import { useState, useEffect, useRef } from 'react';
import { showError } from '../utils/toast';
import type { UserProfile } from '../types/storage';

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
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleImageError = () => {
    console.error('AVATAR: Photo URL failed to load');
    showError('PROFILE_LOAD_FAILED');
    setImageError(true);
    onRefresh?.();
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
    if (imageError && userProfile?.photoUrl) {
      setImageError(false);
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
