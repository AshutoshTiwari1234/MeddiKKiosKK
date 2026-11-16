import { z } from 'zod';

const verifiedHistory = z.object({
  chiefComplaint: z.string().max(1000), onset: z.string().max(500), duration: z.string().max(300),
  location: z.string().max(500), character: z.string().max(1000), aggravatingFactors: z.string().max(500),
  relievingFactors: z.string().max(500), timing: z.string().max(500), severity: z.number().int().min(0).max(10).nullable(),
  associatedSymptoms: z.string().max(1000), pastMedicalHistory: z.string().max(2000), surgicalHistory: z.string().max(2000),
  familyHistory: z.string().max(2000), personalHistory: z.string().max(2000), medicationHistory: z.string().max(2000),
  allergies: z.string().max(2000), reviewOfSystems: z.string().max(2000),
});

export const clinicalReviewSchema = z.object({
  doctorNotes: z.string().trim().max(3000),
  verifiedHistory,
});
