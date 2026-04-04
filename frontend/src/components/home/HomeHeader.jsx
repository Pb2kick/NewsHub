import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronDown, Search } from 'lucide-react';
import HeaderLocationSearch from './HeaderLocationSearch';

/**
 * Renders the fixed top header and category navigation.
 * @param {object} props
 * @returns {JSX.Element}
 */
export default function HomeHeader(props) {
  const {
    selectedLocation,
    setUserLocationFromSearch,
    useCurrentUserLocation,
    userLocationDisplayLabel,
    isDetecting,
    isUsingCurrentLocation,
    topCategories,
    selectedNewsCategory,
    onSelectNewsCategory,
    isProfileMenuOpen,
    setIsProfileMenuOpen,
    setProfileMenuElement,
    profilePhotoUrl,
    profileInitials,
    onLogout,
    isAdminViewMode,
  } = props;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      {isAdminViewMode ? <div className="h-1 w-full bg-amber-500" aria-hidden="true" /> : null}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-3 sm:gap-6">
          <Link to="/home" className="flex items-center gap-2 shrink-0">
            <span className="w-8 h-8 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-sm">N</span>
            <span className="text-xl font-extrabold text-slate-900 tracking-tight">NewsHub</span>
          </Link>

          <div className="hidden md:flex flex-1 max-w-xl relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search news, elections, candidates..."
              className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <HeaderLocationSearch
              currentLabel={userLocationDisplayLabel}
              isDetecting={isDetecting}
              isUsingCurrentLocation={isUsingCurrentLocation}
              onSelectLocation={setUserLocationFromSearch}
              onUseCurrentLocation={useCurrentUserLocation}
            />
            <button type="button" className="w-9 h-9 rounded-full border border-slate-200 text-slate-600 grid place-items-center hover:bg-slate-100">
              <Bell className="w-4 h-4" />
            </button>
            <div ref={setProfileMenuElement} className="relative border-l border-slate-200 pl-2 sm:pl-4">
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-100"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs grid place-items-center overflow-hidden">
                  {profilePhotoUrl ? <img src={profilePhotoUrl} alt="Profile" className="w-full h-full object-cover" /> : profileInitials}
                </div>
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-40 rounded-xl border border-slate-200 bg-white shadow-lg py-1 z-50">
                  {isAdminViewMode ? (
                    <Link
                      to="/admin"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="block px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                    >
                      Dashboard
                    </Link>
                  ) : null}
                  <Link
                    to="/profile"
                    onClick={() => setIsProfileMenuOpen(false)}
                    className="block px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="w-full text-left px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="md:hidden pb-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search news..."
              className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>

        <div className="h-12 border-t border-slate-100 flex items-center overflow-x-auto no-scrollbar">
          <nav className="flex items-center gap-6 text-sm font-semibold text-slate-500 whitespace-nowrap">
            {topCategories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => onSelectNewsCategory(category)}
                className={`pb-3 border-b-2 transition-colors ${
                  category === selectedNewsCategory
                    ? 'text-blue-600 border-blue-600'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {category}
              </button>
            ))}
          </nav>
          <span className="ml-auto hidden md:block text-xs text-slate-400 truncate max-w-[240px]">
            {isDetecting ? 'Detecting location...' : `${selectedLocation}: ${userLocationDisplayLabel}`}
          </span>
        </div>
      </div>
    </header>
  );
}
