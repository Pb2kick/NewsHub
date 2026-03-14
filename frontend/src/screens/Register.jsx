
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
} from 'lucide-react';
import { supabase } from '../supabaseClient';

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

  // Show the raw error for debugging if present
  if (message && message.trim().length > 0) {
    return `Registration failed: ${message}`;
  }
  return 'Registration failed. Please review your details and try again.';
}

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

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: formData.password,
      options: {
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

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-6">
        <div className="bg-card p-10 rounded-3xl shadow-lg border border-border/50 max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Registration Complete</h2>
            <p className="mt-2 text-sm text-muted-foreground">Your voter profile has been securely created. Redirecting to login...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <div className="h-12 w-12 bg-primary text-primary-foreground rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
        </div>
        <h2 className="text-center text-2xl/9 font-bold tracking-tight text-foreground">Voter Registration</h2>
        <p className="mt-2 text-center text-sm/6 text-muted-foreground max-w-sm mx-auto">
          Create your civic identity to participate in secure and verifiable elections.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[500px]">
        <div className="bg-card px-6 py-8 shadow-sm border border-border/50 rounded-2xl sm:px-10">
          <Link
            to="/login"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to sign in
          </Link>

          {serverError && (
            <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3 text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{serverError}</p>
            </div>
          )}

          {infoMessage && (
            <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium">
              {infoMessage}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div>
              <label htmlFor="fullName" className="block text-sm/6 font-medium text-foreground">Legal Full Name</label>
              <div className="mt-2 relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  id="fullName"
                  type="text"
                  {...register('fullName')}
                  autoComplete="name"
                  maxLength={100}
                  className={`block w-full rounded-xl border-0 py-3 pl-10 pr-3 text-foreground shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm/6 bg-background transition-colors ${
                    errors.fullName ? 'ring-destructive focus:ring-destructive' : 'ring-border focus:ring-primary'
                  }`}
                  placeholder="John Doe"
                />
              </div>
              {errors.fullName && <p className="mt-1 text-sm text-destructive font-medium">{errors.fullName.message}</p>}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm/6 font-medium text-foreground">Email address</label>
              <div className="mt-2 relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  id="email"
                  type="email"
                  {...register('email')}
                  autoComplete="email"
                  className={`block w-full rounded-xl border-0 py-3 pl-10 pr-3 text-foreground shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm/6 bg-background transition-colors ${
                    errors.email ? 'ring-destructive focus:ring-destructive' : 'ring-border focus:ring-primary'
                  }`}
                  placeholder="name@example.com"
                />
              </div>
              {errors.email && <p className="mt-1 text-sm text-destructive font-medium">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm/6 font-medium text-foreground">Password</label>
              <div className="mt-2 relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  autoComplete="new-password"
                  className={`block w-full rounded-xl border-0 py-3 pl-10 pr-10 text-foreground shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm/6 bg-background transition-colors ${
                    errors.password ? 'ring-destructive focus:ring-destructive' : 'ring-border focus:ring-primary'
                  }`}
                  placeholder="••••••••"
                />
              </div>
              {errors.password && <p className="mt-1 text-sm text-destructive font-medium">{errors.password.message}</p>}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm/6 font-medium text-foreground">Confirm Password</label>
              <div className="mt-2 relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  {...register('confirmPassword')}
                  autoComplete="new-password"
                  className={`block w-full rounded-xl border-0 py-3 pl-10 pr-10 text-foreground shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm/6 bg-background transition-colors ${
                    errors.confirmPassword ? 'ring-destructive focus:ring-destructive' : 'ring-border focus:ring-primary'
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
              {errors.confirmPassword && <p className="mt-1 text-sm text-destructive font-medium">{errors.confirmPassword.message}</p>}
            </div>

            <div className="relative flex items-start mt-6">
              <div className="flex h-6 items-center">
                <input
                  id="attestation"
                  type="checkbox"
                  {...register('attestation')}
                  className="h-5 w-5 rounded-md border-border bg-background text-primary focus:ring-primary focus:ring-offset-background cursor-pointer"
                />
              </div>
              <div className="ml-3 text-sm/6">
                <label htmlFor="attestation" className="font-medium text-foreground cursor-pointer">Eligibility Attestation</label>
                <p className="text-muted-foreground">
                  I swear or affirm under penalty of perjury that I am a citizen eligible to vote, and the information provided is true.
                </p>
                  {errors.attestation && (
                    <p className="mt-1 text-sm text-destructive font-medium">
                      You must confirm you are eligible to vote.
                    </p>
                  )}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3.5 text-sm/6 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {isLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  'Create Voter Account'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
