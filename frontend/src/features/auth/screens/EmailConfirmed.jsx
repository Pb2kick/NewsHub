import React from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../../shared/components/ThemeToggle';

export default function EmailConfirmed() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800 px-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 text-center max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4 text-blue-600 dark:text-blue-400">Email Confirmed!</h2>
        <p className="mb-6 text-slate-600 dark:text-slate-400">
          Your email has been successfully confirmed. You can now log in to your NewsHub account.
        </p>
        <button
          type="button"
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          onClick={() => navigate('/login')}
        >
          Return to Login
        </button>
      </div>
    </div>
  );
}
