import { useState, useEffect } from 'react';
import { getAlbumTitle } from '../utils/albumCache';
import { showError } from '../utils/toast';

interface AlbumSelectorProps {
  onConfigureClick: () => void;
}

export default function AlbumSelector({ onConfigureClick }: AlbumSelectorProps) {
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [albumName, setAlbumName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSelectedAlbum = async () => {
      try {
        const { selectedAlbumId } = await chrome.storage.sync.get('selectedAlbumId');
        setSelectedAlbumId((selectedAlbumId as string | undefined) || null);
      } catch (error) {
        console.error('ALBUM_SELECTOR: Failed to load selected album ID:', error);
        showError('STORAGE_READ_FAILED');
      } finally {
        setIsLoading(false);
      }
    };

    loadSelectedAlbum();
  }, []);

  useEffect(() => {
    if (!selectedAlbumId) {
      setAlbumName(null);
      return;
    }

    let ignore = false;

    const fetchAlbumName = async () => {
      try {
        // getAlbumTitle reads from cache only (no API call)
        const name = await getAlbumTitle(selectedAlbumId);
        if (!ignore) {
          setAlbumName(name || 'Unknown Album');
        }
      } catch (error) {
        console.error('ALBUM_SELECTOR: Failed to fetch album name:', error);
        if (!ignore) {
          setAlbumName('Unknown Album');
        }
      }
    };

    fetchAlbumName();

    return () => {
      ignore = true;
    };
  }, [selectedAlbumId]);

  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'sync' && changes.selectedAlbumId) {
        const newAlbumId = changes.selectedAlbumId.newValue as string | undefined;
        setSelectedAlbumId(newAlbumId || null);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="album-selector">
        <div className="album-selector-content">
          <span className="album-current-label">Current:</span>
          <div className="album-name-skeleton" />
        </div>
        <button className="album-configure-button" disabled>
          ⚙️ Configure
        </button>
      </div>
    );
  }

  const displayName = selectedAlbumId && albumName ? albumName : 'Main Library';

  return (
    <div className="album-selector">
      <div className="album-selector-content">
        <span className="album-current-label">Current:</span>
        <span className="album-name">{displayName}</span>
      </div>
      <button 
        className="album-configure-button" 
        onClick={onConfigureClick}
        aria-label="Configure upload destination"
      >
        ⚙️ Configure
      </button>
    </div>
  );
}
