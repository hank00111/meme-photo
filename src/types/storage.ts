/**
 * Storage Type Definitions for Meme Photo Extension
 * 
 * This file defines TypeScript interfaces for chrome.storage data structures.
 * All storage operations should reference these interfaces for type safety.
 * 
 * - StorageSchema: chrome.storage.local (device-specific, max 10 MB)
 * - SyncStorageSchema: chrome.storage.sync (synced across devices, max 100 KB)
 */

/** Upload record for Google Photos. thumbnailUrl not stored (baseUrl expires). */
export interface UploadRecord {
  id: string;
  timestamp: number;
  filename: string;
  /** Used to fetch fresh baseUrl via mediaItems.get API */
  mediaItemId: string;
  /** Permanent link to view in Google Photos */
  productUrl: string;
  albumId?: string;
}

/** User's Google account info from userinfo.profile scope. */
export interface UserProfile {
  name: string;
  photoUrl: string;
  lastUpdated: number;
}

/** Cached album names. Expires after 7 days. */
export interface AlbumCache {
  [albumId: string]: {
    name: string;
    lastUpdated: number;
  };
}

/** Cached thumbnail as Base64 Data URL. */
export interface ThumbnailCacheEntry {
  base64DataUrl: string;
  cachedAt: number;
  /** Last access time for LRU eviction. Defaults to cachedAt if not set. */
  lastAccessedAt?: number;
}

/** Thumbnail cache map. Key: mediaItemId, Value: ThumbnailCacheEntry */
export interface ThumbnailCache {
  [mediaItemId: string]: ThumbnailCacheEntry;
}

/** 
 * Complete structure of chrome.storage.local data. Max 10 MB.
 * 
 * Device-specific storage that is NOT synced across devices.
 * Most data is cleared on logout for privacy.
 */
export interface StorageSchema {
  /** Upload history records (max 50, auto-pruned). Cleared on logout. */
  uploadHistory: UploadRecord[];
  /** User profile from Google Account. Cleared on logout. */
  userProfile?: UserProfile;
  /** Cached album names with 7-day TTL. Cleared on logout. */
  albumCache?: AlbumCache;
  /** Cached thumbnails for upload history. Cleared on logout. */
  thumbnailCache?: ThumbnailCache;
  /** Extension installation timestamp (ISO 8601). Persists across logout. */
  installedAt?: string;
  /** Manual logout flag to prevent auto-login. Set on logout, cleared on login. */
  isManuallyLoggedOut?: boolean;
}

/**
 * Complete structure of chrome.storage.sync data. Max 100 KB.
 * 
 * Synced across all devices where user is logged in with same Chrome profile.
 * Cleared on logout for privacy.
 */
export interface SyncStorageSchema {
  /** Selected album ID for uploads. Cleared on logout. */
  selectedAlbumId?: string;
}

/** Type helper for chrome.storage.local.get() */
export type StorageResult<K extends keyof StorageSchema> = Pick<StorageSchema, K>;

/** Type helper for partial chrome.storage.local updates */
export type StorageUpdate = Partial<StorageSchema>;

/** Type helper for chrome.storage.sync.get() */
export type SyncStorageResult<K extends keyof SyncStorageSchema> = Pick<SyncStorageSchema, K>;

/** Type helper for partial chrome.storage.sync updates */
export type SyncStorageUpdate = Partial<SyncStorageSchema>;
