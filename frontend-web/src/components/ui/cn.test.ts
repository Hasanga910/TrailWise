import { describe, expect, it } from 'vitest';
import { cn } from './cn';
import { buttonClasses } from './buttonStyles';

describe('cn', () => {
  it('keeps the text colour when a design-system font size is also present', () => {
    expect(cn('text-white', 'text-body')).toBe('text-white text-body');
    expect(cn('text-fg-muted', 'text-caption')).toBe('text-fg-muted text-caption');
  });

  it('still lets a later colour replace an earlier one', () => {
    expect(cn('text-white', 'text-fg')).toBe('text-fg');
  });

  it('keeps the white label on primary and danger buttons at every size', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      expect(buttonClasses('primary', size)).toContain('text-white');
      expect(buttonClasses('danger', size)).toContain('text-white');
    }
  });
});
