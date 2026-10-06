import { useContext } from 'react';
import { ThemeContext } from '../theme/themeContext';
import wordmark from '../assets/logo-wordmark.png';
import wordmarkOnDark from '../assets/logo-wordmark-dark.png';
import mark from '../assets/logo-mark.png';
import markOnDark from '../assets/logo-mark-dark.png';

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
      width={917}
      height={228}
      className={`${className} object-contain`}
    />
  );
}

/** The TW mark on its own (same artwork as the favicon), for the collapsed sidebar. */
export function LogoMark({ className = 'h-8 w-auto' }: { className?: string }) {
  const themeDark = useContext(ThemeContext)?.resolved === 'dark';
  return (
    <img
      src={themeDark ? markOnDark : mark}
      alt="TrailWise"
      width={275}
      height={228}
      className={`${className} object-contain`}
    />
  );
}
