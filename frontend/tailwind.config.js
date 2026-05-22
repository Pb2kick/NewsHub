/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#ffffff',
        foreground: '#0f172a',
        card: '#ffffff',
        border: '#e2e8f0',
        muted: '#f1f5f9',
        'muted-foreground': '#64748b',
        primary: '#2563eb',
        'primary-foreground': '#ffffff',
        destructive: '#dc2626',
      },
    },
  },
  plugins: [],
};
