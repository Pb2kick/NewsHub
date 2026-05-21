/*
 * Changes:
 * - Added election image uploader and image_url handling for create/update.
 * - Validates the required image outside React Hook Form on create.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import AdminDataState from '../components/AdminDataState';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminStatusBadge from '../components/AdminStatusBadge';
import ImageUploader from '../components/ImageUploader';
import { useAdminResource } from '../hooks/useAdminResource';
import {
  createElection,
  deleteElection,
  listElections,
  updateElection,
  uploadElectionImage,
} from '../services/adminApi';

const electionSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  region: z.string().min(2, 'Region is required'),
  start_time: z.string().min(1, 'Start date is required'),
  end_time: z.string().min(1, 'End date is required'),
  status: z.enum(['Active', 'Upcoming', 'Completed']),
});

const defaultValues = {
  name: '',
  region: '',
  start_time: '',
  end_time: '',
  status: 'Upcoming',
};

function normalizeStatus(value) {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'ACTIVE') return 'Active';
  if (normalized === 'COMPLETED' || normalized === 'ENDED') return 'Completed';
  if (normalized === 'UPCOMING') return 'Upcoming';
  return 'Upcoming';
}

function toDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

/**
 * Renders elections management table.
 * @returns {JSX.Element}
 */
export default function AdminElections() {
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageError, setImageError] = useState('');
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm({
    resolver: zodResolver(electionSchema),
    defaultValues,
  });
  const loadElections = useCallback(() => listElections(), []);
  const { data, loading, error, reload } = useAdminResource(loadElections, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return data || [];
    }
    return (data || []).filter((item) => `${item.name} ${item.region}`.toLowerCase().includes(term));
  }, [data, search]);

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
    setImageUrl(item.image_url || '');
    setImageError('');
    form.reset({
      name: item.name || '',
      region: item.region || '',
      start_time: toDateInput(item.start_time),
      end_time: toDateInput(item.end_time),
      status: normalizeStatus(item.status),
    });
    setIsFormOpen(true);
  };

  const onSubmit = async (values) => {
    if (!imageUrl && !editingId) {
      setImageError('Election image is required.');
      return;
    }
    setIsSaving(true);
    setFormError('');
    try {
      if (editingId) {
        await updateElection(editingId, { ...values, image_url: imageUrl || '' });
        setMessage('Election updated.');
      } else {
        await createElection({ ...values, image_url: imageUrl || '' });
        setMessage('Election added.');
      }
      await reload();
      setIsFormOpen(false);
      setEditingId(null);
    } catch (submitError) {
      setFormError(submitError?.message || 'Unable to save election.');
    } finally {
      setIsSaving(false);
    }
  };

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
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search elections" className="border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm" />
            <button type="button" onClick={handleOpenCreate} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Add Election
            </button>
          </div>
        )}
      />
      {message ? <p className="text-sm text-green-700 mb-3">{message}</p> : null}
      {isFormOpen && (
        <form onSubmit={form.handleSubmit(onSubmit)} className="mb-4 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Name</label>
              <input {...form.register('name')} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              {form.formState.errors.name && <p className="text-xs text-rose-600 mt-1">{form.formState.errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Region</label>
              <input {...form.register('region')} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              {form.formState.errors.region && <p className="text-xs text-rose-600 mt-1">{form.formState.errors.region.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date</label>
              <input type="date" {...form.register('start_time')} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              {form.formState.errors.start_time && <p className="text-xs text-rose-600 mt-1">{form.formState.errors.start_time.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">End Date</label>
              <input type="date" {...form.register('end_time')} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              {form.formState.errors.end_time && <p className="text-xs text-rose-600 mt-1">{form.formState.errors.end_time.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
              <select {...form.register('status')} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="Active">Active</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Completed">Completed</option>
              </select>
              {form.formState.errors.status && <p className="text-xs text-rose-600 mt-1">{form.formState.errors.status.message}</p>}
            </div>
            <div className="md:col-span-2">
              <ImageUploader
                label="Election Image *"
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
                    const url = await uploadElectionImage(file);
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
              {isSaving ? 'Saving...' : editingId ? 'Update Election' : 'Create Election'}
            </button>
          </div>
        </form>
      )}
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
