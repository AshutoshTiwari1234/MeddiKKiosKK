import { z } from 'zod';

export const staffUserSchema = z.object({
  name: z.string().trim().min(2, 'Enter the staff member’s name.').max(100),
  email: z.string().trim().email('Enter a valid work email.').max(254),
  password: z.string().min(12, 'Use at least 12 characters.').max(128),
  role: z.enum(['administrator', 'doctor', 'receptionist']),
  department: z.string().trim().max(100),
});
