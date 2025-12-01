/**
 * Thumbnail Cache Utility for Meme Photo Extension
 * 
 * Handles dynamic fetching of thumbnail URLs from Google Photos Library API.
 * 
 * WHY THIS IS NEEDED:
 * Google Photos baseUrl expires after 60 minutes. Instead of storing expired URLs,
 * we store mediaItemId and fetch fresh baseUrl dynamically when displaying thumbnails.
 * 
 * DEPENDENCIES:
 * - Requires OAuth scope: photoslibrary.readonly.appcreateddata
 * - Works with UploadRecord.mediaItemId stored by background script
 * 
 * USAGE EXAMPLE:
 * ```typescript
 * const token = await chrome.identity.getAuthToken({ interactive: false });
 * const thumbnailUrl = await getThumbnailUrl(record.mediaItemId, token.token);
 * if (thumbnailUrl) {
 *   imgElement.src = thumbnailUrl;
 * }
 * ```
 */

/**
 * Fetches a fresh thumbnail URL from Google Photos Library API
 * 
 * This function handles the baseUrl expiration issue by dynamically requesting
 * the latest media item data from Google Photos API and constructing a thumbnail URL
 * with the specified dimensions (200x200px).
 * 
 * @param mediaItemId - Google Photos media item ID (stored in UploadRecord)
 * @param token - OAuth 2.0 access token from chrome.identity.getAuthToken()
 * @returns Promise resolving to thumbnail URL (baseUrl + size parameter) or null on failure
 * 
 * @example
 * ```typescript
 * const url = await getThumbnailUrl('ABC123xyz', 'ya29.a0...');
 * // Returns: "https://lh3.googleusercontent.com/lr/abc123=w200-h200"
 * ```
 * 
 * API ENDPOINT: GET https://photoslibrary.googleapis.com/v1/mediaItems/{mediaItemId}
 * RESPONSE STRUCTURE:
 * ```json
 * {
 *   "id": "ABC123xyz",
 *   "baseUrl": "https://lh3.googleusercontent.com/lr/abc123",
 *   "mimeType": "image/jpeg",
 *   ...
 * }
 * ```
 * 
 * SIZE PARAMETER:
 * The "=w200-h200" suffix scales the image to 200x200px while maintaining aspect ratio.
 * See: https://developers.google.com/photos/library/guides/access-media-items#base-urls
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

    const thumbnailUrl = `${mediaItem.baseUrl}=w200-h200`;
    console.log('THUMBNAIL: Successfully fetched thumbnail URL');

    return thumbnailUrl;

  } catch (error) {
    console.error('THUMBNAIL: Failed to get thumbnail URL:', error);
    return null;
  }
}
