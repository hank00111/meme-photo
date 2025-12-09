/** Thumbnail cache with 7-day TTL and LRU eviction */

import type { ThumbnailCache, ThumbnailCacheEntry } from '../types/storage';

const MAX_CACHE_SIZE = 100;
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function getCachedThumbnail(mediaItemId: string): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get('thumbnailCache');
    const cache = (result.thumbnailCache ?? {}) as ThumbnailCache;
    
    const entry = cache[mediaItemId];
    if (entry?.base64DataUrl) {
      const age = Date.now() - entry.cachedAt;
      if (age > CACHE_EXPIRY_MS) {
        delete cache[mediaItemId];
        await chrome.storage.local.set({ thumbnailCache: cache });
        return null;
      }
      
      entry.lastAccessedAt = Date.now();
      await chrome.storage.local.set({ thumbnailCache: cache });
      
      return entry.base64DataUrl;
    }
    
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
    
    const now = Date.now();
    for (const [key, entry] of Object.entries(cache)) {
      const age = now - entry.cachedAt;
      if (age > CACHE_EXPIRY_MS) {
        delete cache[key];
      }
    }
    
    const entries = Object.entries(cache);
    if (entries.length >= MAX_CACHE_SIZE) {
      entries.sort((a, b) => {
        const timeA = a[1].lastAccessedAt ?? a[1].cachedAt;
        const timeB = b[1].lastAccessedAt ?? b[1].cachedAt;
        return timeA - timeB;
      });
      
      const evictCount = Math.max(1, Math.floor(MAX_CACHE_SIZE * 0.1));
      const entriesToRemove = entries.slice(0, evictCount);
      
      for (const [key] of entriesToRemove) {
        delete cache[key];
      }
    }
    
    const entry: ThumbnailCacheEntry = {
      base64DataUrl,
      cachedAt: now,
      lastAccessedAt: now
    };
    
    cache[mediaItemId] = entry;
    
    await chrome.storage.local.set({ thumbnailCache: cache });
  } catch (error) {
    console.error('THUMBNAIL_CACHE: Error saving to cache:', error);
  }
}

export async function clearThumbnailCache(): Promise<void> {
  try {
    await chrome.storage.local.remove('thumbnailCache');
  } catch (error) {
    console.error('THUMBNAIL_CACHE: Error clearing cache:', error);
  }
}

async function fetchThumbnailFromApi(
  mediaItemId: string,
  token: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://photoslibrary.googleapis.com/v1/mediaItems/${mediaItemId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      console.error(
        `THUMBNAIL_CACHE: API returned ${response.status} ${response.statusText}`
      );
      return null;
    }

    const mediaItem = await response.json();

    if (!mediaItem.baseUrl) {
      console.error('THUMBNAIL_CACHE: Response missing baseUrl field', {
        receivedFields: Object.keys(mediaItem || {})
      });
      return null;
    }

    const thumbnailUrl = `${mediaItem.baseUrl}=s48`;
    const imageResponse = await fetch(thumbnailUrl);
    
    if (!imageResponse.ok) {
      console.error('THUMBNAIL_CACHE: Failed to fetch image:', imageResponse.status);
      return null;
    }

    const blob = await imageResponse.blob();
    const base64DataUrl = await blobToDataUrl(blob);
    
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

export async function getThumbnailDataUrl(
  mediaItemId: string,
  token: string
): Promise<string | null> {
  const cached = await getCachedThumbnail(mediaItemId);
  if (cached) {
    return cached;
  }

  const dataUrl = await fetchThumbnailFromApi(mediaItemId, token);
  if (!dataUrl) {
    return null;
  }

  await cacheThumbnail(mediaItemId, dataUrl);

  return dataUrl;
}

/** @deprecated Use getThumbnailDataUrl instead. Returns URL that expires in 60 minutes. */
export async function getThumbnailUrl(
  mediaItemId: string,
  token: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://photoslibrary.googleapis.com/v1/mediaItems/${mediaItemId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      console.error(
        `THUMBNAIL: API returned ${response.status} ${response.statusText}`
      );
      return null;
    }

    const mediaItem = await response.json();

    if (!mediaItem.baseUrl) {
      console.error('THUMBNAIL: Response missing baseUrl field', {
        receivedFields: Object.keys(mediaItem || {})
      });
      return null;
    }

    const thumbnailUrl = `${mediaItem.baseUrl}=s48`;

    return thumbnailUrl;

  } catch (error) {
    console.error('THUMBNAIL: Failed to get thumbnail URL:', error);
    return null;
  }
}
