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
    const newRecord: UploadRecord = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...record
    };

    const result = await chrome.storage.local.get('uploadHistory');
    const uploadHistory = (result.uploadHistory ?? []) as UploadRecord[];

    const updated = [newRecord, ...uploadHistory].slice(0, MAX_RECORDS);

    await chrome.storage.local.set({ uploadHistory: updated });

  } catch (error) {
    console.error('HISTORY: Failed to add upload record:', error);
    throw error; // Re-throw to allow caller to handle
  }
}

export async function deleteUploadRecord(id: string): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get('uploadHistory');
    const uploadHistory = (result.uploadHistory ?? []) as UploadRecord[];

    const updated = uploadHistory.filter((r: UploadRecord) => r.id !== id);

    if (updated.length === uploadHistory.length) {
      console.warn('HISTORY: Record not found for deletion:', id);
      return false;
    }

    await chrome.storage.local.set({ uploadHistory: updated });

    return true;
  } catch (error) {
    console.error('HISTORY: Failed to delete upload record:', error);
    return false;
  }
}

export async function clearUploadHistory(): Promise<void> {
  try {
    await chrome.storage.local.remove('uploadHistory');
  } catch (error) {
    console.error('HISTORY: Failed to clear upload history:', error);
  }
}
