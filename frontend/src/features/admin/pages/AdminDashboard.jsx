import React, { useCallback, useMemo } from 'react';
import { FileText, ShieldCheck, Users, Vote } from 'lucide-react';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminDataState from '../components/AdminDataState';
import { useAdminResource } from '../hooks/useAdminResource';
import { getDashboardStats, getLastSevenDayVotes } from '../services/adminApi';

const CHART_WIDTH = 560;
const CHART_HEIGHT = 200;
const CHART_PADDING = { top: 20, right: 20, bottom: 32, left: 40 };

function roundMax(value) {
  if (value <= 5) return 5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  return Math.ceil(value / magnitude) * magnitude;
}

function buildLinePath(points, width, height) {
  if (!points.length) return '';
  const clamped = points.map((point) => ({
    x: Math.min(width, Math.max(0, point.x)),
    y: Math.min(height, Math.max(0, point.y)),
  }));
  return clamped
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
}

function buildAreaPath(points, bottomY) {
  if (!points.length) return '';
  const first = points[0];
  const last = points[points.length - 1];
  const line = points.map((point) => `L ${point.x} ${point.y}`).join(' ');
  return `M ${first.x} ${bottomY} ${line} L ${last.x} ${bottomY} Z`;
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
  const stats = data?.stats || { users: 0, elections: 0, articles: 0, pendingVerifications: 0 };
  const votes = data?.votes || [];

  const cards = [
    {
      label: 'Total Users',
      value: stats.users,
      icon: Users,
      iconBg: 'bg-blue-600',
    },
    {
      label: 'Active Elections',
      value: stats.elections,
      icon: Vote,
      iconBg: 'bg-purple-600',
    },
    {
      label: 'News Articles',
      value: stats.articles,
      icon: FileText,
      iconBg: 'bg-emerald-600',
    },
    {
      label: 'Pending Verifications',
      value: stats.pendingVerifications,
      icon: ShieldCheck,
      iconBg: 'bg-amber-500',
    },
  ];

  const chartData = useMemo(() => {
    const maxValue = Math.max(1, ...votes.map((item) => Number(item.value || 0)));
    const yMax = roundMax(maxValue);
    const yMid = Math.round(yMax / 2);
    const innerWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
    const innerHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
    const step = votes.length > 1 ? innerWidth / (votes.length - 1) : 0;
    const bottomY = CHART_PADDING.top + innerHeight;
    const points = votes.map((item, index) => {
      const value = Number(item.value || 0);
      const x = CHART_PADDING.left + step * index;
      const y = CHART_PADDING.top + innerHeight - (value / yMax) * innerHeight;
      return { x, y, label: item.label, value };
    });
    return { yMax, yMid, bottomY, points, innerHeight };
  }, [votes]);

  const linePath = buildLinePath(chartData.points, CHART_WIDTH, CHART_HEIGHT);
  const areaPath = buildAreaPath(chartData.points, chartData.bottomY);

  return (
    <div>
      <AdminPageHeader title="Dashboard" subtitle="Operational overview for users, elections, and moderation." />
      <AdminDataState loading={loading} error={error} isEmpty={false} emptyText="" />
      {!loading && !error ? (
        <>
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {cards.map((card) => (
              <article key={card.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500 dark:text-slate-400">{card.label}</p>
                  <div className={`w-10 h-10 rounded-lg ${card.iconBg} grid place-items-center`}>
                    <card.icon className="w-5 h-5 text-white" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">{card.value.toLocaleString()}</p>
              </article>
            ))}
          </section>
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">Weekly Vote Activity</h2>
              <div className="overflow-x-auto">
                <svg width={CHART_WIDTH} height={CHART_HEIGHT} viewBox="0 0 560 200" role="img">
                  <rect x="0" y="0" width="560" height="200" fill="white" />
                  {[chartData.yMax, chartData.yMid, 0].map((value) => {
                    const y = chartData.bottomY - (value / chartData.yMax) * chartData.innerHeight;
                    return (
                      <g key={value}>
                        <line
                          x1={CHART_PADDING.left}
                          x2={CHART_WIDTH - CHART_PADDING.right}
                          y1={y}
                          y2={y}
                          stroke="#E2E8F0"
                          strokeDasharray="4 4"
                        />
                        <text x={CHART_PADDING.left - 8} y={y + 4} textAnchor="end" className="text-xs fill-slate-400">
                          {value}
                        </text>
                      </g>
                    );
                  })}
                  <path d={areaPath} fill="#BFDBFE" />
                  <path d={linePath} fill="none" stroke="#2563EB" strokeWidth="2" />
                  {chartData.points.map((point) => (
                    <circle key={point.label} cx={point.x} cy={point.y} r="3" fill="#2563EB" />
                  ))}
                  {chartData.points.map((point) => (
                    <text
                      key={`${point.label}-x`}
                      x={point.x}
                      y={CHART_HEIGHT - 8}
                      textAnchor="middle"
                      className="text-xs fill-slate-500"
                    >
                      {point.label}
                    </text>
                  ))}
                </svg>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">New User Registrations</h2>
              <div className="overflow-x-auto">
                {/* Uses vote data as proxy — replace with registration data when API endpoint is available. */}
                <svg width={CHART_WIDTH} height={CHART_HEIGHT} viewBox="0 0 560 200" role="img">
                  <rect x="0" y="0" width="560" height="200" fill="white" />
                  {[chartData.yMax, chartData.yMid, 0].map((value) => {
                    const y = chartData.bottomY - (value / chartData.yMax) * chartData.innerHeight;
                    return (
                      <g key={value}>
                        <line
                          x1={CHART_PADDING.left}
                          x2={CHART_WIDTH - CHART_PADDING.right}
                          y1={y}
                          y2={y}
                          stroke="#E2E8F0"
                          strokeDasharray="4 4"
                        />
                        <text x={CHART_PADDING.left - 8} y={y + 4} textAnchor="end" className="text-xs fill-slate-400">
                          {value}
                        </text>
                      </g>
                    );
                  })}

                  {chartData.points.map((point, index) => {
                    const barGap = 10;
                    const barWidth = chartData.points.length
                      ? (CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right - barGap * (chartData.points.length - 1)) / chartData.points.length
                      : 0;
                    const barHeight = chartData.innerHeight - (point.y - CHART_PADDING.top);
                    const x = CHART_PADDING.left + index * (barWidth + barGap);
                    const y = CHART_PADDING.top + chartData.innerHeight - barHeight;
                    return (
                      <rect key={point.label} x={x} y={y} width={barWidth} height={barHeight} fill="#7C3AED" rx="4" />
                    );
                  })}

                  {chartData.points.map((point) => (
                    <text
                      key={`${point.label}-bar`}
                      x={point.x}
                      y={CHART_HEIGHT - 8}
                      textAnchor="middle"
                      className="text-xs fill-slate-500"
                    >
                      {point.label}
                    </text>
                  ))}
                </svg>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
