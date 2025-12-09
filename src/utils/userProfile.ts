/** User profile with 1-day cache (OpenID Connect) */

import type { UserProfile, StorageSchema } from '../types/storage';

interface UserInfoResponse {
  sub: string;
  name?: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
  locale?: string;
}

/** 1-day cache expiration */
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

/** UserInfo API endpoint (OpenID Connect standard) */
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';

/** Fetch user profile (cached for 1 day) */
export async function getUserProfile(
  token: string,
  forceRefresh = false
): Promise<UserProfile | null> {
  try {
    if (!forceRefresh) {
      const cached = await getCachedProfile();
      if (cached) {
        return cached;
      }
    }

    const response = await fetch(USERINFO_ENDPOINT, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('USER_PROFILE: API request failed', {
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    const data: UserInfoResponse = await response.json();

    // Only 'sub' is required by OpenID Connect Core 1.0 Section 5.3.2
    // 'name' and 'picture' are optional claims that may not be returned
    if (!data.sub) {
      console.error('USER_PROFILE: Missing required sub field in response', {
        receivedFields: Object.keys(data),
        hasName: !!data.name,
        hasPicture: !!data.picture
      });
      return null;
    }

    const profile: UserProfile = {
      // Use 'User' as fallback when name is not provided
      name: data.name || 'User',
      // Empty string triggers placeholder in UI components
      photoUrl: data.picture || '',
      lastUpdated: Date.now(),
    };

    await cacheProfile(profile);

    return profile;
  } catch (error) {
    console.error('USER_PROFILE: Unexpected error fetching profile', error);
    return null;
  }
}

async function getCachedProfile(): Promise<UserProfile | null> {
  try {
    const result = await chrome.storage.local.get('userProfile') as Pick<StorageSchema, 'userProfile'>;
    const cached = result.userProfile;

    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.lastUpdated;
    if (age > CACHE_EXPIRY_MS) {
      return null;
    }

    return cached;
  } catch (error) {
    console.error('USER_PROFILE: Error reading cache', error);
    return null;
  }
}

async function cacheProfile(profile: UserProfile): Promise<void> {
  try {
    await chrome.storage.local.set({ userProfile: profile });
  } catch (error) {
    console.error('USER_PROFILE: Error saving to cache', error);
  }
}

export async function clearUserProfile(): Promise<void> {
  try {
    await chrome.storage.local.remove('userProfile');
  } catch (error) {
    console.error('USER_PROFILE: Error clearing cache', error);
  }
}
