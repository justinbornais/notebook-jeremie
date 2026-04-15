/**
 * Filesystem storage using the File System Access API.
 *
 * Each notebook is a folder on disk containing:
 *   - notebook.json   – metadata (note list, folders, ordering)
 *   - individual note files (.txt for text, code extension for code notes)
 *   - an "uploads/" sub-directory for uploaded files
 */

import type { Note, Folder, SidebarItem } from './types';

// ── extension helpers ──────────────────────────────────────────────

const LANG_EXT: Record<string, string> = {
  markdown: '.md',
  bash: '.sh',
  c: '.c',
  cpp: '.cpp',
  css: '.css',
  go: '.go',
  markup: '.html',
  java: '.java',
  javascript: '.js',
  json: '.json',
  php: '.php',
  python: '.py',
  ruby: '.rb',
  rust: '.rs',
  sql: '.sql',
  typescript: '.ts',
};

function extForNote(note: Note): string {
  if (!note.isCode) return '.txt';
  return LANG_EXT[note.language] ?? '.txt';
}

/** Turn a title into a safe filename (without extension). */
function sanitize(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 100);
  return cleaned || 'untitled';
}

/** Derive a unique filename for a note within a directory listing. */
function filenameForNote(note: Note, usedNames: Set<string>): string {
  const base = sanitize(note.title || 'untitled');
  const ext = extForNote(note);
  let candidate = `${base}${ext}`;
  let i = 1;
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${base}_${i}${ext}`;
    i++;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

// ── notebook.json schema ───────────────────────────────────────────

export interface NotebookMeta {
  version: number;
  notes: NoteMeta[];
  folders: Folder[];
  sidebarOrder: SidebarItem[];
  folderContents: Record<string, string[]>;
}

interface NoteMeta {
  id: string;
  title: string;
  filename: string;
  isCode: boolean;
  language: string;
  createdAt: number;
  updatedAt: number;
}

// ── IndexedDB handle persistence ───────────────────────────────────

const IDB_NAME = 'notebook-fs';
const IDB_STORE = 'handles';
const IDB_KEY = 'dirHandle';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function persistHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openIDB();
  const tx = db.transaction(IDB_STORE, 'readwrite');
  tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadPersistedHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function clearPersistedHandle(): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(IDB_KEY);
  } catch {
    // ignore
  }
}

// ── verify permission ──────────────────────────────────────────────

export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite',
): Promise<boolean> {
  const h = handle as unknown as {
    queryPermission(opts: { mode: string }): Promise<string>;
    requestPermission(opts: { mode: string }): Promise<string>;
  };
  const opts = { mode };
  if ((await h.queryPermission(opts)) === 'granted') return true;
  if ((await h.requestPermission(opts)) === 'granted') return true;
  return false;
}

// ── pick a directory ───────────────────────────────────────────────

export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await (window as unknown as { showDirectoryPicker: (opts?: object) => Promise<FileSystemDirectoryHandle> })
      .showDirectoryPicker({ mode: 'readwrite' });
    return handle;
  } catch {
    // user cancelled
    return null;
  }
}

// ── write a notebook to disk ───────────────────────────────────────

export async function saveNotebook(
  dirHandle: FileSystemDirectoryHandle,
  notes: Note[],
  folders: Folder[],
  sidebarOrder: SidebarItem[],
  folderContents: Record<string, string[]>,
): Promise<void> {
  if (!(await verifyPermission(dirHandle))) {
    throw new Error('Permission denied');
  }

  const usedNames = new Set<string>();
  // Always reserve the config filename
  usedNames.add('notebook.json');
  usedNames.add('uploads');

  const noteMetas: NoteMeta[] = [];

  for (const note of notes) {
    const filename = filenameForNote(note, usedNames);
    noteMetas.push({
      id: note.id,
      title: note.title,
      filename,
      isCode: note.isCode,
      language: note.language,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    });

    // Write note content file
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(note.content);
    await writable.close();
  }

  // Write notebook.json (metadata)
  const meta: NotebookMeta = {
    version: 1,
    notes: noteMetas,
    folders,
    sidebarOrder,
    folderContents,
  };

  const configHandle = await dirHandle.getFileHandle('notebook.json', { create: true });
  const configWritable = await configHandle.createWritable();
  await configWritable.write(JSON.stringify(meta, null, 2));
  await configWritable.close();
}

// ── read a notebook from disk ──────────────────────────────────────

export interface LoadedNotebook {
  notes: Note[];
  folders: Folder[];
  sidebarOrder: SidebarItem[];
  folderContents: Record<string, string[]>;
}

export async function loadNotebook(
  dirHandle: FileSystemDirectoryHandle,
): Promise<LoadedNotebook> {
  if (!(await verifyPermission(dirHandle, 'readwrite'))) {
    throw new Error('Permission denied');
  }

  let meta: NotebookMeta;
  try {
    const configHandle = await dirHandle.getFileHandle('notebook.json');
    const file = await configHandle.getFile();
    meta = JSON.parse(await file.text()) as NotebookMeta;
  } catch {
    // No notebook.json — scan files and create notes from them
    return await loadLooseFiles(dirHandle);
  }

  const notes: Note[] = [];
  for (const nm of meta.notes) {
    let content = '';
    try {
      const fh = await dirHandle.getFileHandle(nm.filename);
      const file = await fh.getFile();
      content = await file.text();
    } catch {
      // file missing — keep empty content
    }
    notes.push({
      id: nm.id,
      title: nm.title,
      content,
      isCode: nm.isCode,
      language: nm.language,
      createdAt: nm.createdAt,
      updatedAt: nm.updatedAt,
    });
  }

  return {
    notes,
    folders: meta.folders ?? [],
    sidebarOrder: meta.sidebarOrder ?? [],
    folderContents: meta.folderContents ?? {},
  };
}

/** Load any folder that doesn't have notebook.json — treat each file as a note. */
async function loadLooseFiles(
  dirHandle: FileSystemDirectoryHandle,
): Promise<LoadedNotebook> {
  const notes: Note[] = [];
  const sidebarOrder: SidebarItem[] = [];

  const EXT_LANG: Record<string, string> = {};
  for (const [lang, ext] of Object.entries(LANG_EXT)) {
    EXT_LANG[ext] = lang;
  }

  const iterableHandle = dirHandle as unknown as {
    values(): AsyncIterable<FileSystemFileHandle | FileSystemDirectoryHandle>;
  };

  for await (const entry of iterableHandle.values()) {
    if (entry.kind !== 'file') continue;
    const name = entry.name;
    const dot = name.lastIndexOf('.');
    const ext = dot >= 0 ? name.slice(dot).toLowerCase() : '';
    const baseName = dot >= 0 ? name.slice(0, dot) : name;
    const lang = EXT_LANG[ext];
    const isCode = !!lang && lang !== 'markdown';

    const file = await (entry as FileSystemFileHandle).getFile();
    const content = await file.text();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
    notes.push({
      id,
      title: baseName,
      content,
      isCode: ext === '.txt' ? false : isCode,
      language: lang ?? 'markdown',
      createdAt: file.lastModified,
      updatedAt: file.lastModified,
    });
    sidebarOrder.push({ type: 'note', id });
  }

  return { notes, folders: [], sidebarOrder, folderContents: {} };
}

// ── save uploaded file ─────────────────────────────────────────────

export async function saveUploadedFile(
  dirHandle: FileSystemDirectoryHandle,
  file: File,
): Promise<void> {
  if (!(await verifyPermission(dirHandle))) return;

  // Save uploads in an "uploads" subdirectory
  const uploadsDir = await dirHandle.getDirectoryHandle('uploads', { create: true });
  const fileHandle = await uploadsDir.getFileHandle(file.name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(file);
  await writable.close();
}

// ── check API support ──────────────────────────────────────────────

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}
