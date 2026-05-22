import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Eye, Filter, Search, XCircle } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import AdminDataState from '../components/AdminDataState';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminStatusBadge from '../components/AdminStatusBadge';
import { useAdminResource } from '../hooks/useAdminResource';
import { getCurrentAdminProfile, listVerifications, updateVerificationStatus } from '../services/adminApi';
import { supabase } from '../../shared/services/supabaseClient';

// SETUP NOTE: Enable Realtime on public.verifications (Database -> Replication)
// and confirm RLS allows authenticated users to SELECT their own row.

function formatRelativeTime(isoTimestamp) {
  if (!isoTimestamp) return '';
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  if (Number.isNaN(then)) return '';

  const diffSeconds = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSeconds < 45) return 'just now';
  if (diffSeconds < 90) return '1 minute ago';

  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

/**
 * Renders verification queue with inline moderation actions.
 * @returns {JSX.Element}
 */
export default function AdminVerifications() {
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [decisionOutcome, setDecisionOutcome] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDecision, setPendingDecision] = useState(null);
  const loadVerifications = useCallback(() => listVerifications({ search }), [search]);
  const { data, loading, error, reload } = useAdminResource(loadVerifications, [search]);
  const reloadRef = useRef(reload);

  useEffect(() => {
    reloadRef.current = reload;
  });

  useEffect(() => {
    const channel = supabase
      .channel('admin-verifications-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'verifications' },
        () => {
          reloadRef.current();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDecision = async (verificationId, status) => {
    setMessage('');
    setDecisionOutcome(null);
    setIsSaving(true);
    try {
      const admin = await getCurrentAdminProfile();
      if (!admin?.id) {
        throw new Error('Unable to resolve admin identity.');
      }
      await updateVerificationStatus({ verificationId, status, adminUserId: admin.id });
      setDecisionOutcome(status);
      setMessage(`Verification ${status.toLowerCase()} successfully.`);
      await reload();
    } catch (saveError) {
      setDecisionOutcome('ERROR');
      setMessage(saveError?.message || 'Unable to update verification.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (!pendingDecision) return;
    try {
      await handleDecision(pendingDecision.id, pendingDecision.status);
    } finally {
      setPendingDecision(null);
    }
  };

  const handleCancel = () => {
    if (isSaving) return;
    setPendingDecision(null);
  };

  const decisionTarget = pendingDecision?.full_name || 'This user';
  const modalCopy = pendingDecision?.status === 'APPROVED'
    ? {
      title: 'Approve Verification',
      message: `This will mark ${decisionTarget}'s identity as verified. This action cannot be undone.`,
      confirmLabel: 'Yes, Approve',
      confirmClassName: 'bg-green-600 hover:bg-green-700 disabled:hover:bg-green-600',
    }
    : pendingDecision?.status === 'REJECTED'
      ? {
        title: 'Reject Verification',
        message: `This will deny ${decisionTarget}'s verification request. They will need to resubmit. This action cannot be undone.`,
        confirmLabel: 'Yes, Reject',
        confirmClassName: 'bg-red-600 hover:bg-red-700 disabled:hover:bg-red-600',
      }
      : null;

  return (
    <div>
      <AdminPageHeader
        title="Verification Requests"
        subtitle="Inspect voter and candidate identity submissions."
        actions={(
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
                className="border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
              />
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              // TODO: Wire up filter drawer when filters are defined.
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        )}
      />

      {message ? <p className={`text-sm mb-3 ${decisionOutcome === 'APPROVED' ? 'text-green-700' : 'text-red-600'}`}>{message}</p> : null}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <AdminDataState loading={loading} error={error} isEmpty={!loading && !error && (data || []).length === 0} emptyText="No verification requests found. If submissions have been made, check that the admin_select_all RLS policy exists on the verifications table in your Supabase project under Authentication → Policies." />
        {!loading && !error && (data || []).length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Document</th>
                <th className="px-4 py-3 text-left">Submitted</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data || []).map((item) => (
                <tr key={item.id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{item.full_name || 'Unknown'}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {/* Type is derived client-side — add a type column to the DB for real classification. */}
                    {String(item.national_id_number || '').trim().toUpperCase().startsWith('C')
                      ? 'Candidate Registration'
                      : 'Voter ID'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {/* Document label is a placeholder — store document_type in the DB. */}
                    <div className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-slate-200" aria-hidden="true" />
                      ID Document
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {item.submitted_at ? formatRelativeTime(item.submitted_at) : 'N/A'}
                  </td>
                  <td className="px-4 py-3"><AdminStatusBadge value={item.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Link
                        to={`/admin/verifications/${item.id}`}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                        aria-label="View verification"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      {String(item.status || '').toUpperCase() === 'PENDING' ? (
                        <>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => setPendingDecision({ id: item.id, status: 'APPROVED', full_name: item.full_name })}
                            className="inline-flex items-center justify-center rounded-md border border-emerald-200 p-2 text-emerald-600 hover:bg-emerald-50 disabled:opacity-60"
                            aria-label="Approve verification"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => setPendingDecision({ id: item.id, status: 'REJECTED', full_name: item.full_name })}
                            className="inline-flex items-center justify-center rounded-md border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                            aria-label="Reject verification"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      {modalCopy ? (
        <ConfirmationModal
          isOpen={pendingDecision !== null}
          title={modalCopy.title}
          message={modalCopy.message}
          confirmLabel={modalCopy.confirmLabel}
          confirmClassName={modalCopy.confirmClassName}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          isConfirming={isSaving}
        />
      ) : null}
    </div>
  );
}
