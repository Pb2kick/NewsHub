import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HomeFooter from '../../news/components/HomeFooter';
import HomeHeader from '../../news/components/HomeHeader';
import { useLocationNews } from '../../news/hooks/useLocationNews';
import { useProfileMenu } from '../../profile/hooks/useProfileMenu';
import {
  NEWS_CATEGORY_ELECTIONS,
  NEWS_CATEGORY_TABS,
  NEWS_CATEGORY_TOP_STORIES,
} from '../constants/newsCategories';
import { clearAdminViewMode, useAdminViewMode } from '../../auth/hooks/useAdminViewMode';
import { supabase } from '../services/supabaseClient';

/**
 * Shared authenticated page wrapper with consistent header and footer.
 * @param {{ children: React.ReactNode, activeCategory?: string }} props
 * @returns {JSX.Element}
 */
export default function AuthenticatedPageShell({ children, activeCategory = NEWS_CATEGORY_TOP_STORIES }) {
  const navigate = useNavigate();
  const [selectedNewsCategory, setSelectedNewsCategory] = useState(activeCategory);
  const {
    selectedLocation,
    isDetecting,
    setUserLocationFromSearch,
    useCurrentUserLocation,
    userLocationDisplayLabel,
    isUsingCurrentLocation,
  } = useLocationNews();
  const {
    isProfileMenuOpen,
    setIsProfileMenuOpen,
    setProfileMenuElement,
    profilePhotoUrl,
    profileInitials,
  } = useProfileMenu();
  const { isAdminViewMode } = useAdminViewMode();

  /** Handles top category clicks from non-home pages. */
  const handleSelectNewsCategory = (nextCategory) => {
    setSelectedNewsCategory(nextCategory);
    if (nextCategory === NEWS_CATEGORY_ELECTIONS) {
      navigate('/elections');
      return;
    }
    navigate('/home');
  };

  /** Signs out the user and redirects to login. */
  const handleLogout = async () => {
    clearAdminViewMode();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <HomeHeader
        selectedLocation={selectedLocation}
        setUserLocationFromSearch={setUserLocationFromSearch}
        useCurrentUserLocation={useCurrentUserLocation}
        userLocationDisplayLabel={userLocationDisplayLabel}
        isDetecting={isDetecting}
        isUsingCurrentLocation={isUsingCurrentLocation}
        topCategories={NEWS_CATEGORY_TABS}
        selectedNewsCategory={selectedNewsCategory}
        onSelectNewsCategory={handleSelectNewsCategory}
        isProfileMenuOpen={isProfileMenuOpen}
        setIsProfileMenuOpen={setIsProfileMenuOpen}
        setProfileMenuElement={setProfileMenuElement}
        profilePhotoUrl={profilePhotoUrl}
        profileInitials={profileInitials}
        onLogout={handleLogout}
        isAdminViewMode={isAdminViewMode}
      />

      <main className="flex-1 w-full">{children}</main>

      <HomeFooter />
    </div>
  );
}
