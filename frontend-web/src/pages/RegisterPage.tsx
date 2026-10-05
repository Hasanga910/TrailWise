import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { clearReturnTo, pickReturnTo, resolvePostAuthRoute } from '../auth/returnTo';
import { AuthShell } from '../components/auth/AuthShell';
import { PasswordStrength } from '../components/auth/PasswordStrength';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PasswordInput } from '../components/ui/PasswordInput';
import { registerSchema, type RegisterValues } from '../forms/authSchemas';
import { zodResolver } from '../forms/zodResolver';
import { usePageTitle } from '../hooks/usePageTitle';

const FIELD_KEYS: (keyof RegisterValues)[] = ['name', 'email', 'contactNumber', 'password'];

export function RegisterPage() {
  const { register: registerAccount, status, error, fieldErrors, clearError, user } = useAuth();
  const location = useLocation();
  usePageTitle('Create your account');

  // Read once on arrival: the stored copy is cleared after a successful sign-in, and the redirect must not lose it.
  const [from] = useState(() => pickReturnTo((location.state as { from?: unknown } | null)?.from));
  const continuingBooking = from?.startsWith('/traveler/bookings/new') ?? false;

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: { name: '', email: '', contactNumber: '', password: '' },
  });
  const password = useWatch({ control, name: 'password' });

  useEffect(() => {
    clearError?.();
  }, [clearError]);

  useEffect(() => {
    if (status === 'authenticated') clearReturnTo();
  }, [status]);

  // Show server-side field messages (for example "email already registered") next to the field.
  useEffect(() => {
    if (!fieldErrors) return;
    for (const [field, message] of Object.entries(fieldErrors)) {
      const key = (field.charAt(0).toLowerCase() + field.slice(1)) as keyof RegisterValues;
      if (FIELD_KEYS.includes(key)) setError(key, { type: 'server', message });
    }
  }, [fieldErrors, setError]);

  if (status === 'authenticated') {
    return <Navigate to={user ? resolvePostAuthRoute(user, from) : '/login'} replace />;
  }

  async function onSubmit(values: RegisterValues) {
    await registerAccount(values.name, values.email, values.password, values.contactNumber);
  }

  return (
    <AuthShell
      tagline="Join TrailWise and book your Sri Lankan tour."
      title="Create your account"
      subtitle={continuingBooking ? 'One quick step, then we will take you straight back to your booking.' : 'Free for travelers. Browse, book and track your trips in one place.'}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" state={location.state} className="font-semibold text-brand-text hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Input label="Full name" autoComplete="name" error={errors.name?.message} {...register('name')} />
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Input
          label="Contact number"
          type="tel"
          autoComplete="tel"
          hint="Include your country code, e.g. +94 77 123 4567"
          error={errors.contactNumber?.message}
          {...register('contactNumber')}
        />
        <div>
          <PasswordInput
            label="Password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <PasswordStrength password={password ?? ''} className="mt-2" />
        </div>

        {error && (
          <p role="alert" className="rounded-input border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-body font-medium text-danger-fg">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  );
}
