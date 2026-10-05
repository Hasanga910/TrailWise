import { describe, expect, it } from 'vitest';
import { passwordStrength } from './strengthScore';

describe('passwordStrength', () => {
  it('is empty for an empty password', () => {
    expect(passwordStrength('')).toEqual({ level: 0, label: '', hint: null });
  });

  it('is always weak below 8 characters and says how many more are needed', () => {
    expect(passwordStrength('Ab1!')).toMatchObject({ level: 1, label: 'Weak', hint: 'Add 4 more characters' });
    expect(passwordStrength('Ab1!xyz')).toMatchObject({ level: 1, hint: 'Add 1 more character' });
  });

  it.each([
    ['abcdefgh', 1, 'Weak'],
    ['abcdefgH', 1, 'Weak'], // mixed case only
    ['abcdefg1', 1, 'Weak'], // digit only
    ['abcdeFG1', 2, 'Fair'],
    ['abcdeFG1!', 3, 'Good'],
    ['abcdeFGhij1!', 4, 'Strong'],
  ])('%s scores %i (%s)', (password, level, label) => {
    expect(passwordStrength(password)).toMatchObject({ level, label });
  });

  it('suggests the next improvement', () => {
    expect(passwordStrength('abcdefgh').hint).toBe('Mix upper and lower case letters');
    expect(passwordStrength('abcdeFGh').hint).toBe('Add a number');
    expect(passwordStrength('abcdeFG1').hint).toBe('Add a symbol like ! or #');
    expect(passwordStrength('abcdeFG1!').hint).toBe('Make it 12 or more characters');
    expect(passwordStrength('abcdeFGhij1!').hint).toBeNull();
  });
});
