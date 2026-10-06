import { Compass, ShieldCheck, Star } from 'lucide-react';
import sigiriya from '../assets/hero/sigiriya-rock-fortress-1024.webp';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';

const BENEFITS = [
  { Icon: Compass, text: 'Handpicked tours across Sri Lanka' },
  { Icon: ShieldCheck, text: 'Guide and vehicle confirmed before you pay' },
  { Icon: Star, text: 'Reviews from travelers who completed the trip' },
];

export function AuthBrandPanel({ tagline }: { tagline: string }) {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-950 p-10 text-white lg:flex">
      <img
        src={sigiriya}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover opacity-45"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/60 to-brand-950/30" />

      <div className="relative z-10">
        <Link
          to="/"
          aria-label="TrailWise home"
          className="inline-block cursor-pointer rounded-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950"
        >
          <Logo onDark className="h-8 w-auto" />
        </Link>
      </div>

      <div className="relative z-10 max-w-md">
        <h2 className="font-heading text-3xl font-bold leading-tight">{tagline}</h2>
        <ul className="mt-8 space-y-4">
          {BENEFITS.map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-white/90">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative z-10 text-sm text-white/70">&copy; {new Date().getFullYear()} TrailWise</p>
    </div>
  );
}
