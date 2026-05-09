/*
 * Changes:
 * - Added a recent pending verification table to surface moderation needs.
 */
import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ShieldCheck, Users, Vote } from 'lucide-react';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminDataState from '../components/AdminDataState';
import { useAdminResource } from '../hooks/useAdminResource';
import { getDashboardStats, getLastSevenDayVotes, listVerifications } from '../services/adminApi';

/**
 * Maps dashboard stat cards from loaded counters.
 * @param {{users: number, elections: number, articles: number, pendingVerifications: number}} stats
 * @returns {Array<{label: string, value: number, icon: any}>}
 */
function buildCards(stats) {
  return [
    { label: 'Total Users', value: stats.users, icon: Users },
    { label: 'Active Elections', value: stats.elections, icon: Vote },
    { label: 'News Articles', value: stats.articles, icon: FileText },
    { label: 'Pending Verifications', value: stats.pendingVerifications, icon: ShieldCheck },
  ];
}

/**
 * Renders the admin dashboard overview page.
 * @returns {JSX.Element}
 */
export default function AdminDashboard() {
  const loadDashboard = useCallback(async () => {
    const [stats, votes] = await Promise.all([getDashboardStats(), getLastSevenDayVotes()]);
    return { stats, votes };
  }, []);

  const loadPendingVerifications = useCallback(() => listVerifications({ status: 'PENDING' }), []);

  const { data, loading, error } = useAdminResource(loadDashboard, []);
  const { data: pendingData, loading: pendingLoading, error: pendingError } = useAdminResource(loadPendingVerifications, []);

  const cards = buildCards(data?.stats || { users: 0, elections: 0, articles: 0, pendingVerifications: 0 });

  return (
    <div>
      <AdminPageHeader title="Dashboard" subtitle="Operational overview for users, elections, and moderation." />
      <AdminDataState loading={loading} error={error} isEmpty={false} emptyText="" />
      {!loading && !error ? (
        <>
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {cards.map((card) => (
              <article key={card.label} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-500">{card.label}</p>
                  <card.icon className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-slate-900">{card.value.toLocaleString()}</p>
              </article>
            ))}
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-base font-semibold text-slate-900 mb-3">Votes in the Last 7 Days</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {(data?.votes || []).map((item) => (
                <div key={item.label} className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                  <p className="text-xs text-slate-500">{item.label}</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-4 mt-6">
            <h2 className="text-base font-semibold text-slate-900 mb-3">Recent Verification Requests</h2>
            {pendingLoading ? (
              <div className="text-sm text-slate-500">Loading pending verifications...</div>
            ) : pendingError ? (
              <div className="text-sm text-rose-600">Unable to load pending verifications.</div>
            ) : (pendingData || []).length === 0 ? (
              <div className="text-sm text-slate-500">No pending verifications.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="text-left py-2">Full Name</th>
                    <th className="text-left py-2">Address</th>
                    <th className="text-left py-2">Submitted</th>
                    <th className="text-left py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(pendingData || []).slice(0, 5).map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="py-2 font-medium text-slate-900">{item.full_name || 'Unknown'}</td>
                      <td className="py-2 text-slate-600">{item.address || 'N/A'}</td>
                      <td className="py-2 text-slate-600">
                        {item.submitted_at ? new Date(item.submitted_at).toLocaleString() : 'N/A'}
                      </td>
                      <td className="py-2">
                        <Link
                          to={`/admin/verifications/${item.id}`}
                          className="text-blue-600 hover:text-blue-700 text-sm font-semibold"
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
