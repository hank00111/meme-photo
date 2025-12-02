import { useState, useEffect } from 'react';
import UploadRecordCard from './UploadRecordCard';
import { getUploadHistory, deleteUploadRecord } from '../utils/uploadHistory';
import { showSuccess, showError } from '../utils/toast';
import type { UploadRecord } from '../types/storage';

/**
 * UploadHistory Component
 * 
 * Displays the 10 most recent upload records from chrome.storage.local.
 * Shared component used by both Popup and Sidepanel for consistent UX.
 * 
 * Features:
 * - Fetches upload history from chrome.storage.local on mount
 * - Displays 10 most recent records in vertical layout
 * - Real-time sync via chrome.storage.onChanged listener
 * - Empty state when no records exist
 * - Loading state during initial fetch
 * - Delete functionality with UI refresh
 * 
 * Storage Sync:
 * - When Popup deletes a record, Sidepanel automatically updates
 * - When Sidepanel deletes a record, Popup automatically updates
 * - Ensures both UIs always display the same data
 * 
 * @example
 * // In popup/App.tsx or sidepanel/App.tsx
 * <div className="app-content">
 *   <UploadHistory />
 * </div>
 */
export default function UploadHistory() {
  const [records, setRecords] = useState<UploadRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initial data fetch on component mount
  useEffect(() => {
    async function fetchRecords() {
      try {
        const history = await getUploadHistory();
        setRecords(history);
      } catch (error) {
        console.error('HISTORY: Failed to fetch upload history:', error);
        setRecords([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRecords();
  }, []);

  // Real-time storage sync listener
  // Ensures Popup and Sidepanel stay in sync
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      // Only update if uploadHistory changed in local storage
      if (areaName === 'local' && changes.uploadHistory) {
        const newValue = changes.uploadHistory.newValue as UploadRecord[] | undefined;
        setRecords(newValue ?? []);
        console.log('HISTORY: Storage updated, UI synced');
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    // Cleanup listener on unmount
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  /**
   * Handle delete button click from UploadRecordCard
   * 
   * @param id - UUID of the record to delete
   */
  const handleDelete = async (id: string) => {
    try {
      const success = await deleteUploadRecord(id);
      
      if (success) {
        // Refresh UI by fetching updated records
        const updated = await getUploadHistory();
        setRecords(updated);
        showSuccess('Record deleted successfully');
      } else {
        console.warn('HISTORY: Delete failed, record not found:', id);
        showError('DELETE_FAILED');
      }
    } catch (error) {
      console.error('HISTORY: Error deleting record:', error);
      showError('DELETE_FAILED');
    }
  };

  // Loading state
  if (isLoading) {
    return <div className="loading-state">Loading...</div>;
  }

  // Empty state
  // TODO: Implement i18n for localization (English/Chinese)
  if (records.length === 0) {
    return <div className="empty-state">No upload history yet</div>;
  }

  // Loaded state: Display 10 most recent records
  const recentRecords = records.slice(0, 10);

  return (
    <div className="upload-history">
      {recentRecords.map((record) => (
        <UploadRecordCard
          key={record.id}
          record={record}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
}
