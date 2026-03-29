import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { buildUniqueLocationSuggestions } from '../../utils/locationSuggestions';

/**
 * Searchable header location changer with geocoding suggestions.
 * @param {{
 * currentLabel: string,
 * isDetecting: boolean,
 * isUsingCurrentLocation: boolean,
 * onSelectLocation: (details: { area: string, country: string, label: string, latitude: number | null, longitude: number | null }) => void,
 * onUseCurrentLocation: () => void
 * }} props
 * @returns {JSX.Element}
 */
export default function HeaderLocationSearch(props) {
  const { currentLabel, isDetecting, isUsingCurrentLocation, onSelectLocation, onUseCurrentLocation } = props;
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    const abortController = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const params = new URLSearchParams({
          q: query.trim(),
          format: 'jsonv2',
          addressdetails: '1',
          limit: '6',
        });
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
          signal: abortController.signal,
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          setSuggestions([]);
          return;
        }

        const payload = await response.json();
        setSuggestions(buildUniqueLocationSuggestions(payload));
      } catch {
        setSuggestions([]);
      } finally {
        if (!abortController.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      abortController.abort();
    };
  }, [query]);

  /**
   * Handles selecting a suggested location.
   * @param {{ area: string, country: string, label: string, latitude: number | null, longitude: number | null }} suggestion
   */
  const selectSuggestion = (suggestion) => {
    onSelectLocation(suggestion);
    setQuery('');
    setIsOpen(false);
  };

  const statusText = useMemo(() => {
    if (isDetecting && isUsingCurrentLocation) {
      return 'Detecting...';
    }
    return currentLabel;
  }, [currentLabel, isDetecting, isUsingCurrentLocation]);

  return (
    <div className="relative hidden lg:flex items-center gap-2 text-sm font-medium text-slate-600">
      <Search className="w-4 h-4 text-slate-500" />
      <input
        type="text"
        value={query}
        onFocus={() => setIsOpen(true)}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={statusText}
        className="w-52 bg-transparent border-0 border-b border-slate-200 px-0 py-1 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
      />
      <button type="button" onClick={onUseCurrentLocation} className="text-xs text-blue-600 hover:text-blue-700 whitespace-nowrap">Use Current</button>
      {isOpen && (query.trim() || suggestions.length > 0 || isSearching) && (
        <div className="absolute right-0 top-9 w-72 rounded-lg border border-slate-200 bg-white shadow-lg z-50 overflow-hidden">
          {isSearching ? (
            <div className="px-3 py-2 text-xs text-slate-500">Searching locations...</div>
          ) : suggestions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-500">No locations found.</div>
          ) : (
            suggestions.map((suggestion) => (
              <button
                key={`${suggestion.label}-${suggestion.latitude}-${suggestion.longitude}`}
                type="button"
                onMouseDown={() => selectSuggestion(suggestion)}
                className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                {suggestion.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
