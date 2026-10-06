import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { clearReturnTo, pickReturnTo, resolvePostAuthRoute } from '../auth/returnTo';
import { AuthShell } from '../components/auth/AuthShell';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PasswordInput } from '../components/ui/PasswordInput';
import { loginSchema, type LoginValues } from '../forms/authSchemas';
import { zodResolver } from '../forms/zodResolver';
import { usePageTitle } from '../hooks/usePageTitle';

export function LoginPage() {
  const { login, status, error, clearError, user } = useAuth();
  const location = useLocation();
  usePageTitle('Log in');

  // Read once on arrival: the stored copy is cleared after a successful sign-in, and the redirect must not lose it.
  const [from] = useState(() => pickReturnTo((location.state as { from?: unknown } | null)?.from));
  const continuingBooking = from?.startsWith('/traveler/bookings/new') ?? false;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), mode: 'onBlur', defaultValues: { email: '', password: '' } });

  // An error left over from the register page should not greet someone who just arrived here.
  useEffect(() => {
    clearError?.();
  }, [clearError]);

  useEffect(() => {
    if (status === 'authenticated') clearReturnTo();
  }, [status]);

  if (status === 'authenticated') {
    return <Navigate to={user ? resolvePostAuthRoute(user, from) : '/login'} replace />;
  }

  async function onSubmit(values: LoginValues) {
    await login(values.email, values.password);
  }

  return (
    <AuthShell
      tagline="Your next Sri Lankan adventure starts here."
      title={continuingBooking ? 'Log in to continue' : 'Welcome back'}
      subtitle={continuingBooking ? 'Sign in to pick up your booking where you left off.' : 'Log in to your TrailWise account.'}
      footer={
        <>
          New to TrailWise?{' '}
          <Link to="/register" state={location.state} className="font-semibold text-brand-text hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordInput
          label="Password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />

        {error && (
          <p role="alert" className="rounded-input border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-body font-medium text-danger-fg">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          {isSubmitting ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
    </AuthShell>
  );
}
