/** Upload history management with 50-record limit. */

import type { UploadRecord } from '../types/storage';

const MAX_RECORDS = 50;

export async function getUploadHistory(): Promise<UploadRecord[]> {
  try {
    const result = await chrome.storage.local.get('uploadHistory');
    return (result.uploadHistory ?? []) as UploadRecord[];
  } catch (error) {
    console.error('HISTORY: Failed to get upload history:', error);
    return [];
  }
}

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

export async function clearUploadHistory(): Promise<void> {
  try {
    await chrome.storage.local.remove('uploadHistory');
    console.log('HISTORY: All upload history cleared');
  } catch (error) {
    console.error('HISTORY: Failed to clear upload history:', error);
  }
}
