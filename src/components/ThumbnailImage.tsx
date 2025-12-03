import { useState, useEffect } from 'react';
import { getThumbnailDataUrl } from '../utils/thumbnailCache';
import { showError } from '../utils/toast';

/**
 * ThumbnailImage Component
 * 
 * Displays thumbnail images for upload records with proper loading and error states.
 * Uses local caching to avoid repeated API calls (Base64 Data URLs stored in chrome.storage.local).
 * 
 * Features:
 * - Skeleton loading state with shimmer animation
 * - 48x48px thumbnail display
 * - Error fallback with icon + filename
 * - Automatic OAuth token management
 * - Local thumbnail caching via getThumbnailDataUrl()
 * - No network requests for cached thumbnails
 * 
 * @param mediaItemId - Google Photos media item ID from UploadRecord
 * @param filename - Original filename for error fallback display
 */
interface ThumbnailImageProps {
  mediaItemId: string;
  filename: string;
}

export default function ThumbnailImage({ 
  mediaItemId, 
  filename 
}: ThumbnailImageProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  /**
   * Fetch thumbnail on component mount (with local caching)
   * 
   * Process:
   * 1. Get OAuth token from chrome.identity
   * 2. Call getThumbnailDataUrl() which:
   *    - First checks local cache (chrome.storage.local)
   *    - If cached, returns Base64 Data URL immediately (no network request)
   *    - If not cached, fetches from API and caches for future use
   * 3. Handle errors gracefully (show fallback)
   */
  useEffect(() => {
    let isMounted = true;

    const fetchThumbnail = async () => {
      try {
        // Step 1: Get OAuth token (non-interactive - should already be authorized)
        const result = await chrome.identity.getAuthToken({ interactive: false });
        
        if (!isMounted) return;

        if (chrome.runtime.lastError || !result?.token) {
          console.error('THUMBNAIL: Failed to get auth token:', chrome.runtime.lastError);
          showError('THUMBNAIL_LOAD_FAILED');
          setHasError(true);
          setIsLoading(false);
          return;
        }

        // Step 2: Get thumbnail (from cache or API)
        const dataUrl = await getThumbnailDataUrl(mediaItemId, result.token);

        if (!isMounted) return;

        if (dataUrl) {
          setThumbnailUrl(dataUrl);
          setIsLoading(false);
        } else {
          console.error('THUMBNAIL: getThumbnailDataUrl returned null for mediaItemId:', mediaItemId);
          showError('THUMBNAIL_LOAD_FAILED');
          setHasError(true);
          setIsLoading(false);
        }

      } catch (error) {
        if (!isMounted) return;
        
        console.error('THUMBNAIL: Unexpected error fetching thumbnail:', error);
        showError('THUMBNAIL_LOAD_FAILED');
        setHasError(true);
        setIsLoading(false);
      }
    };

    fetchThumbnail();

    // Cleanup: prevent state updates on unmounted component
    return () => {
      isMounted = false;
    };
  }, [mediaItemId]);

  /**
   * Handle image load error
   * 
   * Triggers when:
   * - Image URL is invalid
   * - Network error while loading image
   * - CORS issues (shouldn't happen with Google Photos CDN)
   */
  const handleImageError = () => {
    console.error('THUMBNAIL: Image failed to load for mediaItemId:', mediaItemId);
    showError('THUMBNAIL_LOAD_FAILED');
    setHasError(true);
  };

  // Loading state: Show skeleton with shimmer animation
  if (isLoading) {
    return <div className="thumbnail-skeleton" />;
  }

  // Error state: Show fallback with icon + filename
  if (hasError || !thumbnailUrl) {
    return (
      <div className="thumbnail-error">
        <div className="thumbnail-error-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21,15 16,10 5,21"/>
          </svg>
        </div>
        <div className="thumbnail-error-text">{filename}</div>
      </div>
    );
  }

  // Success state: Show thumbnail image
  return (
    <img 
      src={thumbnailUrl} 
      alt={filename}
      className="thumbnail-image"
      width={48}
      height={48}
      onError={handleImageError}
    />
  );
}
