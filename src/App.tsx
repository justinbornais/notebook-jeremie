import { useState, useEffect, useCallback } from 'react';
import type { Note, Theme } from './types';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';

const NOTES_KEY = 'notebook-notes';
const THEME_KEY = 'notebook-theme';
const SIDEBAR_WIDTH_KEY = 'notebook-sidebar-width';

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
    const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
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
        const imported = JSON.parse(e.target?.result as string) as Note[];
        if (!Array.isArray(imported)) return;
        const valid = imported.filter(
          (n) => typeof n.id === 'string' && typeof n.title === 'string' && typeof n.content === 'string'
        );
        setNotes((prev) => {
          const existing = new Set(prev.map((n) => n.id));
          const incoming = valid.filter((n) => !existing.has(n.id));
          return [...prev, ...incoming];
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

  const createNote = () => {
    const note = makeBlankNote();
    setDraft(note);
    setSelectedId(note.id);
    setMobileView('editor');
  };

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
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
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
          notes={filteredNotes}
          selectedId={selectedId}
          query={query}
          theme={theme}
          totalCount={notes.length}
          onQueryChange={setQuery}
          onSelect={selectNote}
          onCreate={createNote}
          onDelete={deleteNote}
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
