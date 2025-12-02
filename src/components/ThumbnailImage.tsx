import { useState, useEffect } from 'react';
import { getThumbnailUrl } from '../utils/thumbnailCache';
import { showError } from '../utils/toast';

/**
 * ThumbnailImage Component
 * 
 * Displays thumbnail images for upload records with proper loading and error states.
 * Handles Google Photos baseUrl 60-minute expiration by dynamically fetching fresh URLs.
 * 
 * Features:
 * - Skeleton loading state with shimmer animation
 * - 48x48px thumbnail display
 * - Error fallback with icon + filename
 * - Automatic OAuth token management
 * - Dynamic baseUrl fetching via getThumbnailUrl()
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
   * Fetch thumbnail URL on component mount
   * 
   * Process:
   * 1. Get OAuth token from chrome.identity
   * 2. Call getThumbnailUrl() to fetch fresh baseUrl from Google Photos API
   * 3. Append size parameter (=w200-h200) for thumbnail dimensions
   * 4. Handle errors gracefully (show fallback)
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

        // Step 2: Fetch fresh thumbnail URL from Google Photos API
        const url = await getThumbnailUrl(mediaItemId, result.token);

        if (!isMounted) return;

        if (url) {
          setThumbnailUrl(url);
          setIsLoading(false);
        } else {
          console.error('THUMBNAIL: getThumbnailUrl returned null for mediaItemId:', mediaItemId);
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
        <div className="thumbnail-error-icon">📷</div>
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
