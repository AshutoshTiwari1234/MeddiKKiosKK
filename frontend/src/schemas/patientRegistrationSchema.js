import { z } from 'zod';

const phone = z.union([
  z.literal(''),
  z.string().trim().regex(/^\+?[\d\s()-]{7,20}$/, 'Enter a valid phone number.'),
]);

export const patientRegistrationSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(150),
  dateOfBirth: z.union([z.literal(''), z.iso.date()]),
  gender: z.enum(['female', 'male', 'other', 'prefer_not_to_say', 'unknown']),
  phone,
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email address.').max(254)]),
  preferredLanguage: z.enum(['en', 'hi', 'other']),
  emergencyContact: z.object({
    name: z.string().trim().max(100),
    relationship: z.string().trim().max(50),
    phone,
  }),
  abhaId: z.string().trim().max(32),
  consent: z.object({
    caseTaking: z.literal(true, 'Please consent to sharing this information with your care team.'),
    documentProcessing: z.boolean(),
    aiAssistance: z.boolean(),
  }),
});
