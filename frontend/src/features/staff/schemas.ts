import { z } from 'zod';

const optional = (s: z.ZodString) => s.optional().or(z.literal('').transform(() => undefined));

export const staffDetailsSchema = z.object({
  title: optional(z.string().trim().max(20)),
  firstName: z.string().trim().min(1, 'Enter the first name.').max(80),
  middleName: optional(z.string().trim().max(80)),
  lastName: z.string().trim().min(1, 'Enter the surname.').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  phone: optional(
    z
      .string()
      .trim()
      .regex(/^(\+?233|0)?\s?\d{2}\s?\d{3}\s?\d{4}$/, 'Enter a valid Ghana phone number, for example 024 123 4567.'),
  ).transform((v) => v?.replace(/\s/g, '')),
  staffNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9/-]{2,30}$/, 'Staff number can contain letters, digits, "/" and "-".'),
  departmentId: optional(z.string()),
  isTeaching: z.boolean(),
});

export type StaffDetailsValues = z.infer<typeof staffDetailsSchema>;
