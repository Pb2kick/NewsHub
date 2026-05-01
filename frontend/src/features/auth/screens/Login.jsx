
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
    <div className="min-h-screen bg-muted/30 flex flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <img src={newshubLogo} alt="NewsHub" className="h-16 w-16 object-contain drop-shadow-lg" />
        </div>
        <h2 className="text-center text-2xl/9 font-bold tracking-tight text-foreground">Sign in to NewsHub</h2>
        <p className="mt-2 text-center text-sm/6 text-muted-foreground">The official civic platform for election voting</p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
        <div className="bg-card px-6 py-10 shadow-sm border border-border/50 rounded-2xl sm:px-12">
          {serverError && (
            <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3 text-destructive">
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
            <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium">
              {infoMessage}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div>
              <label htmlFor="email" className="block text-sm/6 font-medium text-foreground">Email address</label>
              <div className="mt-2 relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  className={`block w-full rounded-xl border-0 py-3 pl-10 pr-3 text-foreground shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm/6 bg-background transition-colors ${
                    errors.email
                      ? 'ring-destructive focus:ring-destructive text-destructive'
                      : 'ring-border focus:ring-primary'
                  }`}
                  placeholder="name@example.com"
                />
              </div>
              {errors.email && <p className="mt-2 text-sm text-destructive font-medium">{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm/6 font-medium text-foreground">Password</label>
                <div className="text-sm">
                  <a href="/" onClick={(event) => event.preventDefault()} className="font-semibold text-primary hover:text-primary/80">Forgot password?</a>
                </div>
              </div>
              <div className="mt-2 relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('password')}
                  className={`block w-full rounded-xl border-0 py-3 pl-10 pr-10 text-foreground shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm/6 bg-background transition-colors ${
                    errors.password
                      ? 'ring-destructive focus:ring-destructive text-destructive'
                      : 'ring-border focus:ring-primary'
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && <p className="mt-2 text-sm text-destructive font-medium">{errors.password.message}</p>}
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3.5 text-sm/6 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {isLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
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

        <p className="mt-8 text-center text-sm/6 text-muted-foreground">
          Don't have an account?{' '}
          <Link to="/register" className="font-semibold text-primary hover:text-primary/80 transition-colors">
            Register to vote
          </Link>
        </p>
      </div>
    </div>
  );
}
