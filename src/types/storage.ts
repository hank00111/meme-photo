/**
 * Storage Type Definitions for Meme Photo Extension
 * 
 * This file defines TypeScript interfaces for chrome.storage.local data structure.
 * All storage operations should reference these interfaces for type safety.
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

/** Complete structure of chrome.storage.local data. Max 10 MB. */
export interface StorageSchema {
  uploadHistory: UploadRecord[];
  userProfile?: UserProfile;
  selectedAlbumId?: string;
  albumCache?: AlbumCache;
  /** Cleared on logout for privacy */
  thumbnailCache?: ThumbnailCache;
}

/** Type helper for chrome.storage.local.get() */
export type StorageResult<K extends keyof StorageSchema> = Pick<StorageSchema, K>;

/** Type helper for partial storage updates */
export type StorageUpdate = Partial<StorageSchema>;
