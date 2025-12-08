/** User profile fetching and caching with 7-day TTL. API: https://developers.google.com/identity/protocols/oauth2/openid-connect */

import type { UserProfile, StorageSchema } from '../types/storage';

/** OpenID Connect UserInfo response. */
interface UserInfoResponse {
  /** Subject identifier (unique user ID) */
  sub: string;
  
  /** User's full name */
  name?: string;
  
  /** User's profile picture URL */
  picture?: string;
  
  /** User's email address */
  email?: string;
  
  /** Whether email is verified */
  email_verified?: boolean;
  
  /** User's locale (language preference) */
  locale?: string;
}

/**
 * Cache expiration time: 7 days in milliseconds
 * 
 * Profile data (name and photo URL) is relatively stable, so we cache it
 * for 7 days to minimize API calls while ensuring data freshness.
 */
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * UserInfo API endpoint (OpenID Connect standard)
 */
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';

/** Fetches user profile from Google UserInfo endpoint. Uses 7-day cache unless forceRefresh=true. */
export async function getUserProfile(
  token: string,
  forceRefresh = false
): Promise<UserProfile | null> {
  try {
    if (!forceRefresh) {
      const cached = await getCachedProfile();
      if (cached) {
        console.log('USER_PROFILE: Using cached profile data');
        return cached;
      }
    }

    console.log('USER_PROFILE: Fetching profile from UserInfo endpoint');
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

    if (!data.name || !data.picture) {
      console.error('USER_PROFILE: Missing required fields in response', data);
      return null;
    }

    const profile: UserProfile = {
      name: data.name,
      photoUrl: data.picture,
      lastUpdated: Date.now(),
    };

    await cacheProfile(profile);
    console.log('USER_PROFILE: Profile fetched and cached successfully');

    return profile;
  } catch (error) {
    console.error('USER_PROFILE: Unexpected error fetching profile', error);
    return null;
  }
}

/**
 * Retrieves cached user profile from chrome.storage.local
 * 
 * @returns Cached UserProfile if valid (not expired), null otherwise
 */
async function getCachedProfile(): Promise<UserProfile | null> {
  try {
    const result = await chrome.storage.local.get('userProfile') as Pick<StorageSchema, 'userProfile'>;
    const cached = result.userProfile;

    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.lastUpdated;
    if (age > CACHE_EXPIRY_MS) {
      console.log('USER_PROFILE: Cache expired, will fetch fresh data');
      return null;
    }

    return cached;
  } catch (error) {
    console.error('USER_PROFILE: Error reading cache', error);
    return null;
  }
}

/**
 * Saves user profile to chrome.storage.local
 * 
 * @param profile - UserProfile object to cache
 */
async function cacheProfile(profile: UserProfile): Promise<void> {
  try {
    await chrome.storage.local.set({ userProfile: profile });
  } catch (error) {
    console.error('USER_PROFILE: Error saving to cache', error);
  }
}

/** Clears cached user profile. Call on logout. */
export async function clearUserProfile(): Promise<void> {
  try {
    await chrome.storage.local.remove('userProfile');
    console.log('USER_PROFILE: Cache cleared');
  } catch (error) {
    console.error('USER_PROFILE: Error clearing cache', error);
  }
}
