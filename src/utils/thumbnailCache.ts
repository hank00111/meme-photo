/**
 * Thumbnail Cache Utility
 * 
 * Caches thumbnails as Base64 Data URLs in chrome.storage.local.
 * Google Photos baseUrl expires after 60 minutes, but cached image data is permanent.
 * 
 * Features:
 * - LRU eviction when cache exceeds MAX_CACHE_SIZE entries
 * - Uses lastAccessedAt timestamp for LRU tracking
 */

import type { ThumbnailCache, ThumbnailCacheEntry } from '../types/storage';

/** Maximum number of cached thumbnails. Oldest accessed entries are evicted first. */
const MAX_CACHE_SIZE = 100;

async function getCachedThumbnail(mediaItemId: string): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get('thumbnailCache');
    const cache = (result.thumbnailCache ?? {}) as ThumbnailCache;
    
    const entry = cache[mediaItemId];
    if (entry?.base64DataUrl) {
      console.log('THUMBNAIL_CACHE: Cache hit for mediaItemId:', mediaItemId);
      
      // Update lastAccessedAt for LRU tracking
      entry.lastAccessedAt = Date.now();
      await chrome.storage.local.set({ thumbnailCache: cache });
      
      return entry.base64DataUrl;
    }
    
    console.log('THUMBNAIL_CACHE: Cache miss for mediaItemId:', mediaItemId);
    return null;
  } catch (error) {
    console.error('THUMBNAIL_CACHE: Error reading cache:', error);
    return null;
  }
}

async function cacheThumbnail(
  mediaItemId: string,
  base64DataUrl: string
): Promise<void> {
  try {
    const result = await chrome.storage.local.get('thumbnailCache');
    const cache = (result.thumbnailCache ?? {}) as ThumbnailCache;
    
    // Evict oldest entries if cache is at capacity
    const entries = Object.entries(cache);
    if (entries.length >= MAX_CACHE_SIZE) {
      // Sort by lastAccessedAt (or cachedAt as fallback), oldest first
      entries.sort((a, b) => {
        const timeA = a[1].lastAccessedAt ?? a[1].cachedAt;
        const timeB = b[1].lastAccessedAt ?? b[1].cachedAt;
        return timeA - timeB;
      });
      
      // Remove oldest entries to make room (evict 10% to reduce frequent evictions)
      const evictCount = Math.max(1, Math.floor(MAX_CACHE_SIZE * 0.1));
      const entriesToRemove = entries.slice(0, evictCount);
      
      for (const [key] of entriesToRemove) {
        delete cache[key];
      }
      
      console.log(`THUMBNAIL_CACHE: Evicted ${entriesToRemove.length} oldest entries (LRU)`);
    }
    
    const now = Date.now();
    const entry: ThumbnailCacheEntry = {
      base64DataUrl,
      cachedAt: now,
      lastAccessedAt: now
    };
    
    cache[mediaItemId] = entry;
    
    await chrome.storage.local.set({ thumbnailCache: cache });
    console.log('THUMBNAIL_CACHE: Cached thumbnail for mediaItemId:', mediaItemId);
  } catch (error) {
    console.error('THUMBNAIL_CACHE: Error saving to cache:', error);
  }
}

/** Clears all cached thumbnails. Call on logout. */
export async function clearThumbnailCache(): Promise<void> {
  try {
    await chrome.storage.local.remove('thumbnailCache');
    console.log('THUMBNAIL_CACHE: All cached thumbnails cleared');
  } catch (error) {
    console.error('THUMBNAIL_CACHE: Error clearing cache:', error);
  }
}

async function fetchThumbnailFromApi(
  mediaItemId: string,
  token: string
): Promise<string | null> {
  try {
    console.log('THUMBNAIL_CACHE: Fetching from API for mediaItemId:', mediaItemId);

    // Step 1: Get media item info to get baseUrl
    const response = await fetch(
      `https://photoslibrary.googleapis.com/v1/mediaItems/${mediaItemId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `THUMBNAIL_CACHE: API returned ${response.status} ${response.statusText}`,
        errorText
      );
      return null;
    }

    const mediaItem = await response.json();

    if (!mediaItem.baseUrl) {
      console.error('THUMBNAIL_CACHE: Response missing baseUrl field:', mediaItem);
      return null;
    }

    // Step 2: Fetch the actual image with size parameter
    const thumbnailUrl = `${mediaItem.baseUrl}=s48`;
    const imageResponse = await fetch(thumbnailUrl);
    
    if (!imageResponse.ok) {
      console.error('THUMBNAIL_CACHE: Failed to fetch image:', imageResponse.status);
      return null;
    }

    // Step 3: Convert to Base64 Data URL
    const blob = await imageResponse.blob();
    const base64DataUrl = await blobToDataUrl(blob);
    
    console.log('THUMBNAIL_CACHE: Successfully fetched and converted to Base64');
    return base64DataUrl;

  } catch (error) {
    console.error('THUMBNAIL_CACHE: Failed to fetch thumbnail:', error);
    return null;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to data URL'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Gets thumbnail as Base64 Data URL. Checks cache first, fetches from API if not cached. */
export async function getThumbnailDataUrl(
  mediaItemId: string,
  token: string
): Promise<string | null> {
  // Step 1: Check cache first
  const cached = await getCachedThumbnail(mediaItemId);
  if (cached) {
    return cached;
  }

  // Step 2: Fetch from API
  const dataUrl = await fetchThumbnailFromApi(mediaItemId, token);
  if (!dataUrl) {
    return null;
  }

  // Step 3: Cache for future use
  await cacheThumbnail(mediaItemId, dataUrl);

  return dataUrl;
}

/** @deprecated Use getThumbnailDataUrl instead. Returns URL that expires in 60 minutes. */
export async function getThumbnailUrl(
  mediaItemId: string,
  token: string
): Promise<string | null> {
  try {
    console.log('THUMBNAIL: Fetching thumbnail URL for mediaItemId:', mediaItemId);

    const response = await fetch(
      `https://photoslibrary.googleapis.com/v1/mediaItems/${mediaItemId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `THUMBNAIL: API returned ${response.status} ${response.statusText}`,
        errorText
      );
      return null;
    }

    const mediaItem = await response.json();

    if (!mediaItem.baseUrl) {
      console.error('THUMBNAIL: Response missing baseUrl field:', mediaItem);
      return null;
    }

    const thumbnailUrl = `${mediaItem.baseUrl}=s48`;
    console.log('THUMBNAIL: Successfully fetched thumbnail URL');

    return thumbnailUrl;

  } catch (error) {
    console.error('THUMBNAIL: Failed to get thumbnail URL:', error);
    return null;
  }
}
