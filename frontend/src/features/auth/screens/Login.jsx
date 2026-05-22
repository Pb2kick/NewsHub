
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Lock, Mail, ChevronRight, Eye, EyeOff, AlertCircle, ShieldCheck, Newspaper, MapPin } from 'lucide-react';
import newshubLogo from '../../../assets/newshub-logo.png';
import { supabase } from '../../shared/services/supabaseClient';
import ThemeToggle from '../../shared/components/ThemeToggle';
import { completeAuthRedirect, resolveUserRole } from '../utils/completeAuthRedirect';

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
const RESEND_COOLDOWN_SECONDS = 60;

const EMAIL_RATE_LIMIT_MESSAGE =
  'Email rate limit reached. Please wait 60 seconds before trying again, or contact support if this persists.';

/**
 * Detects Supabase auth email rate-limit responses (429 / "email rate limit exceeded").
 * @param {string} message
 * @returns {boolean}
 */
function isEmailRateLimitError(message = '') {
  const text = message.toLowerCase();
  return (
    text.includes('too many requests') ||
    text.includes('rate limit') ||
    text.includes('email rate limit exceeded') ||
    text.includes('exceeded') ||
    text.includes('429')
  );
}

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

  if (isEmailRateLimitError(message)) {
    return {
      message: EMAIL_RATE_LIMIT_MESSAGE,
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
  const [otpStep, setOtpStep] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isOtpLoading, setIsOtpLoading] = useState(false);
  // 60-second client-side cooldown prevents rapid signInWithOtp() calls
  // that burn through Supabase's (or Gmail SMTP's) email rate limits.
  // Even with custom SMTP configured, defensive throttling is good practice.
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

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
      // 2FA via Supabase email OTP for non-admin users. Admins bypass OTP below.
      const normalizedRole = await resolveUserRole(signInData.session.user);
      if (normalizedRole === 'BANNED') {
        await supabase.auth.signOut();
        setServerError('This account has been suspended. Please contact support.');
        setIsLoading(false);
        return;
      }

      // ADMIN BYPASS — admins skip OTP and use the password session directly
      if (normalizedRole === 'ADMIN') {
        const result = await completeAuthRedirect(signInData.session, navigate);
        if (result === 'banned') {
          await supabase.auth.signOut();
          setServerError('This account has been suspended.');
        }
        setIsLoading(false);
        return;
      }

      await supabase.auth.signOut();

      const normalizedEmail = data.email.trim().toLowerCase();
      // Supabase Magic Link template must display {{ .Token }} as a typed
      // code — NOT {{ .ConfirmationURL }}. Change in:
      // Auth → Email Templates → Magic Link → replace body with OTP template.
      // See: db/migrations/supabase_email_template_instructions.txt
      // SMTP (429 fix): db/migrations/supabase_smtp_instructions.txt
      const { error: otpSendError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: false },
      });

      if (otpSendError) {
        const otpMsg = otpSendError.message || '';
        setServerError(
          isEmailRateLimitError(otpMsg)
            ? EMAIL_RATE_LIMIT_MESSAGE
            : otpMsg || 'Unable to send verification code. Please try again.'
        );
        if (isEmailRateLimitError(otpMsg)) {
          setResendCooldown(RESEND_COOLDOWN_SECONDS);
        }
        setIsLoading(false);
        return;
      }

      setFailedAttempts(0);
      setLockUntil(null);
      setOtpEmail(normalizedEmail);
      setOtpStep(true);
      setOtpValue('');
      setOtpError('');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setInfoMessage(`We sent a 6-digit code to ${normalizedEmail}. Enter it below to complete sign-in.`);
      setIsLoading(false);
      return;
    }

    setServerError('Sign in did not complete. Please try again.');
    setIsLoading(false);
  };

  const handleOtpSubmit = async (event) => {
    event.preventDefault();

    if (lockUntil && Date.now() < lockUntil) {
      const secondsLeft = Math.ceil((lockUntil - Date.now()) / 1000);
      setOtpError(`Too many login attempts. Try again in ${secondsLeft} seconds.`);
      return;
    }

    setIsOtpLoading(true);
    setOtpError('');
    setServerError(null);

    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      email: otpEmail,
      token: otpValue.trim(),
      type: 'email',
    });

    if (verifyError || !verifyData?.session) {
      setOtpError('Invalid or expired code. Please try again.');
      setOtpValue('');
      setIsOtpLoading(false);
      return;
    }

    const result = await completeAuthRedirect(verifyData.session, navigate);
    if (result === 'banned') {
      setOtpStep(false);
      setServerError('This account has been suspended. Please contact support.');
    }
    setIsOtpLoading(false);
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;

    setOtpError('');
    setOtpValue('');
    const { error: resendError } = await supabase.auth.signInWithOtp({
      email: otpEmail,
      options: { shouldCreateUser: false },
    });
    if (resendError) {
      const resendMsg = resendError.message || '';
      setOtpError(
        isEmailRateLimitError(resendMsg)
          ? EMAIL_RATE_LIMIT_MESSAGE
          : resendMsg || 'Unable to resend code.'
      );
      if (isEmailRateLimitError(resendMsg)) {
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
      }
    } else {
      setInfoMessage(`A new code was sent to ${otpEmail}.`);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    }
  };

  const handleBackToSignIn = () => {
    setOtpStep(false);
    setOtpEmail('');
    setOtpValue('');
    setOtpError('');
    setInfoMessage('');
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
  const inputNormal = `${inputBase} border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 focus:border-blue-500 focus:ring-blue-200`;
  const inputError  = `${inputBase} border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100 text-red-900`;

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
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-10 lg:px-16 bg-white dark:bg-slate-900 relative">

        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <ThemeToggle />
        </div>

        {/* Mobile logo — hidden on desktop where left panel shows */}
        <div className="flex lg:hidden justify-center mb-8">
          <img src={newshubLogo} alt="NewsHub" className="h-12 w-12" />
        </div>

        <div className="w-full max-w-sm mx-auto">

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {otpStep ? 'Enter verification code' : 'Sign in to NewsHub'}
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              {otpStep
                ? `We sent a 6-digit code to ${otpEmail}. Enter it below to complete sign-in.`
                : 'The official civic platform for election voting'}
            </p>
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

          {otpStep ? (
            <form className="space-y-5" onSubmit={handleOtpSubmit} noValidate>
              {otpError ? (
                <p className="text-sm text-rose-600 font-medium">{otpError}</p>
              ) : null}
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  6-digit code
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otpValue}
                  onChange={(event) => setOtpValue(event.target.value.replace(/\D/g, ''))}
                  className={`${inputNormal} text-center tracking-widest text-lg`}
                  placeholder="000000"
                  autoComplete="one-time-code"
                />
              </div>
              <button
                type="submit"
                disabled={isOtpLoading || otpValue.trim().length < 6}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isOtpLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  'Verify and sign in'
                )}
              </button>
              <div className="flex flex-col items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0}
                  className={`font-semibold text-blue-600 dark:text-blue-400 ${
                    resendCooldown > 0
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:text-blue-700'
                  }`}
                >
                  {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
                </button>
                <button
                  type="button"
                  onClick={handleBackToSignIn}
                  className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                >
                  Back to sign in
                </button>
              </div>
            </form>
          ) : (
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>

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
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
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
          )}

          {!otpStep ? (
          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              Register to vote
            </Link>
          </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
