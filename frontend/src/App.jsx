
import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Login, Register, EmailConfirmed, useAdminAccess } from './features/auth';
import { Home, Article } from './features/news';
import { Elections, ElectionDetails, CandidateProfile, VoteVerification, Vote } from './features/elections';
import { Profile } from './features/profile';
import {
  AdminLayout,
  AdminDashboard,
  AdminVerifications,
  AdminVerificationDetail,
  AdminElections,
  AdminCandidates,
  AdminNews,
  AdminUsers,
} from './features/admin';
import { supabase } from './features/shared';
import { NotificationsProvider } from './features/news/context/NotificationsContext';

const PUBLIC_PATHS = new Set(['/', '/login', '/register', '/email-confirmed']);

function shouldWrapNotifications(pathname) {
  if (pathname.startsWith('/admin')) return false;
  if (PUBLIC_PATHS.has(pathname)) return false;
  return true;
}

/**
 * Restricts route access to authenticated users.
 * @param {{ children: React.ReactNode }} props
 * @returns {JSX.Element | null}
 */
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

function NotificationsGate({ children }) {
  const location = useLocation();
  if (!shouldWrapNotifications(location.pathname)) {
    return children;
  }
  return (
    <ProtectedRoute>
      <NotificationsProvider>{children}</NotificationsProvider>
    </ProtectedRoute>
  );
}

/**
 * Restricts route access to authenticated admin users only.
 * @param {{ children: React.ReactNode }} props
 * @returns {JSX.Element | null}
 */
function AdminRoute({ children }) {
  const { loading, isAuthenticated, isAdmin } = useAdminAccess();

  if (loading) {
    return null;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (!isAdmin) {
    return <Navigate to="/home" replace />;
  }
  return children;
}

/**
 * Root application router and route map.
 * @returns {JSX.Element}
 */
function App() {
  useEffect(() => {
    // Render free plan warm-up ping — fires immediately on mount to reduce cold-start latency.
    // The real news fetch fires after location resolves; by then the server should already be awake.
    try {
      const baseUrl = process.env.REACT_APP_NEWS_API_BASE_URL || 'http://localhost:8080';
      if (!baseUrl) return;
      fetch(`${baseUrl}/api/news?size=1`, { method: 'GET' }).catch(() => {});
    } catch {
      // Swallow warm-up errors silently.
    }
  }, []);

  return (
    <Router>
      <div className="App">
        <NotificationsGate>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/home" element={<Home />} />
            <Route path="/news/:id" element={<Article />} />
            <Route path="/elections" element={<Elections />} />
            <Route path="/elections/:electionId" element={<ElectionDetails />} />
            <Route path="/elections/:electionId/candidates/:candidateId" element={<CandidateProfile />} />
            <Route path="/elections/:electionId/verify" element={<VoteVerification />} />
            <Route path="/elections/:electionId/vote" element={<Vote />} />
            <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="verifications" element={<AdminVerifications />} />
              <Route path="verifications/:verificationId" element={<AdminVerificationDetail />} />
              <Route path="elections" element={<AdminElections />} />
              <Route path="candidates" element={<AdminCandidates />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="news" element={<AdminNews />} />
            </Route>
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/email-confirmed" element={<EmailConfirmed />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </NotificationsGate>
      </div>
    </Router>
  );
}

export default App;
