/**
 * Storage Type Definitions for Meme Photo Extension
 * 
 * This file defines TypeScript interfaces for chrome.storage.local data structure.
 * All storage operations should reference these interfaces for type safety.
 */

/**
 * Upload Record Interface
 * 
 * Represents a single upload record to Google Photos.
 * Note: thumbnailUrl is NOT stored because Google Photos baseUrl expires after 60 minutes.
 * Instead, we store mediaItemId and fetch the latest baseUrl dynamically when needed.
 */
export interface UploadRecord {
  /** Unique identifier for the record (UUID v4) */
  id: string;
  
  /** Upload timestamp in milliseconds (Date.now()) */
  timestamp: number;
  
  /** Original filename of the uploaded image */
  filename: string;
  
  /** Google Photos media item ID (used to fetch fresh baseUrl via mediaItems.get API) */
  mediaItemId: string;
  
  /** Google Photos product URL (permanent link to view in Google Photos) */
  productUrl: string;
  
  /** Optional: Google Photos album ID if uploaded to a specific album */
  albumId?: string;
}

/**
 * User Profile Interface
 * 
 * Stores user's Google account information retrieved from People API.
 * photoUrl is cached locally to avoid repeated API calls.
 */
export interface UserProfile {
  /** User's display name from Google account */
  name: string;
  
  /** User's profile photo URL from googleusercontent.com CDN */
  photoUrl: string;
  
  /** Timestamp when photoUrl was last fetched (for cache invalidation) */
  lastUpdated: number;
}

/**
 * Album Cache Interface
 * 
 * Caches album names to avoid repeated Google Photos API calls.
 * Key: album ID, Value: album metadata with expiration tracking.
 * Cache expires after 7 days (CACHE_EXPIRY constant in albumCache.ts).
 */
export interface AlbumCache {
  [albumId: string]: {
    /** Album title/name */
    name: string;
    
    /** Timestamp when this cache entry was created/updated */
    lastUpdated: number;
  };
}

/**
 * Storage Schema Interface
 * 
 * Defines the complete structure of chrome.storage.local data.
 * Maximum storage: 10 MB (QUOTA_BYTES: 10485760)
 * 
 * Estimated usage:
 * - uploadHistory (50 records × 500 bytes): ~25 KB
 * - userProfile: ~1 KB
 * - albumCache: ~5 KB (estimated)
 * Total: ~31 KB (0.3% of 10 MB quota)
 */
export interface StorageSchema {
  /**
   * Upload history records (maximum 50 records)
   * 
   * Implementation note: When adding new records, use .slice(0, 50) to enforce limit:
   * ```typescript
   * const updated = [newRecord, ...uploadHistory].slice(0, 50);
   * await chrome.storage.local.set({ uploadHistory: updated });
   * ```
   */
  uploadHistory: UploadRecord[];
  
  /**
   * User profile information from Google People API
   * Optional: undefined if not yet fetched or user not authenticated
   */
  userProfile?: UserProfile;
  
  /**
   * Last selected album ID for upload destination
   * Optional: undefined means upload to default location (all photos)
   */
  selectedAlbumId?: string;
  
  /**
   * Cached album names to reduce API calls
   * Optional: undefined if no albums have been cached yet
   */
  albumCache?: AlbumCache;
}

/**
 * Type helper for chrome.storage.local.get() operations
 * 
 * Usage example:
 * ```typescript
 * const result = await chrome.storage.local.get('uploadHistory') as StorageResult<'uploadHistory'>;
 * const history = result.uploadHistory ?? [];
 * ```
 */
export type StorageResult<K extends keyof StorageSchema> = Pick<StorageSchema, K>;

/**
 * Type helper for partial storage updates
 * 
 * Usage example:
 * ```typescript
 * const update: StorageUpdate = {
 *   uploadHistory: updatedHistory,
 *   selectedAlbumId: 'album123'
 * };
 * await chrome.storage.local.set(update);
 * ```
 */
export type StorageUpdate = Partial<StorageSchema>;
