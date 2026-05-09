/*
 * Changes:
 * - Check Supabase verification status before voting and route accordingly.
 * - Add a verification-required modal with actions to verify or cancel.
 */
import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Loader2, ShieldCheck, ThumbsUp } from 'lucide-react';
import AuthenticatedPageShell from '../../shared/components/AuthenticatedPageShell';
import { CANDIDATES } from '../data/mockData';
import { NEWS_CATEGORY_ELECTIONS } from '../../shared/constants/newsCategories';
import { getMyVerification } from '../../admin/services/adminApi';

/**
 * Renders detailed candidate profile with mock vote action.
 * @returns {JSX.Element}
 */
export default function CandidateProfile() {
  const { candidateId, electionId } = useParams();
  const navigate = useNavigate();
  const [verifyModal, setVerifyModal] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const candidate = CANDIDATES.find((item) => String(item.id) === String(candidateId));

  if (!candidate) {
    return (
      <AuthenticatedPageShell activeCategory={NEWS_CATEGORY_ELECTIONS}>
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">Candidate not found</div>
      </AuthenticatedPageShell>
    );
  }

  const handleVoteClick = async () => {
    setCheckingVerification(true);
    try {
      const verification = await getMyVerification();
      const status = verification?.status ? String(verification.status).toUpperCase() : null;

      if (status === 'APPROVED') {
        navigate(`/elections/${electionId}/vote`);
        return;
      }

      setVerifyModal(true);
    } finally {
      setCheckingVerification(false);
    }
  };

  return (
    <AuthenticatedPageShell activeCategory={NEWS_CATEGORY_ELECTIONS}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to={`/elections/${electionId}`} className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors mb-6 text-sm font-medium">
        <ArrowLeft className="w-4 h-4" />
        Back to Candidates
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-200 bg-white">
            <div className="aspect-[4/5] relative">
              <img src={candidate.image} alt={candidate.name} className="w-full h-full object-cover" />
              <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full shadow-sm text-sm font-bold text-slate-900">{candidate.party}</div>
            </div>
            <div className="p-6 text-center">
              <h1 className="text-3xl font-bold text-slate-900 mb-1">{candidate.name}</h1>
              <p className="text-lg text-slate-600 font-medium mb-6">{candidate.position}</p>
              <button
                onClick={handleVoteClick}
                disabled={checkingVerification}
                className="w-full py-4 bg-blue-600 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {checkingVerification ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <CheckCircle className="w-6 h-6" />
                )}
                Vote for {candidate.name.split(' ')[0]}
              </button>
              <p className="text-xs text-slate-400 mt-4 flex items-center justify-center gap-1"><ShieldCheck className="w-3 h-3" />Verified Candidate</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">About the Candidate</h2>
            <p className="text-slate-700 text-lg">{candidate.bio}</p>
          </section>
          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Quick Stats</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">Age: <strong>{candidate.age}</strong></div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">Education: <strong>{candidate.education}</strong></div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">Years in Office: <strong>{candidate.yearsInOffice}</strong></div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">Residence: <strong>{candidate.residence}</strong></div>
            </div>
          </section>
          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Endorsements</h2>
            <div className="flex flex-wrap gap-3">
              {['Teachers Union', 'Local Chamber of Commerce', 'Environmental Defense Fund'].map((endorsement) => (
                <div key={endorsement} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm text-sm font-medium text-slate-700">
                  <ThumbsUp className="w-4 h-4 text-emerald-500" />
                  {endorsement}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
      </div>

      {verifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Verification Required</h2>
            <p className="text-sm text-slate-600 mb-6">
              You must complete voter identity verification before casting your vote.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  setVerifyModal(false);
                  navigate(`/elections/${electionId}/verify`);
                }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
              >
                Verify My Identity
              </button>
              <button
                type="button"
                onClick={() => setVerifyModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthenticatedPageShell>
  );
}
