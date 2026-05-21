import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function EmailConfirmed() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="bg-white p-8 rounded shadow-md text-center">
        <h2 className="text-2xl font-bold mb-4 text-blue-600">Email Confirmed!</h2>
        <p className="mb-6">Your email has been successfully confirmed. You can now log in to your NewsHub account.</p>
        <button
          className="px-6 py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700"
          onClick={() => navigate('/login')}
        >
          Return to Login
        </button>
      </div>
    </div>
  );
}
