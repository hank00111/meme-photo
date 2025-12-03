/**
 * Upload History Utility
 * Manages upload records in chrome.storage.local with 50-record limit.
 */

import type { UploadRecord } from '../types/storage';

/** Maximum records to keep. Older records are auto-removed. */
const MAX_RECORDS = 50;

/** Get all upload records from storage (newest first). */
export async function getUploadHistory(): Promise<UploadRecord[]> {
  try {
    const result = await chrome.storage.local.get('uploadHistory');
    return (result.uploadHistory ?? []) as UploadRecord[];
  } catch (error) {
    console.error('HISTORY: Failed to get upload history:', error);
    return [];
  }
}

/** Add a new upload record. Auto-generates UUID and timestamp, enforces 50-record limit. */
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
    const result = await chrome.storage.local.get('uploadHistory');
    const uploadHistory = (result.uploadHistory ?? []) as UploadRecord[];

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

/** Delete an upload record by ID. Returns true if deleted, false if not found. */
export async function deleteUploadRecord(id: string): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get('uploadHistory');
    const uploadHistory = (result.uploadHistory ?? []) as UploadRecord[];

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
