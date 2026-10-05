import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from './ThemeProvider';
import { useTheme } from './useTheme';

function Probe() {
  const { preference, resolved, setPreference } = useTheme();
  return (
    <div>
      <p data-testid="state">{`${preference}:${resolved}`}</p>
      <button onClick={() => setPreference('dark')}>dark</button>
      <button onClick={() => setPreference('light')}>light</button>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to system and resolves to light when the OS is light', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('state')).toHaveTextContent('system:light');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('applies and remembers an explicit choice', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ThemeProvider><Probe /></ThemeProvider>);
    await user.click(screen.getByText('dark'));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('trailwise_theme')).toBe('dark');
    unmount();
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('state')).toHaveTextContent('dark:dark');
  });
});
