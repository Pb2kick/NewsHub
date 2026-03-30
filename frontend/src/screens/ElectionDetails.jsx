import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MapPin, Users } from 'lucide-react';
import { CANDIDATES, ELECTIONS } from '../mockData';

/**
 * Renders election details and candidate list.
 * @returns {JSX.Element}
 */
export default function ElectionDetails() {
  const { electionId } = useParams();
  const election = ELECTIONS.find((item) => String(item.id) === String(electionId));
  const candidates = useMemo(
    () => CANDIDATES.filter((candidate) => String(candidate.electionId) === String(electionId)),
    [electionId]
  );

  if (!election) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Election not found</h1>
        <Link to="/elections" className="text-blue-600 mt-4 inline-block">Back to Elections</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to="/elections" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors mb-6 text-sm font-medium">
        <ArrowLeft className="w-4 h-4" />
        Back to Elections
      </Link>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm mb-8">
        <img src={election.image} alt={election.title} className="w-full h-52 sm:h-64 object-cover" />
        <div className="p-6">
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">{election.scope}</span>
            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${election.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {election.status}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">{election.title}</h1>
          <div className="text-sm text-slate-600 flex flex-wrap gap-4">
            <span className="inline-flex items-center gap-1"><MapPin className="w-4 h-4" />{election.region}</span>
            <span className="inline-flex items-center gap-1"><Users className="w-4 h-4" />{candidates.length} Candidates</span>
            <span>{election.date}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-900">Candidates</h2>
        <Link to={`/elections/${election.id}/verify`} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
          Verify to Vote
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {candidates.map((candidate) => (
          <Link key={candidate.id} to={`/elections/${election.id}/candidates/${candidate.id}`} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all">
            <div className="flex items-center gap-3">
              <img src={candidate.image} alt={candidate.name} className="w-16 h-16 rounded-full object-cover" />
              <div>
                <h3 className="font-bold text-slate-900">{candidate.name}</h3>
                <p className="text-sm text-slate-500">{candidate.party}</p>
                <p className="text-xs text-slate-400">{candidate.position}</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-blue-600 ml-auto" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
