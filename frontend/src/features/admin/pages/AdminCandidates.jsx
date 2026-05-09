/*
 * Changes:
 * - Added inline add/edit candidate form with election selector and validation.
 * - Added edit actions while keeping search/delete behavior intact.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import AdminDataState from '../components/AdminDataState';
import AdminPageHeader from '../components/AdminPageHeader';
import { useAdminResource } from '../hooks/useAdminResource';
import {
  createCandidate,
  deleteCandidate,
  listCandidates,
  listElections,
  updateCandidate,
} from '../services/adminApi';

const candidateSchema = z.object({
  election_id: z.coerce.number().min(1, 'Select an election'),
  name: z.string().min(2, 'Name is required'),
  party: z.string().min(2, 'Party is required'),
  position: z.string().min(2, 'Position is required'),
  bio: z.string().min(10, 'Bio is required'),
  education: z.string().min(2, 'Education is required'),
  experience: z.string().optional().or(z.literal('')),
  photo_url: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  display_order: z.coerce.number().min(0, 'Display order must be 0 or higher'),
});

const defaultValues = {
  election_id: '',
  name: '',
  party: '',
  position: '',
  bio: '',
  education: '',
  experience: '',
  photo_url: '',
  display_order: 0,
};

/**
 * Renders candidates management table.
 * @returns {JSX.Element}
 */
export default function AdminCandidates() {
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [elections, setElections] = useState([]);
  const [electionsError, setElectionsError] = useState('');
  const form = useForm({
    resolver: zodResolver(candidateSchema),
    defaultValues,
  });
  const loadCandidates = useCallback(() => listCandidates(), []);
  const { data, loading, error, reload } = useAdminResource(loadCandidates, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return data || [];
    }
    return (data || []).filter((item) => `${item.name} ${item.party} ${item.position}`.toLowerCase().includes(term));
  }, [data, search]);

  useEffect(() => {
    let active = true;
    listElections()
      .then((rows) => {
        if (!active) return;
        setElections(rows || []);
        setElectionsError('');
      })
      .catch(() => {
        if (!active) return;
        setElections([]);
        setElectionsError('Unable to load elections for the dropdown.');
      });
    return () => {
      active = false;
    };
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormError('');
    form.reset(defaultValues);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingId(item.id);
    setFormError('');
    form.reset({
      election_id: item.election_id || '',
      name: item.name || '',
      party: item.party || '',
      position: item.position || '',
      bio: item.bio || '',
      education: item.education || '',
      experience: item.experience || '',
      photo_url: item.photo_url || '',
      display_order: item.display_order ?? 0,
    });
    setIsFormOpen(true);
  };

  const onSubmit = async (values) => {
    setIsSaving(true);
    setFormError('');
    try {
      const payload = {
        election_id: values.election_id,
        name: values.name,
        party: values.party,
        position: values.position,
        bio: values.bio,
        education: values.education,
        experience: values.experience || '',
        photo_url: values.photo_url || '',
        display_order: values.display_order ?? 0,
      };
      if (editingId) {
        await updateCandidate(editingId, payload);
        setMessage('Candidate updated.');
      } else {
        await createCandidate(payload);
        setMessage('Candidate added.');
      }
      await reload();
      setIsFormOpen(false);
      setEditingId(null);
    } catch (submitError) {
      setFormError(submitError?.message || 'Unable to save candidate.');
    } finally {
      setIsSaving(false);
    }
  };

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
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search candidates" className="border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm" />
            <button type="button" onClick={handleOpenCreate} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Add Candidate
            </button>
          </div>
        )}
      />
      {message ? <p className="text-sm text-green-700 mb-3">{message}</p> : null}
      {electionsError ? <p className="text-sm text-rose-600 mb-3">{electionsError}</p> : null}
      {isFormOpen && (
        <form onSubmit={form.handleSubmit(onSubmit)} className="mb-4 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Election</label>
              <select {...form.register('election_id')} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">Select election</option>
                {elections.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              {form.formState.errors.election_id && <p className="text-xs text-rose-600 mt-1">{form.formState.errors.election_id.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Name</label>
              <input {...form.register('name')} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              {form.formState.errors.name && <p className="text-xs text-rose-600 mt-1">{form.formState.errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Party</label>
              <input {...form.register('party')} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              {form.formState.errors.party && <p className="text-xs text-rose-600 mt-1">{form.formState.errors.party.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Position</label>
              <input {...form.register('position')} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              {form.formState.errors.position && <p className="text-xs text-rose-600 mt-1">{form.formState.errors.position.message}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Bio</label>
              <textarea rows={3} {...form.register('bio')} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              {form.formState.errors.bio && <p className="text-xs text-rose-600 mt-1">{form.formState.errors.bio.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Education</label>
              <input {...form.register('education')} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              {form.formState.errors.education && <p className="text-xs text-rose-600 mt-1">{form.formState.errors.education.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Experience (optional)</label>
              <input {...form.register('experience')} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Photo URL (optional)</label>
              <input {...form.register('photo_url')} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              {form.formState.errors.photo_url && <p className="text-xs text-rose-600 mt-1">{form.formState.errors.photo_url.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Display Order</label>
              <input type="number" {...form.register('display_order')} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              {form.formState.errors.display_order && <p className="text-xs text-rose-600 mt-1">{form.formState.errors.display_order.message}</p>}
            </div>
          </div>
          {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : editingId ? 'Update Candidate' : 'Create Candidate'}
            </button>
          </div>
        </form>
      )}
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
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-800 mr-3"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit
                    </button>
                    <button type="button" onClick={() => handleDelete(item.id)} className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"><Trash2 className="w-4 h-4" />Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
