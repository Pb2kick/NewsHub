import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ELECTIONS } from '../mockData';
import { supabase } from '../supabaseClient';
import HomeFooter from '../components/home/HomeFooter';
import HomeHeader from '../components/home/HomeHeader';
import HomeHeroSection from '../components/home/HomeHeroSection';
import HomeNewsGrid from '../components/home/HomeNewsGrid';
import HomeSidebar from '../components/home/HomeSidebar';
import { useLocationNews } from '../hooks/useLocationNews';
import { useProfileMenu } from '../hooks/useProfileMenu';
import {
  filterNewsByCategory,
  NEWS_CATEGORY_TABS,
  NEWS_CATEGORY_TOP_STORIES,
  tagNewsArticlesByCategory,
} from '../utils/newsCategories';

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
 * @returns {JSX.Element}
 */
export default function Home() {
  const navigate = useNavigate();
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
  } = useLocationNews();
  const [selectedNewsCategory, setSelectedNewsCategory] = useState(NEWS_CATEGORY_TOP_STORIES);
  const {
    isProfileMenuOpen,
    setIsProfileMenuOpen,
    setProfileMenuElement,
    profilePhotoUrl,
    profileInitials,
  } = useProfileMenu();

  const taggedArticles = useMemo(() => tagNewsArticlesByCategory(newsArticles), [newsArticles]);
  const filteredArticles = useMemo(
    () => filterNewsByCategory(taggedArticles, selectedNewsCategory),
    [taggedArticles, selectedNewsCategory]
  );
  const featuredArticle = filteredArticles[0];
  const otherArticles = useMemo(() => filteredArticles.slice(1), [filteredArticles]);
  const activeElections = ELECTIONS.slice(0, 2);
  const topCategories = NEWS_CATEGORY_TABS;
  const showInitialNewsLoading = isNewsLoading && newsArticles.length === 0;

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
        topCategories={topCategories}
        selectedNewsCategory={selectedNewsCategory}
        onSelectNewsCategory={handleSelectNewsCategory}
        isProfileMenuOpen={isProfileMenuOpen}
        setIsProfileMenuOpen={setIsProfileMenuOpen}
        setProfileMenuElement={setProfileMenuElement}
        profilePhotoUrl={profilePhotoUrl}
        profileInitials={profileInitials}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 w-full">
        <HomeHeroSection showInitialNewsLoading={showInitialNewsLoading} featuredArticle={featuredArticle} hasImage={hasImage} />

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
          />
          <HomeSidebar activeElections={activeElections} />
        </div>
      </main>

      <HomeFooter />
    </div>
  );
}
