
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Lock, Mail, ChevronRight, Eye, EyeOff, AlertCircle, ShieldCheck, Newspaper, MapPin } from 'lucide-react';
import newshubLogo from '../../../assets/newshub-logo.png';
import { supabase } from '../../shared/services/supabaseClient';
import { clearAdminViewMode } from '../hooks/useAdminViewMode';

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .max(128, 'Password is too long'),
});

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 1000;

function mapLoginError(message = '') {
  const text = message.toLowerCase();

  if (text.includes('email not confirmed')) {
    return {
      message: 'Email not confirmed. Please check your inbox for the confirmation link.',
      showResend: true,
      invalidCredentials: false,
    };
  }

  if (
    text.includes('invalid login credentials') ||
    text.includes('invalid credentials') ||
    text.includes('invalid grant')
  ) {
    return {
      message: 'Invalid email or password. Please try again.',
      showResend: false,
      invalidCredentials: true,
    };
  }

  if (text.includes('too many requests') || text.includes('rate limit')) {
    return {
      message: 'Too many attempts. Please wait a minute and try again.',
      showResend: false,
      invalidCredentials: false,
    };
  }

  if (text.includes('network') || text.includes('fetch') || text.includes('timeout')) {
    return {
      message: 'Network issue detected. Please check your internet connection and try again.',
      showResend: false,
      invalidCredentials: false,
    };
  }

  return {
    message: 'Sign in failed. Please try again shortly.',
    showResend: false,
    invalidCredentials: false,
  };
}

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [isResending, setIsResending] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const [showResendAction, setShowResendAction] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(null);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data) => {
    if (lockUntil && Date.now() < lockUntil) {
      const secondsLeft = Math.ceil((lockUntil - Date.now()) / 1000);
      setServerError(`Too many login attempts. Try again in ${secondsLeft} seconds.`);
      return;
    }

    setIsLoading(true);
    setServerError(null);
    setInfoMessage('');
    setShowResendAction(false);

    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email: data.email.trim().toLowerCase(),
      password: data.password,
    });
    if (error) {
      const mapped = mapLoginError(error.message || '');
      setServerError(mapped.message);
      setShowResendAction(mapped.showResend);

      if (mapped.invalidCredentials) {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);

        if (nextAttempts >= MAX_LOGIN_ATTEMPTS) {
          const nextLockUntil = Date.now() + LOCKOUT_MS;
          setLockUntil(nextLockUntil);
          setFailedAttempts(0);
          setServerError(`Too many login attempts. Try again in ${Math.ceil(LOCKOUT_MS / 1000)} seconds.`);
        }
      }

      setValue('password', '');
      setIsLoading(false);
      return;
    }

    if (signInData?.session) {
      setFailedAttempts(0);
      setLockUntil(null);

      const authUser = signInData.session.user;
      let resolvedRole = '';

      if (authUser?.id) {
        const { data: userProfile, error: roleError } = await supabase
          .from('users')
          .select('role')
          .eq('auth_user_id', authUser.id)
          .maybeSingle();

        if (!roleError && userProfile?.role) {
          resolvedRole = userProfile.role;
        }
      }

      if (!resolvedRole) {
        // app_metadata.role can be set once per admin user via the Supabase dashboard or admin API — see migration notes.
        const metaRole = authUser?.app_metadata?.role || authUser?.user_metadata?.role;
        if (metaRole) {
          resolvedRole = metaRole;
        }
      }

      if (!resolvedRole && authUser?.email) {
        const { data: userProfileByEmail, error: emailError } = await supabase
          .from('users')
          .select('role')
          .eq('email', authUser.email)
          .maybeSingle();

        if (!emailError && userProfileByEmail?.role) {
          resolvedRole = userProfileByEmail.role;
        } else {
          console.warn('Role lookup failed after fallback.', {
            userId: authUser?.id || 'unknown',
            email: authUser?.email || 'unknown',
          });
        }
      }

      const normalizedRole = String(resolvedRole || '').trim().toUpperCase();
      if (normalizedRole === 'BANNED') {
        await supabase.auth.signOut();
        setServerError('This account has been suspended. Please contact support.');
        setIsLoading(false);
        return;
      }
      const redirectPath = normalizedRole === 'ADMIN' ? '/admin' : '/home';

      if (redirectPath !== '/admin') {
        clearAdminViewMode();
      }

      navigate(redirectPath, { replace: true });
      return;
    }

    setServerError('Sign in did not complete. Please try again.');
    setIsLoading(false);
  };

  const handleResendConfirmation = async () => {
    const email = getValues('email');

    if (!email) {
      setServerError('Enter your email first, then click resend confirmation.');
      return;
    }

    const validation = loginSchema.shape.email.safeParse(email);
    if (!validation.success) {
      setServerError('Enter a valid email address before resending confirmation.');
      return;
    }

    setIsResending(true);
    setServerError(null);
    setInfoMessage('');

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
    });

    if (error) {
      setServerError(error.message || 'Unable to resend confirmation email right now.');
    } else {
      setInfoMessage('Confirmation email sent. Please check your inbox and spam folder.');
    }

    setIsResending(false);
  };

  // ── Shared input class matching main-app style ────────────────────────────
  const inputBase =
    'block w-full rounded-lg border py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:outline-none focus:ring-2';
  const inputNormal = `${inputBase} border-slate-200 bg-white focus:border-blue-500 focus:ring-blue-200`;
  const inputError  = `${inputBase} border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100 text-red-900`;

  return (
    <div className="min-h-screen flex bg-slate-50">

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
            <img src={newshubLogo} alt="NewsHub" className="h-9 w-9 drop-shadow" />
            <span className="text-lg font-bold text-white tracking-wide">NewsHub</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white leading-snug mb-4">
            Your voice in<br />every election.
          </h1>
          <p className="text-blue-200/75 text-sm leading-relaxed max-w-xs">
            The official civic platform for secure, transparent, and verifiable election participation across the Philippines.
          </p>
        </div>

        {/* Middle: trust bullets */}
        <div className="relative z-10 space-y-5">
          {[
            {
              Icon: ShieldCheck,
              label: 'Secure authentication',
              desc: 'Bank-grade encryption protects your credentials',
            },
            {
              Icon: Newspaper,
              label: 'Real-time election news',
              desc: 'Location-aware coverage of local candidates',
            },
            {
              Icon: MapPin,
              label: 'Location-aware voting',
              desc: 'Ballots tailored to your city and province',
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

        {/* Bottom: footer */}
        <p className="relative z-10 text-xs text-blue-400/40">
          © {new Date().getFullYear()} NewsHub · Republic of the Philippines
        </p>
      </div>

      {/* ── Right: form panel ────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-10 lg:px-16 bg-white">

        {/* Mobile logo — hidden on desktop where left panel shows */}
        <div className="flex lg:hidden justify-center mb-8">
          <img src={newshubLogo} alt="NewsHub" className="h-12 w-12" />
        </div>

        <div className="w-full max-w-sm mx-auto">

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Sign in to NewsHub</h2>
            <p className="mt-1.5 text-sm text-slate-500">The official civic platform for election voting</p>
          </div>

          {/* Server error */}
          {serverError && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p>{serverError}</p>
                {showResendAction && (
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={isResending}
                    className="mt-1.5 font-semibold underline disabled:opacity-60"
                  >
                    {isResending ? 'Sending…' : 'Resend confirmation email'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Info message */}
          {infoMessage && (
            <div className="mb-5 p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm">
              {infoMessage}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  className={`${errors.email ? inputError : inputNormal} pl-9 pr-3`}
                  placeholder="name@example.com"
                />
              </div>
              {errors.email && <p className="mt-1.5 text-xs text-red-600 font-medium">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <a
                  href="/"
                  onClick={(e) => e.preventDefault()}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('password')}
                  className={`${errors.password ? inputError : inputNormal} pl-9 pr-9`}
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
              {errors.password && <p className="mt-1.5 text-xs text-red-600 font-medium">{errors.password.message}</p>}
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
                <>Sign in <ChevronRight className="h-4 w-4" /></>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              Register to vote
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
