import React, { useCallback, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import AdminDataState from '../components/AdminDataState';
import AdminPageHeader from '../components/AdminPageHeader';
import { useAdminResource } from '../hooks/useAdminResource';
import { supabase } from '../../shared/services/supabaseClient';

const STATUS_OPTIONS = ['All', 'PENDING', 'REVIEWED', 'DISMISSED'];

const TYPE_BADGE_CLASSES = {
  news: 'bg-blue-100 text-blue-700',
  candidate: 'bg-purple-100 text-purple-700',
  user: 'bg-orange-100 text-orange-700',
  comment: 'bg-slate-100 text-slate-700',
};

const STATUS_BADGE_CLASSES = {
  PENDING: 'bg-amber-100 text-amber-700',
  REVIEWED: 'bg-green-100 text-green-700',
  DISMISSED: 'bg-slate-100 text-slate-400',
};

async function loadReports() {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Unable to load reports.');
  }

  return data || [];
}

/**
 * Renders the admin reports queue with review actions.
 * @returns {JSX.Element}
 */
export default function AdminReports() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [actionError, setActionError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const loadReportsResource = useCallback(() => loadReports(), []);
  const { data, loading, error, reload } = useAdminResource(loadReportsResource, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data || []).filter((item) => {
      const status = String(item.status || '').toUpperCase();
      if (statusFilter !== 'All' && status !== statusFilter) {
        return false;
      }
      if (!term) {
        return true;
      }
      const haystack = `${item.target_label || ''} ${item.reason || ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [data, search, statusFilter]);

  const handleStatusUpdate = async (reportId, status) => {
    setActionError('');
    setIsUpdating(true);
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user?.id) {
        throw new Error('Unable to resolve admin identity.');
      }

      const { error: updateError } = await supabase
        .from('reports')
        .update({
          status,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      if (updateError) {
        throw new Error(updateError.message || 'Unable to update report.');
      }

      await reload();
    } catch (updateError) {
      setActionError(updateError?.message || 'Unable to update report.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Reports"
        subtitle="Review flagged content and users."
        actions={(
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search target or reason"
                className="border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm bg-white"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 'All' ? 'All statuses' : option}
                </option>
              ))}
            </select>
          </div>
        )}
      />

      {actionError ? <p className="text-sm text-rose-600 mb-3">{actionError}</p> : null}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <AdminDataState
          loading={loading}
          error={error}
          isEmpty={!loading && !error && filtered.length === 0}
          emptyText="No reports found."
        />
        {!loading && !error && filtered.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Target</th>
                <th className="px-4 py-3 text-left">Reason</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Submitted</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const targetType = String(item.target_type || '').toLowerCase();
                const status = String(item.status || '').toUpperCase();
                const typeBadgeClass = TYPE_BADGE_CLASSES[targetType] || TYPE_BADGE_CLASSES.comment;
                const statusBadgeClass = STATUS_BADGE_CLASSES[status] || STATUS_BADGE_CLASSES.PENDING;

                return (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${typeBadgeClass}`}>
                        {targetType || 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-900 font-medium max-w-xs truncate">
                      {item.target_label || item.target_id || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{item.reason || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadgeClass}`}>
                        {status || 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {status === 'PENDING' ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleStatusUpdate(item.id, 'REVIEWED')}
                            className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                          >
                            Mark Reviewed
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleStatusUpdate(item.id, 'DISMISSED')}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                          >
                            Dismiss
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
