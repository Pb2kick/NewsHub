/*
 * Changes:
 * - Fix 1: userId resolution changed from auth_user_id join to email match.
 *   auth_user_id column does not exist in public.users — the link is email.
 *   Without this fix, the public.users lookup always returned null, making
 *   userId null on every load.
 * - Fix 2: authUserId state added to hold the auth UUID separately.
 *   votes.user_id is bigint (needs numeric id); verifications.user_id is uuid
 *   (needs auth UUID). Both are now resolved and stored independently.
 * - Fix 3: castVote() receives both userId (bigint) and authUserId (uuid)
 *   so each table query gets the correct ID type.
 * - Fix 4: Silent guard replaced with visible submitError when userId is null,
 *   so the user gets actionable feedback instead of a frozen button.
 * - Fix 5: Inline step === 'success' card block replaced with a fixed-overlay
 *   modal. step state now only controls select ↔ confirm. Modal has no X
 *   button and no backdrop close — only the two nav buttons exit it.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Home, Lock, PartyPopper, User } from 'lucide-react';
import AuthenticatedPageShell from '../../shared/components/AuthenticatedPageShell';
import { NEWS_CATEGORY_ELECTIONS } from '../../shared/constants/newsCategories';
import { supabase } from '../../shared/services/supabaseClient';
import { getMyVerification } from '../../admin/services/adminApi';
import { castVote, checkHasVoted, getCandidatesByElectionId, getElectionById } from '../services/electionsApi';

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
  const [submitError, setSubmitError] = useState('');
  const [eligibilityError, setEligibilityError] = useState('');
  const [userId, setUserId] = useState('');
  const [authUserId, setAuthUserId] = useState(''); // Fix 2: auth UUID for verifications lookup
  const [showSuccessModal, setShowSuccessModal] = useState(false); // Fix 5: modal flag
  const [election, setElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      setLoadError('');
      setEligibilityError('');
      setSubmitError('');
      setConfirmationCode('');
      setSelectedCandidate(null);
      setStep('select');

      const userPromise = supabase.auth.getUser().then(async (result) => {
        const user = result?.data?.user || null;

        // Fix 1: resolve numeric public.users.id via email match.
        // auth_user_id column does not exist — public.users.email is the link.
        // maybeSingle() avoids throwing when the row is missing.
        const numericId = user?.email ? await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)        // Fix 1: was .eq('auth_user_id', user.id)
          .maybeSingle()
          .then(({ data: publicUser }) => publicUser?.id ?? null)
          : null;

        // numericId is used for votes.user_id (bigint).
        // user?.id (auth UUID) is used for verifications.user_id (uuid).
        const hasVoted = numericId !== null
          ? await checkHasVoted(numericId, electionId)
          : false;

        return {
          user,
          hasVoted,
          numericUserId: numericId,
          authUserId: user?.id ?? null, // Fix 2: expose auth UUID separately
        };
      });
      const electionPromise = getElectionById(electionId);
      const candidatesPromise = getCandidatesByElectionId(electionId);
      const verificationPromise = getMyVerification();

      const [userResult, electionData, candidateData, verification] = await Promise.all([
        userPromise,
        electionPromise,
        candidatesPromise,
        verificationPromise,
      ]);

      if (!active) return;

      const hasVoted = Boolean(userResult?.hasVoted);

      // Fix 1: use numeric public.users.id — votes.user_id is bigint.
      setUserId(userResult?.numericUserId ?? '');
      // Fix 2: store auth UUID separately — verifications.user_id is uuid.
      setAuthUserId(userResult?.authUserId ?? '');

      if (!electionData) {
        setElection(null);
        setCandidates([]);
        setLoadError('Election not found');
        setIsLoading(false);
        return;
      }

      setElection(electionData);
      setCandidates(candidateData || []);

      const electionStatus = String(electionData?.status || '').toUpperCase();
      const verificationStatus = String(verification?.status || '').toUpperCase();

      if (hasVoted) {
        setEligibilityError('You have already cast your vote in this election.');
      } else if (electionStatus !== 'ACTIVE') {
        setEligibilityError('This election is not currently accepting votes.');
      } else if (verificationStatus !== 'APPROVED') {
        setEligibilityError('Your identity has not been verified. Please submit your verification before voting.');
      }

      setIsLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, [electionId]);

  const selectedCandidateData = candidates.find((item) => item.id === selectedCandidate);

  if (isLoading) {
    return (
      <AuthenticatedPageShell activeCategory={NEWS_CATEGORY_ELECTIONS}>
        <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-500">Loading ballot...</div>
      </AuthenticatedPageShell>
    );
  }

  if (!election) {
    return (
      <AuthenticatedPageShell activeCategory={NEWS_CATEGORY_ELECTIONS}>
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">{loadError || 'Election not found'}</div>
      </AuthenticatedPageShell>
    );
  }

  /** Handles vote submission and success modal transition. */
  const handleSubmitVote = async () => {
    if (!selectedCandidate) return;
    // Fix 4: replace silent return with visible error when userId failed to resolve.
    if (!userId) {
      setSubmitError('Unable to identify your account. Please sign out and sign back in.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const result = await castVote({
        electionId,
        candidateId: selectedCandidate,
        userId,       // Fix 3: numeric bigint → votes.user_id
        authUserId,   // Fix 3: auth UUID → verifications.user_id lookup inside castVote
      });

      if (result?.success) {
        const shortId = String(result.voteId || '').slice(0, 8).toUpperCase();
        // Fix 5: trigger modal instead of switching step to 'success'.
        setConfirmationCode(shortId ? `VOTE-${shortId}` : 'VOTE-UNKNOWN');
        setShowSuccessModal(true);
        return;
      }

      const reason = result?.reason;
      if (reason === 'ALREADY_VOTED') {
        setSubmitError('You have already cast your vote in this election.');
      } else if (reason === 'NOT_ACTIVE') {
        setSubmitError('This election is not currently accepting votes.');
      } else if (reason === 'NOT_VERIFIED') {
        setSubmitError('Your identity has not been verified. Please submit your verification before voting.');
      } else if (reason === 'INSERT_FAILED' || reason === 'UNEXPECTED') {
        setSubmitError(result?.message || 'Unable to submit your vote right now.');
      } else {
        setSubmitError('Unable to submit your vote right now.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthenticatedPageShell activeCategory={NEWS_CATEGORY_ELECTIONS}>
      <div className="min-h-[calc(100vh-8rem)] bg-slate-50 py-4 sm:py-8">
        <div className="max-w-2xl mx-auto px-3 sm:px-6">
        {step !== 'success' && <Link to={`/elections/${electionId}/verify`} className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-4 text-sm"><ArrowLeft className="w-4 h-4" />Back to Verification</Link>}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">
          {eligibilityError ? (
            <div className="text-center space-y-3 py-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 grid place-items-center mx-auto">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <p className="text-sm text-slate-600">{eligibilityError}</p>
            </div>
          ) : (
            <>
              {step === 'select' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-slate-900">Select Your Candidate</h2>
                  {candidates.length === 0 ? (
                    <div className="text-sm text-slate-500">No candidates available for this election.</div>
                  ) : (
                    candidates.map((candidate) => (
                      <button key={candidate.id} type="button" onClick={() => setSelectedCandidate(candidate.id)} className={`w-full p-3 border-2 rounded-xl text-left ${selectedCandidate === candidate.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                        <div className="flex items-center gap-3">
                          {candidate.image ? (
                            <img src={candidate.image} alt={candidate.name} className="w-12 h-12 rounded-full object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                              <User className="w-5 h-5 text-slate-400" />
                            </div>
                          )}
                          <div>
                            <h3 className="font-bold text-slate-900">{candidate.name}</h3>
                            <p className="text-xs text-slate-500">{candidate.party || 'Independent'}</p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3 flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5" />Your vote is final once submitted.</div>
                  <button type="button" onClick={() => setStep('confirm')} disabled={!selectedCandidate || candidates.length === 0} className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">Review Selection</button>
                </div>
              )}

              {step === 'confirm' && selectedCandidateData && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-slate-900">Confirm Your Vote</h2>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                    {selectedCandidateData.image ? (
                      <img src={selectedCandidateData.image} alt={selectedCandidateData.name} className="w-20 h-20 rounded-full object-cover mx-auto mb-3" />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mx-auto mb-3">
                        <User className="w-6 h-6 text-slate-400" />
                      </div>
                    )}
                    <h3 className="font-bold text-slate-900">{selectedCandidateData.name}</h3>
                    <p className="text-sm text-slate-500">{selectedCandidateData.party || 'Independent'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setStep('select')} className="py-3 border border-slate-200 rounded-lg font-semibold">Go Back</button>
                    <button type="button" onClick={handleSubmitVote} disabled={isSubmitting} className="py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
                      {isSubmitting ? 'Recording...' : 'Submit Vote'}
                    </button>
                  </div>
                  {submitError ? <p className="text-xs text-red-600 text-center">{submitError}</p> : null}
                </div>
              )}
              {/* Fix 5: step === 'success' block removed — replaced by showSuccessModal below */}
            </>
          )}
        </div>
        </div>
      </div>

      {/* Fix 5: Success modal — fixed full-screen overlay, no backdrop close, no X button */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 grid place-items-center">
                <PartyPopper className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Vote Submitted!</h2>
              <p className="text-sm text-slate-500">Your vote has been securely recorded.</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Confirmation Code</span>
                <span className="font-mono font-bold text-blue-600">{confirmationCode}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 shrink-0">Election</span>
                <span className="font-medium text-slate-800 text-right truncate">{election?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Timestamp</span>
                <span className="font-medium text-slate-800">{new Date().toLocaleString()}</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-1 text-xs text-slate-400">
              <Lock className="w-3 h-3" /> Your vote is final and cannot be changed.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => navigate('/elections')}
                className="py-3 border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-sm"
              >
                View Elections
              </button>
              <button
                type="button"
                onClick={() => navigate('/home')}
                className="py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" /> Go to Home
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthenticatedPageShell>
  );
}
