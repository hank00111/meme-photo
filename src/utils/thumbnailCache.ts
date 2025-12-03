/**
 * Thumbnail Cache Utility for Meme Photo Extension
 * 
 * Handles caching of thumbnail images locally to avoid repeated API calls.
 * Thumbnails are stored as Base64 Data URLs in chrome.storage.local.
 * 
 * WHY THIS IS NEEDED:
 * Google Photos baseUrl expires after 60 minutes. Instead of fetching from API
 * every time, we cache the actual image data locally. The image content is permanent,
 * only the URL expires.
 * 
 * STORAGE ARCHITECTURE:
 * - Location: chrome.storage.local.thumbnailCache
 * - Format: { [mediaItemId]: { base64DataUrl, cachedAt } }
 * - Size estimate: ~3-7 KB per thumbnail (48x48px)
 * - Max storage: ~350 KB for 50 thumbnails (well within 10 MB limit)
 * 
 * DEPENDENCIES:
 * - Requires OAuth scope: photoslibrary.readonly.appcreateddata
 * - Works with UploadRecord.mediaItemId stored by background script
 * 
 * USAGE EXAMPLE:
 * ```typescript
 * const token = await chrome.identity.getAuthToken({ interactive: false });
 * const thumbnailDataUrl = await getThumbnailDataUrl(record.mediaItemId, token.token);
 * if (thumbnailDataUrl) {
 *   imgElement.src = thumbnailDataUrl;
 * }
 * ```
 */

import type { ThumbnailCache, ThumbnailCacheEntry } from '../types/storage';

/**
 * Retrieves cached thumbnail from chrome.storage.local
 * 
 * @param mediaItemId - Google Photos media item ID
 * @returns Cached Base64 Data URL or null if not cached
 */
async function getCachedThumbnail(mediaItemId: string): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get('thumbnailCache');
    const cache: ThumbnailCache = result.thumbnailCache ?? {};
    
    const entry = cache[mediaItemId];
    if (entry?.base64DataUrl) {
      console.log('THUMBNAIL_CACHE: Cache hit for mediaItemId:', mediaItemId);
      return entry.base64DataUrl;
    }
    
    console.log('THUMBNAIL_CACHE: Cache miss for mediaItemId:', mediaItemId);
    return null;
  } catch (error) {
    console.error('THUMBNAIL_CACHE: Error reading cache:', error);
    return null;
  }
}

/**
 * Saves thumbnail to chrome.storage.local cache
 * 
 * @param mediaItemId - Google Photos media item ID
 * @param base64DataUrl - Base64 encoded image data URL
 */
async function cacheThumbnail(
  mediaItemId: string,
  base64DataUrl: string
): Promise<void> {
  try {
    const result = await chrome.storage.local.get('thumbnailCache');
    const cache: ThumbnailCache = result.thumbnailCache ?? {};
    
    const entry: ThumbnailCacheEntry = {
      base64DataUrl,
      cachedAt: Date.now()
    };
    
    cache[mediaItemId] = entry;
    
    await chrome.storage.local.set({ thumbnailCache: cache });
    console.log('THUMBNAIL_CACHE: Cached thumbnail for mediaItemId:', mediaItemId);
  } catch (error) {
    console.error('THUMBNAIL_CACHE: Error saving to cache:', error);
  }
}

/**
 * Clears all cached thumbnails from chrome.storage.local
 * 
 * This should be called when the user logs out to ensure privacy
 * and free up storage space.
 * 
 * @example
 * ```typescript
 * // In logout handler
 * await clearThumbnailCache();
 * ```
 */
export async function clearThumbnailCache(): Promise<void> {
  try {
    await chrome.storage.local.remove('thumbnailCache');
    console.log('THUMBNAIL_CACHE: All cached thumbnails cleared');
  } catch (error) {
    console.error('THUMBNAIL_CACHE: Error clearing cache:', error);
  }
}

/**
 * Fetches thumbnail from Google Photos API and converts to Base64 Data URL
 * 
 * @param mediaItemId - Google Photos media item ID
 * @param token - OAuth 2.0 access token
 * @returns Base64 Data URL or null on failure
 */
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

/**
 * Converts Blob to Base64 Data URL
 * 
 * @param blob - Image blob
 * @returns Base64 Data URL string
 */
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

/**
 * Gets thumbnail as Base64 Data URL (with caching)
 * 
 * This is the main function to use for displaying thumbnails.
 * It first checks the local cache, and only fetches from API if not cached.
 * After fetching, the thumbnail is cached for future use.
 * 
 * @param mediaItemId - Google Photos media item ID (stored in UploadRecord)
 * @param token - OAuth 2.0 access token from chrome.identity.getAuthToken()
 * @returns Promise resolving to Base64 Data URL or null on failure
 * 
 * @example
 * ```typescript
 * const dataUrl = await getThumbnailDataUrl('ABC123xyz', 'ya29.a0...');
 * if (dataUrl) {
 *   imgElement.src = dataUrl;
 * }
 * ```
 */
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

/**
 * @deprecated Use getThumbnailDataUrl instead. This function is kept for backward compatibility.
 * 
 * Fetches a fresh thumbnail URL from Google Photos Library API
 * Note: This returns a URL that expires in 60 minutes.
 */
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
