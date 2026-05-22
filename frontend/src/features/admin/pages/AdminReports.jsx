import React, { useCallback, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import AdminDataState from '../components/AdminDataState';
import AdminPageHeader from '../components/AdminPageHeader';
import { useAdminResource } from '../hooks/useAdminResource';
import { supabase } from '../../shared/services/supabaseClient';

const STATUS_OPTIONS = ['All', 'PENDING', 'REVIEWED', 'DISMISSED'];
const REPORT_TYPES = ['news', 'candidate', 'comment', 'user'];

const TYPE_COLORS = {
  news: '#3b82f6',
  candidate: '#a855f7',
  comment: '#94a3b8',
  user: '#f97316',
};

const STATUS_COLORS = {
  PENDING: '#f59e0b',
  REVIEWED: '#22c55e',
  DISMISSED: '#94a3b8',
};

const TYPE_BADGE_CLASSES = {
  news: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  candidate: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  user: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  comment: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
};

const STATUS_BADGE_CLASSES = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  REVIEWED: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  DISMISSED: 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400',
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

function ReportsTypeBarChart({ rows }) {
  const counts = REPORT_TYPES.map((type) => ({
    type,
    count: rows.filter((r) => String(r.target_type || '').toLowerCase() === type).length,
  }));
  const maxCount = Math.max(1, ...counts.map((c) => c.count));
  const barMaxWidth = 220;
  const rowHeight = 32;
  const startY = 24;

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Reports by Type</h3>
      <svg viewBox="0 0 420 160" className="w-full h-auto" role="img" aria-label="Reports by type bar chart">
        {counts.map((item, index) => {
          const y = startY + index * rowHeight;
          const barWidth = (item.count / maxCount) * barMaxWidth;
          return (
            <g key={item.type}>
              <text x="8" y={y + 12} className="text-[11px] fill-slate-600 dark:fill-slate-400" style={{ fontSize: 11 }}>
                {item.type}
              </text>
              <rect x="100" y={y} width={barWidth} height="18" rx="4" fill={TYPE_COLORS[item.type]} />
              <text x="400" y={y + 12} textAnchor="end" className="text-[11px] fill-slate-700 dark:fill-slate-300" style={{ fontSize: 11 }}>
                {item.count}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ReportsStatusStackedBar({ rows }) {
  const pending = rows.filter((r) => String(r.status || '').toUpperCase() === 'PENDING').length;
  const reviewed = rows.filter((r) => String(r.status || '').toUpperCase() === 'REVIEWED').length;
  const dismissed = rows.filter((r) => String(r.status || '').toUpperCase() === 'DISMISSED').length;
  const total = Math.max(1, pending + reviewed + dismissed);
  const segments = [
    { key: 'PENDING', count: pending, color: STATUS_COLORS.PENDING },
    { key: 'REVIEWED', count: reviewed, color: STATUS_COLORS.REVIEWED },
    { key: 'DISMISSED', count: dismissed, color: STATUS_COLORS.DISMISSED },
  ];
  const barWidth = 380;
  const barX = 20;
  let offset = barX;

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Status Breakdown</h3>
      <svg viewBox="0 0 420 32" className="w-full h-auto mb-2" role="img" aria-label="Report status breakdown">
        {segments.map((seg) => {
          const width = (seg.count / total) * barWidth;
          const rect = (
            <rect
              key={seg.key}
              x={offset}
              y="4"
              width={width}
              height="24"
              fill={seg.color}
            />
          );
          offset += width;
          return rect;
        })}
      </svg>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        PENDING: {pending} | REVIEWED: {reviewed} | DISMISSED: {dismissed}
      </p>
    </div>
  );
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

  const chartRows = useMemo(() => data || [], [data]);

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

  const showCharts = !loading && !error && chartRows.length > 0;

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
                className="border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
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

      {showCharts ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <ReportsTypeBarChart rows={chartRows} />
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <ReportsStatusStackedBar rows={chartRows} />
          </div>
        </div>
      ) : null}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <AdminDataState
          loading={loading}
          error={error}
          isEmpty={!loading && !error && filtered.length === 0}
          emptyText="No reports found."
        />
        {!loading && !error && filtered.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
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
                  <tr key={item.id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${typeBadgeClass}`}>
                        {targetType || 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100 font-medium max-w-xs truncate">
                      {item.target_label || item.target_id || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">{item.reason || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadgeClass}`}>
                        {status || 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {status === 'PENDING' ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleStatusUpdate(item.id, 'REVIEWED')}
                            className="rounded-lg border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 disabled:opacity-60"
                          >
                            Mark Reviewed
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleStatusUpdate(item.id, 'DISMISSED')}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
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
