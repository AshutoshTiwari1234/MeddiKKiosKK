import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid work email address.').max(254),
  password: z.string().min(1, 'Enter your password.'),
});
