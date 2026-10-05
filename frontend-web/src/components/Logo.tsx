import { useContext } from 'react';
import { ThemeContext } from '../theme/themeContext';
import wordmark from '../assets/logo-wordmark.png';
import wordmarkOnDark from '../assets/logo-wordmark-dark.png';

export function Logo({
  className = 'h-8 w-auto',
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  const themeDark = useContext(ThemeContext)?.resolved === 'dark';
  return (
    <img
      src={onDark || themeDark ? wordmarkOnDark : wordmark}
      alt="TrailWise"
      className={`${className} object-contain`}
    />
  );
}
