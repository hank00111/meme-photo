import { useState, useEffect } from 'react';
import { getAlbumTitle } from '../utils/albumCache';
import { showError } from '../utils/toast';

/**
 * AlbumSelector Component
 * 
 * Displays current upload destination (main library or selected album).
 * Users can click "Configure" button to open album selection modal.
 * 
 * Features:
 * - Shows "Main Library" when no album selected (uploads to main library)
 * - Shows album name when album is selected
 * - Real-time sync across Popup and Sidepanel via chrome.storage.onChanged
 * - Loading skeleton during album name fetching
 * - Configure button to open AlbumSelectorModal (Phase 7.3)
 * 
 * Storage:
 * - Reads selectedAlbumId from chrome.storage.sync
 * - Reads album name from cache (7-day TTL) or API
 * 
 * @param onConfigureClick - Callback to parent to open AlbumSelectorModal
 */
interface AlbumSelectorProps {
  onConfigureClick: () => void;
}

export default function AlbumSelector({ onConfigureClick }: AlbumSelectorProps) {
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [albumName, setAlbumName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Load selected album ID from chrome.storage.sync on mount
   */
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

  /**
   * Fetch album name when selectedAlbumId changes
   */
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

  /**
   * Listen to chrome.storage.sync changes for real-time sync
   * 
   * When user changes album in Popup, Sidepanel updates automatically.
   * When user changes album in Sidepanel, Popup updates automatically.
   */
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'sync' && changes.selectedAlbumId) {
        const newAlbumId = changes.selectedAlbumId.newValue as string | undefined;
        console.log('ALBUM_SELECTOR: selectedAlbumId changed:', newAlbumId);
        setSelectedAlbumId(newAlbumId || null);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  /**
   * Render loading skeleton during initialization
   */
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
