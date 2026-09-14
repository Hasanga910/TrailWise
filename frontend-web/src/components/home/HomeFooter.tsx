import { Link } from 'react-router-dom';
import { Logo } from '../Logo';

export function HomeFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <Logo className="h-7 w-auto" />
        <p className="text-sm text-slate-500">One console for operations, guides, and travelers.</p>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/login" className="text-slate-600 hover:text-brand-700">
            Log in
          </Link>
          <Link to="/register" className="text-slate-600 hover:text-brand-700">
            Sign up
          </Link>
        </div>
      </div>
      <p className="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        &copy; {new Date().getFullYear()} TrailWise. Built for tour operations.
      </p>
    </footer>
  );
}
