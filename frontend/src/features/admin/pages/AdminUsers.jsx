import React, { useCallback, useState } from 'react';
import { Eye, UserX, UserCheck } from 'lucide-react'; // CHANGED: added UserCheck for unban UI
import AdminDataState from '../components/AdminDataState';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminStatusBadge from '../components/AdminStatusBadge';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAdminResource } from '../hooks/useAdminResource';
import { banUser, listUsers, unbanUser } from '../services/adminApi'; // CHANGED: imported unbanUser
import AdminUserDetailModal from './AdminUserDetailModal'; // NEW

/**
 * Renders admin user management table.
 * @returns {JSX.Element}
 */
export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [pendingBan, setPendingBan] = useState(null);
  const [isBanning, setIsBanning] = useState(false);
  const [pendingUnban, setPendingUnban] = useState(null); // NEW: track user pending unban
  const [isUnbanning, setIsUnbanning] = useState(false); // NEW: pending unban action flag
  const [viewingUser, setViewingUser] = useState(null); // NEW
  const [banReason, setBanReason] = useState(''); // NEW: controlled reason for ban modal

  const loadUsers = useCallback(() => listUsers({ search }), [search]);
  const { data, loading, error, reload } = useAdminResource(loadUsers, [search]);
  const users = data || [];

  const handleConfirmBan = async (reason = '') => { // CHANGED: accepts reason from modal
    if (!pendingBan) {
      return;
    }

    setIsBanning(true);
    const result = await banUser(pendingBan.id, reason); // CHANGED: forwards reason
    if (result?.success) {
      setMessage('User banned.');
      setBanReason(''); // NEW: reset reason after success
      await reload();
    } else {
      setMessage(result?.message || 'Unable to ban user.');
    }
    setPendingBan(null);
    setIsBanning(false);
  };

  const handleConfirmUnban = async () => {
    if (!pendingUnban) return;
    setIsUnbanning(true);
    const result = await unbanUser(pendingUnban.id);
    if (result?.success) {
      setMessage('User unbanned successfully.');
      await reload();
    } else {
      setMessage(result?.message || 'Unable to unban user.');
    }
    setPendingUnban(null);
    setIsUnbanning(false);
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
            className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300"
          />
        )}
      />
      {message ? <p className="text-sm text-green-700 mb-3">{message}</p> : null}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <AdminDataState
          loading={loading}
          error={error}
          isEmpty={!loading && !error && users.length === 0}
          emptyText="No users found."
        />
        {!loading && !error && users.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
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
                  <tr key={user.id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{user.full_name || '-'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{user.email || '-'}</td>
                    <td className="px-4 py-3"><AdminStatusBadge value={user.role} /></td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatDate(user.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                            {
                              <button
                                type="button"
                                onClick={() => setViewingUser(user)}
                                className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 mr-3"
                              >
                                <Eye className="w-4 h-4" />
                                View
                              </button>
                            }
                            {canBan ? (
                              <button
                                type="button"
                                onClick={() => setPendingBan(user)}
                                className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                              >
                                <UserX className="w-4 h-4" />
                                Ban
                              </button>
                            ) : null}
                            {String(user.role || '').toUpperCase() === 'BANNED' ? (
                              <button
                                type="button"
                                onClick={() => setPendingUnban(user)}
                                className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 ml-3"
                              >
                                <UserCheck className="w-4 h-4" />
                                Unban
                              </button>
                            ) : null}
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
        onCancel={() => { setPendingBan(null); setBanReason(''); }} // CHANGED: reset reason on cancel
        isConfirming={isBanning}
        showReasonInput={true}       // NEW: show reason textarea for bans
        reason={banReason}           // NEW
        onReasonChange={setBanReason} // NEW
      />
      <ConfirmationModal
        isOpen={pendingUnban !== null}
        title="Unban User"
        message={pendingUnban ? `Are you sure you want to unban ${pendingUnban.full_name || 'this user'} (${pendingUnban.email || 'no email'})? This will restore their access.` : ''}
        confirmLabel="Yes, Unban User"
        confirmClassName="bg-green-600 text-white hover:bg-green-700"
        onConfirm={handleConfirmUnban}
        onCancel={() => setPendingUnban(null)}
        isConfirming={isUnbanning}
      />
      {viewingUser ? (
        // NEW
        <AdminUserDetailModal
          user={viewingUser}
          onClose={() => setViewingUser(null)}
        />
      ) : null}
    </div>
  );
}
