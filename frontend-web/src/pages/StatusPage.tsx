import type { ReactNode } from 'react';
import { Logo } from '../components/Logo';

export function StatusPage({ code, title, message, actions }: { code: string; title: string; message: string; actions: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-surface-sunken px-6 text-center">
      <Logo className="mb-8 h-8 w-auto" />
      <p className="font-heading text-display text-brand-600 dark:text-brand-400">{code}</p>
      <h1 className="mt-2 font-heading text-h2 text-fg">{title}</h1>
      <p className="mt-2 max-w-md text-body text-fg-muted">{message}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">{actions}</div>
    </div>
  );
}
