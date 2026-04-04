import React, { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminDataState from '../components/AdminDataState';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminStatusBadge from '../components/AdminStatusBadge';
import { useAdminResource } from '../hooks/useAdminResource';
import { getCurrentAdminProfile, getVerificationById, updateVerificationStatus } from '../services/adminApi';

/**
 * Formats date-time for human display.
 * @param {string | null | undefined} value
 * @returns {string}
 */
function formatDateTime(value) {
  if (!value) {
    return 'N/A';
  }
  return new Date(value).toLocaleString();
}

/**
 * Renders detailed verification review page.
 * @returns {JSX.Element}
 */
export default function AdminVerificationDetail() {
  const { verificationId } = useParams();
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const loadDetail = useCallback(() => getVerificationById(verificationId), [verificationId]);
  const { data, loading, error, reload } = useAdminResource(loadDetail, [verificationId]);

  const isPending = useMemo(() => String(data?.status || '').toUpperCase() === 'PENDING', [data]);

  /** Applies the selected review decision to current verification. */
  const handleDecision = async (status) => {
    setMessage('');
    setIsSaving(true);
    try {
      const admin = await getCurrentAdminProfile();
      if (!admin?.id) {
        throw new Error('Unable to resolve admin identity.');
      }
      await updateVerificationStatus({ verificationId, status, adminUserId: admin.id });
      setMessage(`Verification ${status.toLowerCase()} successfully.`);
      await reload();
    } catch (saveError) {
      setMessage(saveError?.message || 'Unable to update verification.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Verification Review"
        subtitle="Inspect evidence and apply approval decision."
        actions={<Link to="/admin/verifications" className="text-sm text-blue-600 hover:text-blue-700">Back to list</Link>}
      />

      {message ? <p className={`text-sm mb-4 ${message.includes('successfully') ? 'text-green-700' : 'text-red-600'}`}>{message}</p> : null}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6">
        <AdminDataState loading={loading} error={error} isEmpty={!loading && !error && !data} emptyText="Verification not found." />

        {!loading && !error && data ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{data.full_name}</h2>
              <AdminStatusBadge value={data.status} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <p><span className="text-slate-500">Address:</span> {data.address}</p>
              <p><span className="text-slate-500">Birthdate:</span> {data.birthdate || 'N/A'}</p>
              <p><span className="text-slate-500">Submitted:</span> {formatDateTime(data.submitted_at)}</p>
              <p><span className="text-slate-500">Reviewed:</span> {formatDateTime(data.reviewed_at)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Photo ID</p>
              <a href={data.photo_id_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700 break-all">{data.photo_id_url}</a>
            </div>
            {isPending ? (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                <button type="button" disabled={isSaving} onClick={() => handleDecision('APPROVED')} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-60">Approve</button>
                <button type="button" disabled={isSaving} onClick={() => handleDecision('REJECTED')} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-60">Reject</button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
