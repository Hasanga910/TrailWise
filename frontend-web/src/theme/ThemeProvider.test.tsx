import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import indexHtml from '../../index.html?raw';
import { ThemeProvider } from './ThemeProvider';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from './useTheme';

function Probe() {
  const { preference, resolved } = useTheme();
  return <p data-testid="state">{`${preference}:${resolved}`}</p>;
}

function renderWithTheme() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
      <Probe />
    </ThemeProvider>,
  );
}

/** Make the OS report a dark colour scheme, to prove it is ignored. */
function mockSystemDark() {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query.includes('prefers-color-scheme: dark'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
        onchange: null,
      }) as MediaQueryList,
  );
}

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to light for a new visitor', () => {
    renderWithTheme();
    expect(screen.getByTestId('state')).toHaveTextContent('light:light');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
  });

  it('stays light even when the system prefers dark', () => {
    mockSystemDark();
    renderWithTheme();
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('treats a legacy saved "system" value as light', () => {
    mockSystemDark();
    localStorage.setItem('trailwise_theme', 'system');
    renderWithTheme();
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('toggles to dark and back, saving each choice', async () => {
    const user = userEvent.setup();
    renderWithTheme();

    await user.click(screen.getByRole('button', { name: /switch to dark mode/i }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('trailwise_theme')).toBe('dark');
    expect(screen.getByRole('button', { name: /switch to light mode/i })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: /switch to light mode/i }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(localStorage.getItem('trailwise_theme')).toBe('light');
  });

  it('remembers the choice after a reload', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithTheme();
    await user.click(screen.getByRole('button', { name: /switch to dark mode/i }));
    unmount();
    document.documentElement.removeAttribute('data-theme');

    renderWithTheme();
    expect(screen.getByTestId('state')).toHaveTextContent('dark:dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });
});

describe('pre-paint theme script in index.html', () => {
  const script = indexHtml.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '';

  function run(stored: string | null, systemDark: boolean) {
    document.documentElement.removeAttribute('data-theme');
    if (stored === null) localStorage.removeItem('trailwise_theme');
    else localStorage.setItem('trailwise_theme', stored);
    if (systemDark) mockSystemDark();
    new Function(script)();
    return document.documentElement.getAttribute('data-theme');
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('sets light for a new visitor, even when the system prefers dark', () => {
    expect(run(null, true)).toBe('light');
  });

  it('sets dark only for a saved dark choice', () => {
    expect(run('dark', false)).toBe('dark');
    expect(run('light', true)).toBe('light');
  });
});
