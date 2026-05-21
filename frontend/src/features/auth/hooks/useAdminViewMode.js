import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

const ADMIN_VIEW_QUERY_KEY = 'adminView';
const ADMIN_VIEW_STORAGE_KEY = 'newshub_admin_view_mode';

/**
 * Safely reads an item from sessionStorage.
 * @param {string} key
 * @returns {string | null}
 */
function getStorageItem(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Safely writes an item to sessionStorage.
 * @param {string} key
 * @param {string} value
 * @returns {void}
 */
function setStorageItem(key, value) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage failures and continue without persistence.
  }
}

/**
 * Safely removes an item from sessionStorage.
 * @param {string} key
 * @returns {void}
 */
function removeStorageItem(key) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage failures and continue without persistence.
  }
}

/**
 * Clears admin view-only mode persistence.
 * @returns {void}
 */
export function clearAdminViewMode() {
  removeStorageItem(ADMIN_VIEW_STORAGE_KEY);
}

/**
 * Resolves whether the website is in admin view-only mode.
 * The mode is enabled only when navigation includes ?adminView=1.
 * @returns {{ isAdminViewMode: boolean }}
 */
export function useAdminViewMode() {
  const location = useLocation();

  const hasAdminViewQuery = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get(ADMIN_VIEW_QUERY_KEY) === '1';
  }, [location.search]);

  useEffect(() => {
    if (hasAdminViewQuery) {
      setStorageItem(ADMIN_VIEW_STORAGE_KEY, '1');
    }
  }, [hasAdminViewQuery]);

  const isStoredAdminView = getStorageItem(ADMIN_VIEW_STORAGE_KEY) === '1';

  return {
    isAdminViewMode: hasAdminViewQuery || isStoredAdminView,
  };
}
