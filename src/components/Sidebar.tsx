import { useState, useRef } from 'react';
import type { Note, Theme } from '../types';

interface SidebarProps {
  notes: Note[];
  selectedId: string | null;
  query: string;
  theme: Theme;
  totalCount: number;
  onQueryChange: (q: string) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onToggleTheme: () => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Inline SVG notebook logo icon
function NotebookIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="8" y="2" width="18" height="28" rx="3" fill="var(--nb-accent)"/>
      <rect x="11" y="4" width="13" height="24" rx="2" fill="var(--nb-bg)"/>
      <circle cx="8" cy="9.5" r="2.5" fill="var(--nb-surface)"/>
      <circle cx="8" cy="16"  r="2.5" fill="var(--nb-surface)"/>
      <circle cx="8" cy="22.5" r="2.5" fill="var(--nb-surface)"/>
      <circle cx="8" cy="9.5" r="1.3" fill="var(--nb-accent)"/>
      <circle cx="8" cy="16"  r="1.3" fill="var(--nb-accent)"/>
      <circle cx="8" cy="22.5" r="1.3" fill="var(--nb-accent)"/>
      <line x1="14" y1="10" x2="21" y2="10" stroke="var(--nb-border-hard)" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="14" y1="14" x2="21" y2="14" stroke="var(--nb-border-hard)" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="14" y1="18" x2="21" y2="18" stroke="var(--nb-border-hard)" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="20" cy="22" r="1.3" fill="var(--nb-accent)"/>
    </svg>
  );
}

export default function Sidebar({
  notes,
  selectedId,
  query,
  theme,
  totalCount,
  onQueryChange,
  onSelect,
  onCreate,
  onDelete,
  onExport,
  onImport,
  onToggleTheme,
}: SidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const deleteTimerRef = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleCardDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deleteConfirmId === id) {
      if (deleteTimerRef[0]) clearTimeout(deleteTimerRef[0]);
      deleteTimerRef[1](null);
      setDeleteConfirmId(null);
      onDelete(id);
    } else {
      setDeleteConfirmId(id);
      const t = setTimeout(() => setDeleteConfirmId(null), 3000);
      deleteTimerRef[1](t);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="nb-sidebar-top">
        <div className="nb-logo">
          <div className="nb-logo-left">
            <NotebookIcon />
            <span className="nb-logo-text">notebook.</span>
          </div>
          <button
            className="nb-theme-btn"
            onClick={onToggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
            </button>
        </div>

        {/* Search */}
        <div className="nb-search-wrap">
          <svg className="nb-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            className="nb-search"
            placeholder="Search notes..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-label="Search notes"
          />
        </div>
      </div>

      {/* New Note button */}
      <button className="nb-new-btn" onClick={onCreate} aria-label="Create new note">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        New note
      </button>

      {/* Note count */}
      {totalCount > 0 && (
        <div className="nb-note-count">
          {query
            ? `${notes.length} of ${totalCount} note${totalCount !== 1 ? 's' : ''}`
            : `${totalCount} note${totalCount !== 1 ? 's' : ''}`}
        </div>
      )}

      {/* Notes list */}
      <div className="nb-notes-list" role="list">
        {notes.length === 0 ? (
          <div className="nb-empty-list">
            {query
              ? 'No notes match your search.'
              : 'No notes yet.\nCreate your first note to get started.'}
          </div>
        ) : (
          notes.map((note, i) => (
            <div
              key={note.id}
              role="listitem"
              className={`nb-note-card${selectedId === note.id ? ' active' : ''}${hoveredId === note.id ? ' hovered' : ''}`}
              style={{ animationDelay: `${i * 35}ms`, position: 'relative' }}
              onClick={() => onSelect(note.id)}
              onMouseEnter={() => setHoveredId(note.id)}
              onMouseLeave={() => { setHoveredId(null); }}
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(note.id)}
              aria-selected={selectedId === note.id}
            >
              <div className="nb-note-card-title">
                {note.title || 'Untitled'}
              </div>
              <div className="nb-note-card-preview">
                {note.content || (note.isCode ? '// empty snippet' : 'Empty note...')}
              </div>
              <div className="nb-note-card-meta">
                <span className="nb-note-date">{formatDate(note.updatedAt)}</span>
                {note.isCode && (
                  <span className="nb-code-badge">{note.language}</span>
                )}
              </div>
              {/* Hover delete button */}
              {(hoveredId === note.id || deleteConfirmId === note.id) && (
                <button
                  className={`nb-card-delete-btn${deleteConfirmId === note.id ? ' confirming' : ''}`}
                  onClick={(e) => handleCardDelete(e, note.id)}
                  aria-label={deleteConfirmId === note.id ? 'Confirm delete' : 'Delete note'}
                  title={deleteConfirmId === note.id ? 'Click again to confirm' : 'Delete note'}
                >
                  {deleteConfirmId === note.id ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  )}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <footer className="nb-sidebar-footer">
        <div className="nb-io-btns">
          <button className="nb-io-btn" onClick={onExport} title="Export all notes as JSON">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </button>
          <button className="nb-io-btn" onClick={() => importInputRef.current?.click()} title="Import notes from JSON">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Import
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImport(file);
              e.target.value = '';
            }}
            aria-hidden="true"
          />
        </div>
        <div>
          By{' '}
          <a href="https://github.com/jere-mie" target="_blank" rel="noopener noreferrer">
            Jeremie Bornais
          </a>
        </div>
        <div>
          <a href="https://github.com/jere-mie/notebook" target="_blank" rel="noopener noreferrer">
            Source on GitHub
          </a>
          {' · '}MIT License
        </div>
      </footer>
    </>
  );
}
