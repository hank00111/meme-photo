/**
 * Upload History Utility
 * 
 * Manages CRUD operations for upload records in chrome.storage.local.
 * Implements a 50-record limit to keep storage usage minimal.
 * 
 * Storage Architecture:
 * - Storage Layer: Maximum 50 records (enforced via .slice(0, 50))
 * - UI Layer: Displays 10 most recent records (handled by UI components)
 * - Space Usage: ~25 KB for 50 records (0.25% of 10 MB quota)
 */

import type { UploadRecord } from '../types/storage';

/**
 * Maximum number of upload records to keep in storage.
 * Older records are automatically removed when this limit is exceeded.
 */
const MAX_RECORDS = 50;

/**
 * Get all upload history records from storage.
 * 
 * @returns Promise resolving to array of upload records (newest first)
 * @returns Empty array if no records exist or if an error occurs
 * 
 * @example
 * const history = await getUploadHistory();
 * const recentRecords = history.slice(0, 10); // Get 10 most recent
 */
export async function getUploadHistory(): Promise<UploadRecord[]> {
  try {
    const result = await chrome.storage.local.get('uploadHistory');
    return result.uploadHistory ?? [];
  } catch (error) {
    console.error('HISTORY: Failed to get upload history:', error);
    return [];
  }
}

/**
 * Add a new upload record to storage.
 * Automatically generates UUID and timestamp.
 * Enforces 50-record limit by removing oldest records.
 * 
 * @param record - Upload record data (without id and timestamp)
 * @returns Promise that resolves when record is saved
 * 
 * @example
 * await addUploadRecord({
 *   filename: 'meme.jpg',
 *   mediaItemId: 'AJ...',
 *   productUrl: 'https://photos.google.com/...',
 *   albumId: 'AP...' // optional
 * });
 */
export async function addUploadRecord(
  record: Omit<UploadRecord, 'id' | 'timestamp'>
): Promise<void> {
  try {
    // Generate unique ID and timestamp
    const newRecord: UploadRecord = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...record
    };

    // Get existing history
    const { uploadHistory = [] } = await chrome.storage.local.get('uploadHistory');

    // Add new record at the beginning and enforce 50-record limit
    const updated = [newRecord, ...uploadHistory].slice(0, MAX_RECORDS);

    // Save back to storage
    await chrome.storage.local.set({ uploadHistory: updated });

    console.log('HISTORY: Record added successfully', {
      id: newRecord.id,
      filename: newRecord.filename,
      totalRecords: updated.length
    });
  } catch (error) {
    console.error('HISTORY: Failed to add upload record:', error);
    throw error; // Re-throw to allow caller to handle
  }
}

/**
 * Delete an upload record from storage by ID.
 * 
 * @param id - UUID of the record to delete
 * @returns Promise resolving to true if deleted, false if not found
 * 
 * @example
 * const success = await deleteUploadRecord('f47ac10b-58cc-4372-a567-0e02b2c3d479');
 * if (success) {
 *   console.log('Record deleted');
 * }
 */
export async function deleteUploadRecord(id: string): Promise<boolean> {
  try {
    const { uploadHistory = [] } = await chrome.storage.local.get('uploadHistory');

    // Filter out the record with matching ID
    const updated = uploadHistory.filter((r: UploadRecord) => r.id !== id);

    // Check if any record was actually removed
    if (updated.length === uploadHistory.length) {
      console.warn('HISTORY: Record not found for deletion:', id);
      return false;
    }

    // Save updated history
    await chrome.storage.local.set({ uploadHistory: updated });

    console.log('HISTORY: Record deleted successfully', {
      id,
      remainingRecords: updated.length
    });

    return true;
  } catch (error) {
    console.error('HISTORY: Failed to delete upload record:', error);
    return false;
  }
}
