import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Filter, Calendar, MapPin, Search } from 'lucide-react';
import { ELECTIONS } from '../mockData';

const ELECTION_FILTERS = ['All', 'National', 'State', 'Local'];

/**
 * Renders elections catalog with scope and keyword filtering.
 * @returns {JSX.Element}
 */
export default function Elections() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchText, setSearchText] = useState('');

  const filteredElections = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return ELECTIONS.filter((election) => {
      const filterMatch = activeFilter === 'All' || election.scope === activeFilter;
      if (!filterMatch) {
        return false;
      }
      if (!query) {
        return true;
      }
      return `${election.title} ${election.region} ${election.status}`.toLowerCase().includes(query);
    });
  }, [activeFilter, searchText]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      <header className="mb-5 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">Active Elections</h1>
        <p className="text-sm sm:text-base text-slate-600">Find your local, state, and national elections.</p>
      </header>

      <div className="flex flex-col gap-3 sm:gap-4 mb-5 sm:mb-8">
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1">
          {ELECTION_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 font-medium rounded-lg transition-colors text-xs sm:text-base whitespace-nowrap ${
                filter === activeFilter
                  ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search elections..."
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <button type="button" className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 shrink-0">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredElections.map((election) => (
          <Link key={election.id} to={`/elections/${election.id}`} className="group block bg-white rounded-xl overflow-hidden border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="relative h-36 sm:h-48 overflow-hidden">
              <img src={election.image} alt={election.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute top-4 left-4">
                <span className={`px-2 py-1 text-xs font-bold rounded-md shadow-sm ${election.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {election.status}
                </span>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-2 text-slate-500 text-[11px] sm:text-xs font-medium mb-2 sm:mb-3 uppercase tracking-wider">
                <MapPin className="w-3 h-3" />
                {election.region}
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">{election.title}</h3>
              <div className="flex items-center justify-between mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-100">
                <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-slate-600">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
                  {election.date}
                </div>
                <div className="text-xs sm:text-sm font-medium text-blue-600 group-hover:underline">{election.candidatesCount} Candidates</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
