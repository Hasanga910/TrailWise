import { Link, useNavigate } from 'react-router-dom';
import { Percent } from 'lucide-react';
import type { ActiveDiscount } from '../../api/discounts';
import type { PackageTier } from '../../api/packages';
import { useAuth } from '../../auth/AuthContext';
import { saveReturnTo } from '../../auth/returnTo';
import { formatPrice } from '../../utils/format';
import { buttonClasses } from '../ui/buttonStyles';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { bookingTarget } from './packageSummary';

export interface BookingCardProps {
  tier: PackageTier | null;
  discounts: ActiveDiscount[];
  /** Optional hand-off from the home search: ?guests=&start= */
  guests?: string | null;
  start?: string | null;
}

export function BookingCard({ tier, discounts, guests, start }: BookingCardProps) {
  const { status, user } = useAuth();
  const navigate = useNavigate();
  const target = tier ? bookingTarget(tier.id, guests, start) : null;

  function bookAnonymously() {
    if (!target) return;
    // State survives the register/login hop; sessionStorage covers a refresh or switching pages.
    saveReturnTo(target);
    navigate('/register', { state: { from: target } });
  }

  let action;
  if (!tier || !target) {
    action = <Button disabled className="w-full">Select a class to continue</Button>;
  } else if (status === 'loading') {
    action = <Button disabled className="w-full">Checking your account…</Button>;
  } else if (status === 'authenticated' && user?.role === 'Traveler') {
    action = (
      <Link to={target} className={buttonClasses('primary', 'lg', 'w-full')}>
        Book this tour
      </Link>
    );
  } else if (status === 'authenticated') {
    action = (
      <>
        <Button disabled size="lg" className="w-full">
          Book this tour
        </Button>
        <p className="mt-2 text-caption text-fg-muted">Staff accounts can't make bookings. Sign in with a traveler account to book.</p>
      </>
    );
  } else {
    action = (
      <>
        <Button size="lg" className="w-full" onClick={bookAnonymously}>
          Book this tour
        </Button>
        <p className="mt-3 text-center text-caption text-fg-muted">
          Free account needed to book.{' '}
          <Link
            to="/login"
            state={{ from: target }}
            onClick={() => saveReturnTo(target)}
            className="font-semibold text-brand-text hover:underline"
          >
            I already have an account
          </Link>
        </p>
      </>
    );
  }

  return (
    <Card className="space-y-4 lg:sticky lg:top-24">
      {tier ? (
        <div>
          <p className="text-caption text-fg-muted">{tier.classType} class from</p>
          <p>
            <span className="font-heading text-h1 text-fg">{formatPrice(tier.basePricePerPerson)}</span>
            <span className="text-body text-fg-muted"> /person</span>
          </p>
        </div>
      ) : (
        <p className="text-body text-fg-muted">No classes are open for booking on this tour yet.</p>
      )}

      {discounts.length > 0 && (
        <ul className="space-y-2" aria-label="Current offers">
          {discounts.slice(0, 2).map((d) => (
            <li key={d.id} className="flex items-start gap-2 rounded-input bg-success-soft px-3 py-2 text-caption font-medium text-success-fg">
              <Percent className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                Save {d.percentageOff}% for groups of {d.minGroupSize}+. {d.description}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div>{action}</div>
      <p className="text-center text-caption text-fg-muted">We confirm availability before you pay anything.</p>
    </Card>
  );
}
