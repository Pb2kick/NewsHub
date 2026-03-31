
import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './screens/Login';
import Register from './screens/Register';
import Home from './screens/Home';
import EmailConfirmed from './screens/EmailConfirmed';
import Profile from './screens/Profile';
import Article from './screens/Article';
import Elections from './screens/Elections';
import ElectionDetails from './screens/ElectionDetails';
import CandidateProfile from './screens/CandidateProfile';
import VoteVerification from './screens/VoteVerification';
import Vote from './screens/Vote';
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import HomeHeader from './components/home/HomeHeader';
import HomeFooter from './components/home/HomeFooter';
import { useProfileMenu } from './hooks/useProfileMenu';
import { NEWS_CATEGORY_TABS, NEWS_CATEGORY_TOP_STORIES } from './utils/newsCategories';

function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (isMounted) {
        setUser(session?.user || null);
        setLoading(false);
      }
    }
    fetchSession();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => {
      isMounted = false;
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, []);

  if (loading) return null;
  return user ? children : <Navigate to="/login" replace />;
}

function PageChrome({ children, selectedNewsCategory = NEWS_CATEGORY_TOP_STORIES }) {
  const {
    isProfileMenuOpen,
    setIsProfileMenuOpen,
    setProfileMenuElement,
    profilePhotoUrl,
    profileInitials,
  } = useProfileMenu();

  /** Handles top nav categories for non-home pages. */
  const handleSelectNewsCategory = (category) => {
    if (category === 'Elections') {
      window.location.href = '/elections';
      return;
    }
    window.location.href = '/home';
  };

  /** Signs out current session from header menu. */
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <HomeHeader
        selectedLocation="Philippines"
        setUserLocationFromSearch={() => {}}
        useCurrentUserLocation={() => {}}
        userLocationDisplayLabel="Set location"
        isDetecting={false}
        isUsingCurrentLocation={false}
        topCategories={NEWS_CATEGORY_TABS}
        selectedNewsCategory={selectedNewsCategory}
        onSelectNewsCategory={handleSelectNewsCategory}
        isProfileMenuOpen={isProfileMenuOpen}
        setIsProfileMenuOpen={setIsProfileMenuOpen}
        setProfileMenuElement={setProfileMenuElement}
        profilePhotoUrl={profilePhotoUrl}
        profileInitials={profileInitials}
        onLogout={handleLogout}
      />
      <main className="flex-1">{children}</main>
      <HomeFooter />
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<PageChrome><Login /></PageChrome>} />
          <Route path="/register" element={<PageChrome><Register /></PageChrome>} />
          <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/news/:id" element={<ProtectedRoute><PageChrome><Article /></PageChrome></ProtectedRoute>} />
          <Route path="/elections" element={<ProtectedRoute><PageChrome selectedNewsCategory="Elections"><Elections /></PageChrome></ProtectedRoute>} />
          <Route path="/elections/:electionId" element={<ProtectedRoute><PageChrome selectedNewsCategory="Elections"><ElectionDetails /></PageChrome></ProtectedRoute>} />
          <Route path="/elections/:electionId/candidates/:candidateId" element={<ProtectedRoute><PageChrome selectedNewsCategory="Elections"><CandidateProfile /></PageChrome></ProtectedRoute>} />
          <Route path="/elections/:electionId/verify" element={<ProtectedRoute><PageChrome selectedNewsCategory="Elections"><VoteVerification /></PageChrome></ProtectedRoute>} />
          <Route path="/elections/:electionId/vote" element={<ProtectedRoute><PageChrome selectedNewsCategory="Elections"><Vote /></PageChrome></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><PageChrome><Profile /></PageChrome></ProtectedRoute>} />
          <Route path="/email-confirmed" element={<PageChrome><EmailConfirmed /></PageChrome>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
