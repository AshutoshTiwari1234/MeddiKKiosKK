const { z } = require('zod');
const { validateAbhaId } = require('../services/abhaService');

const abhaIdSchema = z.union([
  z.literal(''),
  z.string().trim().refine((val) => {
    if (!val) return true;
    const { valid } = validateAbhaId(val);
    return valid;
  }, {
    message: 'Invalid ABHA ID format. Must be a 14-digit ABHA number (e.g. 12-3456-7890-1234 or 12345678901234) or a valid ABHA address (e.g. name@abdm).',
  }),
]).default('');

const abhaVerificationSchema = z.object({
  abhaId: z.string().trim().min(1, 'ABHA ID is required.'),
}).strict();

const optionalPhone = z.union([
  z.literal(''),
  z.string().trim().regex(/^\+?[\d\s()-]{7,20}$/, 'Enter a valid phone number.'),
]).default('');

const registrationSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the patient’s full name.').max(150),
  dateOfBirth: z.union([z.literal(''), z.iso.date()]).default(''),
  gender: z.enum(['female', 'male', 'other', 'prefer_not_to_say', 'unknown']).default('unknown'),
  phone: optionalPhone,
  email: z.union([z.literal(''), z.string().trim().email().max(254)]).default(''),
  preferredLanguage: z.enum(['en', 'hi', 'other']).default('en'),
  emergencyContact: z.object({
    name: z.string().trim().max(100).optional().default(''),
    relationship: z.string().trim().max(50).optional().default(''),
    phone: optionalPhone,
  }).strict().default({}),
  abhaId: abhaIdSchema,
  consent: z.object({
    caseTaking: z.literal(true, 'Consent to case-taking is required.'),
    documentProcessing: z.boolean().default(false),
    aiAssistance: z.boolean().default(false),
  }).strict(),
}).strict();

const caseHistoryFields = {
  chiefComplaint: z.string().trim().min(2, 'Please share your main concern.').max(1000).optional(),
  onset: z.string().trim().max(500).optional(),
  duration: z.string().trim().max(300).optional(),
  location: z.string().trim().max(500).optional(),
  character: z.string().trim().max(1000).optional(),
  aggravatingFactors: z.string().trim().max(500).optional(),
  relievingFactors: z.string().trim().max(500).optional(),
  timing: z.string().trim().max(500).optional(),
  severity: z.number().int().min(0).max(10).nullable().optional(),
  associatedSymptoms: z.string().trim().max(1000).optional(),
  pastMedicalHistory: z.string().trim().max(2000).optional(),
  surgicalHistory: z.string().trim().max(2000).optional(),
  familyHistory: z.string().trim().max(2000).optional(),
  personalHistory: z.string().trim().max(2000).optional(),
  medicationHistory: z.string().trim().max(2000).optional(),
  allergies: z.string().trim().max(2000).optional(),
  reviewOfSystems: z.string().trim().max(2000).optional(),
  complete: z.boolean().optional().default(false),
};

const caseHistoryPatchSchema = z.object(caseHistoryFields).strict().refine(
  (value) => Object.keys(value).some((key) => key !== 'complete') || value.complete,
  'Share at least one response before saving.',
);

const patientSearchSchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  page: z.number().int().min(1).max(100000).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(20),
}).strict();

const conversationSchema = z.object({
  field: z.enum([
    'chiefComplaint', 'onset', 'duration', 'location', 'character', 'aggravatingFactors',
    'relievingFactors', 'timing', 'severity', 'associatedSymptoms', 'pastMedicalHistory',
    'surgicalHistory', 'familyHistory', 'personalHistory', 'medicationHistory', 'allergies', 'reviewOfSystems',
  ]),
  answer: z.string().trim().max(2000),
  language: z.enum(['en', 'hi']),
  followUpAnswer: z.boolean().default(false),
}).strict();

const consentUpdateSchema = z.object({
  caseTaking: z.boolean().optional(),
  documentProcessing: z.boolean().optional(),
  aiAssistance: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Choose at least one consent setting to update.');

const documentReviewSchema = z.object({
  reviewedText: z.string().trim().max(20000),
  reviewNotes: z.string().trim().max(2000).default(''),
  reviewStatus: z.enum(['pending', 'reviewed']),
}).strict();

const clinicalSummarySchema = z.object({
  text: z.string().trim().min(1, 'A summary is required.').max(12000),
  status: z.enum(['draft', 'approved']),
}).strict();

const verifiedHistorySchema = z.object({
  chiefComplaint: z.string().trim().max(1000).optional(),
  onset: z.string().trim().max(500).optional(),
  duration: z.string().trim().max(300).optional(),
  location: z.string().trim().max(500).optional(),
  character: z.string().trim().max(1000).optional(),
  aggravatingFactors: z.string().trim().max(500).optional(),
  relievingFactors: z.string().trim().max(500).optional(),
  timing: z.string().trim().max(500).optional(),
  severity: z.number().int().min(0).max(10).nullable().optional(),
  associatedSymptoms: z.string().trim().max(1000).optional(),
  pastMedicalHistory: z.string().trim().max(2000).optional(),
  surgicalHistory: z.string().trim().max(2000).optional(),
  familyHistory: z.string().trim().max(2000).optional(),
  personalHistory: z.string().trim().max(2000).optional(),
  medicationHistory: z.string().trim().max(2000).optional(),
  allergies: z.string().trim().max(2000).optional(),
  reviewOfSystems: z.string().trim().max(2000).optional(),
}).strict();

const clinicalReviewSchema = z.object({
  status: z.enum(['pending', 'approved', 'revisions_needed']),
  doctorNotes: z.string().trim().max(3000).default(''),
  verifiedHistory: verifiedHistorySchema.default({}),
}).strict();

const ayurvedaAssessmentSchema = z.object({
  prakriti: z.enum(['not_assessed', 'vata', 'pitta', 'kapha', 'vata_pitta', 'vata_kapha', 'pitta_kapha', 'sama']),
  vikriti: z.enum(['not_assessed', 'vata', 'pitta', 'kapha', 'vata_pitta', 'vata_kapha', 'pitta_kapha', 'sama']),
  sara: z.string().trim().max(1000),
  samhanana: z.string().trim().max(1000),
  pramana: z.string().trim().max(1000),
  satmya: z.string().trim().max(1000),
  sattva: z.string().trim().max(1000),
  aharaShakti: z.string().trim().max(1000),
  vyayamaShakti: z.string().trim().max(1000),
  vaya: z.enum(['not_assessed', 'bala', 'madhya', 'vriddha']),
  agni: z.enum(['not_assessed', 'sama', 'vishama', 'tikshna', 'manda']),
  koshtha: z.enum(['not_assessed', 'mridu', 'madhyama', 'krura']),
  nidana: z.string().trim().max(3000),
}).strict();

const medicationInputSchema = z.object({
  name: z.string().trim().min(1, 'Medication name is required.').max(200),
  dosage: z.string().trim().max(100).default(''),
  frequency: z.string().trim().max(100).default(''),
  duration: z.string().trim().max(100).default(''),
  instructions: z.string().trim().max(500).default(''),
}).strict();

const prescriptionInputSchema = z.object({
  medications: z.array(medicationInputSchema).min(1, 'At least one medication is required.'),
  instructions: z.string().trim().max(2000).default(''),
}).strict();

const interactionCheckSchema = z.object({
  medications: z.array(z.union([z.string().trim().min(1), medicationInputSchema])).min(1, 'Provide medications to check.'),
}).strict();

module.exports = {
  abhaVerificationSchema,
  ayurvedaAssessmentSchema,
  caseHistoryPatchSchema,
  clinicalReviewSchema,
  clinicalSummarySchema,
  consentUpdateSchema,
  conversationSchema,
  documentReviewSchema,
  interactionCheckSchema,
  medicationInputSchema,
  patientSearchSchema,
  prescriptionInputSchema,
  registrationSchema,
};
