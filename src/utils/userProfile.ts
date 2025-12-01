/**
 * User Profile Utility
 * 
 * Handles fetching and caching user profile information from Google UserInfo endpoint.
 * Uses OpenID Connect standard userinfo.profile scope.
 * 
 * API Reference: https://developers.google.com/identity/protocols/oauth2/openid-connect
 * Endpoint: https://www.googleapis.com/oauth2/v3/userinfo
 */

import type { UserProfile, StorageSchema } from '../types/storage';

/**
 * UserInfo API Response Interface
 * 
 * Standard OpenID Connect UserInfo response structure.
 * Documentation: https://openid.net/specs/openid-connect-core-1_0.html#UserInfoResponse
 */
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

/**
 * Fetches user profile information from Google UserInfo endpoint
 * 
 * This function retrieves the user's name and profile photo URL using the
 * OpenID Connect UserInfo endpoint. It implements caching to avoid unnecessary
 * API calls - cached data is valid for 7 days.
 * 
 * @param token - OAuth 2.0 access token from chrome.identity.getAuthToken()
 * @param forceRefresh - If true, bypasses cache and fetches fresh data
 * @returns UserProfile object with name and photoUrl, or null if fetch fails
 * 
 * @example
 * ```typescript
 * const token = await chrome.identity.getAuthToken({ interactive: false });
 * if (token) {
 *   const profile = await getUserProfile(token);
 *   if (profile) {
 *     console.log(`User: ${profile.name}`);
 *   }
 * }
 * ```
 */
export async function getUserProfile(
  token: string,
  forceRefresh = false
): Promise<UserProfile | null> {
  try {
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await getCachedProfile();
      if (cached) {
        console.log('USER_PROFILE: Using cached profile data');
        return cached;
      }
    }

    // Fetch from UserInfo API
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

    // Validate required fields
    if (!data.name || !data.picture) {
      console.error('USER_PROFILE: Missing required fields in response', data);
      return null;
    }

    // Create UserProfile object
    const profile: UserProfile = {
      name: data.name,
      photoUrl: data.picture,
      lastUpdated: Date.now(),
    };

    // Cache the profile
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

    // Check if cache is still valid
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

/**
 * Clears cached user profile from chrome.storage.local
 * 
 * This should be called when the user logs out or when you want to
 * force a refresh of the profile data.
 * 
 * @example
 * ```typescript
 * await clearUserProfile();
 * ```
 */
export async function clearUserProfile(): Promise<void> {
  try {
    await chrome.storage.local.remove('userProfile');
    console.log('USER_PROFILE: Cache cleared');
  } catch (error) {
    console.error('USER_PROFILE: Error clearing cache', error);
  }
}
