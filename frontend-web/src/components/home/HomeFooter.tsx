import { Link } from 'react-router-dom';
import { Mail, MessageCircle, Phone } from 'lucide-react';
import { CONTACT_EMAIL, CONTACT_PHONE_DISPLAY, contactLinks } from '../../config/contact';
import { Logo } from '../Logo';

const linkClass = 'flex items-center gap-2 text-sm text-white/75 transition hover:text-white';

export function HomeFooter() {
  return (
    <footer className="bg-brand-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Logo onDark className="h-8 w-auto" />
            <p className="mt-4 max-w-xs text-sm text-white/70">
              Handpicked Sri Lankan tours, planned and confirmed with you from first idea to last day.
            </p>
          </div>

          <nav aria-label="Footer">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">Explore</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link to="/explore" className="text-white/75 transition hover:text-white">
                  Browse tours
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-white/75 transition hover:text-white">
                  Create an account
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-white/75 transition hover:text-white">
                  Log in
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">Contact us</h3>
            <ul className="mt-4 space-y-3">
              <li>
                <a href={contactLinks.email} className={linkClass}>
                  <Mail className="h-4 w-4 shrink-0" aria-hidden />
                  {CONTACT_EMAIL}
                </a>
              </li>
              <li>
                <a href={contactLinks.phone} className={linkClass}>
                  <Phone className="h-4 w-4 shrink-0" aria-hidden />
                  {CONTACT_PHONE_DISPLAY}
                </a>
              </li>
              <li>
                <a href={contactLinks.whatsapp} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
                  WhatsApp us
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-12 border-t border-white/10 pt-6 text-sm text-white/65">
          Run tours, guide or drive for a living?{' '}
          <Link to="/login" className="font-semibold text-white underline underline-offset-4 hover:text-accent-400">
            Operators, guides and drivers sign in to the TrailWise console.
          </Link>
        </p>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-6 py-6 text-center text-sm text-white/60 sm:text-left">
          &copy; {new Date().getFullYear()} TrailWise. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
