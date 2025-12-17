# Meme Photo

> Upload images to Google Photos with a simple right-click

[![CI](https://github.com/hank00111/meme-photo/actions/workflows/ci.yml/badge.svg)](https://github.com/hank00111/meme-photo/actions/workflows/ci.yml)
[![Security Scan](https://github.com/hank00111/meme-photo/actions/workflows/security.yml/badge.svg)](https://github.com/hank00111/meme-photo/actions/workflows/security.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore)
[![React](https://img.shields.io/badge/React-19.2.3-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.3.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)

---

## Features

- **Quick Upload** - Right-click any image on the web to upload to Google Photos
- **Album Management** - Select or create albums to organize your uploads
- **Upload History** - Track your recent uploads with thumbnails
- **Side Panel** - Convenient side panel interface for managing uploads
- **User Profile** - Display your Google account info after authentication
- **Modern UI** - Clean interface built with React 19 and TypeScript
- **Manifest V3** - Built with the latest Chrome Extension standards
- **HMR Development** - Hot Module Replacement for fast development

## Screenshots

_Coming soon_

## Prerequisites

Before using this extension, you need:

1. **Node.js 22+** (LTS recommended)
2. **Google Cloud Project** with OAuth 2.0 credentials
3. **Google Photos Library API** enabled
4. **Chrome browser** (version 88 or later)

## Installation

### From Source

1. **Clone this repository**
   ```bash
   git clone https://github.com/hank00111/meme-photo.git
   cd meme-photo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure OAuth credentials**

   Create OAuth 2.0 credentials in [Google Cloud Console](https://console.cloud.google.com/):

   - Go to **APIs & Services** > **Credentials**
   - Click **Create Credentials** > **OAuth client ID**
   - Select **Chrome Extension** as application type
   - Update `manifest.json` with your Client ID:
     ```json
     "oauth2": {
       "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
       ...
     }
     ```

4. **Build the extension**
   ```bash
   npm run dev    # Development with HMR
   # or
   npm run build  # Production build
   ```

5. **Load in Chrome**
   - Open `chrome://extensions/`
   - Enable **Developer mode**
   - Click **Load unpacked**
   - Select the `dist/` folder

## OAuth Setup

To use this extension, you need to set up Google OAuth 2.0:

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one

### Step 2: Enable APIs

1. Go to **APIs & Services** > **Library**
2. Search and enable **Google Photos Library API**

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Select **External** user type
3. Fill in the required information
4. Add these scopes:
   - `https://www.googleapis.com/auth/photoslibrary.appendonly`
   - `https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata`
   - `https://www.googleapis.com/auth/userinfo.profile`

### Step 4: Create Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Select **Chrome Extension**
4. Enter your extension ID (found in `chrome://extensions/`)
5. Copy the Client ID and update `manifest.json`

## Development

### Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.3 | UI Framework |
| TypeScript | 5.9.3 | Type Safety |
| Vite | 7.3.0 | Build Tool |
| CRXJS | 2.3.0 | Chrome Extension Plugin |
| ESLint | 9.39.x | Code Linting |

### Project Structure

```
src/
├── background/      # Service Worker (Manifest V3)
├── popup/           # Extension popup UI
├── sidepanel/       # Side panel UI
├── content/         # Content scripts
├── components/      # Shared React components
│   ├── AlbumSelector.tsx
│   ├── AlbumSelectorModal.tsx
│   ├── AuthOverlay.tsx
│   ├── ErrorBoundary.tsx
│   ├── ThumbnailImage.tsx
│   ├── UploadHistory.tsx
│   ├── UploadRecordCard.tsx
│   └── UserAvatar.tsx
├── utils/           # Utility functions
├── types/           # TypeScript type definitions
└── styles/          # Global styles

public/
├── icons/           # Extension icons
├── content/         # Content script assets
└── styles/          # Content script styles
```

### Available Scripts

```bash
npm run dev      # Start dev server with HMR
npm run build    # Production build
npm run lint     # Run ESLint
npm run preview  # Preview production build
npm run clean    # Clean build outputs
```

### Chrome Extension Permissions

| Permission | Purpose |
|------------|---------|
| `identity` | Google OAuth authentication |
| `storage` | Store user preferences and upload history |
| `contextMenus` | Right-click menu integration |
| `sidePanel` | Side panel UI |
| `scripting` | Content script injection |

### Debugging

- **Service Worker**: Click "Service Worker" link in `chrome://extensions/`
- **Popup**: Right-click extension icon > Inspect popup
- **Side Panel**: Open side panel > Right-click > Inspect

## Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** this repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Guidelines

- Follow existing code style
- Write clear commit messages
- Test your changes before submitting
- Update documentation if needed
- Ensure CI checks pass

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Google Photos Library API](https://developers.google.com/photos)
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [CRXJS](https://crxjs.dev/vite-plugin)
- [TypeScript](https://www.typescriptlang.org/)

---

Made with love by [hank00111](https://github.com/hank00111)
