import React, { useEffect, useMemo, useState } from 'react';
import { LocateFixed, MapPin } from 'lucide-react';
import { searchLocations } from '../../shared/services/locationApi';

const MIN_QUERY_LENGTH = 2;
// Photon (behind /api/location/search) allows search-as-you-type, unlike Nominatim.
const DEBOUNCE_MS = 300;
const KIND_HINTS = { province: 'Province / state', country: 'Whole country' };

/**
 * Searchable location changer with geocoding suggestions.
 *
 * variant "desktop" sits in the header row and shows from the lg breakpoint up;
 * variant "compact" is a full-width row for phones and tablets, where the header
 * row has no room (previously there was no way to change location below 1024px).
 *
 * @param {{
 * variant?: 'desktop' | 'compact',
 * currentLabel: string,
 * isDetecting: boolean,
 * isUsingCurrentLocation: boolean,
 * onSelectLocation: (details: { area: string, country: string, label: string, latitude: number | null, longitude: number | null }) => void,
 * onUseCurrentLocation: () => void
 * }} props
 * @returns {JSX.Element}
 */
export default function HeaderLocationSearch(props) {
  const {
    variant = 'desktop',
    currentLabel,
    isDetecting,
    isUsingCurrentLocation,
    onSelectLocation,
    onUseCurrentLocation,
  } = props;
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFailed, setIsSearchFailed] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = `location-suggestions-${variant}`;

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setIsSearching(false);
      return undefined;
    }

    const abortController = new AbortController();
    setIsSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const results = await searchLocations({ query: trimmed, signal: abortController.signal });
        if (!abortController.signal.aborted) {
          setSuggestions(results);
          setIsSearchFailed(false);
          setActiveIndex(-1);
        }
      } catch {
        if (!abortController.signal.aborted) {
          setSuggestions([]);
          setIsSearchFailed(true);
        }
      } finally {
        if (!abortController.signal.aborted) setIsSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      abortController.abort();
    };
  }, [query]);

  const selectSuggestion = (suggestion) => {
    // Persist only the location fields, not the UI hints.
    const { matchedName, kind, ...location } = suggestion;
    onSelectLocation(location);
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      event.currentTarget.blur();
      return;
    }
    if (!suggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex >= 0 ? activeIndex : 0]);
    }
  };

  const statusText = useMemo(() => {
    if (isDetecting && isUsingCurrentLocation) {
      return 'Detecting location...';
    }
    return currentLabel;
  }, [currentLabel, isDetecting, isUsingCurrentLocation]);

  const showPanel = isOpen && query.trim().length >= MIN_QUERY_LENGTH;
  const isCompact = variant === 'compact';

  return (
    <div
      className={
        isCompact
          ? 'relative flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300'
          : 'relative hidden lg:flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300'
      }
    >
      <MapPin className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
      <input
        type="text"
        role="combobox"
        aria-label="Change news location"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        value={query}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        placeholder={statusText}
        autoComplete="off"
        className={`${isCompact ? 'flex-1 min-w-0' : 'w-52'} bg-transparent border-0 border-b border-slate-200 dark:border-slate-700 px-0 py-1 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:border-slate-400`}
      />
      <button
        type="button"
        onClick={onUseCurrentLocation}
        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 whitespace-nowrap"
        title="Detect my location again"
      >
        <LocateFixed className="w-3.5 h-3.5" aria-hidden="true" />
        Use Current
      </button>
      {showPanel && (
        <div
          id={listId}
          role="listbox"
          className={`absolute ${isCompact ? 'left-0 right-0' : 'right-0 w-72'} top-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg z-50 overflow-hidden`}
        >
          {isSearching ? (
            <div className="px-3 py-2 text-xs text-slate-500">Searching locations...</div>
          ) : isSearchFailed ? (
            <div className="px-3 py-2 text-xs text-amber-700">Location search is unavailable right now.</div>
          ) : suggestions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-500">No locations found.</div>
          ) : (
            suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.label}-${suggestion.latitude}-${suggestion.longitude}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                // onMouseDown fires before the input's blur closes the panel.
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectSuggestion(suggestion);
                }}
                className={`block w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 ${
                  index === activeIndex ? 'bg-slate-100 dark:bg-slate-800' : ''
                }`}
              >
                <span className="block">{suggestion.label}</span>
                {(suggestion.matchedName || KIND_HINTS[suggestion.kind]) && (
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {suggestion.matchedName
                      ? `Includes ${suggestion.matchedName}`
                      : KIND_HINTS[suggestion.kind]}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
