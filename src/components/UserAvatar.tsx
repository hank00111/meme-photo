import { useState } from 'react';
import { showError } from '../utils/toast';
import type { UserProfile } from '../types/storage';

/**
 * UserAvatar Component
 * 
 * Displays user's Google account avatar with fallback handling.
 * 
 * Features:
 * - 40px circular avatar display
 * - Loading state (shows placeholder)
 * - Error handling (shows placeholder + triggers refresh)
 * - Automatic fallback to gray circle on image load failure
 * 
 * @param userProfile - User profile data from chrome.storage.local (can be null)
 * @param onRefresh - Callback to parent to refetch profile when image fails to load
 * @param isLoading - External loading state from parent component
 */
interface UserAvatarProps {
  userProfile: UserProfile | null;
  onRefresh?: () => Promise<void>;
  isLoading?: boolean;
}

export default function UserAvatar({ 
  userProfile, 
  onRefresh, 
  isLoading = false 
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);

  /**
   * Handle image load error
   * 
   * When photoUrl fails to load (expired, 404, network error):
   * 1. Mark image as errored to show fallback
   * 2. Notify parent to refetch fresh profile data
   * 
   * Parent should call getUserProfile(token, true) to force refresh
   */
  const handleImageError = () => {
    console.error('AVATAR: Photo URL failed to load');
    showError('PROFILE_LOAD_FAILED');
    setImageError(true);
    onRefresh?.();
  };

  /**
   * Reset error state when userProfile changes
   * 
   * This allows retry when parent successfully refreshes the profile
   */
  if (imageError && userProfile?.photoUrl) {
    setImageError(false);
  }

  // Show placeholder during loading or when profile unavailable
  if (isLoading || !userProfile || imageError) {
    return <div className="avatar-placeholder" />;
  }

  // Show user avatar image
  return (
    <img 
      src={userProfile.photoUrl} 
      alt={userProfile.name || 'User Avatar'}
      className="user-avatar"
      onError={handleImageError}
    />
  );
}
