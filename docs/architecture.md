# Architecture Overview

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.0 | UI framework with new JSX transform |
| TypeScript | 5.9.3 | Type-safe development |
| Vite | 7.2.2 | Fast build tool and dev server |
| CRXJS Plugin | 2.2.1 | Chrome Extension development with HMR |

## Chrome Manifest V3

This extension uses Chrome Manifest V3, which requires:

- **Service Worker** instead of background pages
- **Event-driven architecture** for better performance
- **Declarative permissions** for enhanced security

### Key Differences from Manifest V2

| Feature | Manifest V2 | Manifest V3 |
|---------|-------------|-------------|
| Background | Persistent page | Service Worker |
| Lifecycle | Always running | Event-driven |
| Remote code | Allowed | Not allowed |
| CSP | Flexible | Strict |

## Project Structure

```
meme-photo/
├── src/
│   ├── background/      # Service Worker
│   │   └── index.ts     # Main background script
│   ├── popup/           # Extension popup
│   │   ├── App.tsx      # Popup React component
│   │   └── main.tsx     # Popup entry point
│   ├── sidepanel/       # Side panel UI
│   │   ├── App.tsx      # Side panel component
│   │   └── main.tsx     # Side panel entry point
│   ├── content/         # Content scripts
│   │   └── toast-injector.ts
│   ├── components/      # Shared React components
│   │   ├── AlbumSelector.tsx
│   │   ├── UploadHistory.tsx
│   │   ├── UserAvatar.tsx
│   │   └── ...
│   ├── utils/           # Utility functions
│   │   ├── albumCache.ts
│   │   ├── uploadHistory.ts
│   │   ├── imageProcessor.ts
│   │   └── ...
│   ├── styles/          # Global styles
│   │   ├── base.css
│   │   ├── theme.css
│   │   └── components.css
│   └── types/           # TypeScript types
│       └── storage.ts
├── public/
│   ├── icons/           # Extension icons
│   └── content/         # Content script assets
├── manifest.json        # Extension manifest
├── popup.html           # Popup HTML
├── sidepanel.html       # Side panel HTML
└── vite.config.ts       # Vite configuration
```

## Core Components

### Background Service Worker

**File**: `src/background/index.ts`

Responsibilities:
- Handle OAuth authentication via `chrome.identity`
- Manage context menu registration
- Process image uploads to Google Photos
- Communicate with popup and side panel via message passing

```typescript
// Message handling pattern
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'uploadImage') {
    handleUpload(message.data).then(sendResponse);
    return true; // Keep channel open for async response
  }
});
```

### Popup UI

**Files**: `src/popup/App.tsx`, `src/popup/main.tsx`

Features:
- Quick authentication status
- Open side panel button
- Minimal footprint for fast load

### Side Panel

**Files**: `src/sidepanel/App.tsx`, `src/sidepanel/main.tsx`

Features:
- Album selection and management
- Upload history with thumbnails
- User profile display
- Full-featured interface

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interaction                        │
│                   (Right-click on image)                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Context Menu Handler                       │
│               (chrome.contextMenus.onClicked)                │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Background Service Worker                   │
│                                                              │
│  1. Get image URL from context menu info                    │
│  2. Download image via content script                       │
│  3. Get OAuth token                                         │
│  4. Upload to Google Photos API                             │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Google Photos API                          │
│                                                              │
│  1. POST /uploads (get upload token)                        │
│  2. POST /mediaItems:batchCreate (create media item)        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     Update Storage                           │
│              (chrome.storage.local)                          │
│                                                              │
│  - Add to upload history                                    │
│  - Cache thumbnail                                          │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Notify UI                               │
│                                                              │
│  - Show toast notification                                  │
│  - Update side panel (if open)                              │
└─────────────────────────────────────────────────────────────┘
```

## Storage Schema

Uses `chrome.storage.local` for persistent data:

```typescript
interface StorageData {
  // User profile from Google
  userProfile: {
    id: string;
    name: string;
    picture: string;
  } | null;

  // Selected album for uploads
  selectedAlbumId: string | null;

  // Upload history records
  uploadHistory: UploadRecord[];

  // Cached album list
  albumCache: {
    albums: Album[];
    lastUpdated: number;
  } | null;

  // Cached thumbnails (base64)
  thumbnailCache: Record<string, string>;
}

interface UploadRecord {
  id: string;
  filename: string;
  albumId: string;
  albumTitle: string;
  timestamp: number;
  mediaItemId: string;
  productUrl: string;
  thumbnailUrl?: string;
}

interface Album {
  id: string;
  title: string;
  productUrl: string;
  mediaItemsCount?: string;
  coverPhotoBaseUrl?: string;
}
```

## API Integration

### Google Photos Library API

**Base URL**: `https://photoslibrary.googleapis.com/v1/`

**Authentication**: OAuth 2.0 Bearer token via `chrome.identity.getAuthToken()`

#### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/albums` | GET | List user's albums |
| `/albums` | POST | Create new album |
| `/uploads` | POST | Upload image bytes |
| `/mediaItems:batchCreate` | POST | Create media item from upload |

#### Upload Flow (Two-Phase)

```typescript
// Phase 1: Upload bytes
const uploadResponse = await fetch(
  'https://photoslibrary.googleapis.com/v1/uploads',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'X-Goog-Upload-File-Name': filename,
      'X-Goog-Upload-Protocol': 'raw'
    },
    body: imageBytes
  }
);
const uploadToken = await uploadResponse.text();

// Phase 2: Create media item
const createResponse = await fetch(
  'https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      albumId: selectedAlbumId,
      newMediaItems: [{
        simpleMediaItem: { uploadToken }
      }]
    })
  }
);
```

### API Limitations

| Limit | Value |
|-------|-------|
| Max file size | 200 MB |
| Supported formats | JPEG, PNG, GIF, BMP, TIFF, WebP, HEIC |
| Rate limit | 30 requests/minute |
| Daily quota | 10,000 requests |
| Album item limit | 20,000 items per album |

## Message Passing

### Popup ↔ Background

```typescript
// From Popup
chrome.runtime.sendMessage({ action: 'getAuthStatus' }, (response) => {
  console.log('Auth status:', response.isAuthenticated);
});

// In Background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getAuthStatus') {
    checkAuthStatus().then(status => sendResponse(status));
    return true;
  }
});
```

### Content Script ↔ Background

```typescript
// From Content Script
chrome.runtime.sendMessage({ 
  action: 'downloadImage', 
  url: imageUrl 
});

// In Background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'downloadImage') {
    downloadImage(message.url, sender.tab.id);
  }
});
```

## Error Handling

### OAuth Errors

```typescript
try {
  const token = await chrome.identity.getAuthToken({ interactive: true });
  if (chrome.runtime.lastError) {
    throw new Error(chrome.runtime.lastError.message);
  }
} catch (error) {
  // Handle: user denied, network error, invalid client
}
```

### API Errors

```typescript
const response = await fetch(apiUrl, options);
if (!response.ok) {
  const error = await response.json();
  // Handle: quota exceeded, invalid token, rate limited
}
```

## Performance Considerations

1. **Lazy Loading**: Side panel components load on demand
2. **Thumbnail Caching**: Avoid repeated API calls for thumbnails
3. **Album Caching**: Cache album list with TTL (5 minutes)
4. **Background Cleanup**: Service worker terminates when idle
5. **Batch Operations**: Use batch API for multiple uploads (future)
