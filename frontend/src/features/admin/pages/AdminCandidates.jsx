import React, { useCallback, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import AdminDataState from '../components/AdminDataState';
import AdminPageHeader from '../components/AdminPageHeader';
import { useAdminResource } from '../hooks/useAdminResource';
import { deleteCandidate, listCandidates } from '../services/adminApi';

/**
 * Renders candidates management table.
 * @returns {JSX.Element}
 */
export default function AdminCandidates() {
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const loadCandidates = useCallback(() => listCandidates(), []);
  const { data, loading, error, reload } = useAdminResource(loadCandidates, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return data || [];
    }
    return (data || []).filter((item) => `${item.name} ${item.party} ${item.position}`.toLowerCase().includes(term));
  }, [data, search]);

  /** Handles candidate delete action with confirmation. */
  const handleDelete = async (candidateId) => {
    const confirmed = window.confirm('Delete this candidate?');
    if (!confirmed) {
      return;
    }
    await deleteCandidate(candidateId);
    setMessage('Candidate removed.');
    await reload();
  };

  return (
    <div>
      <AdminPageHeader
        title="Candidates"
        subtitle="Review and moderate candidate entries."
        actions={<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search candidates" className="border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm" />}
      />
      {message ? <p className="text-sm text-green-700 mb-3">{message}</p> : null}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <AdminDataState loading={loading} error={error} isEmpty={!loading && !error && filtered.length === 0} emptyText="No candidates found." />
        {!loading && !error && filtered.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Party</th><th className="px-4 py-3 text-left">Position</th><th className="px-4 py-3 text-left">Election ID</th><th className="px-4 py-3 text-right">Action</th></tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                  <td className="px-4 py-3 text-slate-600">{item.party || 'N/A'}</td>
                  <td className="px-4 py-3 text-slate-600">{item.position || 'N/A'}</td>
                  <td className="px-4 py-3 text-slate-600">{item.election_id}</td>
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
