import { useState, useEffect, useRef } from 'react';
import { showError } from '../utils/toast';
import type { UserProfile } from '../types/storage';

/** Maximum number of refresh retries to prevent infinite loop */
const MAX_REFRESH_RETRIES = 2;

/** Displays user avatar with dropdown menu. Shows placeholder during loading or on error. */
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
  const [refreshRetryCount, setRefreshRetryCount] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleImageError = () => {
    console.error('AVATAR: Photo URL failed to load');
    setImageError(true);
    
    // Prevent infinite loop: only retry up to MAX_REFRESH_RETRIES times
    if (refreshRetryCount < MAX_REFRESH_RETRIES) {
      setRefreshRetryCount(prev => prev + 1);
      showError('PROFILE_LOAD_FAILED');
      onRefresh?.();
    } else {
      console.warn('AVATAR: Max refresh retries reached, stopping auto-refresh');
    }
  };

  const handleAvatarClick = () => {
    // Prevent opening menu during loading
    if (isLoading) return;
    setIsMenuOpen(!isMenuOpen);
  };

  const handleLogoutClick = () => {
    setIsMenuOpen(false);
    onLogout?.();
  };

  useEffect(() => {
    // Reset error state and retry count when photoUrl changes successfully
    if (userProfile?.photoUrl && imageError) {
      setImageError(false);
      setRefreshRetryCount(0);
    }
  }, [userProfile?.photoUrl, imageError]);

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
  // Also show placeholder when photoUrl is empty (user has no profile picture)
  const showPlaceholder = isLoading || !userProfile || imageError || !userProfile.photoUrl;

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
