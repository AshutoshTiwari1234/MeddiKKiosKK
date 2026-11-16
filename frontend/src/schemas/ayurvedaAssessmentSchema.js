import { z } from 'zod';

export const ayurvedaAssessmentSchema = z.object({
  prakriti: z.enum(['not_assessed', 'vata', 'pitta', 'kapha', 'vata_pitta', 'vata_kapha', 'pitta_kapha', 'sama']),
  vikriti: z.enum(['not_assessed', 'vata', 'pitta', 'kapha', 'vata_pitta', 'vata_kapha', 'pitta_kapha', 'sama']),
  sara: z.string().max(1000), samhanana: z.string().max(1000), pramana: z.string().max(1000),
  satmya: z.string().max(1000), sattva: z.string().max(1000), aharaShakti: z.string().max(1000),
  vyayamaShakti: z.string().max(1000), vaya: z.enum(['not_assessed', 'bala', 'madhya', 'vriddha']),
  agni: z.enum(['not_assessed', 'sama', 'vishama', 'tikshna', 'manda']),
  koshtha: z.enum(['not_assessed', 'mridu', 'madhyama', 'krura']), nidana: z.string().max(3000),
});
