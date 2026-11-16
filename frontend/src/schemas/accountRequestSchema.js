import { z } from 'zod';

export const accountRequestSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(100),
  email: z.string().trim().email('Enter a valid work email.').max(254),
  password: z.string().min(12, 'Use at least 12 characters.').max(128),
  confirmPassword: z.string().min(1, 'Confirm your password.'),
  role: z.enum(['doctor', 'receptionist']),
  department: z.string().trim().max(100),
}).refine((values) => values.password === values.confirmPassword, {
  path: ['confirmPassword'],
  message: 'The passwords do not match.',
});
