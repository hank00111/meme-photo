import ThumbnailImage from './ThumbnailImage';
import type { UploadRecord } from '../types/storage';

/** Displays upload record with thumbnail, filename, timestamp, and delete button. */
interface UploadRecordCardProps {
  record: UploadRecord;
  onDelete: (id: string) => void;
}

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
