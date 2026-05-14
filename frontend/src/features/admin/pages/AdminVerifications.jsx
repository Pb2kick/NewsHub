import React, { useCallback, useEffect, useRef, useState } from 'react'; // NEW
import { Link } from 'react-router-dom';
import AdminDataState from '../components/AdminDataState';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminStatusBadge from '../components/AdminStatusBadge';
import { useAdminResource } from '../hooks/useAdminResource';
import { listVerifications } from '../services/adminApi';
import { supabase } from '../../shared/services/supabaseClient'; // NEW

// SETUP NOTE: Enable Realtime on public.verifications (Database -> Replication) // NEW
// and confirm RLS allows authenticated users to SELECT their own row. // NEW

/**
 * Renders verification queue with status filtering.
 * @returns {JSX.Element}
 */
export default function AdminVerifications() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const loadVerifications = useCallback(() => listVerifications({ search, status }), [search, status]);
  const { data, loading, error, reload } = useAdminResource(loadVerifications, [search, status]); // NEW
  const reloadRef = useRef(reload); // NEW

  useEffect(() => { // NEW
    reloadRef.current = reload; // NEW
  }); // NEW

  useEffect(() => { // NEW
    const channel = supabase // NEW
      .channel('admin-verifications-feed') // NEW
      .on( // NEW
        'postgres_changes', // NEW
        { event: '*', schema: 'public', table: 'verifications' }, // NEW
        () => { // NEW
          reloadRef.current(); // NEW
        } // NEW
      ) // NEW
      .subscribe(); // NEW

    return () => { // NEW
      supabase.removeChannel(channel); // NEW
    }; // NEW
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // NEW

  return (
    <div>
      <AdminPageHeader
        title="Verification Requests"
        subtitle="Inspect voter and candidate identity submissions."
        actions={(
          <div className="flex flex-col sm:flex-row gap-2">
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="ALL">All</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white" />
          </div>
        )}
      />

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <AdminDataState loading={loading} error={error} isEmpty={!loading && !error && (data || []).length === 0} emptyText="No verification requests found." />
        {!loading && !error && (data || []).length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr><th className="px-4 py-3 text-left">Full Name</th><th className="px-4 py-3 text-left">Address</th><th className="px-4 py-3 text-left">Submitted</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-right">Details</th></tr>
            </thead>
            <tbody>
              {(data || []).map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{item.full_name}</td>
                  <td className="px-4 py-3 text-slate-600">{item.address}</td>
                  <td className="px-4 py-3 text-slate-600">{item.submitted_at ? new Date(item.submitted_at).toLocaleString() : 'N/A'}</td>
                  <td className="px-4 py-3"><AdminStatusBadge value={item.status} /></td>
                  <td className="px-4 py-3 text-right"><Link to={`/admin/verifications/${item.id}`} className="text-blue-600 hover:text-blue-700">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
