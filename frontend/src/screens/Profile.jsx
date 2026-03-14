import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Shield,
  User,
} from 'lucide-react';
import { supabase } from '../supabaseClient';

const PROFILE_PHOTO_BUCKET = 'profile-photos';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export default function Profile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const currentPreviewUrlRef = useRef('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [editableFirstName, setEditableFirstName] = useState('');
  const [editableLastName, setEditableLastName] = useState('');
  const [userData, setUserData] = useState({
    id: '',
    firstName: '',
    lastName: '',
    fullName: 'NewsHub User',
    email: '',
    role: 'voter',
    verified: true,
    createdAt: '',
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(passwordSchema),
  });

  useEffect(() => {
    const loadProfile = async () => {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;

      if (error || !user) {
        navigate('/login');
        return;
      }

      let tableProfilePhotoUrl = '';
      const { data: tableUser } = await supabase
        .from('users')
        .select('profile_photo_url, first_name, last_name, full_name')
        .eq('email', user.email)
        .maybeSingle();

      if (tableUser?.profile_photo_url) {
        tableProfilePhotoUrl = tableUser.profile_photo_url;
      }

      const metadataPhotoUrl = user.user_metadata?.profile_photo_url || '';
      const metadataFirstName = (user.user_metadata?.first_name || '').trim();
      const metadataLastName = (user.user_metadata?.last_name || '').trim();
      const metadataFullName = (user.user_metadata?.full_name || '').trim();
      const tableFirstName = (tableUser?.first_name || '').trim();
      const tableLastName = (tableUser?.last_name || '').trim();
      const tableFullName = (tableUser?.full_name || '').trim();
      const finalPhotoUrl = tableProfilePhotoUrl || metadataPhotoUrl;
      const finalFirstName = tableFirstName || metadataFirstName || '';
      const finalLastName = tableLastName || metadataLastName || '';
      const combinedName = `${finalFirstName} ${finalLastName}`.trim();
      const finalFullName = combinedName || tableFullName || metadataFullName || 'NewsHub User';

      setUserData({
        id: user.id,
        firstName: finalFirstName,
        lastName: finalLastName,
        fullName: finalFullName,
        email: user.email || '',
        role: user.user_metadata?.role || 'voter',
        verified: Boolean(user.email_confirmed_at),
        createdAt: user.created_at || '',
      });
      setEditableFirstName(finalFirstName);
      setEditableLastName(finalLastName);
      setProfilePhotoUrl(finalPhotoUrl);
      setIsLoading(false);
    };

    loadProfile();
  }, [navigate]);

  useEffect(() => {
    return () => {
      if (currentPreviewUrlRef.current) {
        URL.revokeObjectURL(currentPreviewUrlRef.current);
      }
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image must be smaller than 5MB.');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsUploadingPhoto(true);

    try {
      const extension = file.name.split('.').pop() || 'jpg';
      const filePath = `${userData.id}/${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(PROFILE_PHOTO_BUCKET)
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        const normalizedUploadMessage = (uploadError.message || '').toLowerCase();
        throw new Error(
          uploadError.message.includes('Bucket not found')
            ? 'Storage bucket not found. Create a public bucket named "profile-photos" in Supabase Storage first.'
            : normalizedUploadMessage.includes('row-level security')
              ? 'Storage upload blocked by RLS policy. Add INSERT/UPDATE policies on storage.objects for bucket "profile-photos" and allow path prefix <auth.uid()>/... .'
            : uploadError.message
        );
      }

      const { data: publicUrlData } = supabase.storage
        .from(PROFILE_PHOTO_BUCKET)
        .getPublicUrl(filePath);

      const uploadedPhotoUrl = publicUrlData?.publicUrl || '';

      if (!uploadedPhotoUrl) {
        throw new Error('Could not create public URL for uploaded profile photo.');
      }

      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          profile_photo_url: uploadedPhotoUrl,
        },
      });

      if (metadataError) {
        throw new Error(metadataError.message || 'Failed to update auth profile metadata.');
      }

      const { error: dbUpdateError } = await supabase
        .from('users')
        .update({ profile_photo_url: uploadedPhotoUrl })
        .eq('email', userData.email);

      if (dbUpdateError) {
        throw new Error(
          `${dbUpdateError.message}. Ensure column public.users.profile_photo_url exists and RLS policy allows owner update.`
        );
      }

      if (currentPreviewUrlRef.current) {
        URL.revokeObjectURL(currentPreviewUrlRef.current);
        currentPreviewUrlRef.current = '';
      }

      setProfilePhotoUrl(uploadedPhotoUrl);
      setSuccessMessage('Profile photo updated successfully.');
    } catch (error) {
      setErrorMessage(error.message || 'Failed to upload profile photo.');
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const onNameSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const normalizedFirstName = editableFirstName.trim().replace(/\s+/g, ' ');
    const normalizedLastName = editableLastName.trim().replace(/\s+/g, ' ');
    const normalizedFullName = `${normalizedFirstName} ${normalizedLastName}`.trim();

    if (normalizedFirstName.length < 2) {
      setErrorMessage('First name must be at least 2 characters.');
      return;
    }

    if (normalizedLastName.length < 2) {
      setErrorMessage('Last name must be at least 2 characters.');
      return;
    }

    if (normalizedFullName.length > 100) {
      setErrorMessage('Name must be at most 100 characters.');
      return;
    }

    if (!/^[A-Za-z\s]+$/.test(normalizedFirstName)) {
      setErrorMessage('First name can only contain letters and spaces.');
      return;
    }

    if (!/^[A-Za-z\s]+$/.test(normalizedLastName)) {
      setErrorMessage('Last name can only contain letters and spaces.');
      return;
    }

    if (
      normalizedFirstName === userData.firstName &&
      normalizedLastName === userData.lastName
    ) {
      setSuccessMessage('No changes to save.');
      return;
    }

    setIsUpdatingProfile(true);

    try {
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          first_name: normalizedFirstName,
          last_name: normalizedLastName,
          full_name: normalizedFullName,
        },
      });

      if (metadataError) {
        throw new Error(metadataError.message || 'Failed to update auth profile metadata.');
      }

      const { error: dbUpdateError } = await supabase
        .from('users')
        .update({
          first_name: normalizedFirstName,
          last_name: normalizedLastName,
          full_name: normalizedFullName,
        })
        .eq('email', userData.email);

      if (dbUpdateError) {
        throw new Error(
          `${dbUpdateError.message}. Ensure RLS policy allows owner update on public.users.`
        );
      }

      setUserData((previous) => ({
        ...previous,
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        fullName: normalizedFullName,
      }));
      setEditableFirstName(normalizedFirstName);
      setEditableLastName(normalizedLastName);
      setIsEditingProfile(false);
      setSuccessMessage('Name updated successfully.');
    } catch (error) {
      setErrorMessage(error.message || 'Failed to update name.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleStartEditProfile = () => {
    setErrorMessage('');
    setSuccessMessage('');
    setEditableFirstName(userData.firstName);
    setEditableLastName(userData.lastName);
    setIsEditingProfile(true);
  };

  const handleCancelEditProfile = () => {
    setEditableFirstName(userData.firstName);
    setEditableLastName(userData.lastName);
    setIsEditingProfile(false);
  };

  const onPasswordSubmit = async (formData) => {
    setErrorMessage('');
    setSuccessMessage('');
    setIsUpdatingPassword(true);

    try {
      if (!userData.email) {
        throw new Error('Unable to verify account email. Please sign in again.');
      }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password: formData.currentPassword,
      });

      if (verifyError) {
        throw new Error('Current password is incorrect.');
      }

      const { error } = await supabase.auth.updateUser({ password: formData.newPassword });

      if (error) {
        throw new Error(error.message || 'Failed to update password.');
      }

      setSuccessMessage('Password changed successfully.');
      reset();
    } catch (error) {
      setErrorMessage(error.message || 'Failed to update password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const headerDisplayName = `${userData.firstName} ${userData.lastName}`.trim() || userData.fullName;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 flex items-center justify-between">
          <Link
            to="/home"
            className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Home
          </Link>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 pb-24">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Your Profile</h1>
          <p className="text-slate-500">Manage your account settings and security</p>
        </div>


        {successMessage && (
          <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-3 text-blue-700">
            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{successMessage}</p>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-700">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{errorMessage}</p>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 mb-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Camera className="h-5 w-5 text-blue-600" />
            Profile Photo
          </h2>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative">
              <div className="h-32 w-32 rounded-full bg-slate-100 overflow-hidden border-4 border-slate-100 shadow-lg">
                {profilePhotoUrl ? (
                  <img src={profilePhotoUrl} alt={userData.fullName} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-blue-50">
                    <User className="h-16 w-16 text-blue-300" />
                  </div>
                )}
              </div>
              {isUploadingPhoto && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left">
              <p className="text-2xl font-semibold text-slate-900 mb-4">{headerDisplayName}</p>
              <p className="text-sm text-slate-500 mb-4">
                Upload a profile photo. Recommended size: 400x400px. Max file size: 5MB.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
              <button
                onClick={handlePhotoClick}
                disabled={isUploadingPhoto}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                <Camera className="h-4 w-4" />
                {isUploadingPhoto ? 'Uploading...' : profilePhotoUrl ? 'Change Photo' : 'Upload Photo'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              Account Information
            </h2>
            {!isEditingProfile ? (
              <button
                type="button"
                onClick={handleStartEditProfile}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Edit Profile
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCancelEditProfile}
                disabled={isUpdatingProfile}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
            )}
          </div>

          {isEditingProfile && (
            <form onSubmit={onNameSubmit} className="mb-6 p-4 rounded-lg border border-slate-200 bg-slate-50">
              <p className="block text-sm font-medium text-slate-900 mb-2">Edit Name</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <input
                  id="editableFirstName"
                  type="text"
                  value={editableFirstName}
                  onChange={(event) => setEditableFirstName(event.target.value)}
                  maxLength={60}
                  className="block w-full rounded-xl py-3 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-300 sm:text-sm bg-white"
                  placeholder="First name"
                />
                <input
                  id="editableLastName"
                  type="text"
                  value={editableLastName}
                  onChange={(event) => setEditableLastName(event.target.value)}
                  maxLength={60}
                  className="block w-full rounded-xl py-3 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-300 sm:text-sm bg-white"
                  placeholder="Last name"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 sm:min-w-[140px]"
                >
                  {isUpdatingProfile ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Name'
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-4 rounded-lg bg-slate-50">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <User className="h-4 w-4" />
                First Name
              </div>
              <div className="sm:col-span-2 text-sm font-semibold text-slate-900">{userData.firstName || '-'}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-4 rounded-lg bg-slate-50">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <User className="h-4 w-4" />
                Last Name
              </div>
              <div className="sm:col-span-2 text-sm font-semibold text-slate-900">{userData.lastName || '-'}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-4 rounded-lg bg-slate-50">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <User className="h-4 w-4" />
                Full Name
              </div>
              <div className="sm:col-span-2 text-sm font-semibold text-slate-900">{headerDisplayName || '-'}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-4 rounded-lg bg-slate-50">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <Mail className="h-4 w-4" />
                Email
              </div>
              <div className="sm:col-span-2 text-sm font-semibold text-slate-900">{userData.email}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-4 rounded-lg bg-slate-50">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <Shield className="h-4 w-4" />
                Verification Status
              </div>
              <div className="sm:col-span-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  userData.verified ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {userData.verified ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Verified
                    </>
                  ) : (
                    'Not Verified'
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Lock className="h-5 w-5 text-blue-600" />
            Change Password
          </h2>

          <form onSubmit={handleSubmit(onPasswordSubmit)} className="space-y-5 max-w-md">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-900 mb-2">
                Current Password
              </label>
              <input
                id="currentPassword"
                type="password"
                {...register('currentPassword')}
                className={`block w-full rounded-xl py-3 px-3 text-slate-900 shadow-sm ring-1 ring-inset focus:ring-2 sm:text-sm bg-white ${
                  errors.currentPassword ? 'ring-rose-300 focus:ring-rose-400' : 'ring-slate-200 focus:ring-blue-300'
                }`}
                placeholder="********"
              />
              {errors.currentPassword && (
                <p className="mt-2 text-sm text-rose-600 font-medium">{errors.currentPassword.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-slate-900 mb-2">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                {...register('newPassword')}
                className={`block w-full rounded-xl py-3 px-3 text-slate-900 shadow-sm ring-1 ring-inset focus:ring-2 sm:text-sm bg-white ${
                  errors.newPassword ? 'ring-rose-300 focus:ring-rose-400' : 'ring-slate-200 focus:ring-blue-300'
                }`}
                placeholder="********"
              />
              {errors.newPassword && (
                <p className="mt-2 text-sm text-rose-600 font-medium">{errors.newPassword.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-900 mb-2">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                {...register('confirmPassword')}
                className={`block w-full rounded-xl py-3 px-3 text-slate-900 shadow-sm ring-1 ring-inset focus:ring-2 sm:text-sm bg-white ${
                  errors.confirmPassword ? 'ring-rose-300 focus:ring-rose-400' : 'ring-slate-200 focus:ring-blue-300'
                }`}
                placeholder="********"
              />
              {errors.confirmPassword && (
                <p className="mt-2 text-sm text-rose-600 font-medium">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isUpdatingPassword}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {isUpdatingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Update Password
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
