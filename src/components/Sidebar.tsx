import { useState, useRef, Fragment, useEffect } from 'react';
import type { Note, Folder, SidebarItem, Theme } from '../types';

interface SidebarProps {
  notes: Note[];
  draft: Note | null;
  folders: Folder[];
  sidebarOrder: SidebarItem[];
  folderContents: Record<string, string[]>;
  openFolders: string[];
  searchFocusKey: number;
  onOpenFromSearch: (id: string) => void;
  selectedId: string | null;
  query: string;
  theme: Theme;
  totalCount: number;
  newNoteShortcutHint: string;
  onQueryChange: (q: string) => void;
  onSelect: (id: string) => void;
  onCreate: (folderId?: string) => void;
  onDelete: (id: string) => void;
  onCreateFolder: (name: string) => string;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveNoteToFolder: (noteId: string, folderId: string | null, insertAt?: number) => void;
  onReorderSidebar: (order: SidebarItem[]) => void;
  onReorderFolder: (folderId: string, noteIds: string[]) => void;
  onOpenFoldersChange: (folderIds: string[]) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onToggleTheme: () => void;
  // Filesystem storage props
  fsSupported: boolean;
  folderPath: string | null;
  fsSaving: boolean;
  onSaveToFolder: () => void;
  onLoadFromFolder: () => void;
  onDisconnectFolder: () => void;
  onUploadFile: (file: File) => void;
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

type DragSource =
  | { kind: 'root-item'; index: number }
  | { kind: 'folder-note'; folderId: string; index: number };

type DropTarget =
  | { kind: 'root'; index: number }
  | { kind: 'into-folder'; folderId: string; index: number };

export default function Sidebar({
  notes,
  draft,
  folders,
  sidebarOrder,
  folderContents,
  openFolders,
  searchFocusKey,
  onOpenFromSearch,
  selectedId,
  query,
  theme,
  totalCount,
  newNoteShortcutHint,
  onQueryChange,
  onSelect,
  onCreate,
  onDelete,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveNoteToFolder,
  onReorderSidebar,
  onReorderFolder,
  onOpenFoldersChange,
  onExport,
  onImport,
  onToggleTheme,
  fsSupported,
  folderPath,
  fsSaving,
  onSaveToFolder,
  onLoadFromFolder,
  onDisconnectFolder,
  onUploadFile,
}: SidebarProps) {
  const importInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const noteCardRefs = useRef(new Map<string, HTMLDivElement>());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [deleteFolderConfirmId, setDeleteFolderConfirmId] = useState<string | null>(null);
  const deleteFolderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragSource, setDragSource] = useState<DragSource | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const openFolderSet = new Set(openFolders);

  const updateOpenFolders = (updater: (previous: Set<string>) => Set<string>) => {
    const next = updater(new Set(openFolders));
    onOpenFoldersChange([...next]);
  };

  // Build full note map including draft
  const allNotes = new Map<string, Note>();
  if (draft) allNotes.set(draft.id, draft);
  for (const n of notes) allNotes.set(n.id, n);

  const q = query.trim().toLowerCase();
  const matchesQuery = (note: Note) => {
    if (!q) return true;
    return note.title.toLowerCase().includes(q) || note.content.toLowerCase().includes(q);
  };

  const orderedMatchingNoteIds = sidebarOrder.flatMap((item) => {
    if (item.type === 'note') {
      const note = allNotes.get(item.id);
      return note && matchesQuery(note) ? [note.id] : [];
    }

    return (folderContents[item.id] ?? []).filter((noteId) => {
      const note = allNotes.get(noteId);
      return !!note && matchesQuery(note);
    });
  });

  useEffect(() => {
    if (searchFocusKey === 0) return;
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [searchFocusKey]);

  useEffect(() => {
    if (!selectedId) return;
    const selectedCard = noteCardRefs.current.get(selectedId);
    if (!selectedCard) return;
    selectedCard.scrollIntoView({ block: 'nearest' });
  }, [selectedId, openFolders, query, sidebarOrder, folderContents]);

  const handleCardDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deleteConfirmId === id) {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
      setDeleteConfirmId(null);
      onDelete(id);
    } else {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      setDeleteConfirmId(id);
      deleteTimerRef.current = setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  };

  const handleFolderDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deleteFolderConfirmId === id) {
      if (deleteFolderTimerRef.current) clearTimeout(deleteFolderTimerRef.current);
      deleteFolderTimerRef.current = null;
      setDeleteFolderConfirmId(null);
      onDeleteFolder(id);
    } else {
      if (deleteFolderTimerRef.current) clearTimeout(deleteFolderTimerRef.current);
      setDeleteFolderConfirmId(id);
      deleteFolderTimerRef.current = setTimeout(() => setDeleteFolderConfirmId(null), 3000);
    }
  };

  const handleDragStart = (e: React.DragEvent, source: DragSource) => {
    e.dataTransfer.effectAllowed = 'move';
    setDragSource(source);
  };

  const handleDragEnd = () => {
    setDragSource(null);
    setDropTarget(null);
  };

  const handleRootDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ kind: 'root', index });
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: string, index: number) => {
    // Don't allow dropping folders into folders
    if (dragSource?.kind === 'root-item' && sidebarOrder[dragSource.index]?.type === 'folder') return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ kind: 'into-folder', folderId, index });
  };

  const handleRootDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (!dragSource) return;

    if (dragSource.kind === 'root-item') {
      const newOrder = [...sidebarOrder];
      const [moved] = newOrder.splice(dragSource.index, 1);
      const insertAt = dropIndex > dragSource.index ? dropIndex - 1 : dropIndex;
      newOrder.splice(Math.max(0, insertAt), 0, moved);
      onReorderSidebar(newOrder);
    } else if (dragSource.kind === 'folder-note') {
      const noteId = (folderContents[dragSource.folderId] ?? [])[dragSource.index];
      if (noteId) onMoveNoteToFolder(noteId, null, dropIndex);
    }

    setDragSource(null);
    setDropTarget(null);
  };

  const handleFolderDrop = (e: React.DragEvent, folderId: string, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragSource) return;

    if (dragSource.kind === 'root-item') {
      const item = sidebarOrder[dragSource.index];
      if (item?.type === 'note') {
        onMoveNoteToFolder(item.id, folderId);
        updateOpenFolders((prev) => new Set([...prev, folderId]));
      }
    } else if (dragSource.kind === 'folder-note') {
      const srcFolderId = dragSource.folderId;
      const noteId = (folderContents[srcFolderId] ?? [])[dragSource.index];
      if (!noteId) return;

      if (srcFolderId === folderId) {
        const contents = [...(folderContents[folderId] ?? [])];
        contents.splice(dragSource.index, 1);
        const insertAt = dropIndex > dragSource.index ? dropIndex - 1 : dropIndex;
        contents.splice(Math.max(0, insertAt), 0, noteId);
        onReorderFolder(folderId, contents);
      } else {
        onMoveNoteToFolder(noteId, folderId);
        updateOpenFolders((prev) => new Set([...prev, folderId]));
      }
    }

    setDragSource(null);
    setDropTarget(null);
  };

  const renderNoteCard = (
    noteId: string,
    dragSrc: DragSource,
    onDragOverCard: (e: React.DragEvent) => void,
    onDropCard: (e: React.DragEvent) => void,
    indent = false,
  ) => {
    const note = allNotes.get(noteId);
    if (!note || !matchesQuery(note)) return null;
    const isActive = selectedId === note.id;
    const isConfirm = deleteConfirmId === note.id;
    return (
      <div
        ref={(element) => {
          if (element) noteCardRefs.current.set(note.id, element);
          else noteCardRefs.current.delete(note.id);
        }}
        draggable
        onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, dragSrc); }}
        onDragEnd={handleDragEnd}
        onDragOver={onDragOverCard}
        onDrop={onDropCard}
        role="listitem"
        className={[
          'nb-note-card',
          isActive ? 'active' : '',
          indent ? 'nb-note-card--indented' : '',
        ].filter(Boolean).join(' ')}
        style={{ position: 'relative' }}
        onClick={() => onSelect(note.id)}
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(note.id)}
        aria-selected={isActive}
      >
        <div className="nb-note-card-drag-handle" aria-hidden="true">
          <svg width="10" height="14" viewBox="0 0 10 14" fill="none" aria-hidden="true">
            <circle cx="3" cy="2.5" r="1.2" fill="currentColor"/>
            <circle cx="7" cy="2.5" r="1.2" fill="currentColor"/>
            <circle cx="3" cy="7" r="1.2" fill="currentColor"/>
            <circle cx="7" cy="7" r="1.2" fill="currentColor"/>
            <circle cx="3" cy="11.5" r="1.2" fill="currentColor"/>
            <circle cx="7" cy="11.5" r="1.2" fill="currentColor"/>
          </svg>
        </div>
        <div className="nb-note-card-title">{note.title || 'Untitled'}</div>
        <div className="nb-note-card-preview">
          {note.content || (note.isCode ? '// empty snippet' : 'Empty note...')}
        </div>
        <div className="nb-note-card-meta">
          <span className="nb-note-date">{formatDate(note.updatedAt)}</span>
          {note.isCode && <span className="nb-code-badge">{note.language}</span>}
        </div>
        <button
          className={`nb-card-delete-btn${isConfirm ? ' confirming' : ''}`}
          onClick={(e) => handleCardDelete(e, note.id)}
          aria-label={isConfirm ? 'Confirm delete' : 'Delete note'}
          title={isConfirm ? 'Click again to confirm' : 'Delete note'}
        >
          {isConfirm ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          )}
        </button>
      </div>
    );
  };

  const filteredCount = [...allNotes.values()].filter(matchesQuery).length;

  return (
    <>
      {/* Header */}
      <div className="nb-sidebar-top">
        <div className="nb-logo">
          <div className="nb-logo-left">
            <NotebookIcon />
            <span className="nb-logo-text">notebook</span>
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
            ref={searchInputRef}
            type="search"
            className="nb-search"
            placeholder="Search notes..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || !q) return;
              const firstMatchId = orderedMatchingNoteIds[0];
              if (!firstMatchId) return;
              e.preventDefault();
              onOpenFromSearch(firstMatchId);
            }}
            aria-label="Search notes"
          />
        </div>
      </div>

      {/* New Note + New Folder buttons */}
      <div className="nb-sidebar-actions">
        <button
          className="nb-new-btn"
          onClick={() => onCreate()}
          aria-label={`Create new note. Shortcut: ${newNoteShortcutHint}`}
          title={`Create new note (${newNoteShortcutHint})`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New note
        </button>
        <button
          className="nb-new-folder-btn"
          onClick={() => { setAddingFolder(true); setNewFolderName(''); }}
          aria-label="Create new folder"
          title="New folder"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            <line x1="12" y1="11" x2="12" y2="17"/>
            <line x1="9" y1="14" x2="15" y2="14"/>
          </svg>
        </button>
      </div>

      {/* Inline new-folder name input */}
      {addingFolder && (
        <div className="nb-folder-name-input-wrap">
          <input
            autoFocus
            type="text"
            className="nb-folder-name-input"
            placeholder="Folder name…"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newFolderName.trim()) {
                const id = onCreateFolder(newFolderName.trim());
                updateOpenFolders((prev) => new Set([...prev, id]));
                setAddingFolder(false);
              } else if (e.key === 'Escape') {
                setAddingFolder(false);
              }
            }}
            onBlur={() => {
              if (newFolderName.trim()) {
                const id = onCreateFolder(newFolderName.trim());
                updateOpenFolders((prev) => new Set([...prev, id]));
              }
              setAddingFolder(false);
            }}
            aria-label="New folder name"
          />
        </div>
      )}

      {/* Note count */}
      {totalCount > 0 && (
        <div className="nb-note-count">
          {q
            ? `${filteredCount} of ${totalCount} note${totalCount !== 1 ? 's' : ''}`
            : `${totalCount} note${totalCount !== 1 ? 's' : ''}`}
        </div>
      )}

      {/* Notes + Folders list */}
      <div className="nb-notes-list" role="list">
        {sidebarOrder.length === 0 && !addingFolder ? (
          <div className="nb-empty-list">
            {q ? 'No notes match your search.' : 'No notes yet.\nCreate your first note to get started.'}
          </div>
        ) : (
          <>
            {sidebarOrder.map((item, rootIndex) => {
              const rootDropLine = (
                <div
                  className={`nb-root-drop-zone${dragSource && dropTarget?.kind === 'root' && dropTarget.index === rootIndex ? ' active' : ''}`}
                  onDragOver={(e) => handleRootDragOver(e, rootIndex)}
                  onDrop={(e) => handleRootDrop(e, rootIndex)}
                />
              );

              if (item.type === 'note') {
                const card = renderNoteCard(
                  item.id,
                  { kind: 'root-item', index: rootIndex },
                  (e) => {
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    handleRootDragOver(e, e.clientY < r.top + r.height / 2 ? rootIndex : rootIndex + 1);
                  },
                  (e) => {
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    handleRootDrop(e, e.clientY < r.top + r.height / 2 ? rootIndex : rootIndex + 1);
                  },
                );
                if (!card) return null;
                return (
                  <Fragment key={item.id}>
                    {rootDropLine}
                    {card}
                  </Fragment>
                );
              }

              // Folder
              const folder = folders.find((f) => f.id === item.id);
              if (!folder) return null;
              const isFolderOpen = openFolderSet.has(folder.id);
              const isOpen = isFolderOpen || !!q;
              const folderNoteIds = folderContents[folder.id] ?? [];
              const visibleCount = folderNoteIds.filter((nid) => {
                const n = allNotes.get(nid);
                return n && matchesQuery(n);
              }).length;
              if (q && visibleCount === 0) return null;
              const isConfirmDelete = deleteFolderConfirmId === folder.id;
              const isRenaming = renamingFolderId === folder.id;
              const droppingIntoThis = dragSource && dropTarget?.kind === 'into-folder' && dropTarget.folderId === folder.id;

              return (
                <Fragment key={folder.id}>
                  {rootDropLine}
                  <div
                    className={['nb-folder', droppingIntoThis ? 'nb-folder--drop-into' : ''].filter(Boolean).join(' ')}
                    draggable={!isRenaming}
                    onDragStart={(e) => handleDragStart(e, { kind: 'root-item', index: rootIndex })}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => {
                      if (
                        dragSource?.kind === 'folder-note' ||
                        (dragSource?.kind === 'root-item' && sidebarOrder[dragSource.index]?.type === 'note')
                      ) {
                        handleFolderDragOver(e, folder.id, 0);
                      } else {
                        e.preventDefault();
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        handleRootDragOver(e, e.clientY < r.top + 20 ? rootIndex : rootIndex + 1);
                      }
                    }}
                    onDrop={(e) => {
                      if (
                        dragSource?.kind === 'folder-note' ||
                        (dragSource?.kind === 'root-item' && sidebarOrder[dragSource.index]?.type === 'note')
                      ) {
                        handleFolderDrop(e, folder.id, 0);
                      } else {
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        handleRootDrop(e, e.clientY < r.top + 20 ? rootIndex : rootIndex + 1);
                      }
                    }}
                  >
                    <div
                      className="nb-folder-header"
                      onClick={() => {
                        if (!isRenaming) {
                          updateOpenFolders((prev) => {
                            const next = new Set(prev);
                            if (next.has(folder.id)) next.delete(folder.id);
                            else next.add(folder.id);
                            return next;
                          });
                        }
                      }}
                    >
                      <span className={`nb-folder-chevron${isOpen ? ' open' : ''}`} aria-hidden="true">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </span>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="nb-folder-icon">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                      </svg>
                      {isRenaming ? (
                        <input
                          autoFocus
                          className="nb-folder-rename-input"
                          value={renamingValue}
                          onChange={(e) => setRenamingValue(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') {
                              if (renamingValue.trim()) onRenameFolder(folder.id, renamingValue.trim());
                              setRenamingFolderId(null);
                            } else if (e.key === 'Escape') {
                              setRenamingFolderId(null);
                            }
                          }}
                          onBlur={() => {
                            if (renamingValue.trim()) onRenameFolder(folder.id, renamingValue.trim());
                            setRenamingFolderId(null);
                          }}
                          aria-label="Rename folder"
                        />
                      ) : (
                        <span className="nb-folder-name">{folder.name}</span>
                      )}
                      <span className="nb-folder-count">{folderNoteIds.length}</span>
                      <div className="nb-folder-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="nb-folder-action-btn"
                          onClick={() => {
                            onCreate(folder.id);
                            updateOpenFolders((prev) => new Set([...prev, folder.id]));
                          }}
                          title="New note in folder"
                          aria-label="New note in folder"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                          </svg>
                        </button>
                        <button
                          className="nb-folder-action-btn"
                          onClick={() => { setRenamingFolderId(folder.id); setRenamingValue(folder.name); }}
                          title="Rename folder"
                          aria-label="Rename folder"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                          </svg>
                        </button>
                        <button
                          className={`nb-folder-action-btn nb-folder-delete-btn${isConfirmDelete ? ' confirming' : ''}`}
                          onClick={(e) => handleFolderDelete(e, folder.id)}
                          title={isConfirmDelete ? 'Click again to confirm' : 'Delete folder'}
                          aria-label={isConfirmDelete ? 'Confirm delete folder' : 'Delete folder'}
                        >
                          {isConfirmDelete ? (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          ) : (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Folder notes */}
                    {isOpen && (
                      <div className="nb-folder-notes" role="list">
                        {folderNoteIds.map((noteId, noteIndex) => {
                          const card = renderNoteCard(
                            noteId,
                            { kind: 'folder-note', folderId: folder.id, index: noteIndex },
                            (e) => {
                              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              handleFolderDragOver(e, folder.id, e.clientY < r.top + r.height / 2 ? noteIndex : noteIndex + 1);
                            },
                            (e) => {
                              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              handleFolderDrop(e, folder.id, e.clientY < r.top + r.height / 2 ? noteIndex : noteIndex + 1);
                            },
                            true,
                          );
                          if (!card) return null;
                          return (
                            <Fragment key={noteId}>
                              <div
                                className={`nb-folder-drop-zone${dragSource && dropTarget?.kind === 'into-folder' && dropTarget.folderId === folder.id && dropTarget.index === noteIndex ? ' active' : ''}`}
                                onDragOver={(e) => handleFolderDragOver(e, folder.id, noteIndex)}
                                onDrop={(e) => handleFolderDrop(e, folder.id, noteIndex)}
                              />
                              {card}
                            </Fragment>
                          );
                        })}
                        <div
                          className={`nb-folder-drop-zone${dragSource && dropTarget?.kind === 'into-folder' && dropTarget.folderId === folder.id && dropTarget.index === folderNoteIds.length ? ' active' : ''}`}
                          onDragOver={(e) => handleFolderDragOver(e, folder.id, folderNoteIds.length)}
                          onDrop={(e) => handleFolderDrop(e, folder.id, folderNoteIds.length)}
                        />
                      </div>
                    )}
                  </div>
                </Fragment>
              );
            })}

            {/* Root-level drop zone at the very bottom */}
            <div
              className={`nb-root-drop-zone${dragSource && dropTarget?.kind === 'root' && dropTarget.index === sidebarOrder.length ? ' active' : ''}`}
              onDragOver={(e) => handleRootDragOver(e, sidebarOrder.length)}
              onDrop={(e) => handleRootDrop(e, sidebarOrder.length)}
            />
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="nb-sidebar-footer">
        {/* Filesystem storage */}
        {fsSupported && (
          <div className="nb-fs-section">
            {folderPath ? (
              <>
                <div className="nb-fs-status">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span className="nb-fs-path" title={folderPath}>{folderPath}</span>
                  {fsSaving && <span className="nb-fs-saving">Saving…</span>}
                  {!fsSaving && <span className="nb-fs-saved">Synced</span>}
                </div>
                <div className="nb-fs-btns">
                  <button className="nb-io-btn" onClick={onSaveToFolder} title="Change folder">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    Change
                  </button>
                  <button className="nb-io-btn" onClick={() => uploadInputRef.current?.click()} title="Upload file to folder">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Upload
                  </button>
                  <button className="nb-io-btn" onClick={onDisconnectFolder} title="Disconnect from folder">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                    Disconnect
                  </button>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUploadFile(file);
                      e.target.value = '';
                    }}
                    aria-hidden="true"
                  />
                </div>
              </>
            ) : (
              <div className="nb-fs-btns">
                <button className="nb-io-btn" onClick={onSaveToFolder} title="Save notebook to a local folder">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                  </svg>
                  Save to folder
                </button>
                <button className="nb-io-btn" onClick={onLoadFromFolder} title="Load notebook from a local folder">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                  Open folder
                </button>
              </div>
            )}
          </div>
        )}

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
          <a href="https://jeremie.bornais.ca" target="_blank" rel="noopener noreferrer">
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
