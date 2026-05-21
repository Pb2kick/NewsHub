import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Renders Home page footer.
 * @returns {JSX.Element}
 */
export default function HomeFooter() {
  return (
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
  );
}
