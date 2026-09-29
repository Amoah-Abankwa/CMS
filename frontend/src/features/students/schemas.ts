import { z } from 'zod';

const thisYear = new Date().getFullYear();

const optional = (schema: z.ZodString) =>
  schema
    .optional()
    .or(
      z.literal('').transform(() => undefined),
    );

export const registerStudentSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'Enter the first name.')
    .max(80),

  middleName: optional(
    z.string().trim().max(80),
  ),

  lastName: z
    .string()
    .trim()
    .min(1, 'Enter the surname.')
    .max(80),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address.'),

  phone: z
    .string()
    .trim()
    .regex(
      /^(\+?233|0)?\s?\d{2}\s?\d{3}\s?\d{4}$/,
      'Enter a valid Ghana phone number, for example 024 123 4567.',
    )
    .transform((value) =>
      value.replace(/\s/g, ''),
    ),

  programmeId: z
    .string()
    .uuid('Choose a programme.'),

  admissionYear: z
    .coerce
    .number()
    .int()
    .min(thisYear - 10)
    .max(thisYear + 1),

  dateOfBirth: optional(z.string()),

  gender: z
    .enum(['', 'Female', 'Male'])
    .transform((value) =>
      value === '' ? undefined : value,
    )
    .optional(),

  nationality: optional(
    z.string().trim().max(60),
  ),
});

export type RegisterStudentValues =
  z.input<typeof registerStudentSchema>;