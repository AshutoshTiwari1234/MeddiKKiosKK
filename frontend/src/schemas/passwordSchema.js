import { z } from 'zod';

export const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: z.string().min(12, 'Use at least 12 characters.').max(128),
  confirmPassword: z.string().min(1, 'Confirm your new password.'),
}).refine((values) => values.newPassword === values.confirmPassword, {
  path: ['confirmPassword'],
  message: 'The passwords do not match.',
});
