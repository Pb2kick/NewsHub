/*
 * Changes:
 * - Added candidate image uploader and photo_url handling via Supabase uploads.
 * - Validates the required image outside React Hook Form on create.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import AdminDataState from '../components/AdminDataState';
import AdminPageHeader from '../components/AdminPageHeader';
import ImageUploader from '../components/ImageUploader';
import { useAdminResource } from '../hooks/useAdminResource';
import {
  createCandidate,
  deleteCandidate,
  listCandidates,
  listElections,
  updateCandidate,
  uploadCandidateImage,
} from '../services/adminApi';

const candidateSchema = z.object({
  election_id: z.coerce.number().min(1, 'Select an election'),
  name: z.string().min(2, 'Name is required'),
  party: z.string().min(2, 'Party is required'),
  position: z.string().min(2, 'Position is required'),
  bio: z.string().min(10, 'Bio is required'),
  education: z.string().min(2, 'Education is required'),
  experience: z.string().optional().or(z.literal('')),
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
  display_order: 0,
};

function getInitials(name) {
  if (!name) return 'NU';
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() || '')
      .join('') || 'NU'
  );
}

/**
 * Renders candidates management table.
 * @returns {JSX.Element}
 */
export default function AdminCandidates() {
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageError, setImageError] = useState('');
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);
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
    setImageUrl('');
    setImageError('');
    form.reset(defaultValues);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingId(item.id);
    setFormError('');
    setImageUrl(item.photo_url || '');
    setImageError('');
    form.reset({
      election_id: item.election_id || '',
      name: item.name || '',
      party: item.party || '',
      position: item.position || '',
      bio: item.bio || '',
      education: item.education || '',
      experience: item.experience || '',
      display_order: item.display_order ?? 0,
    });
    setIsFormOpen(true);
  };

  const onSubmit = async (values) => {
    if (!imageUrl && !editingId) {
      setImageError('Candidate photo is required.');
      return;
    }
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
        photo_url: imageUrl || '',
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
  const handleDelete = async () => {
    if (!pendingDelete) return;
    setIsConfirming(true);
    setFormError('');
    try {
      await deleteCandidate(pendingDelete.id);
      setMessage('Candidate removed.');
      await reload();
    } catch (deleteError) {
      setFormError(deleteError?.message || 'Unable to delete candidate.');
    } finally {
      setIsConfirming(false);
      setPendingDelete(null);
    }
  };

  const handleCancelDelete = () => {
    if (isConfirming) return;
    setPendingDelete(null);
  };

  return (
    <div>
      <AdminPageHeader
        title="Candidates"
        subtitle="Review and moderate candidate entries."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleOpenCreate} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Add Candidate
            </button>
          </div>
        )}
      />
      {message ? <p className="text-sm text-green-700 mb-3">{message}</p> : null}
      {electionsError ? <p className="text-sm text-rose-600 mb-3">{electionsError}</p> : null}
      <div className="relative mb-4">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search candidates"
          className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-700 dark:text-slate-300"
        />
      </div>
      {isFormOpen && (
        <form onSubmit={form.handleSubmit(onSubmit)} className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Election</label>
              <select {...form.register('election_id')} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-3 py-2 text-sm">
                <option value="">Select election</option>
                {elections.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              {form.formState.errors.election_id && <p className="text-xs text-rose-600 mt-1">{form.formState.errors.election_id.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Name</label>
              <input {...form.register('name')} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-3 py-2 text-sm" />
              {form.formState.errors.name && <p className="text-xs text-rose-600 mt-1">{form.formState.errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Party</label>
              <input {...form.register('party')} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-3 py-2 text-sm" />
              {form.formState.errors.party && <p className="text-xs text-rose-600 mt-1">{form.formState.errors.party.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Position</label>
              <input {...form.register('position')} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-3 py-2 text-sm" />
              {form.formState.errors.position && <p className="text-xs text-rose-600 mt-1">{form.formState.errors.position.message}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Bio</label>
              <textarea rows={3} {...form.register('bio')} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-3 py-2 text-sm" />
              {form.formState.errors.bio && <p className="text-xs text-rose-600 mt-1">{form.formState.errors.bio.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Education</label>
              <input {...form.register('education')} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-3 py-2 text-sm" />
              {form.formState.errors.education && <p className="text-xs text-rose-600 mt-1">{form.formState.errors.education.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Experience (optional)</label>
              <input {...form.register('experience')} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-3 py-2 text-sm" />
            </div>
            <div className="md:col-span-2">
              <ImageUploader
                label="Candidate Photo *"
                value={imageUrl}
                onChange={(value) => {
                  setImageUrl(value);
                  if (!value) {
                    setImageError('');
                  }
                }}
                error={imageError}
                isUploading={isImageUploading}
                onUpload={async (file) => {
                  setIsImageUploading(true);
                  try {
                    const url = await uploadCandidateImage(file);
                    setImageUrl(url);
                    setImageError('');
                  } catch (uploadError) {
                    setImageError(uploadError?.message || 'Unable to upload image.');
                  } finally {
                    setIsImageUploading(false);
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Display Order</label>
              <input type="number" {...form.register('display_order')} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-3 py-2 text-sm" />
              {form.formState.errors.display_order && <p className="text-xs text-rose-600 mt-1">{form.formState.errors.display_order.message}</p>}
            </div>
          </div>
          {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <AdminDataState loading={loading} error={error} isEmpty={!loading && !error && filtered.length === 0} emptyText="No candidates found." />
        {!loading && !error && filtered.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Party</th>
                <th className="px-4 py-3 text-left">Election</th>
                <th className="px-4 py-3 text-left">Position</th>
                <th className="px-4 py-3 text-left">Votes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold grid place-items-center overflow-hidden">
                        {item.photo_url
                          ? <img src={item.photo_url} alt={item.name || 'Candidate'} className="w-full h-full object-cover" />
                          : getInitials(item.name)}
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{item.party || 'N/A'}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{item.election_id ? `e${item.election_id}` : 'N/A'}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{item.position || 'N/A'}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {/* Votes column placeholder — add a vote_count view or column when available. */}
                    —
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        aria-label="Edit candidate"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(item)}
                        className="inline-flex items-center justify-center rounded-md border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"
                        aria-label="Delete candidate"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      {pendingDelete ? (
        <ConfirmationModal
          isOpen={pendingDelete !== null}
          title="Delete Candidate"
          message={`Are you sure you want to permanently delete ${pendingDelete.name || 'this candidate'}? This cannot be undone.`}
          confirmLabel="Yes, Delete"
          confirmClassName="bg-red-600 hover:bg-red-700 disabled:hover:bg-red-600"
          onConfirm={handleDelete}
          onCancel={handleCancelDelete}
          isConfirming={isConfirming}
        />
      ) : null}
    </div>
  );
}
