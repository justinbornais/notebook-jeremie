import { useState, useEffect } from 'react';
import type { Note, Theme } from './types';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';

const NOTES_KEY = 'notebook-notes';
const THEME_KEY = 'notebook-theme';

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

  // Apply theme class + persist
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Persist notes (does NOT include unsaved drafts)
  useEffect(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }, [notes]);

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

  return (
    <div className={`nb-shell${sidebarVisible ? '' : ' nb-sidebar-collapsed'}`}>
      <aside
        className={`nb-sidebar${mobileView === 'editor' ? ' nb-mobile-hide' : ''}`}
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
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        />
      </aside>
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
        />
      </main>
    </div>
  );
}
