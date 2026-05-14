/*
 * Changes:
 * - Enforce a 16-digit national ID in the Zod schema to match verification requirements.
 * - Restrict typed input to digits only while keeping paste support and add maxLength/placeholder.
 */
/**
 * VoteVerification.jsx — REWRITTEN from mock to real Supabase flow.
 *
 * Changes from the mock version:
 *  - On mount, calls getMyVerification() to check the user's current status.
 *  - APPROVED  → shows "You are verified" screen + Proceed to Ballot button.
 *  - PENDING   → immediately redirects to /elections?verification=pending.
 *  - REJECTED  → shows rejection notice + "Try Again" button that re-shows the form.
 *  - No record → shows the real 7-field form with file upload.
 *  - On submit  → calls submitVerification() then navigates to
 *                 /elections?verification=submitted.
 *  - File validation is done outside Zod (checks idFile state is non-null).
 *  - Old mock fields (voterId, zipCode) replaced with Philippine ID fields.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Lock,
  ShieldCheck,
  Upload,
  XCircle,
} from 'lucide-react';
import AuthenticatedPageShell from '../../shared/components/AuthenticatedPageShell';
import { ELECTIONS } from '../data/mockData';
import { NEWS_CATEGORY_ELECTIONS } from '../../shared/constants/newsCategories';
import { getMyVerification, submitVerification } from '../../admin/services/adminApi';
import { supabase } from '../../shared/services/supabaseClient'; // NEW

// ── Zod schema — text fields only; file checked separately ───────────────────
const verificationSchema = z.object({
  nationalIdNumber: z
    .string()
    .length(16, 'National ID number must be exactly 16 digits')
    .regex(/^\d{16}$/, 'National ID number must contain only digits, no spaces or dashes'),
  fullName: z.string().min(2, 'Enter your full legal name').max(100),
  dateOfBirth: z.string().min(1, 'Select your date of birth'),
  barangay: z.string().min(1, 'Enter your barangay').max(100),
  municipality: z.string().min(1, 'Enter your municipality / city').max(100),
  province: z.string().min(1, 'Enter your province').max(100),
});

// ── Shared input class ────────────────────────────────────────────────────────
const inputCls =
  'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition placeholder-slate-400';

// ── Sub-components ────────────────────────────────────────────────────────────

/** Full-page centered spinner shown while checking existing status. */
function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      <span className="text-sm">Checking verification status…</span>
    </div>
  );
}

/** Shown when the user already has an APPROVED verification. */
function ApprovedScreen({ election, electionId, navigate }) {
  return (
    <div className="p-6 text-center space-y-4">
      <div className="w-14 h-14 rounded-full bg-green-100 text-green-700 grid place-items-center mx-auto">
        <CheckCircle2 className="w-7 h-7" />
      </div>
      <h2 className="text-xl font-bold text-slate-900">You Are Verified</h2>
      <p className="text-sm text-slate-600">
        Your identity has been approved. You can now cast your vote for{' '}
        <span className="font-semibold">{election.title}</span>.
      </p>
      <button
        type="button"
        onClick={() => navigate(`/elections/${electionId}/vote`)}
        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
      >
        Proceed to Ballot <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

/** Shown when the admin has REJECTED the user's last submission. */
function RejectedScreen({ onResubmit }) {
  return (
    <div className="p-6 text-center space-y-4">
      <div className="w-14 h-14 rounded-full bg-red-100 text-red-700 grid place-items-center mx-auto">
        <XCircle className="w-7 h-7" />
      </div>
      <h2 className="text-xl font-bold text-slate-900">Verification Rejected</h2>
      <p className="text-sm text-slate-600">
        Your previous submission was not approved. Please review your details and
        resubmit with a clear photo of a valid government-issued ID.
      </p>
      <button
        type="button"
        onClick={onResubmit}
        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
      >
        Submit Again
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Voter verification gate before ballot access.
 * Checks Supabase for an existing verification record on mount and branches
 * into APPROVED / PENDING / REJECTED / no-record states.
 *
 * @returns {JSX.Element}
 */
export default function VoteVerification() {
  const { electionId } = useParams();
  const navigate = useNavigate();
  const election = ELECTIONS.find((item) => String(item.id) === String(electionId));

  // Status-check state
  const [statusLoading, setStatusLoading] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState(null); // null = no record

  // Form state
  const [idFile, setIdFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const form = useForm({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      nationalIdNumber: '',
      fullName: '',
      dateOfBirth: '',
      barangay: '',
      municipality: '',
      province: '',
    },
  });

  const handleNationalIdKeyDown = (event) => {
    if (event.ctrlKey || event.metaKey) {
      return;
    }
    const allowedKeys = [
      'Backspace',
      'Delete',
      'Tab',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'Enter',
    ];
    if (allowedKeys.includes(event.key)) {
      return;
    }
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  };

  // ── Check existing verification on mount ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let channel; // NEW
    const run = async () => { // NEW
      const record = await getMyVerification(); // NEW
      if (cancelled) return; // NEW
      const status = record?.status ? String(record.status).toUpperCase() : null;
      if (status === 'PENDING') {
        // Redirect immediately — no need to show any UI
        navigate('/elections?verification=pending', { replace: true });
        return;
      }
      setVerificationStatus(status); // APPROVED | REJECTED | null
      setStatusLoading(false);

      const { data: { user } } = await supabase.auth.getUser(); // NEW
      if (cancelled || !user?.id) return; // NEW

      channel = supabase // NEW
        .channel(`verification-status-${user.id}`) // NEW
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'verifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (cancelled) return;
            const newStatus = payload.new?.status
              ? String(payload.new.status).toUpperCase()
              : null;
            if (newStatus === 'PENDING') {
              navigate('/elections?verification=pending', { replace: true });
              return;
            }
            setVerificationStatus(newStatus); // live update: APPROVED or REJECTED
          }
        )
        .subscribe(); // NEW
    }; // NEW
    run(); // NEW
    return () => {
      cancelled = true; // NEW
      if (channel) { // NEW
        supabase.removeChannel(channel); // NEW
      } // NEW
    };
  }, [navigate]);

  // ── File input handler ────────────────────────────────────────────────────
  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setIdFile(file);
    setFileError(file ? '' : 'Please attach a photo or PDF of your national ID.');
  };

  // ── Form submit ───────────────────────────────────────────────────────────
  const onSubmit = async (data) => {
    if (!idFile) {
      setFileError('Please attach a photo or PDF of your national ID.');
      return;
    }
    setSubmitError('');
    setIsSubmitting(true);
    try {
      await submitVerification({ ...data, photoFile: idFile });
      navigate('/elections?verification=submitted', { replace: true });
    } catch (err) {
      setSubmitError(err?.message || 'Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Election guard ────────────────────────────────────────────────────────
  if (!election) {
    return (
      <AuthenticatedPageShell activeCategory={NEWS_CATEGORY_ELECTIONS}>
        <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-500">
          Election not found.
        </div>
      </AuthenticatedPageShell>
    );
  }

  return (
    <AuthenticatedPageShell activeCategory={NEWS_CATEGORY_ELECTIONS}>
      <div className="min-h-[calc(100vh-8rem)] bg-slate-50 py-4 sm:py-8">
        <div className="max-w-2xl mx-auto px-3 sm:px-6">
          <Link
            to={`/elections/${electionId}`}
            className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors mb-4 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Candidates
          </Link>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header bar */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-4 text-white">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5" />
                <h1 className="font-bold">Voter Verification</h1>
              </div>
              <p className="text-xs opacity-90 mt-1">{election.title}</p>
            </div>

            {/* Body — branches on status */}
            {statusLoading ? (
              <LoadingScreen />
            ) : verificationStatus === 'APPROVED' ? (
              <ApprovedScreen election={election} electionId={electionId} navigate={navigate} />
            ) : verificationStatus === 'REJECTED' ? (
              <RejectedScreen onResubmit={() => setVerificationStatus(null)} />
            ) : (
              /* No record or forced resubmit — show the real form */
              <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 sm:p-6 space-y-4" noValidate>
                {/* Info banner */}
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  Identity verification is required before casting your vote. Your details will be reviewed by an admin.
                </div>

                {/* National ID Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    National ID Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...form.register('nationalIdNumber')}
                    placeholder="16-digit number e.g. 1234567890123456"
                    maxLength={16}
                    onKeyDown={handleNationalIdKeyDown}
                    className={inputCls}
                  />
                  {form.formState.errors.nationalIdNumber && (
                    <p className="text-xs text-red-500 mt-1">{form.formState.errors.nationalIdNumber.message}</p>
                  )}
                </div>

                {/* Full Legal Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Full Legal Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...form.register('fullName')}
                    placeholder="As printed on your national ID"
                    className={inputCls}
                  />
                  {form.formState.errors.fullName && (
                    <p className="text-xs text-red-500 mt-1">{form.formState.errors.fullName.message}</p>
                  )}
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <input type="date" {...form.register('dateOfBirth')} className={inputCls} />
                  {form.formState.errors.dateOfBirth && (
                    <p className="text-xs text-red-500 mt-1">{form.formState.errors.dateOfBirth.message}</p>
                  )}
                </div>

                {/* Address fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Barangay <span className="text-red-500">*</span>
                    </label>
                    <input {...form.register('barangay')} placeholder="Barangay" className={inputCls} />
                    {form.formState.errors.barangay && (
                      <p className="text-xs text-red-500 mt-1">{form.formState.errors.barangay.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Municipality / City <span className="text-red-500">*</span>
                    </label>
                    <input {...form.register('municipality')} placeholder="Municipality" className={inputCls} />
                    {form.formState.errors.municipality && (
                      <p className="text-xs text-red-500 mt-1">{form.formState.errors.municipality.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Province <span className="text-red-500">*</span>
                    </label>
                    <input {...form.register('province')} placeholder="Province" className={inputCls} />
                    {form.formState.errors.province && (
                      <p className="text-xs text-red-500 mt-1">{form.formState.errors.province.message}</p>
                    )}
                  </div>
                </div>

                {/* National ID Photo upload */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    National ID Photo <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    {idFile ? idFile.name : 'Click to upload photo or PDF'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {fileError && <p className="text-xs text-red-500 mt-1">{fileError}</p>}
                </div>

                {/* Privacy note */}
                <div className="text-xs text-slate-500 flex items-start gap-2">
                  <Lock className="w-4 h-4 mt-0.5 shrink-0" />
                  Your details are submitted securely and reviewed only by authorised administrators.
                </div>

                {/* API-level error */}
                {submitError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    {submitError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? 'Submitting…' : 'Submit for Verification'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </AuthenticatedPageShell>
  );
}
