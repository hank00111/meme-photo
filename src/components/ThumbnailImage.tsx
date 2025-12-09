import { useState, useEffect } from 'react';
import { getThumbnailDataUrl } from '../utils/thumbnailCache';
import { reportThumbnailError } from '../utils/thumbnailErrorAggregator';

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

  useEffect(() => {
    let isMounted = true;

    const fetchThumbnail = async () => {
      try {
        const result = await chrome.identity.getAuthToken({ interactive: false });
        
        if (!isMounted) return;

        if (chrome.runtime.lastError || !result?.token) {
          console.error('THUMBNAIL: Failed to get auth token:', chrome.runtime.lastError);
          reportThumbnailError();
          setHasError(true);
          setIsLoading(false);
          return;
        }

        const dataUrl = await getThumbnailDataUrl(mediaItemId, result.token);

        if (!isMounted) return;

        if (dataUrl) {
          setThumbnailUrl(dataUrl);
          setIsLoading(false);
        } else {
          console.error('THUMBNAIL: getThumbnailDataUrl returned null for mediaItemId:', mediaItemId);
          reportThumbnailError();
          setHasError(true);
          setIsLoading(false);
        }

      } catch (error) {
        if (!isMounted) return;
        
        console.error('THUMBNAIL: Unexpected error fetching thumbnail:', error);
        reportThumbnailError();
        setHasError(true);
        setIsLoading(false);
      }
    };

    fetchThumbnail();

    return () => {
      isMounted = false;
    };
  }, [mediaItemId]);

  const handleImageError = () => {
    console.error('THUMBNAIL: Image failed to load for mediaItemId:', mediaItemId);
    reportThumbnailError();
    setHasError(true);
  };

  if (isLoading) {
    return <div className="thumbnail-skeleton" />;
  }

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
