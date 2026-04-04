
import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
} from './features/admin';
import { supabase } from './features/shared';

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
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/news/:id" element={<ProtectedRoute><Article /></ProtectedRoute>} />
          <Route path="/elections" element={<ProtectedRoute><Elections /></ProtectedRoute>} />
          <Route path="/elections/:electionId" element={<ProtectedRoute><ElectionDetails /></ProtectedRoute>} />
          <Route path="/elections/:electionId/candidates/:candidateId" element={<ProtectedRoute><CandidateProfile /></ProtectedRoute>} />
          <Route path="/elections/:electionId/verify" element={<ProtectedRoute><VoteVerification /></ProtectedRoute>} />
          <Route path="/elections/:electionId/vote" element={<ProtectedRoute><Vote /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="verifications" element={<AdminVerifications />} />
            <Route path="verifications/:verificationId" element={<AdminVerificationDetail />} />
            <Route path="elections" element={<AdminElections />} />
            <Route path="candidates" element={<AdminCandidates />} />
            <Route path="news" element={<AdminNews />} />
          </Route>
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/email-confirmed" element={<EmailConfirmed />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
