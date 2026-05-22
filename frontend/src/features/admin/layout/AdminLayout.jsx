import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ExternalLink, Flag, LayoutDashboard, Menu, Newspaper, ShieldCheck, User, Users, Vote, X } from 'lucide-react';
import { supabase } from '../../shared/services/supabaseClient';
import { clearAdminViewMode } from '../../auth/hooks/useAdminViewMode';
import { getCurrentAdminProfile } from '../services/adminApi';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { label: 'Verifications', path: '/admin/verifications', icon: ShieldCheck },
  { label: 'Elections', path: '/admin/elections', icon: Vote },
  { label: 'Candidates', path: '/admin/candidates', icon: Users },
  { label: 'Users', path: '/admin/users', icon: Users },
  { label: 'News Moderation', path: '/admin/news', icon: Newspaper },
  { label: 'Reports', path: '/admin/reports', icon: Flag },
];

/**
 * Checks whether a nav item is active for the current route.
 * @param {string} path
 * @param {string} currentPath
 * @returns {boolean}
 */
function isActive(path, currentPath) {
  if (path === '/admin') {
    return currentPath === '/admin';
  }
  return currentPath.startsWith(path);
}

/**
 * Renders admin shell with sidebar, top bar, and routed outlet.
 * @returns {JSX.Element}
 */
export default function AdminLayout() {
  const [isOpen, setIsOpen] = useState(false);
  const [adminName, setAdminName] = useState('Admin');
  const [adminInitials, setAdminInitials] = useState('A');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    const resolveAdminProfile = async () => {
      const [{ data: { user } }, adminProfile] = await Promise.all([
        supabase.auth.getUser(),
        getCurrentAdminProfile(),
      ]);

      if (!active) return;

      const firstName = String(user?.user_metadata?.first_name || '').trim();
      const lastName = String(user?.user_metadata?.last_name || '').trim();
      const fullName = `${firstName} ${lastName}`.trim();
      const fallbackEmail = user?.email || adminProfile?.email || '';
      const fallbackName = fallbackEmail ? fallbackEmail.split('@')[0] : 'Admin';
      const displayName = fullName || fallbackName || 'Admin';

      const initials = displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('') || 'A';

      setAdminName(displayName);
      setAdminInitials(initials);
    };

    resolveAdminProfile();
    return () => {
      active = false;
    };
  }, []);

  /** Signs out the current user and redirects to login. */
  const handleSignOut = async () => {
    clearAdminViewMode();
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform`}>
        <div className="h-16 px-4 border-b border-slate-800 flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-2 font-bold">
            <span className="w-8 h-8 rounded-lg bg-blue-600 grid place-items-center text-white font-bold">N</span>
            NewsHub Admin
          </Link>
          <button type="button" className="lg:hidden" onClick={() => setIsOpen(false)}><X className="w-5 h-5" /></button>
        </div>
        <nav className="p-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link key={item.path} to={item.path} onClick={() => setIsOpen(false)} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${isActive(item.path, location.pathname) ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
          <button type="button" onClick={handleSignOut} className="w-full mt-3 text-left px-3 py-2 rounded-lg text-sm text-rose-300 hover:bg-rose-900/30">Sign out</button>
        </nav>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between">
          <button type="button" onClick={() => setIsOpen(true)} className="lg:hidden p-2 rounded hover:bg-slate-100"><Menu className="w-5 h-5" /></button>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Link
              to="/home?adminView=1"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <ExternalLink className="w-4 h-4" />
              View Website
            </Link>
            <Link
              to="/profile?fromAdmin=1"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <User className="w-4 h-4" />
              Profile
            </Link>
            <p className="text-sm font-semibold text-slate-700">{adminName}</p>
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white text-sm font-bold grid place-items-center">
              {adminInitials}
            </div>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>

      {isOpen ? <button type="button" className="fixed inset-0 bg-black/40 lg:hidden" onClick={() => setIsOpen(false)} aria-label="Close sidebar" /> : null}
    </div>
  );
}
