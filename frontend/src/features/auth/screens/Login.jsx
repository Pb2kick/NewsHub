
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Lock, Mail, ChevronRight, Eye, EyeOff, AlertCircle } from 'lucide-react';
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
      let redirectPath = '/home';

      if (authUser?.email) {
        const { data: userProfile, error: roleError } = await supabase
          .from('users')
          .select('role')
          .eq('email', authUser.email)
          .maybeSingle();

        if (!roleError) {
          const normalizedRole = String(userProfile?.role || '').trim().toUpperCase();
          if (normalizedRole === 'ADMIN') {
            redirectPath = '/admin';
          }
        }
      }

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

  return (
    <div
      className="min-h-screen relative flex flex-col justify-center px-6 py-12 lg:px-8 overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1a1144 40%, #0c1a45 100%)' }}
    >
      {/* ── Keyframe animations ───────────────────────────────────────────── */}
      <style>{`
        @keyframes nh-float-a {
          0%, 100% { transform: translate(0px,  0px) scale(1);    }
          50%       { transform: translate(-28px, -36px) scale(1.08); }
        }
        @keyframes nh-float-b {
          0%, 100% { transform: translate(0px, 0px) scale(1);   }
          50%       { transform: translate(22px, 28px) scale(0.94); }
        }
        @keyframes nh-float-c {
          0%   { transform: translate(0px,  0px);  }
          33%  { transform: translate(14px, -18px); }
          66%  { transform: translate(-8px,  10px); }
          100% { transform: translate(0px,  0px);  }
        }
        @keyframes nh-float-d {
          0%, 100% { transform: translate(0px, 0px) scale(1);   }
          50%       { transform: translate(-18px, 24px) scale(1.05); }
        }
        .nh-orb-a { animation: nh-float-a  9s ease-in-out infinite; }
        .nh-orb-b { animation: nh-float-b 12s ease-in-out infinite; }
        .nh-orb-c { animation: nh-float-c  7s ease-in-out infinite; }
        .nh-orb-d { animation: nh-float-d 15s ease-in-out infinite reverse; }
      `}</style>

      {/* ── Background orbs ───────────────────────────────────────────────── */}
      <div
        className="nh-orb-a pointer-events-none absolute -top-36 -left-36 w-[420px] h-[420px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.45) 0%, transparent 70%)' }}
      />
      <div
        className="nh-orb-b pointer-events-none absolute -bottom-48 -right-48 w-[540px] h-[540px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.38) 0%, transparent 70%)' }}
      />
      <div
        className="nh-orb-c pointer-events-none absolute top-1/2 left-1/4 w-72 h-72 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.22) 0%, transparent 70%)' }}
      />
      <div
        className="nh-orb-d pointer-events-none absolute -top-16 right-1/4 w-80 h-80 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.28) 0%, transparent 70%)' }}
      />

      {/* ── Subtle dot-grid overlay ───────────────────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* ── Logo + heading ────────────────────────────────────────────────── */}
      <div className="relative sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full blur-xl opacity-60"
              style={{ background: 'radial-gradient(circle, #60a5fa, #818cf8)' }}
            />
            <img src={newshubLogo} alt="NewsHub" className="relative h-16 w-16 object-contain drop-shadow-2xl" />
          </div>
        </div>
        <h2 className="text-center text-2xl font-bold tracking-tight text-white">
          Sign in to NewsHub
        </h2>
        <p className="mt-2 text-center text-sm text-blue-200/70">
          The official civic platform for election voting
        </p>
      </div>

      {/* ── Form card ─────────────────────────────────────────────────────── */}
      <div className="relative mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
        <div
          className="px-6 py-10 rounded-2xl shadow-2xl sm:px-12"
          style={{
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          {serverError && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-400/30 flex items-start gap-3 text-red-300">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="text-sm font-medium">
                <p>{serverError}</p>
                {showResendAction && (
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={isResending}
                    className="mt-2 font-semibold underline disabled:opacity-60"
                  >
                    {isResending ? 'Sending confirmation...' : 'Resend confirmation email'}
                  </button>
                )}
              </div>
            </div>
          )}

          {infoMessage && (
            <div className="mb-6 p-4 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-200 text-sm font-medium">
              {infoMessage}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/80">
                Email address
              </label>
              <div className="mt-2 relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-white/40" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  className={`block w-full rounded-xl border-0 py-3 pl-10 pr-3 text-white shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm placeholder-white/30 transition-colors ${
                    errors.email
                      ? 'ring-red-400/60 focus:ring-red-400'
                      : 'ring-white/20 focus:ring-blue-400'
                  }`}
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                  placeholder="name@example.com"
                />
              </div>
              {errors.email && <p className="mt-2 text-sm text-red-400 font-medium">{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-white/80">
                  Password
                </label>
                <div className="text-sm">
                  <a
                    href="/"
                    onClick={(event) => event.preventDefault()}
                    className="font-semibold text-blue-300 hover:text-blue-200 transition-colors"
                  >
                    Forgot password?
                  </a>
                </div>
              </div>
              <div className="mt-2 relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-white/40" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('password')}
                  className={`block w-full rounded-xl border-0 py-3 pl-10 pr-10 text-white shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm placeholder-white/30 transition-colors ${
                    errors.password
                      ? 'ring-red-400/60 focus:ring-red-400'
                      : 'ring-white/20 focus:ring-blue-400'
                  }`}
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-white/40 hover:text-white/70 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && <p className="mt-2 text-sm text-red-400 font-medium">{errors.password.message}</p>}
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3.5 text-sm font-semibold text-white shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                style={{
                  background: isLoading
                    ? 'rgba(59,130,246,0.7)'
                    : 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                  boxShadow: '0 4px 24px rgba(99,102,241,0.4)',
                }}
              >
                {isLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    Sign in
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <p className="mt-8 text-center text-sm text-white/50">
          Don't have an account?{' '}
          <Link to="/register" className="font-semibold text-blue-300 hover:text-blue-200 transition-colors">
            Register to vote
          </Link>
        </p>
      </div>
    </div>
  );
}
