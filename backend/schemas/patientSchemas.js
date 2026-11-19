const { z } = require('zod');

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
  department: z.string().trim().max(100).optional().default('General Medicine'),
  emergencyContact: z.object({
    name: z.string().trim().max(100).optional().default(''),
    relationship: z.string().trim().max(50).optional().default(''),
    phone: optionalPhone,
  }).strict().default({}),
  abhaId: z.string().trim().max(32).optional().default(''),
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

const vitalsInputSchema = z.object({
  bloodPressure: z.object({
    systolic: z.number().int().min(40).max(300).nullable().optional(),
    diastolic: z.number().int().min(30).max(200).nullable().optional(),
  }).optional(),
  pulseRate: z.number().int().min(20).max(250).nullable().optional(),
  spo2: z.number().int().min(50).max(100).nullable().optional(),
  temperature: z.number().min(80).max(115).nullable().optional(),
  weight: z.number().min(1).max(500).nullable().optional(),
  height: z.number().min(20).max(300).nullable().optional(),
}).strict();

const callStatusSchema = z.preprocess((value) => value ?? {}, z.object({
  status: z.enum(['waiting', 'called', 'in_consultation', 'done']).default('called'),
}).strict());

const medicationInputSchema = z.object({
  name: z.string().trim().min(1).max(150),
  dosage: z.string().trim().max(100).optional().default(''),
  form: z.string().trim().max(50).optional().default('Tablet'),
  frequency: z.string().trim().max(50).optional().default('1-0-1'),
  duration: z.string().trim().max(50).optional().default('5 days'),
  instructions: z.string().trim().max(200).optional().default('After food'),
}).strict();

const prescriptionInputSchema = z.object({
  medications: z.array(medicationInputSchema).optional().default([]),
  investigations: z.array(z.string().trim().max(200)).optional().default([]),
  ayushAdvice: z.object({
    pathya: z.string().trim().max(2000).optional().default(''),
    apathya: z.string().trim().max(2000).optional().default(''),
  }).optional().default({}),
  generalAdvice: z.string().trim().max(3000).optional().default(''),
  followUpDate: z.union([z.literal(''), z.iso.date()]).nullable().optional(),
}).strict();

module.exports = {
  ayurvedaAssessmentSchema,
  caseHistoryPatchSchema,
  clinicalReviewSchema,
  clinicalSummarySchema,
  consentUpdateSchema,
  conversationSchema,
  documentReviewSchema,
  patientSearchSchema,
  prescriptionInputSchema,
  registrationSchema,
  vitalsInputSchema,
  callStatusSchema,
};
