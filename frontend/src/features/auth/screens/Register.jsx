
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Newspaper,
  MapPin,
} from 'lucide-react';
import { supabase } from '../../shared/services/supabaseClient';
import ThemeToggle from '../../shared/components/ThemeToggle';
import { getEmailConfirmedRedirectUrl } from '../../shared/utils/siteUrl';

/*
 * SUPABASE DASHBOARD — Authentication → URL Configuration (required for email confirm):
 * 1. Set "Site URL" to: https://newshub-s1dh.onrender.com
 *    (and http://localhost:3000 when testing locally)
 * 2. Add Redirect URL: https://newshub-s1dh.onrender.com/email-confirmed
 * 3. Add Redirect URL: http://localhost:3000/email-confirmed
 * 4. Add Redirect URL: https://newshub-s1dh.onrender.com/*
 * Without step 2+, Supabase blocks emailRedirectTo even when the code is correct.
 */

const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Full name is required')
      .max(100, 'Full name is too long')
      .regex(/^[A-Za-z][A-Za-z\s.'-]*$/, 'Full name can only contain letters and basic punctuation'),
    email: z
      .string()
      .trim()
      .min(1, 'Email is required')
      .email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password must be at most 72 characters')
      .regex(/[a-z]/, 'Password must include at least one lowercase letter')
      .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
      .regex(/[0-9]/, 'Password must include at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must include at least one special character'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    attestation: z.literal(true, {
      errorMap: () => ({ message: 'You must attest to your eligibility' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => !data.password.toLowerCase().includes(data.email.split('@')[0]?.toLowerCase() || ''), {
    message: 'Password should not include your email name',
    path: ['password'],
  });

function mapRegisterError(message = '') {
  const text = message.toLowerCase();

  if (
    text.includes('user already registered') ||
    text.includes('user already exists') ||
    text.includes('email already registered') ||
    text.includes('email already in use') ||
    text.includes('duplicate key value') ||
    text.includes('already associated with an account')
  ) {
    return 'An account already exists for this email. Try signing in or resetting your password.';
  }

  if (text.includes('too many requests') || text.includes('rate limit')) {
    return 'Too many attempts. Please wait a minute before trying again.';
  }

  if (text.includes('network') || text.includes('fetch') || text.includes('timeout')) {
    return 'Network issue detected. Please check your internet connection and try again.';
  }

  if (text.includes('password')) {
    return 'Password does not meet security requirements.';
  }

  if (text.includes('invalid email')) {
    return 'Please enter a valid email address.';
  }

  if (message && message.trim().length > 0) {
    return `Registration failed: ${message}`;
  }
  return 'Registration failed. Please review your details and try again.';
}

// ── Shared input class matching main-app style ──────────────────────────────
const inputBase =
  'block w-full rounded-lg border py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:outline-none focus:ring-2';
const inputNormal = `${inputBase} border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 focus:border-blue-500 focus:ring-blue-200`;
const inputError  = `${inputBase} border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100 text-red-900`;

export default function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [infoMessage, setInfoMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      attestation: false,
    },
  });

  const onSubmit = async (formData) => {
    setIsLoading(true);
    setServerError(null);
    setInfoMessage('');

    const normalizedEmail = formData.email.trim().toLowerCase();
    const normalizedFullName = formData.fullName.trim().replace(/\s+/g, ' ');
    const nameParts = normalizedFullName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ');

    // emailRedirectTo must match a URL in Supabase Auth → URL Configuration → Redirect URLs allowlist.
    const emailRedirectTo = getEmailConfirmedRedirectUrl();

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: formData.password,
      options: {
        emailRedirectTo,
        data: {
          full_name: normalizedFullName,
          first_name: firstName,
          last_name: lastName,
        },
      },
    });

    if (error) {
      console.error('Registration error:', error);
      setServerError(mapRegisterError(error.message || ''));
      setValue('password', '');
      setValue('confirmPassword', '');
      setIsLoading(false);
      setIsSuccess(false);
      return;
    }

    const identities = data?.user?.identities;
    const isExistingUserWithoutError =
      Array.isArray(identities) && identities.length === 0;

    if (isExistingUserWithoutError) {
      setServerError('An account already exists for this email. Try signing in or resetting your password.');
      setValue('password', '');
      setValue('confirmPassword', '');
      setIsLoading(false);
      setIsSuccess(false);
      return;
    }

    setInfoMessage('Registration submitted. Please check your email and confirm your account registration before signing in.');
    setIsSuccess(true);
    setIsLoading(false);
    setTimeout(() => {
      navigate('/login');
    }, 1800);
  };

  // ── Success screen ──────────────────────────────────────────────────────
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-800 px-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm p-10 max-w-sm w-full text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Registration Complete</h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              Your voter profile has been securely created. Redirecting to login…
            </p>
          </div>
          <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-800">

      {/* ── Left civic panel (desktop only) ──────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[44%] xl:w-[40%] relative flex-col justify-between p-12 overflow-hidden shrink-0"
        style={{ background: 'linear-gradient(160deg, #0a2342 0%, #1a3a6e 55%, #0d1f3c 100%)' }}
      >
        {/* Dot-grid texture */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.055) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
        />
        {/* Philippine flag vertical accent strip */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: 'linear-gradient(to bottom, #0038A8 50%, #CE1126 50%)' }}
        />

        {/* Top: branding */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center shadow">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-wide">NewsHub</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white leading-snug mb-4">
            Register to<br />vote securely.
          </h1>
          <p className="text-blue-200/75 text-sm leading-relaxed max-w-xs">
            Create your civic identity to participate in transparent, verifiable elections and access location-aware news coverage.
          </p>
        </div>

        {/* Middle: trust bullets */}
        <div className="relative z-10 space-y-5">
          {[
            {
              Icon: ShieldCheck,
              label: 'Identity verification',
              desc: 'Admin-reviewed before ballot access is granted',
            },
            {
              Icon: Newspaper,
              label: 'Stay informed',
              desc: 'Real-time news from your local area',
            },
            {
              Icon: MapPin,
              label: 'Local coverage',
              desc: 'Candidates and elections for your city and province',
            },
          ].map(({ Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3.5">
              <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Icon className="w-4 h-4 text-blue-200" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-tight">{label}</p>
                <p className="text-blue-300/60 text-xs mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <p className="relative z-10 text-xs text-blue-400/40">
          © {new Date().getFullYear()} NewsHub · Republic of the Philippines
        </p>
      </div>

      {/* ── Right: form panel ────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:px-16 bg-white dark:bg-slate-900 overflow-y-auto relative">

        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm mx-auto">

          {/* Back link */}
          <Link
            to="/login"
            className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 mb-6 transition-colors"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to sign in
          </Link>

          {/* Heading */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Voter Registration</h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              Create your civic identity to participate in elections.
            </p>
          </div>

          {/* Server error */}
          {serverError && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="text-sm">{serverError}</p>
            </div>
          )}

          {/* Info message */}
          {infoMessage && (
            <div className="mb-5 p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm">
              {infoMessage}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>

            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Legal Full Name
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="fullName"
                  type="text"
                  {...register('fullName')}
                  autoComplete="name"
                  maxLength={100}
                  className={`${errors.fullName ? inputError : inputNormal} pl-9 pr-3`}
                  placeholder="John Doe"
                />
              </div>
              {errors.fullName && <p className="mt-1.5 text-xs text-red-600 font-medium">{errors.fullName.message}</p>}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  {...register('email')}
                  autoComplete="email"
                  className={`${errors.email ? inputError : inputNormal} pl-9 pr-3`}
                  placeholder="name@example.com"
                />
              </div>
              {errors.email && <p className="mt-1.5 text-xs text-red-600 font-medium">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  autoComplete="new-password"
                  className={`${errors.password ? inputError : inputNormal} pl-9 pr-3`}
                  placeholder="••••••••"
                />
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-red-600 font-medium">{errors.password.message}</p>}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  {...register('confirmPassword')}
                  autoComplete="new-password"
                  className={`${errors.confirmPassword ? inputError : inputNormal} pl-9 pr-9`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="mt-1.5 text-xs text-red-600 font-medium">{errors.confirmPassword.message}</p>}
            </div>

            {/* Attestation */}
            <div className="flex items-start gap-3 pt-1">
              <input
                id="attestation"
                type="checkbox"
                {...register('attestation')}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <div className="text-sm">
                <label htmlFor="attestation" className="font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  Eligibility Attestation
                </label>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                  I swear or affirm under penalty of perjury that I am a citizen eligible to vote, and the information provided is true.
                </p>
                {errors.attestation && (
                  <p className="mt-1 text-xs text-red-600 font-medium">You must confirm you are eligible to vote.</p>
                )}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors active:scale-[0.99]"
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                'Create Voter Account'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
