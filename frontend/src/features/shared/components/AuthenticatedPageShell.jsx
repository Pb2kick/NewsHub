import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import HomeFooter from '../../news/components/HomeFooter';
import HomeHeader from '../../news/components/HomeHeader';
import { useLocationNews } from '../../news/hooks/useLocationNews';
import { useNotificationsContext } from '../../news/context/NotificationsContext';
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
 * Owns the global search state so the search bar works on every screen
 * that uses this shell (Elections, Article, Profile, etc.).
 * @param {{ children: React.ReactNode, activeCategory?: string }} props
 * @returns {JSX.Element}
 */
export default function AuthenticatedPageShell({ children, activeCategory = NEWS_CATEGORY_TOP_STORIES }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedNewsCategory, setSelectedNewsCategory] = useState(activeCategory);
  const {
    selectedLocation,
    isDetecting,
    setUserLocationFromSearch,
    useCurrentUserLocation,
    userLocationDisplayLabel,
    isUsingCurrentLocation,
    area,
    region,
    country,
    countryCode,
  } = useLocationNews({ loadNews: false }); // header only — no feed fetch on non-home pages
  // Stable identity so the search request is not re-sent on every render.
  const locationContext = useMemo(
    () => ({ selectedLocation, area, region, country, countryCode }),
    [selectedLocation, area, region, country, countryCode]
  );
  const {
    isProfileMenuOpen,
    setIsProfileMenuOpen,
    setProfileMenuElement,
    profilePhotoUrl,
    profileInitials,
  } = useProfileMenu();
  const { isAdminViewMode } = useAdminViewMode();

  const { notifications, unreadCount, markOneRead, markAllRead } = useNotificationsContext();

  // Search state — shared between desktop and mobile inputs.
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Close the dropdown whenever the user navigates to another route.
  useEffect(() => {
    setIsSearchOpen(false);
  }, [location.pathname]);

  /** Handles top category clicks from non-home pages. */
  const handleSelectNewsCategory = (nextCategory) => {
    setSelectedNewsCategory(nextCategory);
    if (nextCategory === NEWS_CATEGORY_ELECTIONS) {
      navigate('/elections');
      return;
    }
    navigate('/home', { state: { category: nextCategory } }); // Home opens on the chosen tab
  };

  /** Signs out the user and redirects to login. */
  const handleLogout = async () => {
    clearAdminViewMode();
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-800 flex flex-col">
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
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSearchOpen={isSearchOpen}
        setIsSearchOpen={setIsSearchOpen}
        locationContext={locationContext}
        notifications={notifications}
        unreadCount={unreadCount}
        markOneRead={markOneRead}
        markAllRead={markAllRead}
      />

      <main className="flex-1 w-full">{children}</main>

      <HomeFooter />
    </div>
  );
}

