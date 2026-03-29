import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Loads profile identity and manages profile menu open/close behavior.
 * @returns {{
 * isProfileMenuOpen: boolean,
 * setIsProfileMenuOpen: Function,
 * setProfileMenuElement: Function,
 * profilePhotoUrl: string,
 * profileInitials: string
 * }}
 */
export function useProfileMenu() {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [profileMenuElement, setProfileMenuElement] = useState(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [profileInitials, setProfileInitials] = useState('NH');

  useEffect(() => {
    /** Loads authenticated user metadata for profile visuals. */
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) {
        return;
      }

      const firstName = (user.user_metadata?.first_name || '').trim();
      const lastName = (user.user_metadata?.last_name || '').trim();
      const fullName = (user.user_metadata?.full_name || '').trim();

      const initials = firstName || lastName
        ? `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase()
        : fullName
          ? fullName
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase() || '')
              .join('')
          : 'NH';

      setProfileInitials(initials || 'NH');
      setProfilePhotoUrl(user.user_metadata?.profile_photo_url || '');
    };

    loadUser();
  }, []);

  useEffect(() => {
    /** Closes menu when user clicks outside the menu container. */
    const onClickOutside = (event) => {
      if (profileMenuElement && !profileMenuElement.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [profileMenuElement]);

  return {
    isProfileMenuOpen,
    setIsProfileMenuOpen,
    setProfileMenuElement,
    profilePhotoUrl,
    profileInitials,
  };
}
