import { useState, useEffect, useCallback } from 'react';
import { LANGUAGES, type Note, type Folder, type SidebarItem, type Theme } from './types';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';

const NOTES_KEY = 'notebook-notes';
const THEME_KEY = 'notebook-theme';
const SIDEBAR_WIDTH_KEY = 'notebook-sidebar-width';
const FOLDERS_KEY = 'notebook-folders';
const NOTE_MODE_KEY = 'notebook-note-mode';
const NOTE_LANGUAGE_KEY = 'notebook-note-language';
const OPEN_FOLDERS_KEY = 'notebook-open-folders';
// sidebarOrder: ordered list of top-level items (folders + unfolderd notes)
const SIDEBAR_ORDER_KEY = 'notebook-sidebar-order';
// folderContents: map of folderId -> ordered note ids
const FOLDER_CONTENTS_KEY = 'notebook-folder-contents';

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function readPreferredIsCode(): boolean {
  try {
    return localStorage.getItem(NOTE_MODE_KEY) === 'code';
  } catch {
    return false;
  }
}

function isValidLanguage(language: string): boolean {
  return LANGUAGES.some((entry) => entry.value === language);
}

function readPreferredLanguage(): string {
  try {
    const language = localStorage.getItem(NOTE_LANGUAGE_KEY);
    return language && isValidLanguage(language) ? language : 'markdown';
  } catch {
    return 'markdown';
  }
}

function isMacOS(): boolean {
  if (typeof navigator === 'undefined') return false;

  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform;
  return /mac/i.test(platform);
}

function makeBlankNote(isCode = false, language = 'markdown'): Note {
  return {
    id: uid(),
    title: '',
    content: '',
    isCode,
    language,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

const initialDraft = makeBlankNote(readPreferredIsCode(), readPreferredLanguage());

export default function App() {
  const macOS = isMacOS();
  const newNoteShortcutLabel = macOS ? 'Cmd+Enter' : 'Ctrl+Enter';
  const [preferredIsCode, setPreferredIsCode] = useState(readPreferredIsCode);
  const [preferredLanguage, setPreferredLanguage] = useState(readPreferredLanguage);
  const [notes, setNotes] = useState<Note[]>(() => {
    try {
      const saved = localStorage.getItem(NOTES_KEY);
      return saved ? (JSON.parse(saved) as Note[]) : [];
    } catch {
      return [];
    }
  });

  const [folders, setFolders] = useState<Folder[]>(() => {
    try {
      const saved = localStorage.getItem(FOLDERS_KEY);
      return saved ? (JSON.parse(saved) as Folder[]) : [];
    } catch { return []; }
  });

  // Top-level sidebar ordering (folders + root notes, no folder-children here)
  const [sidebarOrder, setSidebarOrder] = useState<SidebarItem[]>(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_ORDER_KEY);
      return saved ? (JSON.parse(saved) as SidebarItem[]) : [];
    } catch { return []; }
  });

  // Per-folder note order: { [folderId]: noteId[] }
  const [folderContents, setFolderContents] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem(FOLDER_CONTENTS_KEY);
      return saved ? (JSON.parse(saved) as Record<string, string[]>) : {};
    } catch { return {}; }
  });

  const [openFolders, setOpenFolders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(OPEN_FOLDERS_KEY);
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });

  // draft: open in editor but not yet in notes[]. Committed on first keystroke.
  const [draft, setDraft] = useState<Note | null>(initialDraft);
  const [selectedId, setSelectedId] = useState<string | null>(initialDraft.id);
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem(THEME_KEY) as Theme) || 'dark';
  });
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('editor');
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [searchFocusKey, setSearchFocusKey] = useState(0);
  const [editorFocusKey, setEditorFocusKey] = useState(0);

  const handleExport = () => {
    const payload = { notes, folders, folderContents };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notebook-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        // Support both plain array (legacy) and { notes, folders, folderContents } object
        const importedNotes: Note[] = Array.isArray(data) ? data : (data.notes ?? []);
        const importedFolders: Folder[] = Array.isArray(data) ? [] : (data.folders ?? []);
        const importedFolderContents: Record<string, string[]> = Array.isArray(data) ? {} : (data.folderContents ?? {});
        const validNotes = importedNotes.filter(
          (n) => typeof n.id === 'string' && typeof n.title === 'string' && typeof n.content === 'string'
        );
        setNotes((prev) => {
          const existing = new Set(prev.map((n) => n.id));
          const incoming = validNotes.filter((n) => !existing.has(n.id));
          return [...prev, ...incoming];
        });
        setFolders((prev) => {
          const existing = new Set(prev.map((f) => f.id));
          const incoming = importedFolders.filter((f) => typeof f.id === 'string' && !existing.has(f.id));
          return [...prev, ...incoming];
        });
        setFolderContents((prev) => {
          const next = { ...prev };
          for (const [fid, nids] of Object.entries(importedFolderContents)) {
            if (Array.isArray(nids)) {
              const existingInFolder = new Set(next[fid] ?? []);
              next[fid] = [...(next[fid] ?? []), ...nids.filter((id) => !existingInFolder.has(id))];
            }
          }
          return next;
        });
      } catch {
        // ignore malformed files
      }
    };
    reader.readAsText(file);
  };
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : 290;
  });

  // Apply theme class + persist
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Persist notes (does NOT include unsaved drafts)
  useEffect(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }, [notes]);

  // Persist folder data
  useEffect(() => { localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders)); }, [folders]);
  useEffect(() => { localStorage.setItem(SIDEBAR_ORDER_KEY, JSON.stringify(sidebarOrder)); }, [sidebarOrder]);
  useEffect(() => { localStorage.setItem(FOLDER_CONTENTS_KEY, JSON.stringify(folderContents)); }, [folderContents]);
  useEffect(() => { localStorage.setItem(NOTE_MODE_KEY, preferredIsCode ? 'code' : 'text'); }, [preferredIsCode]);
  useEffect(() => { localStorage.setItem(NOTE_LANGUAGE_KEY, preferredLanguage); }, [preferredLanguage]);
  useEffect(() => { localStorage.setItem(OPEN_FOLDERS_KEY, JSON.stringify(openFolders)); }, [openFolders]);

  // Persist sidebar width
  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  const savedNote = notes.find((n) => n.id === selectedId) ?? null;

  const createNote = useCallback((folderId?: string) => {
    const note = makeBlankNote(preferredIsCode, preferredLanguage);
    setDraft(note);
    setSelectedId(note.id);
    setMobileView('editor');
    if (folderId) {
      // Add to folder contents
      setFolderContents((prev) => ({
        ...prev,
        [folderId]: [note.id, ...(prev[folderId] ?? [])],
      }));
    } else {
      // Add as root-level item at the top
      setSidebarOrder((prev) => [{ type: 'note', id: note.id }, ...prev]);
    }
  }, [preferredIsCode, preferredLanguage]);

  const focusSearch = useCallback(() => {
    setSidebarVisible(true);
    setMobileView('list');
    setSearchFocusKey((key) => key + 1);
  }, []);

  const createFolder = (name: string): string => {
    const folder: Folder = { id: uid(), name };
    setFolders((prev) => [...prev, folder]);
    setSidebarOrder((prev) => [{ type: 'folder', id: folder.id }, ...prev]);
    return folder.id;
  };

  const renameFolder = (id: string, name: string) => {
    setFolders((prev) => prev.map((f) => f.id === id ? { ...f, name } : f));
  };

  const deleteFolder = (id: string) => {
    // Move notes inside this folder to root
    const orphaned = folderContents[id] ?? [];
    setOpenFolders((prev) => prev.filter((folderId) => folderId !== id));
    setFolderContents((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSidebarOrder((prev) => {
      const filtered = prev.filter((item) => !(item.type === 'folder' && item.id === id));
      const rootNotes: SidebarItem[] = orphaned.map((nid) => ({ type: 'note', id: nid }));
      return [...rootNotes, ...filtered];
    });
    setFolders((prev) => prev.filter((f) => f.id !== id));
  };

  const moveNoteToFolder = (noteId: string, targetFolderId: string | null, insertAt?: number) => {
    // Remove from any existing folder
    setFolderContents((prev) => {
      const next: Record<string, string[]> = {};
      for (const [fid, nids] of Object.entries(prev)) {
        next[fid] = nids.filter((n) => n !== noteId);
      }
      if (targetFolderId) {
        next[targetFolderId] = [noteId, ...(next[targetFolderId] ?? [])];
      }
      return next;
    });
    // Remove from / add to sidebarOrder accordingly
    setSidebarOrder((prev) => {
      const without = prev.filter((item) => !(item.type === 'note' && item.id === noteId));
      if (!targetFolderId) {
        const idx = insertAt !== undefined ? Math.min(insertAt, without.length) : 0;
        const result = [...without];
        result.splice(idx, 0, { type: 'note' as const, id: noteId });
        return result;
      }
      return without;
    });
  };

  // Reconcile sidebarOrder: add any notes/folders missing from it, drop deleted ones
  const reconciledOrder = (() => {
    const allFolderIds = new Set(folders.map((f) => f.id));
    const noteIdsInFolders = new Set(
      Object.values(folderContents).flat()
    );
    const allNoteIds = new Set([
      ...(draft ? [draft.id] : []),
      ...notes.map((n) => n.id),
    ]);
    // Root notes: notes not in any folder
    const rootNoteIds = new Set(
      [...allNoteIds].filter((id) => !noteIdsInFolders.has(id))
    );
    // Build cleaned order: keep valid items, then append any new ones
    const seen = new Set<string>();
    const cleaned: SidebarItem[] = [];
    for (const item of sidebarOrder) {
      if (item.type === 'folder' && allFolderIds.has(item.id) && !seen.has(item.id)) {
        cleaned.push(item);
        seen.add(item.id);
      } else if (item.type === 'note' && rootNoteIds.has(item.id) && !seen.has(item.id)) {
        cleaned.push(item);
        seen.add(item.id);
      }
    }
    // Append unseen root notes (newly created draft not yet in order)
    for (const id of rootNoteIds) {
      if (!seen.has(id)) cleaned.unshift({ type: 'note', id });
    }
    // Append unseen folders
    for (const id of allFolderIds) {
      if (!seen.has(id)) cleaned.push({ type: 'folder', id });
    }
    return cleaned;
  })();

  // When the user types, commit the draft to notes[] then handle normally
  const updateNote = (id: string, updates: Partial<Note>) => {
    if (typeof updates.isCode === 'boolean') {
      setPreferredIsCode(updates.isCode);
    }
    if (typeof updates.language === 'string' && isValidLanguage(updates.language)) {
      setPreferredLanguage(updates.language);
    }

    if (draft && draft.id === id) {
      const committed = { ...draft, ...updates, updatedAt: Date.now() };
      setNotes((prev) => [committed, ...prev]);
      setDraft(null);
      return;
    }
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n
      )
    );
  };

  const deleteNote = (id: string) => {
    if (draft && draft.id === id) {
      setDraft(null);
      setSelectedId(null);
      setMobileView('list');
      // Also remove from sidebarOrder if it was there
      setSidebarOrder((prev) => prev.filter((item) => !(item.type === 'note' && item.id === id)));
      setFolderContents((prev) => {
        const next: Record<string, string[]> = {};
        for (const [fid, nids] of Object.entries(prev)) next[fid] = nids.filter((n) => n !== id);
        return next;
      });
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setSidebarOrder((prev) => prev.filter((item) => !(item.type === 'note' && item.id === id)));
    setFolderContents((prev) => {
      const next: Record<string, string[]> = {};
      for (const [fid, nids] of Object.entries(prev)) next[fid] = nids.filter((n) => n !== id);
      return next;
    });
    if (selectedId === id) {
      setSelectedId(null);
      setMobileView('list');
    }
  };

  const selectNote = useCallback((id: string) => {
    if (id === selectedId) {
      setMobileView('editor');
      return;
    }

    // Discard an unedited draft when navigating to another note
    if (draft && draft.id === selectedId) {
      setDraft(null);
    }
    setSelectedId(id);
    setMobileView('editor');
  }, [draft, selectedId]);

  const openNoteFromSearch = useCallback((id: string) => {
    selectNote(id);
    setEditorFocusKey((key) => key + 1);
  }, [selectNote]);

  // Active note: either the unsaved draft or a persisted note
  const activeNote = (draft && draft.id === selectedId) ? draft : savedNote;

  const visibleSidebarNoteIds = (() => {
    const q = query.trim().toLowerCase();
    const folderIsOpen = new Set(openFolders);
    const allNotes = new Map<string, Note>();

    if (draft) allNotes.set(draft.id, draft);
    for (const note of notes) allNotes.set(note.id, note);

    const matchesQuery = (note: Note) => {
      if (!q) return true;
      return note.title.toLowerCase().includes(q) || note.content.toLowerCase().includes(q);
    };

    const orderedNoteIds: string[] = [];

    for (const item of reconciledOrder) {
      if (item.type === 'note') {
        const note = allNotes.get(item.id);
        if (note && matchesQuery(note)) orderedNoteIds.push(note.id);
        continue;
      }

      const folderNoteIds = folderContents[item.id] ?? [];
      if (!folderIsOpen.has(item.id) && !q) continue;

      for (const noteId of folderNoteIds) {
        const note = allNotes.get(noteId);
        if (note && matchesQuery(note)) orderedNoteIds.push(note.id);
      }
    }

    return orderedNoteIds;
  })();

  // Navigate to the previous/next note in the sidebar order
  const navigateNote = useCallback((direction: 'up' | 'down') => {
    if (visibleSidebarNoteIds.length === 0) return;

    const currentIdx = selectedId ? visibleSidebarNoteIds.indexOf(selectedId) : -1;
    if (currentIdx === -1) {
      selectNote(direction === 'down' ? visibleSidebarNoteIds[0] : visibleSidebarNoteIds[visibleSidebarNoteIds.length - 1]);
      return;
    }
    if (visibleSidebarNoteIds.length < 2) return;

    const nextIdx =
      direction === 'down'
        ? (currentIdx + 1) % visibleSidebarNoteIds.length
        : (currentIdx - 1 + visibleSidebarNoteIds.length) % visibleSidebarNoteIds.length;
    if (nextIdx !== currentIdx) selectNote(visibleSidebarNoteIds[nextIdx]);
  }, [selectNote, selectedId, visibleSidebarNoteIds]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      const next = Math.min(520, Math.max(160, startWidth + ev.clientX - startX));
      setSidebarWidth(next);
    };

    const onMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Global shortcuts for quick-open, new note, sidebar toggle, and note navigation.
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.isComposing) return;

    const hasPrimaryModifier = e.ctrlKey || e.metaKey;
    if (!hasPrimaryModifier) return;

    if (e.code === 'KeyP') {
      if (e.altKey || e.shiftKey) return;
      e.preventDefault();
      focusSearch();
      return;
    }

    if (e.key === 'Enter') {
      if (e.altKey || e.shiftKey) return;
      e.preventDefault();
      createNote();
      return;
    }

    if (e.code === 'KeyB') {
      if (e.altKey || e.shiftKey) return;
      e.preventDefault();
      setSidebarVisible((visible) => !visible);
      return;
    }

    if (e.altKey) return;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    navigateNote(e.key === 'ArrowDown' ? 'down' : 'up');
  }, [createNote, focusSearch, navigateNote]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className={`nb-shell${sidebarVisible ? '' : ' nb-sidebar-collapsed'}`}>
      <aside
        className={`nb-sidebar${mobileView === 'editor' ? ' nb-mobile-hide' : ''}`}
        style={{ '--nb-sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
      >
        <Sidebar
          notes={notes}
          draft={draft}
          folders={folders}
          sidebarOrder={reconciledOrder}
          folderContents={folderContents}
          openFolders={openFolders}
          searchFocusKey={searchFocusKey}
          onOpenFromSearch={openNoteFromSearch}
          selectedId={selectedId}
          query={query}
          theme={theme}
          totalCount={notes.length}
          newNoteShortcutHint={newNoteShortcutLabel}
          onQueryChange={setQuery}
          onSelect={selectNote}
          onCreate={createNote}
          onDelete={deleteNote}
          onCreateFolder={createFolder}
          onRenameFolder={renameFolder}
          onDeleteFolder={deleteFolder}
          onMoveNoteToFolder={moveNoteToFolder}
          onReorderSidebar={setSidebarOrder}
          onReorderFolder={(folderId, newOrder) =>
            setFolderContents((prev) => ({ ...prev, [folderId]: newOrder }))
          }
          onOpenFoldersChange={setOpenFolders}
          onExport={handleExport}
          onImport={handleImport}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        />
      </aside>
      {sidebarVisible && (
        <div className="nb-resize-handle" onMouseDown={handleResizeStart} aria-hidden="true" />
      )}
      <main
        className={`nb-editor${mobileView === 'list' ? ' nb-mobile-hide' : ''}`}
      >
        <Editor
          key={activeNote?.id ?? 'empty'}
          note={activeNote}
          focusRequestKey={editorFocusKey}
          theme={theme}
          sidebarVisible={sidebarVisible}
          onUpdate={updateNote}
          onDelete={deleteNote}
          onBack={() => setMobileView('list')}
          onToggleSidebar={() => setSidebarVisible((v) => !v)}
          onNavNote={navigateNote}
        />
      </main>
    </div>
  );
}
