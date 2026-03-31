# notebook

notebook is a local-first notes app built with React and TypeScript. It supports plain text notes, code notes with Monaco, folders, drag-and-drop organization, JSON import/export, and an installable PWA shell.

Source: [github.com/jere-mie/notebook](https://github.com/jere-mie/notebook)

## Features

- Create, edit, and delete notes with automatic persistence to `localStorage`
- Start from an untitled draft and only commit it once you begin typing
- Toggle notes between text mode and code mode
- Edit code notes in Monaco with language-specific syntax support
- Choose from 16 supported note languages: Markdown, Bash/Shell, C, C++, CSS, Go, HTML, Java, JavaScript, JSON, PHP, Python, Ruby, Rust, SQL, and TypeScript
- Organize notes into folders
- Drag and drop root notes, folders, and notes inside folders to reorder or re-home them
- Search note titles and content in real time
- Import and export notes as JSON
- Remember your preferred note mode and default code language for new notes
- Toggle light and dark themes
- Resize and collapse the sidebar on desktop
- Use the app on mobile with list and editor views
- Install the app as a PWA with offline-friendly network-first caching

## Keyboard Shortcuts

- New note: `Cmd+Enter` on macOS, `Ctrl+Enter` on Windows/Linux
- Search: `Cmd+P` on macOS, `Ctrl+P` on Windows/Linux
- Toggle sidebar: `Cmd+B` on macOS, `Ctrl+B` on Windows/Linux
- Previous / next note: `Cmd+Up` and `Cmd+Down` on macOS, `Ctrl+Up` and `Ctrl+Down` on Windows/Linux

## Stack

- [React 19](https://react.dev)
- [TypeScript](https://www.typescriptlang.org)
- [Vite 8](https://vite.dev)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- [Tailwind CSS v4](https://tailwindcss.com) with custom app styling
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Production Build

```bash
npm run build
npm run preview
```

## Project Notes

- Notes, folders, ordering, theme, sidebar width, open folders, and new-note preferences are stored in the browser
- Imports support both the current structured JSON payload and a legacy plain note array
- The PWA service worker is enabled in development so install behavior can be tested locally

## Author

Created by [Jeremie Bornais](https://jeremie.bornais.ca) - [github.com/jere-mie](https://github.com/jere-mie)

## License

MIT. See [LICENSE](LICENSE).
