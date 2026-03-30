import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Home, Lock, PartyPopper, ShieldCheck } from 'lucide-react';
import { CANDIDATES, ELECTIONS } from '../mockData';

/**
 * Creates deterministic confirmation code for mock vote receipts.
 * @returns {string}
 */
function createConfirmationCode() {
  const now = Date.now().toString(36).toUpperCase();
  return `VOTE-${now.slice(-8)}`;
}

/**
 * Renders voting flow with selection, confirmation, and receipt states.
 * @returns {JSX.Element}
 */
export default function Vote() {
  const { electionId } = useParams();
  const navigate = useNavigate();
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState('select');
  const [confirmationCode, setConfirmationCode] = useState('');

  const election = ELECTIONS.find((item) => String(item.id) === String(electionId));
  const candidates = useMemo(() => CANDIDATES.filter((item) => String(item.electionId) === String(electionId)), [electionId]);
  const selectedCandidateData = candidates.find((item) => item.id === selectedCandidate);

  if (!election) {
    return <div className="max-w-7xl mx-auto px-4 py-16 text-center">Election not found</div>;
  }

  /** Handles mock vote submission and success transition. */
  const handleSubmitVote = async () => {
    if (!selectedCandidate) {
      return;
    }
    setIsSubmitting(true);
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    setConfirmationCode(createConfirmationCode());
    setStep('success');
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-slate-50 py-4 sm:py-8">
      <div className="max-w-2xl mx-auto px-3 sm:px-6">
        {step !== 'success' && <Link to={`/elections/${electionId}/verify`} className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-4 text-sm"><ArrowLeft className="w-4 h-4" />Back to Verification</Link>}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">
          {step === 'select' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Select Your Candidate</h2>
              {candidates.map((candidate) => (
                <button key={candidate.id} type="button" onClick={() => setSelectedCandidate(candidate.id)} className={`w-full p-3 border-2 rounded-xl text-left ${selectedCandidate === candidate.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center gap-3">
                    <img src={candidate.image} alt={candidate.name} className="w-12 h-12 rounded-full object-cover" />
                    <div>
                      <h3 className="font-bold text-slate-900">{candidate.name}</h3>
                      <p className="text-xs text-slate-500">{candidate.party}</p>
                    </div>
                  </div>
                </button>
              ))}
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3 flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5" />Your vote is final once submitted.</div>
              <button type="button" onClick={() => setStep('confirm')} disabled={!selectedCandidate} className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">Review Selection</button>
            </div>
          )}

          {step === 'confirm' && selectedCandidateData && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Confirm Your Vote</h2>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <img src={selectedCandidateData.image} alt={selectedCandidateData.name} className="w-20 h-20 rounded-full object-cover mx-auto mb-3" />
                <h3 className="font-bold text-slate-900">{selectedCandidateData.name}</h3>
                <p className="text-sm text-slate-500">{selectedCandidateData.party}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setStep('select')} className="py-3 border border-slate-200 rounded-lg font-semibold">Go Back</button>
                <button type="button" onClick={handleSubmitVote} disabled={isSubmitting} className="py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
                  {isSubmitting ? 'Recording...' : 'Submit Vote'}
                </button>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center space-y-4 py-2">
              <div className="w-16 h-16 rounded-full bg-green-100 text-green-700 grid place-items-center mx-auto"><PartyPopper className="w-8 h-8" /></div>
              <h2 className="text-xl font-bold text-slate-900">Vote Submitted!</h2>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-sm">
                <p className="flex justify-between"><span className="text-slate-500">Confirmation Code</span><span className="font-mono text-blue-600 font-bold">{confirmationCode}</span></p>
                <p className="flex justify-between mt-2"><span className="text-slate-500">Election</span><span className="font-medium">{election.title}</span></p>
                <p className="flex justify-between mt-2"><span className="text-slate-500">Timestamp</span><span className="font-medium">{new Date().toLocaleString()}</span></p>
              </div>
              <div className="text-xs text-slate-500 flex justify-center gap-2"><Lock className="w-3 h-3" />Mock secure ballot receipt</div>
              <button type="button" onClick={() => navigate('/home')} className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
                <Home className="w-4 h-4" /> Return Home
              </button>
            </div>
          )}
        </div>
        <div className="text-center text-xs text-slate-400 mt-4 flex justify-center gap-2"><ShieldCheck className="w-3 h-3" />Mock flow only: no real vote transaction was submitted.</div>
      </div>
    </div>
  );
}
