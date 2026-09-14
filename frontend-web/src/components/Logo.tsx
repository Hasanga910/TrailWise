import wordmark from '../assets/logo-wordmark.png';
import wordmarkOnDark from '../assets/logo-wordmark-dark.png';

export function Logo({
  className = 'h-8 w-auto',
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  return (
    <img
      src={onDark ? wordmarkOnDark : wordmark}
      alt="TrailWise"
      className={`${className} object-contain`}
    />
  );
}
