
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
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/email-confirmed" element={<EmailConfirmed />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
