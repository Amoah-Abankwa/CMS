import { z } from 'zod';

export const studentLoginSchema = z.object({
  indexNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^ANU\d{2}[0-9A-Z]{1,3}\d{5}$/, 'Enter your index number, for example ANU25400001.'),
  password: z.string().min(1, 'Enter your password.'),
});

export const staffLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^(\d{6}|[A-Za-z0-9]{5}-?[A-Za-z0-9]{5})$/, 'Enter the 6-digit code, or a recovery code such as ABCDE-12345.'),
});

export const totpSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app.'),
});

const newPassword = z.string().min(10, 'Use at least 10 characters.');

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' });

export const forgotSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your index number or staff email.'),
});

export const resetSchema = z
  .object({
    code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code we sent you.'),
    newPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' });

export const setupSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' });
