import { useState, useEffect, useRef } from 'react';
import { showError } from '../utils/toast';
import type { UserProfile } from '../types/storage';

/**
 * UserAvatar Component
 * 
 * Displays user's Google account avatar with dropdown menu for logout.
 * 
 * Features:
 * - 40px circular avatar display
 * - Loading state (shows placeholder)
 * - Error handling (shows placeholder + triggers refresh)
 * - Automatic fallback to gray circle on image load failure
 * - Hover effect (scale + green ring)
 * - Dropdown menu with Logout button
 * - Click outside to close menu
 * - Escape key to close menu
 * 
 * @param userProfile - User profile data from chrome.storage.local (can be null)
 * @param onRefresh - Callback to parent to refetch profile when image fails to load
 * @param onLogout - Callback to parent to handle logout
 * @param isLoading - External loading state from parent component
 */
interface UserAvatarProps {
  userProfile: UserProfile | null;
  onRefresh?: () => Promise<void>;
  onLogout?: () => Promise<void>;
  isLoading?: boolean;
}

export default function UserAvatar({ 
  userProfile, 
  onRefresh, 
  onLogout,
  isLoading = false 
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
   * Handle avatar click to toggle menu
   * 
   * - Prevents opening menu during loading state
   * - Toggles menu visibility
   */
  const handleAvatarClick = () => {
    // Prevent opening menu during loading
    if (isLoading) return;
    setIsMenuOpen(!isMenuOpen);
  };

  /**
   * Handle logout button click
   * 
   * - Close menu first
   * - Then trigger logout callback
   */
  const handleLogoutClick = () => {
    setIsMenuOpen(false);
    onLogout?.();
  };

  /**
   * Reset error state when userProfile changes
   * 
   * This allows retry when parent successfully refreshes the profile.
   * Using useEffect to avoid calling setState during render phase.
   */
  useEffect(() => {
    if (imageError && userProfile?.photoUrl) {
      setImageError(false);
    }
  }, [userProfile?.photoUrl, imageError]);

  /**
   * Handle click outside to close menu
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  /**
   * Handle Escape key to close menu
   */
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isMenuOpen]);

  // Determine if we should show placeholder
  const showPlaceholder = isLoading || !userProfile || imageError;

  return (
    <div 
      className="user-avatar-wrapper" 
      ref={wrapperRef} 
      onClick={handleAvatarClick}
    >
      {/* Avatar or Placeholder */}
      {showPlaceholder ? (
        <div className="avatar-placeholder" />
      ) : (
        <img 
          src={userProfile.photoUrl} 
          alt={userProfile.name || 'User Avatar'}
          className="user-avatar"
          onError={handleImageError}
        />
      )}

      {/* Dropdown Menu - only show when menu is open, not loading, and has userProfile */}
      {isMenuOpen && !isLoading && userProfile && (
        <div className="user-menu">
          <button className="user-menu-item" onClick={handleLogoutClick}>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
