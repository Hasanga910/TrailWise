import { describe, expect, it } from 'vitest';

/**
 * Regression guard for the dark-mode sweep: pages must use the semantic tokens
 * (bg-surface-raised, text-fg, bg-danger-soft, ...) rather than raw palette
 * colours, which do not follow the theme.
 *
 * Solid fills (bg-red-600, bg-emerald-500, bg-brand-700, gradients) are allowed:
 * they carry their own text colour and read in both themes.
 */
/** Every component source file as raw text, keyed by absolute-from-root path (e.g. /src/pages/x.tsx). */
const SOURCES = import.meta.glob<string>('/src/**/*.tsx', { query: '?raw', import: 'default', eager: true });

const FAMILIES = 'red|rose|emerald|green|amber|yellow|orange|blue|sky|indigo|purple|violet|cyan|teal|pink|fuchsia';
const PREFIX = String.raw`(?<![\w-])(?:[\w\[\]=&>-]+:)*`;
const FORBIDDEN: Record<string, RegExp> = {
  'raw neutral palette (use bg-surface-*, text-fg*, border-border, bg-neutral-soft)': new RegExp(
    `${PREFIX}(?:bg|text|border|divide|ring|outline|from|to|via|fill|stroke|placeholder)-(?:slate|gray|zinc|neutral|stone)-\\d+(?:/\\d+)?(?![\\w-])`,
    'g',
  ),
  'bg-white (use bg-surface-raised)': new RegExp(`${PREFIX}bg-white(?![\\w/-])`, 'g'),
  'soft status background (use bg-*-soft tokens)': new RegExp(
    `${PREFIX}bg-(?:${FAMILIES})-(?:50|100|200|300)(?:/\\d+)?(?![\\w-])`,
    'g',
  ),
  'palette text/border (use text-*-fg, text-danger, border-*/30 tokens)': new RegExp(
    `${PREFIX}(?:text|border|divide|ring|outline)-(?:${FAMILIES})-\\d+(?:/\\d+)?(?![\\w-])`,
    'g',
  ),
};

/** Explicit allowlist. Each entry needs a reason; keep it short. */
const ALLOWED_EVERYWHERE: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /^bg-slate-900\/(40|50|60)$/,
    reason: 'Modal and drawer scrims: a dark overlay is correct in both themes.',
  },
];
const ALLOWED_IN_FILE: Record<string, { match: string; reason: string }[]> = {
  'components/home/HeroSlideshow.tsx': [
    { match: 'bg-white', reason: 'Active slide indicator dot sits on a dark hero photo, not on a themed surface.' },
  ],
};

/** Not scanned: the design system defines the tokens, and the gallery demonstrates raw swatches. */
const SKIPPED = [/^\/src\/components\/ui\//, /^\/src\/pages\/dev\//, /\.test\.tsx?$/];

const files = Object.entries(SOURCES)
  .filter(([path]) => !SKIPPED.some((re) => re.test(path)))
  .map(([path, text]) => [path.replace(/^\/src\//, ''), text] as const);

describe('theme tokens', () => {
  it('scans a meaningful number of files', () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it('uses no raw palette colours outside the documented allowlist', () => {
    const offenders: string[] = [];
    for (const [rel, text] of files) {
      for (const [label, re] of Object.entries(FORBIDDEN)) {
        for (const m of text.matchAll(re)) {
          const cls = m[0].split(':').pop() as string;
          if (ALLOWED_EVERYWHERE.some((a) => a.pattern.test(cls))) continue;
          if (ALLOWED_IN_FILE[rel]?.some((a) => a.match === cls)) continue;
          offenders.push(`${rel}: ${m[0]}  [${label}]`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the allowlist honest: every file entry is still used', () => {
    for (const [rel, entries] of Object.entries(ALLOWED_IN_FILE)) {
      const text = files.find(([path]) => path === rel)?.[1] ?? '';
      for (const e of entries) expect(text, `${rel} no longer uses ${e.match}`).toContain(e.match);
    }
  });
});
