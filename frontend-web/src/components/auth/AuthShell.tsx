import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../Logo';
import { AuthBrandPanel } from '../AuthBrandPanel';

export interface AuthShellProps {
  tagline: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}

/** Split-screen layout shared by login and register. */
export function AuthShell({ tagline, title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <AuthBrandPanel tagline={tagline} />

      <main className="flex min-w-0 items-center justify-center bg-surface-raised px-6 py-12">
        <div className="w-full min-w-0 max-w-sm">
          <Link to="/" aria-label="TrailWise home" className="mb-6 inline-block lg:hidden">
            <Logo className="h-8 w-auto" />
          </Link>
          <h1 className="font-heading text-h1 text-fg">{title}</h1>
          {subtitle && <p className="mt-1.5 text-body text-fg-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          <p className="mt-6 text-body text-fg-muted">{footer}</p>
        </div>
      </main>
    </div>
  );
}
