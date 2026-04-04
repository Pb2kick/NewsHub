import React, { useCallback } from 'react';
import { FileText, ShieldCheck, Users, Vote } from 'lucide-react';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminDataState from '../components/AdminDataState';
import { useAdminResource } from '../hooks/useAdminResource';
import { getDashboardStats, getLastSevenDayVotes } from '../services/adminApi';

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

  const { data, loading, error } = useAdminResource(loadDashboard, []);

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
        </>
      ) : null}
    </div>
  );
}
