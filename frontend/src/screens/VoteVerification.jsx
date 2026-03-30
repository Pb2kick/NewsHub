import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import { ELECTIONS } from '../mockData';

const verificationSchema = z.object({
  voterId: z.string().min(8).max(12).regex(/^[A-Z0-9]+$/),
  fullName: z.string().min(2).max(100),
  dateOfBirth: z.string().min(1),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/),
});

/**
 * Renders voter verification step before ballot access.
 * @returns {JSX.Element}
 */
export default function VoteVerification() {
  const { electionId } = useParams();
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const election = ELECTIONS.find((item) => String(item.id) === String(electionId));

  const form = useForm({
    resolver: zodResolver(verificationSchema),
    defaultValues: { voterId: '', fullName: '', dateOfBirth: '', zipCode: '' },
  });

  /** Handles mock verification flow and proceeds to vote page. */
  const onSubmit = async () => {
    setIsVerifying(true);
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    setVerified(true);
    setIsVerifying(false);
  };

  if (!election) {
    return <div className="max-w-7xl mx-auto px-4 py-16 text-center">Election not found</div>;
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-slate-50 py-4 sm:py-8">
      <div className="max-w-2xl mx-auto px-3 sm:px-6">
        <Link to={`/elections/${electionId}`} className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors mb-4 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Candidates
        </Link>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-4 text-white">
            <div className="flex items-center gap-3"><ShieldCheck className="w-5 h-5" /><h1 className="font-bold">Voter Verification</h1></div>
            <p className="text-xs opacity-90 mt-1">{election.title}</p>
          </div>

          {!verified ? (
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 sm:p-6 space-y-4">
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
                <AlertTriangle className="w-4 h-4 mt-0.5" /> Identity verification is required before casting your vote.
              </div>
              <input {...form.register('voterId')} placeholder="Voter ID" className="w-full p-3 border border-slate-200 rounded-lg" />
              <input {...form.register('fullName')} placeholder="Full legal name" className="w-full p-3 border border-slate-200 rounded-lg" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="date" {...form.register('dateOfBirth')} className="w-full p-3 border border-slate-200 rounded-lg" />
                <input {...form.register('zipCode')} placeholder="ZIP code" className="w-full p-3 border border-slate-200 rounded-lg" />
              </div>
              <div className="text-xs text-slate-500 flex items-start gap-2"><Lock className="w-4 h-4 mt-0.5" />Your data is used only for mock verification in this demo.</div>
              <button type="submit" disabled={isVerifying} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
                {isVerifying ? 'Verifying...' : 'Verify & Continue'}
              </button>
            </form>
          ) : (
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-green-100 text-green-700 grid place-items-center mx-auto"><CheckCircle2 className="w-7 h-7" /></div>
              <h2 className="text-xl font-bold text-slate-900">Identity Verified</h2>
              <p className="text-sm text-slate-600">You can now proceed to the ballot for {election.title}.</p>
              <button type="button" onClick={() => navigate(`/elections/${electionId}/vote`)} className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
                Proceed to Ballot <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
