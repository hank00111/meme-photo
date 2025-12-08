import { useState, useEffect } from 'react';
import UploadRecordCard from './UploadRecordCard';
import { getUploadHistory, deleteUploadRecord } from '../utils/uploadHistory';
import { showSuccess, showError } from '../utils/toast';
import { cleanupThumbnailErrorAggregator } from '../utils/thumbnailErrorAggregator';
import type { UploadRecord } from '../types/storage';

/** Displays 10 most recent uploads with real-time sync across popup/sidepanel. */
export default function UploadHistory() {
  const [records, setRecords] = useState<UploadRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes.uploadHistory) {
        const newValue = changes.uploadHistory.newValue as UploadRecord[] | undefined;
        setRecords(newValue ?? []);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      cleanupThumbnailErrorAggregator();
    };
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const success = await deleteUploadRecord(id);
      
      if (success) {
        // UI will be updated automatically via storage.onChanged listener
        // No need for redundant getUploadHistory() call
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

  if (records.length === 0) {
    return <div className="empty-state">No upload history yet</div>;
  }

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
