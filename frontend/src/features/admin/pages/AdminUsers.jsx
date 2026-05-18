import React, { useCallback, useState } from 'react';
import { UserX } from 'lucide-react';
import AdminDataState from '../components/AdminDataState';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminStatusBadge from '../components/AdminStatusBadge';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAdminResource } from '../hooks/useAdminResource';
import { banUser, listUsers } from '../services/adminApi';

/**
 * Renders admin user management table.
 * @returns {JSX.Element}
 */
export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [pendingBan, setPendingBan] = useState(null);
  const [isBanning, setIsBanning] = useState(false);

  const loadUsers = useCallback(() => listUsers({ search }), [search]);
  const { data, loading, error, reload } = useAdminResource(loadUsers, [search]);
  const users = data || [];

  const handleConfirmBan = async () => {
    if (!pendingBan) {
      return;
    }

    setIsBanning(true);
    const result = await banUser(pendingBan.id);
    if (result?.success) {
      setMessage('User banned.');
      await reload();
    } else {
      setMessage(result?.message || 'Unable to ban user.');
    }
    setPendingBan(null);
    setIsBanning(false);
  };

  const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
  };

  return (
    <div>
      <AdminPageHeader
        title="Users"
        actions={(
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search users"
            className="border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm"
          />
        )}
      />
      {message ? <p className="text-sm text-green-700 mb-3">{message}</p> : null}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <AdminDataState
          loading={loading}
          error={error}
          isEmpty={!loading && !error && users.length === 0}
          emptyText="No users found."
        />
        {!loading && !error && users.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Full Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const role = String(user.role || '').toUpperCase();
                const canBan = role !== 'ADMIN' && role !== 'BANNED';
                return (
                  <tr key={user.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{user.full_name || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{user.email || '-'}</td>
                    <td className="px-4 py-3"><AdminStatusBadge value={user.role} /></td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(user.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {canBan ? (
                        <button
                          type="button"
                          onClick={() => setPendingBan(user)}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                        >
                          <UserX className="w-4 h-4" />
                          Ban
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </div>

      <ConfirmationModal
        isOpen={pendingBan !== null}
        title="Ban User"
        message={pendingBan ? `Are you sure you want to ban ${pendingBan.full_name || 'this user'} (${pendingBan.email || 'no email'})? They will lose access to the platform immediately.` : ''}
        confirmLabel="Yes, Ban User"
        confirmClassName="bg-red-600 text-white hover:bg-red-700"
        onConfirm={handleConfirmBan}
        onCancel={() => setPendingBan(null)}
        isConfirming={isBanning}
      />
    </div>
  );
}
