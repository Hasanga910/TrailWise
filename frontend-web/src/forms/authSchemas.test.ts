import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './authSchemas';
import { zodResolver } from './zodResolver';

const messages = (result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  Object.fromEntries((result.error?.issues ?? []).reverse().map((i) => [String(i.path[0]), i.message])); // first issue per field wins

describe('loginSchema', () => {
  it('requires email and password', () => {
    expect(messages(loginSchema.safeParse({ email: '', password: '' }))).toEqual({
      email: 'Enter your email address',
      password: 'Enter your password',
    });
  });

  it('rejects a malformed email and trims whitespace on valid ones', () => {
    expect(messages(loginSchema.safeParse({ email: 'nope', password: 'x' })).email).toBe('Enter a valid email address');
    expect(loginSchema.parse({ email: '  a@b.co ', password: 'x' }).email).toBe('a@b.co');
  });
});

describe('registerSchema', () => {
  const valid = { name: 'Amaya Silva', email: 'a@b.co', contactNumber: '+94 77 123 4567', password: 'longenough' };

  it('accepts a valid registration', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['name', { name: 'A' }, 'Enter your full name'],
    ['contactNumber', { contactNumber: 'call me' }, 'Enter a valid phone number, for example +94 77 123 4567'],
    ['contactNumber', { contactNumber: '' }, 'Enter a contact number'],
    ['password', { password: 'short' }, 'Use at least 8 characters'],
  ])('reports %s problems', (field, patch, message) => {
    expect(messages(registerSchema.safeParse({ ...valid, ...patch }))[field]).toBe(message);
  });

  it('accepts common local phone formats', () => {
    for (const phone of ['0771234567', '077-123-4567', '(077) 123 4567', '+1 415 555 0100']) {
      expect(registerSchema.safeParse({ ...valid, contactNumber: phone }).success).toBe(true);
    }
  });
});

describe('zodResolver', () => {
  it('returns parsed values on success and the first message per field on failure', async () => {
    const resolve = zodResolver(registerSchema);
    const ok = await resolve({ name: 'Amaya', email: ' a@b.co ', contactNumber: '0771234567', password: 'longenough' }, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });
    expect(ok.errors).toEqual({});
    expect(ok.values).toMatchObject({ email: 'a@b.co' });

    const bad = await resolve({ name: '', email: 'x', contactNumber: '', password: '' }, undefined, { fields: {}, shouldUseNativeValidation: false });
    expect(bad.values).toEqual({});
    expect(Object.keys(bad.errors).sort()).toEqual(['contactNumber', 'email', 'name', 'password']);
    expect(bad.errors.name).toMatchObject({ message: 'Enter your full name' });
  });
});
