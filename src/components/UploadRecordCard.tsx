import ThumbnailImage from './ThumbnailImage';
import type { UploadRecord } from '../types/storage';

/**
 * UploadRecordCard Component
 * 
 * Displays a single upload record in a horizontal card layout.
 * Implements Display-Only mode where only the delete button is interactive.
 * 
 * Layout Structure:
 * [ThumbnailImage] [Filename + Timestamp] [Delete Button]
 * 
 * Features:
 * - 48x48px thumbnail on the left
 * - Filename and relative time in the middle
 * - Delete button (X icon) on the right
 * - Display-Only mode: pointer-events: none on card, auto on delete button
 * - Relative time display (e.g., "2 mins ago", "3 hours ago")
 * 
 * @param record - Upload record object from chrome.storage.local
 * @param onDelete - Callback function to delete the record by ID
 */
interface UploadRecordCardProps {
  record: UploadRecord;
  onDelete: (id: string) => void;
}

/**
 * Helper function to convert timestamp to relative time string
 * 
 * Examples:
 * - < 1 minute: "just now"
 * - < 60 minutes: "2 mins ago", "45 mins ago"
 * - < 24 hours: "3 hours ago", "12 hours ago"
 * - < 7 days: "2 days ago", "5 days ago"
 * - >= 7 days: "12/1/2025" (locale date string)
 * 
 * @param timestamp - Unix timestamp in milliseconds (Date.now())
 * @returns Relative time string in English
 */
function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function UploadRecordCard({ 
  record, 
  onDelete 
}: UploadRecordCardProps) {
  return (
    <div className="upload-record-card">
      {/* Left: Thumbnail (48x48px) */}
      <div className="record-thumbnail">
        <ThumbnailImage 
          mediaItemId={record.mediaItemId}
          filename={record.filename}
        />
      </div>
      
      {/* Middle: Filename + Timestamp */}
      <div className="record-info">
        <div className="record-filename">{record.filename}</div>
        <div className="record-timestamp">
          {getRelativeTime(record.timestamp)}
        </div>
      </div>
      
      {/* Right: Delete Button (Only Interactive Element) */}
      <button 
        className="delete-button"
        onClick={() => onDelete(record.id)}
        aria-label={`Delete ${record.filename}`}
      >
        ×
      </button>
    </div>
  );
}
