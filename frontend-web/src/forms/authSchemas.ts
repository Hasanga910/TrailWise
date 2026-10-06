import { z } from 'zod';

const email = z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
});
export type LoginValues = z.infer<typeof loginSchema>;

/** Digits with optional + prefix, spaces, dashes and brackets; deliberately lenient about local formats. */
export const PHONE_PATTERN = /^\+?[0-9\s\-()]{7,20}$/;
export const PHONE_MESSAGE = 'Enter a valid phone number, for example +94 77 123 4567';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name'),
  email,
  contactNumber: z
    .string()
    .trim()
    .min(1, 'Enter a contact number')
    .regex(PHONE_PATTERN, PHONE_MESSAGE),
  // The API only requires 8 characters; the strength meter nudges beyond that without blocking.
  password: z.string().min(8, 'Use at least 8 characters'),
});
export type RegisterValues = z.infer<typeof registerSchema>;
