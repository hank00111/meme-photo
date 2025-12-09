/** Album caching with 7-day TTL. API: https://developers.google.com/photos/library/reference/rest/v1/albums */

import type { AlbumCache } from '../types/storage';

/** Google Photos album from Albums API. */
export interface Album {
  id: string;
  title: string;
  productUrl: string;
  isWriteable: boolean;
  mediaItemsCount?: number;
}

/** Albums API list response. */
interface AlbumsListResponse {
  albums?: Array<{
    id: string;
    title: string;
    productUrl: string;
    isWriteable: boolean;
    mediaItemsCount?: string; // API returns string (int64 format)
  }>;
  nextPageToken?: string;
}

/** Cache expiration: 7 days */
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const API_BASE = 'https://photoslibrary.googleapis.com/v1';

/** Fixed album name for meme-photo uploads. Auto-created on first use. */
export const MEME_PHOTO_ALBUM_NAME = 'meme-photo';

// ============================================================================
// Cache Management Functions
// ============================================================================

/** Saves album title to cache with current timestamp. */
export async function cacheAlbumTitle(
  albumId: string,
  title: string
): Promise<void> {
  try {
    const result = await chrome.storage.local.get('albumCache');
    const albumCache = (result.albumCache ?? {}) as AlbumCache;

    albumCache[albumId] = {
      name: title,
      lastUpdated: Date.now(),
    };

    await chrome.storage.local.set({ albumCache });

  } catch (error) {
    console.error('ALBUM_CACHE: Failed to cache album title', error);
    throw error;
  }
}

/** Retrieves album title from cache. Returns null if not cached or expired (>7 days). */
export async function getAlbumTitle(albumId: string): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get('albumCache');
    const albumCache = (result.albumCache ?? {}) as AlbumCache;

    const cached = albumCache[albumId];
    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.lastUpdated;
    if (age > CACHE_EXPIRY_MS) {
      return null;
    }

    return cached.name;
  } catch (error) {
    console.error('ALBUM_CACHE: Failed to get album title', error);
    return null;
  }
}

/** Batch cache multiple albums with single storage write. */
export async function batchCacheAlbums(albums: Album[]): Promise<void> {
  try {
    const result = await chrome.storage.local.get('albumCache');
    const albumCache = (result.albumCache ?? {}) as AlbumCache;

    const now = Date.now();
    albums.forEach((album) => {
      albumCache[album.id] = {
        name: album.title,
        lastUpdated: now,
      };
    });

    await chrome.storage.local.set({ albumCache });

  } catch (error) {
    console.error('ALBUM_CACHE: Failed to batch cache albums', error);
    throw error;
  }
}

/** Removes expired cache entries (older than 7 days). */
export async function cleanupExpiredCache(): Promise<void> {
  try {
    const result = await chrome.storage.local.get('albumCache');
    const albumCache = (result.albumCache ?? {}) as AlbumCache;

    const now = Date.now();

    const cleaned: AlbumCache = {};
    Object.entries(albumCache).forEach(([albumId, cached]) => {
      const age = now - cached.lastUpdated;
      if (age <= CACHE_EXPIRY_MS) {
        cleaned[albumId] = cached;
      }
    });

    await chrome.storage.local.set({ albumCache: cleaned });

  } catch (error) {
    console.error('ALBUM_CACHE: Failed to cleanup cache', error);
  }
}

/** Clears all album cache. Call on logout for privacy. */
export async function clearAlbumCache(): Promise<void> {
  try {
    await chrome.storage.local.remove('albumCache');
  } catch (error) {
    console.error('ALBUM_CACHE: Failed to clear cache', error);
  }
}

// ============================================================================
// Google Photos Albums API Functions
// ============================================================================

/** Lists albums created by this app (max 50, paginated). */
export async function listAlbums(token: string): Promise<Album[]> {
  try {
    const albums: Album[] = [];
    let pageToken: string | undefined;
    const pageSize = 20; // Max 50 allowed, but we use 20 for efficiency
    const maxAlbums = 50; // Hard limit

    while (albums.length < maxAlbums) {
      // Build URL with query parameters
      const url = new URL(`${API_BASE}/albums`);
      url.searchParams.set('pageSize', pageSize.toString());
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      // Fetch albums page
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // Handle API errors
      if (!response.ok) {
        console.error('ALBUM_CACHE: API request failed', {
          status: response.status,
          statusText: response.statusText
        });

        // Throw specific errors for common cases
        if (response.status === 401) {
          throw new Error('AUTH_TOKEN_EXPIRED');
        } else if (response.status === 403) {
          throw new Error('PERMISSION_DENIED');
        } else if (response.status === 429) {
          throw new Error('QUOTA_EXCEEDED');
        } else {
          throw new Error('API_ERROR');
        }
      }

      const data: AlbumsListResponse = await response.json();

      // Process albums
      if (data.albums && data.albums.length > 0) {
        data.albums.forEach((album) => {
          albums.push({
            id: album.id,
            title: album.title,
            productUrl: album.productUrl,
            isWriteable: album.isWriteable,
            mediaItemsCount: album.mediaItemsCount
              ? parseInt(album.mediaItemsCount, 10)
              : undefined,
          });
        });
      }

      // Check for next page
      if (!data.nextPageToken || albums.length >= maxAlbums) {
        break;
      }

      pageToken = data.nextPageToken;
    }

    // Limit to max 50 albums
    const result = albums.slice(0, maxAlbums);

    return result;
  } catch (error) {
    console.error('ALBUM_CACHE: Failed to list albums', error);
    throw error;
  }
}

/** Creates new album in Google Photos. */
export async function createAlbum(
  token: string,
  title: string
): Promise<Album> {
  try {
    // Validate title
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      throw new Error('ALBUM_TITLE_EMPTY');
    }
    if (trimmedTitle.length > 500) {
      throw new Error('ALBUM_TITLE_TOO_LONG');
    }

    // Create album via API
    const response = await fetch(`${API_BASE}/albums`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        album: {
          title: trimmedTitle,
        },
      }),
    });

    // Handle API errors
    if (!response.ok) {
      console.error('ALBUM_CACHE: Create album failed', {
        status: response.status,
        statusText: response.statusText
      });

      // Throw specific errors
      if (response.status === 401) {
        throw new Error('AUTH_TOKEN_EXPIRED');
      } else if (response.status === 403) {
        throw new Error('PERMISSION_DENIED');
      } else if (response.status === 400) {
        throw new Error('INVALID_REQUEST');
      } else {
        throw new Error('API_ERROR');
      }
    }

    const data = await response.json();

    // Parse response
    const album: Album = {
      id: data.id,
      title: data.title,
      productUrl: data.productUrl,
      isWriteable: data.isWriteable,
      mediaItemsCount: data.mediaItemsCount
        ? parseInt(data.mediaItemsCount, 10)
        : 0, // New albums start with 0 items
    };

    return album;
  } catch (error) {
    console.error('ALBUM_CACHE: Failed to create album', error);
    throw error;
  }
}

/** Gets or creates the 'meme-photo' album. */
export async function getOrCreateMemePhotoAlbum(token: string): Promise<Album> {
  try {
    // Search for existing meme-photo album
    const albums = await listAlbums(token);
    const existing = albums.find(album => album.title === MEME_PHOTO_ALBUM_NAME);
    
    if (existing) {
      return existing;
    }
    
    // Create if not found
    const newAlbum = await createAlbum(token, MEME_PHOTO_ALBUM_NAME);
    
    return newAlbum;
  } catch (error) {
    console.error('ALBUM_CACHE: Failed to get/create meme-photo album', error);
    throw error;
  }
}
