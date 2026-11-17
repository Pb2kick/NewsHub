import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../shared/services/supabaseClient';
import { getElectionsWithCounts } from '../../elections/services/electionsApi';
import HomeFooter from '../components/HomeFooter';
import HomeHeader from '../components/HomeHeader';
import HomeHeroSection from '../components/HomeHeroSection';
import HomeNewsGrid from '../components/HomeNewsGrid';
import HomeSidebar from '../components/HomeSidebar';
import { useLocationNews } from '../hooks/useLocationNews';
import { useNotificationsContext } from '../context/NotificationsContext';
import { useProfileMenu } from '../../profile/hooks/useProfileMenu';
import {
  filterNewsByCategory,
  NEWS_CATEGORY_TABS,
  NEWS_CATEGORY_TOP_STORIES,
  tagNewsArticlesByCategory,
} from '../../shared/constants/newsCategories';
import { clearAdminViewMode, useAdminViewMode } from '../../auth/hooks/useAdminViewMode';

/**
 * Returns whether an image URL can be rendered.
 * @param {string} imageUrl
 * @returns {boolean}
 */
function hasImage(imageUrl) {
  return typeof imageUrl === 'string' && imageUrl.trim().length > 0;
}

/**
 * Home screen for location-aware news and election widgets.
 * Owns the global search state (searchQuery, isSearchOpen) and passes it down
 * to HomeHeader so both desktop and mobile search bars share the same value.
 * @returns {JSX.Element}
 */
export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    selectedLocation,
    locationLabel,
    isDetecting,
    locationError,
    newsArticles,
    isNewsLoading,
    newsError,
    setSelectedLocation,
    setUserLocationFromSearch,
    useCurrentUserLocation,
    userLocationDisplayLabel,
    isUsingCurrentLocation,
    area,
    region,
    country,
    hasMore,
    isLoadingMore,
    loadMore,
    isLocationPending, // true while detection runs and no location is known yet
    needsManualLocation, // detection failed and nothing is remembered
  } = useLocationNews();
  const [selectedNewsCategory, setSelectedNewsCategory] = useState(NEWS_CATEGORY_TOP_STORIES);
  const {
    isProfileMenuOpen,
    setIsProfileMenuOpen,
    setProfileMenuElement,
    profilePhotoUrl,
    profileInitials,
  } = useProfileMenu();
  const { isAdminViewMode } = useAdminViewMode();
  const { notifications, unreadCount, markOneRead, markAllRead, deleteNotification } = useNotificationsContext(); // CHANGED: extracted deleteNotification from context

  // Search state owned here so both desktop and mobile inputs stay in sync.
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeElections, setActiveElections] = useState([]);

  // Close the search dropdown whenever the user navigates to another route.
  useEffect(() => {
    setIsSearchOpen(false);
  }, [location.pathname]);

  // Real active elections from Supabase — replaces ELECTIONS mock data from mockData.js.
  useEffect(() => {
    const loadActiveElections = async () => {
      try {
        const allElections = await getElectionsWithCounts();
        if (!allElections || allElections.length === 0) {
          setActiveElections([]);
          return;
        }

        const active = allElections.filter((election) => election?.status === 'Active');
        setActiveElections(active);
      } catch {
        setActiveElections([]);
      }
    };

    loadActiveElections();
  }, []);

  const taggedArticles = useMemo(() => tagNewsArticlesByCategory(newsArticles), [newsArticles]);
  const filteredArticles = useMemo(
    () => filterNewsByCategory(taggedArticles, selectedNewsCategory),
    [taggedArticles, selectedNewsCategory]
  );
  const featuredArticle = filteredArticles[0];
  const otherArticles = useMemo(() => filteredArticles.slice(1), [filteredArticles]);
  const topCategories = NEWS_CATEGORY_TABS;
  const showInitialNewsLoading = (isNewsLoading || isLocationPending) && newsArticles.length === 0;
  // Stable identity: a new object every render re-triggered the search request on each keystroke.
  const locationContext = useMemo(
    () => ({ selectedLocation, area, region, country }),
    [selectedLocation, area, region, country]
  );

  /** Handles top header category actions including elections navigation. */
  const handleSelectNewsCategory = (nextCategory) => {
    if (nextCategory === 'Elections') {
      navigate('/elections');
      return;
    }
    setSelectedNewsCategory(nextCategory);
  };

  /** Signs out the user and redirects to login. */
  const handleLogout = async () => {
    clearAdminViewMode();
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
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
        topCategories={topCategories}
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
        deleteNotification={deleteNotification} // CHANGED: forward deleteNotification to header
      />

      <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 w-full">
        <HomeHeroSection
          showInitialNewsLoading={showInitialNewsLoading}
          featuredArticle={featuredArticle}
          hasImage={hasImage}
          needsManualLocation={needsManualLocation}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-12">
          <HomeNewsGrid
            selectedLocation={selectedLocation}
            setSelectedLocation={setSelectedLocation}
            isDetecting={isDetecting}
            isNewsLoading={isNewsLoading}
            locationLabel={locationLabel}
            locationError={locationError}
            newsError={newsError}
            showInitialNewsLoading={showInitialNewsLoading}
            otherArticles={otherArticles}
            hasImage={hasImage}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            loadMore={loadMore}
            isLocationPending={isLocationPending}
            needsManualLocation={needsManualLocation}
          />
          <HomeSidebar activeElections={activeElections} />
        </div>
      </main>

      <HomeFooter />
    </div>
  );
}

