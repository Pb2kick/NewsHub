import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Newspaper, Vote, User } from 'lucide-react';
import { useGlobalSearch } from '../hooks/useGlobalSearch';

const STATUS_COLORS = {
  Active: 'bg-emerald-100 text-emerald-700',
  Upcoming: 'bg-blue-100 text-blue-700',
  Closed: 'bg-slate-100 text-slate-500',
};

/**
 * Dropdown panel that renders grouped search results beneath a search input.
 *
 * Closes when:
 *  - The user clicks outside the panel (document mousedown listener).
 *  - The user presses the Escape key.
 *  - The user selects any result (navigation fires, then onClose is called).
 *
 * @param {{ query: string, onClose: () => void }} props
 * @returns {JSX.Element | null}
 */
export default function GlobalSearchDropdown({ query, onClose }) {
  const navigate = useNavigate();
  const panelRef = useRef(null);

  const { articleResults, electionResults, candidateResults, isSearching, hasResults } =
    useGlobalSearch(query);

  // Close on outside click.
  useEffect(() => {
    function handleMouseDown(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  // Close on Escape key.
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Do not render for very short queries.
  if (!query || query.trim().length < 2) return null;

  function navigateTo(path, state) {
    navigate(path, state ? { state } : undefined);
    onClose();
  }

  function truncate(text, maxLength) {
    if (!text) return '';
    return text.length <= maxLength ? text : text.slice(0, maxLength - 1) + '…';
  }

  return (
    <div
      ref={panelRef}
      role="listbox"
      aria-label="Search results"
      className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden"
    >
      {/* Spinner row — shown while the backend request is in flight */}
      {isSearching && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>Searching…</span>
        </div>
      )}

      {/* No results state */}
      {!isSearching && !hasResults && (
        <div className="px-4 py-5 text-sm text-slate-500 text-center">
          No results found for <span className="font-semibold text-slate-700">"{query.trim()}"</span>
        </div>
      )}

      {/* ── Articles section ── */}
      {articleResults.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
            <Newspaper className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Articles
            </span>
          </div>
          <ul>
            {articleResults.map((article) => (
              <li key={article.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  onClick={() =>
                    navigateTo(`/news/${article.id}`, { article })
                  }
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex flex-col gap-0.5"
                >
                  <span className="text-sm font-medium text-slate-800 leading-snug line-clamp-1">
                    {truncate(article.title, 60)}
                  </span>
                  <span className="text-xs text-slate-400">
                    {article.author}
                    {article.date ? ` · ${article.date}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Elections section ── */}
      {electionResults.length > 0 && (
        <section className={articleResults.length > 0 ? 'border-t border-slate-100' : ''}>
          <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
            <Vote className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Elections
            </span>
          </div>
          <ul>
            {electionResults.map((election) => (
              <li key={election.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  onClick={() => navigateTo(`/elections/${election.id}`)}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-medium text-slate-800 leading-snug truncate">
                      {election.title}
                    </span>
                    <span className="text-xs text-slate-400">{election.region}</span>
                  </div>
                  <span
                    className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      STATUS_COLORS[election.status] ?? 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {election.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Candidates section ── */}
      {candidateResults.length > 0 && (
        <section
          className={
            articleResults.length > 0 || electionResults.length > 0
              ? 'border-t border-slate-100'
              : ''
          }
        >
          <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Candidates
            </span>
          </div>
          <ul>
            {candidateResults.map((candidate) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  onClick={() => navigateTo(`/elections/${candidate.electionId}`)}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex flex-col gap-0.5"
                >
                  <span className="text-sm font-medium text-slate-800 leading-snug">
                    {candidate.name}
                  </span>
                  <span className="text-xs text-slate-400">
                    {candidate.party}
                    {candidate.position ? ` · ${candidate.position}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Bottom padding */}
      <div className="h-2" />
    </div>
  );
}
