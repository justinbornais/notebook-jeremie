# notebook.

A beautiful, minimal notes app built with React, TypeScript, and Tailwind CSS. Designed for both desktop and mobile use.

**Live app:** [github.com/jere-mie/notebook](https://github.com/jere-mie/notebook)

## Features

- **Create, edit & delete notes** - Notes auto-save on every keystroke. No save button needed.
- **Persistent storage** - All notes are saved in `localStorage` and survive page refreshes.
- **Search** - Real-time search by title or content across all your notes.
- **Code mode** - Toggle any note into code mode to write syntax-highlighted snippets. Supports 16 languages: JavaScript, TypeScript, Python, Rust, Go, Java, C++, C, HTML, CSS, JSON, Bash, Ruby, PHP, SQL, and Markdown.
- **Light / dark mode** - Toggle freely; your preference is remembered.
- **Responsive** - Full two-panel layout on desktop, single-panel with navigation on mobile.

## Tech Stack

- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Vite 8](https://vite.dev) (build tool)
- [Tailwind CSS v4](https://tailwindcss.com)
- [react-syntax-highlighter](https://github.com/react-syntax-highlighter/react-syntax-highlighter) (code highlighting with Prism.js)
- Fonts: [Playfair Display](https://fonts.google.com/specimen/Playfair+Display), [Lora](https://fonts.google.com/specimen/Lora), [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) via Google Fonts

## Getting Started

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build
npm run preview
```

## Author

Created by [Jeremie Bornais](https://github.com/jere-mie) - [github.com/jere-mie](https://github.com/jere-mie)

Source code: [github.com/jere-mie/notebook](https://github.com/jere-mie/notebook)

## License

MIT - see [LICENSE](LICENSE) for details.


Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
