import { Moon, Sun } from 'lucide-react';
import { IconButton } from '../components/ui';
import { useTheme } from './useTheme';

/** Light/dark switch. `onDark` styles it for the always-dark public header. */
export function ThemeToggle({ onDark, size, className }: { onDark?: boolean; size?: 'sm' | 'md'; className?: string }) {
  const { resolved, setPreference } = useTheme();
  const isDark = resolved === 'dark';
  return (
    <IconButton
      size={size}
      label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      icon={isDark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
      onClick={() => setPreference(isDark ? 'light' : 'dark')}
      className={onDark ? `text-white/85 hover:bg-white/10 hover:text-white ${className ?? ''}` : className}
    />
  );
}
