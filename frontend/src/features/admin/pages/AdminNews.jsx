import React, { useCallback, useMemo, useState } from 'react';
import { ExternalLink, Trash2 } from 'lucide-react';
import AdminDataState from '../components/AdminDataState';
import AdminPageHeader from '../components/AdminPageHeader';
import { useAdminResource } from '../hooks/useAdminResource';
import { deleteNews, listNews } from '../services/adminApi';

/**
 * Renders news moderation table.
 * @returns {JSX.Element}
 */
export default function AdminNews() {
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const loadNews = useCallback(() => listNews(), []);
  const { data, loading, error, reload } = useAdminResource(loadNews, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return data || [];
    }
    return (data || []).filter((item) => `${item.title} ${item.source || ''}`.toLowerCase().includes(term));
  }, [data, search]);

  /** Handles article delete action with confirmation. */
  const handleDelete = async (newsId) => {
    const confirmed = window.confirm('Delete this news item?');
    if (!confirmed) {
      return;
    }
    await deleteNews(newsId);
    setMessage('News item removed.');
    await reload();
  };

  return (
    <div>
      <AdminPageHeader
        title="News Moderation"
        subtitle="Monitor and remove problematic stories."
        actions={<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search news" className="border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm" />}
      />
      {message ? <p className="text-sm text-green-700 mb-3">{message}</p> : null}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <AdminDataState loading={loading} error={error} isEmpty={!loading && !error && filtered.length === 0} emptyText="No news records found." />
        {!loading && !error && filtered.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Source</th>
                <th className="px-4 py-3 text-left">Published</th>
                <th className="px-4 py-3 text-left">Region</th>
                <th className="px-4 py-3 text-left">Original</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{item.title}</td>
                  <td className="px-4 py-3 text-slate-600">{item.source || 'N/A'}</td>
                  <td className="px-4 py-3 text-slate-600">{item.published_at ? new Date(item.published_at).toLocaleString() : 'N/A'}</td>
                  <td className="px-4 py-3 text-slate-600">{[item.region, item.country].filter(Boolean).join(', ') || 'N/A'}</td>
                  <td className="px-4 py-3">
                    {item.source_url ? (
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs font-medium"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View
                      </a>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </td>
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
