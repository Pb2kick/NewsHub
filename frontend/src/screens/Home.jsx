import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, Calendar, ChevronDown, Clock, MapPin, Search, TrendingUp, User } from 'lucide-react';
import { NEWS_ARTICLES, ELECTIONS } from '../mockData';
import { supabase } from '../supabaseClient';
import { fetchNewsByLocation } from '../api/newsApi';

export default function Home() {
  const [selectedLocation, setSelectedLocation] = useState('National');
  const [locationLabel, setLocationLabel] = useState('');
  const [isDetecting, setIsDetecting] = useState(true);
  const [locationError, setLocationError] = useState('');
  const [detectedLatitude, setDetectedLatitude] = useState(null);
  const [detectedLongitude, setDetectedLongitude] = useState(null);
  const [newsArticles, setNewsArticles] = useState(NEWS_ARTICLES);
  const [isNewsLoading, setIsNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState('');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [profileMenuElement, setProfileMenuElement] = useState(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [profileInitials, setProfileInitials] = useState('NH');

  useEffect(() => {
    if (!navigator.geolocation) {
      setIsDetecting(false);
      setLocationError('Geolocation not supported. Using national news.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setDetectedLatitude(latitude);
        setDetectedLongitude(longitude);
        setSelectedLocation('Local');
        setLocationLabel(`Lat ${latitude.toFixed(2)}, Lng ${longitude.toFixed(2)}`);
        setLocationError('');
        setIsDetecting(false);
      },
      () => {
        setDetectedLatitude(null);
        setDetectedLongitude(null);
        setSelectedLocation('National');
        setLocationError('Location access denied. Showing national news.');
        setIsDetecting(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadLocationNews() {
      setIsNewsLoading(true);

      try {
        const fetchedNews = await fetchNewsByLocation({
          location: selectedLocation,
          latitude: detectedLatitude,
          longitude: detectedLongitude,
          signal: abortController.signal,
        });

        if (!abortController.signal.aborted) {
          setNewsArticles(fetchedNews.length > 0 ? fetchedNews : NEWS_ARTICLES);
          setNewsError('');
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          return;
        }

        if (!abortController.signal.aborted) {
          setNewsArticles(NEWS_ARTICLES);
          setNewsError('Unable to fetch location-based news. Showing fallback feed.');
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsNewsLoading(false);
        }
      }
    }

    loadLocationNews();

    return () => {
      abortController.abort();
    };
  }, [selectedLocation, detectedLatitude, detectedLongitude]);

  useEffect(() => {
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
    const onClickOutside = (event) => {
      if (profileMenuElement && !profileMenuElement.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [profileMenuElement]);

  const locationOptions = ['Local', 'National', 'Metro District', 'North Province', 'Central Region', 'All'];
  const effectiveArticles = useMemo(() => {
    return newsArticles.length > 0 ? newsArticles : NEWS_ARTICLES;
  }, [newsArticles]);
  const featuredArticle = effectiveArticles[0];
  const otherArticles = effectiveArticles.slice(1);
  const activeElections = ELECTIONS.slice(0, 2);
  const topCategories = ['Top Stories', 'Politics', 'Economy', 'Local', 'International', 'Elections 2026'];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
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
              <div className="hidden lg:flex items-center gap-1.5 text-sm font-medium text-slate-600">
                <MapPin className="w-4 h-4 text-slate-500" />
                <span>{selectedLocation}</span>
              </div>
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
                    {profilePhotoUrl ? (
                      <img src={profilePhotoUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      profileInitials
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </button>

                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-40 rounded-xl border border-slate-200 bg-white shadow-lg py-1 z-50">
                    <Link
                      to="/profile"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="block px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Profile
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
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
              {topCategories.map((category, index) => (
                <Link
                  key={category}
                  to="/home"
                  className={`pb-3 border-b-2 transition-colors ${index === 0 ? 'text-blue-600 border-blue-600' : 'border-transparent hover:text-slate-900'}`}
                >
                  {category}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 w-full">
        <section className="mb-6 sm:mb-12">
          <div className="relative rounded-xl sm:rounded-2xl overflow-hidden shadow-lg group">
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" />
            <img
              src={featuredArticle.image}
              alt={featuredArticle.title}
              className="w-full h-[280px] sm:h-[400px] lg:h-[500px] object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-8 z-20">
              <span className="inline-block px-2.5 py-0.5 sm:px-3 sm:py-1 bg-blue-600 text-white text-[11px] sm:text-xs font-semibold rounded-full mb-2 sm:mb-4">
                {featuredArticle.category}
              </span>
              <h1 className="text-xl sm:text-3xl md:text-5xl font-bold text-white mb-2 sm:mb-4 leading-tight max-w-4xl">
                {featuredArticle.title}
              </h1>
              <p className="text-slate-200 text-sm sm:text-lg mb-3 sm:mb-6 max-w-2xl line-clamp-2 hidden min-[360px]:block">
                {featuredArticle.excerpt}
              </p>
              <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-slate-300 text-xs sm:text-sm font-medium">
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {featuredArticle.author}
                </span>
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {featuredArticle.date}
                </span>
                <Link
                  to={`/news/${featuredArticle.id}`}
                  state={{ article: featuredArticle }}
                  className="hidden sm:flex ml-auto items-center gap-2 text-white hover:text-blue-400 transition-colors group-hover:translate-x-1 duration-300"
                >
                  Read Full Story <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-12">
          <div className="lg:col-span-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 sm:mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1.5 sm:w-2 h-6 sm:h-8 bg-blue-600 rounded-full block" />
                Latest News
              </h2>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="text-xs sm:text-sm text-slate-500">
                  {isDetecting
                    ? 'Detecting location...'
                    : isNewsLoading
                      ? `Fetching ${selectedLocation} news...`
                      : `Location: ${selectedLocation}`}
                  {locationLabel && <span className="ml-2 text-slate-400">({locationLabel})</span>}
                </div>
                {locationError && !isDetecting && (
                  <span className="text-xs text-amber-600">{locationError}</span>
                )}
                {newsError && !isNewsLoading && (
                  <span className="text-xs text-amber-600">{newsError}</span>
                )}
                <select
                  value={selectedLocation}
                  onChange={(event) => setSelectedLocation(event.target.value)}
                  className="px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {locationOptions.map((location) => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
              {otherArticles.map((article) => (
                <Link key={article.id} to={`/news/${article.id}`} state={{ article }} className="group flex flex-row sm:flex-col h-auto sm:h-full bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <div className="relative w-28 sm:w-full h-auto sm:h-48 overflow-hidden shrink-0">
                    <img
                      src={article.image}
                      alt={article.title}
                      className="w-full h-full min-h-[100px] object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute top-2 left-2 sm:top-4 sm:left-4">
                      <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-white/90 backdrop-blur-sm text-slate-900 text-[10px] sm:text-xs font-semibold rounded-md shadow-sm">
                        {article.category}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 sm:p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-500 mb-1.5 sm:mb-3">
                      <span className="font-medium text-blue-600">{article.author}</span>
                      <span>•</span>
                      <span>{article.date}</span>
                    </div>
                    <h3 className="text-sm sm:text-xl font-bold text-slate-900 mb-1 sm:mb-3 group-hover:text-blue-600 transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    <p className="text-slate-600 text-xs sm:text-sm line-clamp-2 sm:line-clamp-3 mb-2 sm:mb-4 flex-1 hidden min-[360px]:block">
                      {article.excerpt}
                    </p>
                    <div className="flex items-center justify-between pt-2 sm:pt-4 border-t border-slate-100 mt-auto">
                      <span className="text-[10px] sm:text-xs text-slate-500 font-medium">{article.readTime}</span>
                      <span className="text-blue-600 text-xs sm:text-sm font-medium flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Read <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Active Elections
                </h3>
                <Link to="/home" className="text-sm font-medium text-blue-600 hover:text-blue-700">View All</Link>
              </div>

              <div className="space-y-4">
                {activeElections.map((election) => (
                  <Link key={election.id} to="/home" className="block group">
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">{election.status}</span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {election.date}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">{election.title}</h4>
                      <p className="text-sm text-slate-500 mb-3">{election.region}</p>
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                        <div className="flex -space-x-2">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] text-slate-500 font-bold overflow-hidden">
                              <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="" className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                        <span className="ml-1 text-blue-600 group-hover:underline">{election.candidatesCount} Candidates</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Trending Topics</h3>
              <div className="flex flex-wrap gap-2">
                {['#Election2026', '#ClimateAction', '#TechPrivacy', '#CityCouncil', '#Education', '#PublicTransit', '#LocalBusiness'].map((tag) => (
                  <Link
                    key={tag}
                    to="/home"
                    className="px-3 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 text-sm font-medium rounded-lg transition-colors border border-slate-100 hover:border-blue-100"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </div>

            <div className="bg-blue-600 rounded-xl p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
              <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-white/10 rounded-full blur-xl" />

              <h3 className="text-lg font-bold mb-2 relative z-10">Stay Informed</h3>
              <p className="text-blue-100 text-sm mb-4 relative z-10">
                Get the latest updates on elections and local news delivered to your inbox.
              </p>
              <form className="relative z-10 space-y-2" onSubmit={(event) => event.preventDefault()}>
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
                />
                <button className="w-full py-2 bg-white text-blue-600 font-bold rounded-lg hover:bg-blue-50 transition-colors text-sm">
                  Subscribe
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-slate-900 text-slate-300 mt-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <h4 className="text-white text-lg font-bold">NewsHub</h4>
              <p className="mt-2 text-sm text-slate-400">Secure civic news and election information platform.</p>
            </div>
            <div>
              <h5 className="text-white text-sm font-semibold uppercase tracking-wide">Platform</h5>
              <ul className="mt-2 space-y-2 text-sm">
                <li><Link to="/home" className="hover:text-white">Latest News</Link></li>
                <li><Link to="/home" className="hover:text-white">Elections</Link></li>
                <li><Link to="/home" className="hover:text-white">Privacy</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white text-sm font-semibold uppercase tracking-wide">Contact</h5>
              <p className="mt-2 text-sm text-slate-400">support@newshub.gov</p>
              <p className="text-sm text-slate-400">+63 2 8123 4567</p>
            </div>
          </div>
          <div className="border-t border-slate-700 mt-8 pt-4 text-xs text-slate-400 flex flex-col sm:flex-row justify-between gap-2">
            <span>© 2026 NewsHub. All rights reserved.</span>
            <span>Built for secure public information access.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
