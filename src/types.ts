export interface Note {
  id: string;
  title: string;
  content: string;
  isCode: boolean;
  language: string;
  createdAt: number;
  updatedAt: number;
}

export interface Folder {
  id: string;
  name: string;
}

// An item in the sidebar ordering list — either a folder or a root-level note
export type SidebarItem =
  | { type: 'folder'; id: string }
  | { type: 'note'; id: string };

export type Theme = 'light' | 'dark';

export const LANGUAGES = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'bash', label: 'Bash/Shell' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'css', label: 'CSS' },
  { value: 'go', label: 'Go' },
  { value: 'markup', label: 'HTML' },
  { value: 'java', label: 'Java' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'json', label: 'JSON' },
  { value: 'php', label: 'PHP' },
  { value: 'python', label: 'Python' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'rust', label: 'Rust' },
  { value: 'sql', label: 'SQL' },
  { value: 'typescript', label: 'TypeScript' },
] as const;
