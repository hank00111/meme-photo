# Meme Photo - Google Photos Uploader

Chrome Extension for uploading images to Google Photos from context menu.

## 🎯 Features

- Upload images to Google Photos with right-click context menu
- OAuth 2.0 integration with Google account
- Support for albums selection
- Upload progress tracking
- Chrome Manifest V3 compliant

## 📦 Tech Stack

- **React 19.2.0** - UI framework
- **TypeScript 5.9.3** - Type safety
- **Vite 7.2.2** - Build tool
- **CRXJS Vite Plugin 2.2.1** - Chrome Extension development with HMR
- **Chrome API Types** - Full type support for Chrome Extension APIs

## 🚀 Development

### Prerequisites

- Node.js 18+ 
- npm or pnpm
- Google Chrome browser

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Load Extension to Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the **`dist/` folder** (not project root!)
5. Extension ID: `YOUR_EXTENSION_ID_HERE`

### Development Workflow

- The dev server supports HMR (Hot Module Replacement)
- Changes to source files will automatically reload the extension
- Check Service Worker console for background script logs

## 🏗️ Build

```bash
# Build for production
npm run build
```

The production build will be in the `dist/` folder.

## 📁 Project Structure

```
src/
├── background/      # Service Worker (background scripts)
├── content/         # Content Scripts (page injection)
├── popup/           # Popup UI (extension popup)
├── options/         # Options Page (settings)
└── utils/           # Shared utilities
public/
└── icons/           # Extension icons
```

## 🔑 OAuth Setup

See [TODO.md](./docs/2025-11-11/TODO.md) for detailed OAuth configuration steps.

## 📝 Documentation

- [Specification](./spec.md)
- [TODO List](./docs/2025-11-11/TODO.md)
- [Requirement Analysis](./docs/2025-11-10/requirement-analysis.md)
- [Tech Stack Versions](./docs/2025-11-11/tech-stack-versions.md)

## 🤝 Contributing

This is a personal project. Issues and PRs are welcome.

## 📄 License

MIT
