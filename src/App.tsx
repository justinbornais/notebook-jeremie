import { useState, useEffect, useCallback } from 'react';
import type { Note, Folder, SidebarItem, Theme } from './types';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';

const NOTES_KEY = 'notebook-notes';
const THEME_KEY = 'notebook-theme';
const SIDEBAR_WIDTH_KEY = 'notebook-sidebar-width';
const FOLDERS_KEY = 'notebook-folders';
// sidebarOrder: ordered list of top-level items (folders + unfolderd notes)
const SIDEBAR_ORDER_KEY = 'notebook-sidebar-order';
// folderContents: map of folderId -> ordered note ids
const FOLDER_CONTENTS_KEY = 'notebook-folder-contents';

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function makeBlankNote(): Note {
  return {
    id: uid(),
    title: '',
    content: '',
    isCode: false,
    language: 'markdown',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

const initialDraft = makeBlankNote();

export default function App() {
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

  // draft: open in editor but not yet in notes[]. Committed on first keystroke.
  const [draft, setDraft] = useState<Note | null>(initialDraft);
  const [selectedId, setSelectedId] = useState<string | null>(initialDraft.id);
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem(THEME_KEY) as Theme) || 'dark';
  });
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('editor');
  const [sidebarVisible, setSidebarVisible] = useState(true);

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

  // Persist sidebar width
  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  const filteredNotes = notes
    .filter((n) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const savedNote = notes.find((n) => n.id === selectedId) ?? null;

  const createNote = (folderId?: string) => {
    const note = makeBlankNote();
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
  };

  const createFolder = (name: string) => {
    const folder: Folder = { id: uid(), name };
    setFolders((prev) => [...prev, folder]);
    setSidebarOrder((prev) => [{ type: 'folder', id: folder.id }, ...prev]);
  };

  const renameFolder = (id: string, name: string) => {
    setFolders((prev) => prev.map((f) => f.id === id ? { ...f, name } : f));
  };

  const deleteFolder = (id: string) => {
    // Move notes inside this folder to root
    const orphaned = folderContents[id] ?? [];
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

  const selectNote = (id: string) => {
    // Discard an unedited draft when navigating to another note
    if (draft && draft.id === selectedId) {
      setDraft(null);
    }
    setSelectedId(id);
    setMobileView('editor');
  };

  // Active note: either the unsaved draft or a persisted note
  const activeNote = (draft && draft.id === selectedId) ? draft : savedNote;

  // Navigate to the previous/next note in the sidebar order
  const navigateNote = useCallback((direction: 'up' | 'down') => {
    const navList = [
      ...(draft ? [draft] : []),
      ...filteredNotes.filter((n) => !draft || n.id !== draft.id),
    ];
    if (navList.length < 2) return;
    const currentIdx = navList.findIndex((n) => n.id === selectedId);
    if (currentIdx === -1) return;
    const nextIdx =
      direction === 'down'
        ? (currentIdx + 1) % navList.length
        : (currentIdx - 1 + navList.length) % navList.length;
    if (nextIdx !== currentIdx) selectNote(navList[nextIdx].id);
  }, [draft, filteredNotes, selectedId, selectNote]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Ctrl+Up / Ctrl+Down for non-Monaco contexts (sidebar, title field, etc.)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!e.ctrlKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    navigateNote(e.key === 'ArrowDown' ? 'down' : 'up');
  }, [navigateNote]);

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
          selectedId={selectedId}
          query={query}
          theme={theme}
          totalCount={notes.length}
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
          note={activeNote}
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
