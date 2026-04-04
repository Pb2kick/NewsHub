import React, { useCallback, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import AdminDataState from '../components/AdminDataState';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminStatusBadge from '../components/AdminStatusBadge';
import { useAdminResource } from '../hooks/useAdminResource';
import { deleteElection, listElections } from '../services/adminApi';

/**
 * Renders elections management table.
 * @returns {JSX.Element}
 */
export default function AdminElections() {
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const loadElections = useCallback(() => listElections(), []);
  const { data, loading, error, reload } = useAdminResource(loadElections, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return data || [];
    }
    return (data || []).filter((item) => `${item.name} ${item.region}`.toLowerCase().includes(term));
  }, [data, search]);

  /** Handles election soft-delete action with confirmation. */
  const handleDelete = async (electionId) => {
    const confirmed = window.confirm('Delete this election?');
    if (!confirmed) {
      return;
    }
    await deleteElection(electionId);
    setMessage('Election deleted.');
    await reload();
  };

  return (
    <div>
      <AdminPageHeader
        title="Elections"
        subtitle="Manage configured elections and visibility state."
        actions={<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search elections" className="border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm" />}
      />
      {message ? <p className="text-sm text-green-700 mb-3">{message}</p> : null}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <AdminDataState loading={loading} error={error} isEmpty={!loading && !error && filtered.length === 0} emptyText="No elections found." />
        {!loading && !error && filtered.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Region</th><th className="px-4 py-3 text-left">Start</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-right">Action</th></tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                  <td className="px-4 py-3 text-slate-600">{item.region || 'N/A'}</td>
                  <td className="px-4 py-3 text-slate-600">{item.start_time ? new Date(item.start_time).toLocaleString() : 'N/A'}</td>
                  <td className="px-4 py-3"><AdminStatusBadge value={item.status} /></td>
                  <td className="px-4 py-3 text-right"><button type="button" onClick={() => handleDelete(item.id)} className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"><Trash2 className="w-4 h-4" />Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
