import { useState, useEffect, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import type { Note, Theme } from '../types';
import { LANGUAGES } from '../types';

// Map Prism language IDs used in Note.language → Monaco language IDs
const MONACO_LANG: Record<string, string> = {
  markup: 'html',
  bash: 'shell',
};
function toMonacoLang(lang: string): string {
  return MONACO_LANG[lang] ?? lang;
}

interface EditorProps {
  note: Note | null;
  theme: Theme;
  sidebarVisible: boolean;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  onToggleSidebar: () => void;
}

// Empty state shown when no note is selected
function EmptyState() {
  return (
    <div className="nb-empty-state">
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ opacity: 0.25 }}>
        <rect x="16" y="6" width="40" height="56" rx="6" stroke="currentColor" strokeWidth="2.5"/>
        <rect x="10" y="12" width="40" height="56" rx="6" stroke="currentColor" strokeWidth="2.5"/>
        <rect x="4" y="18" width="40" height="56" rx="6" fill="var(--nb-surface)" stroke="currentColor" strokeWidth="2.5"/>
        <line x1="14" y1="34" x2="34" y2="34" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="14" y1="42" x2="34" y2="42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="14" y1="50" x2="26" y2="50" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
      <h2>Open a note</h2>
      <p>Select a note from the list or create a new one to start writing.</p>
    </div>
  );
}

export default function Editor({ note, theme, sidebarVisible, onUpdate, onDelete, onBack, onToggleSidebar }: EditorProps) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset per-note UI state
  useEffect(() => {
    setDeleteConfirm(false);
    if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
  }, [note?.id]);

  // Auto-focus empty title
  useEffect(() => {
    if (note && !note.title && titleRef.current) {
      titleRef.current.focus();
    }
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!note) return <EmptyState />;

  const handleDelete = () => {
    if (deleteConfirm) {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
      onDelete(note.id);
    } else {
      setDeleteConfirm(true);
      deleteTimeoutRef.current = setTimeout(() => setDeleteConfirm(false), 3000);
    }
  };

  return (
    <>
      {/* Header bar */}
      <div className="nb-editor-header">
        <button className="nb-back-btn" onClick={onBack} aria-label="Back to notes list">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Notes
        </button>

        {/* Sidebar toggle - desktop only */}
        <button
          className="nb-sidebar-toggle-btn"
          onClick={onToggleSidebar}
          title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
          aria-label={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
        >
          {sidebarVisible ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="15" y1="3" x2="15" y2="21"/>
            </svg>
          )}
        </button>

        <div className="nb-editor-actions">
          <button
            className={`nb-delete-btn${deleteConfirm ? ' confirming' : ''}`}
            onClick={handleDelete}
            aria-label={deleteConfirm ? 'Confirm delete' : 'Delete note'}
          >
            {deleteConfirm ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Confirm delete
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
                Delete
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mode toggle toolbar - always visible */}
      <div className="nb-toolbar-row">
        <div className="nb-toolbar">
          <div className="nb-mode-toggle" role="group" aria-label="Note mode">
            <button
              className={`nb-mode-btn${!note.isCode ? ' active' : ''}`}
              onClick={() => onUpdate(note.id, { isCode: false })}
              aria-pressed={!note.isCode}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              Text
            </button>
            <button
              className={`nb-mode-btn${note.isCode ? ' active' : ''}`}
              onClick={() => onUpdate(note.id, { isCode: true })}
              aria-pressed={note.isCode}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
              Code
            </button>
          </div>

          {note.isCode && (
            <select
              className="nb-lang-select"
              value={note.language}
              onChange={(e) => onUpdate(note.id, { language: e.target.value })}
              aria-label="Programming language"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {note.isCode ? (
        /* Code mode: title above Monaco, Monaco fills remaining height */
        <>
          <div className="nb-code-title-row">
            <textarea
              ref={titleRef}
              className="nb-title-input"
              placeholder="Untitled"
              value={note.title}
              rows={1}
              onChange={(e) => onUpdate(note.id, { title: e.target.value })}
              aria-label="Note title"
            />
          </div>
          <div className="nb-monaco-container">
            <MonacoEditor
              height="100%"
              language={toMonacoLang(note.language)}
              value={note.content}
              theme={theme === 'dark' ? 'vs-dark' : 'vs'}
              onChange={(v) => onUpdate(note.id, { content: v ?? '' })}
              options={{
                minimap: { enabled: false },
                fontSize: 13.5,
                fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                fontLigatures: true,
                lineNumbers: 'on',
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                tabSize: 2,
                automaticLayout: true,
                padding: { top: 14, bottom: 14 },
                renderLineHighlight: 'line',
                smoothScrolling: true,
                cursorSmoothCaretAnimation: 'on',
              }}
            />
          </div>
        </>
      ) : (
        /* Text mode: scrollable body with title + textarea */
        <div className="nb-editor-body">
          <textarea
            ref={titleRef}
            className="nb-title-input"
            placeholder="Untitled"
            value={note.title}
            rows={1}
            onChange={(e) => onUpdate(note.id, { title: e.target.value })}
            aria-label="Note title"
          />
          <textarea
            className="nb-text-area"
            placeholder="Start writing..."
            value={note.content}
            onChange={(e) => onUpdate(note.id, { content: e.target.value })}
            aria-label="Note content"
          />
        </div>
      )}
    </>
  );
}
