import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The design system's own type scale (src/index.css). Without this, tailwind-merge reads `text-body`
// or `text-caption` as a text *colour* and drops the real colour (e.g. `text-white` on a primary button).
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display', 'h1', 'h2', 'h3', 'h4', 'body-lg', 'body', 'caption', 'overline'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
