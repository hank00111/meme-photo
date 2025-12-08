import { useState, useEffect } from 'react';
import { getOrCreateMemePhotoAlbum, cacheAlbumTitle, type Album } from '../utils/albumCache';
import { showToast, ERROR_MESSAGES } from '../utils/toast';

interface AlbumSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AlbumSelectorModal({ isOpen, onClose }: AlbumSelectorModalProps) {
  const [memePhotoAlbum, setMemePhotoAlbum] = useState<Album | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let ignore = false; // React cleanup pattern to prevent race conditions

    const loadData = async () => {
      setIsLoading(true);

      try {
        const result = await chrome.storage.sync.get('selectedAlbumId');
        let currentSelection = (result.selectedAlbumId as string | undefined) || null;

        const tokenResult = await chrome.identity.getAuthToken({ interactive: false });
        if (!tokenResult?.token) {
          throw new Error('AUTH_TOKEN_MISSING');
        }

        const album = await getOrCreateMemePhotoAlbum(tokenResult.token);

        if (currentSelection && currentSelection !== album.id) {
          currentSelection = album.id;
          await chrome.storage.sync.set({ selectedAlbumId: album.id });
        }

        if (!ignore) {
          setMemePhotoAlbum(album);
          setSelectedId(currentSelection);
          await cacheAlbumTitle(album.id, album.title);
        }
      } catch (error) {
        if (!ignore) {
          console.error('ALBUM_MODAL: Failed to load meme-photo album', error);
          
          const errorMessage = error instanceof Error && error.message === 'AUTH_TOKEN_EXPIRED'
            ? ERROR_MESSAGES.AUTH_TOKEN_EXPIRED
            : ERROR_MESSAGES.ALBUM_LOAD_FAILED;
          
          showToast(errorMessage, 'error');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      ignore = true; // Cleanup: prevent state updates after unmount
    };
  }, [isOpen]);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      await chrome.storage.sync.set({ selectedAlbumId: selectedId });

      showToast(
        selectedId 
          ? 'Upload destination updated' 
          : 'Upload destination set to Main Library',
        'success'
      );

      onClose();
    } catch (error) {
      console.error('ALBUM_MODAL: Failed to save selection', error);
      showToast(ERROR_MESSAGES.STORAGE_WRITE_ERROR, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div className="album-modal-overlay" onClick={handleCancel}>
      <div className="album-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Title */}
        <h2 className="album-modal-title">Select Album</h2>

        {/* Loading State */}
        {isLoading && (
          <div className="album-modal-loading">
            <div className="album-name-skeleton"></div>
            <div className="album-name-skeleton"></div>
            <div className="album-name-skeleton"></div>
          </div>
        )}

        {/* Loaded State */}
        {!isLoading && (
          <>
            {/* Option 1: meme-photo Album (Default) */}
            {memePhotoAlbum && (
              <div className="album-option">
                <label>
                  <input
                    type="radio"
                    name="album"
                    checked={selectedId === memePhotoAlbum.id}
                    onChange={() => setSelectedId(memePhotoAlbum.id)}
                    disabled={isSaving}
                  />
                  <span className="album-option-label">meme-photo</span>
                </label>
              </div>
            )}

            {/* Option 2: Main Library */}
            <div className="album-option">
              <label>
                <input
                  type="radio"
                  name="album"
                  checked={selectedId === null}
                  onChange={() => setSelectedId(null)}
                  disabled={isSaving}
                />
                <span className="album-option-label">Main Library</span>
              </label>
            </div>
          </>
        )}

        {/* Bottom Buttons */}
        <div className="album-modal-buttons">
          <button
            className="btn-modal-cancel"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            className="btn-modal-save"
            onClick={handleSave}
            disabled={isSaving || isLoading}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
