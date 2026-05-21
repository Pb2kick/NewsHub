import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, TrendingUp } from 'lucide-react';

/**
 * Renders right sidebar cards including elections and topics.
 * @param {object} props
 * @returns {JSX.Element}
 */
export default function HomeSidebar({ activeElections }) {
  return (
    <div className="lg:col-span-4 space-y-8">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Active Elections
          </h3>
          <Link to="/elections" className="text-sm font-medium text-blue-600 hover:text-blue-700">View All</Link>
        </div>

        <div className="space-y-4">
          {activeElections.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-6">No active elections right now.</p>
          ) : (
            activeElections.map((election) => (
              <Link key={election.id} to={`/elections/${election.id}`} className="block group">
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">{election.status}</span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {election.date}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">{election.title}</h4>
                  <p className="text-sm text-slate-500 mb-3">{election.region}</p>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    {(election.candidatePreviews || []).length > 0 && (
                      <div className="flex -space-x-2">
                        {(election.candidatePreviews || []).slice(0, 3).map((photoUrl, i) => (
                          <div
                            key={i}
                            className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white overflow-hidden flex items-center justify-center text-[10px] text-slate-500 font-bold"
                          >
                            {photoUrl ? (
                              <img
                                src={photoUrl}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            ) : (
                              <span>{i + 1}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <span className="ml-1 text-blue-600 group-hover:underline">{election.candidatesCount} Candidates</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
