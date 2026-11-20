const crypto = require('node:crypto');
const mongoose = require('mongoose');

const emergencyContactSchema = new mongoose.Schema({
  name: { type: String, trim: true, maxlength: 100 },
  relationship: { type: String, trim: true, maxlength: 50 },
  phone: { type: String, trim: true, maxlength: 20 },
}, { _id: false });

const consentSchema = new mongoose.Schema({
  caseTaking: { type: Boolean, default: false },
  documentProcessing: { type: Boolean, default: false },
  aiAssistance: { type: Boolean, default: false },
  recordedAt: { type: Date, default: null },
  policyVersion: { type: String, trim: true, maxlength: 30, default: '' },
}, { _id: false });

const consentHistorySchema = new mongoose.Schema({
  caseTaking: { type: Boolean, required: true },
  documentProcessing: { type: Boolean, required: true },
  aiAssistance: { type: Boolean, required: true },
  recordedAt: { type: Date, default: Date.now, immutable: true },
  policyVersion: { type: String, trim: true, maxlength: 30, default: '1.0' },
  source: { type: String, enum: ['kiosk'], default: 'kiosk' },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { _id: false });

const caseHistorySchema = new mongoose.Schema({
  chiefComplaint: { type: String, trim: true, maxlength: 1000, default: '' },
  onset: { type: String, trim: true, maxlength: 500, default: '' },
  duration: { type: String, trim: true, maxlength: 300, default: '' },
  location: { type: String, trim: true, maxlength: 500, default: '' },
  character: { type: String, trim: true, maxlength: 1000, default: '' },
  aggravatingFactors: { type: String, trim: true, maxlength: 500, default: '' },
  relievingFactors: { type: String, trim: true, maxlength: 500, default: '' },
  timing: { type: String, trim: true, maxlength: 500, default: '' },
  severity: { type: Number, min: 0, max: 10, default: null },
  associatedSymptoms: { type: String, trim: true, maxlength: 1000, default: '' },
  pastMedicalHistory: { type: String, trim: true, maxlength: 2000, default: '' },
  surgicalHistory: { type: String, trim: true, maxlength: 2000, default: '' },
  familyHistory: { type: String, trim: true, maxlength: 2000, default: '' },
  personalHistory: { type: String, trim: true, maxlength: 2000, default: '' },
  medicationHistory: { type: String, trim: true, maxlength: 2000, default: '' },
  allergies: { type: String, trim: true, maxlength: 2000, default: '' },
  reviewOfSystems: { type: String, trim: true, maxlength: 2000, default: '' },
}, { _id: false });

const clinicalReviewSchema = new mongoose.Schema({
  verifiedHistory: { type: caseHistorySchema, default: () => ({}) },
  doctorNotes: { type: String, trim: true, maxlength: 3000, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'revisions_needed'], default: 'pending', index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  history: [{
    verifiedHistory: { type: caseHistorySchema, default: () => ({}) },
    doctorNotes: { type: String, trim: true, maxlength: 3000, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'revisions_needed'], required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now },
  }],
}, { _id: false });

const ayurvedaAssessmentSchema = new mongoose.Schema({
  prakriti: { type: String, enum: ['not_assessed', 'vata', 'pitta', 'kapha', 'vata_pitta', 'vata_kapha', 'pitta_kapha', 'sama'], default: 'not_assessed' },
  vikriti: { type: String, enum: ['not_assessed', 'vata', 'pitta', 'kapha', 'vata_pitta', 'vata_kapha', 'pitta_kapha', 'sama'], default: 'not_assessed' },
  sara: { type: String, trim: true, maxlength: 1000, default: '' },
  samhanana: { type: String, trim: true, maxlength: 1000, default: '' },
  pramana: { type: String, trim: true, maxlength: 1000, default: '' },
  satmya: { type: String, trim: true, maxlength: 1000, default: '' },
  sattva: { type: String, trim: true, maxlength: 1000, default: '' },
  aharaShakti: { type: String, trim: true, maxlength: 1000, default: '' },
  vyayamaShakti: { type: String, trim: true, maxlength: 1000, default: '' },
  vaya: { type: String, enum: ['not_assessed', 'bala', 'madhya', 'vriddha'], default: 'not_assessed' },
  agni: { type: String, enum: ['not_assessed', 'sama', 'vishama', 'tikshna', 'manda'], default: 'not_assessed' },
  koshtha: { type: String, enum: ['not_assessed', 'mridu', 'madhyama', 'krura'], default: 'not_assessed' },
  nidana: { type: String, trim: true, maxlength: 3000, default: '' },
  assessedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assessedAt: { type: Date, default: null },
}, { _id: false });

const clinicalSummarySchema = new mongoose.Schema({
  status: { type: String, enum: ['not_generated', 'draft', 'approved'], default: 'not_generated' },
  text: { type: String, trim: true, maxlength: 12000, default: '' },
  generationMode: { type: String, enum: ['assembled', 'llm'], default: 'assembled' },
  generatedAt: { type: Date, default: null },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedAt: { type: Date, default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  history: [{
    status: { type: String, enum: ['draft', 'approved'], required: true },
    text: { type: String, trim: true, maxlength: 12000, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now },
  }],
}, { _id: false });

const medicationItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  dosage: { type: String, trim: true, maxlength: 100, default: '' },
  form: { type: String, trim: true, maxlength: 50, default: '' },
  frequency: { type: String, trim: true, maxlength: 100, default: '' },
  duration: { type: String, trim: true, maxlength: 100, default: '' },
  instructions: { type: String, trim: true, maxlength: 500, default: '' },
}, { _id: false });

const vitalsSchema = new mongoose.Schema({
  bloodPressure: {
    systolic: { type: Number, min: 40, max: 300, default: null },
    diastolic: { type: Number, min: 30, max: 200, default: null },
  },
  pulseRate: { type: Number, min: 20, max: 250, default: null },
  spo2: { type: Number, min: 50, max: 100, default: null },
  temperature: { type: Number, min: 80, max: 115, default: null },
  weight: { type: Number, min: 1, max: 500, default: null },
  height: { type: Number, min: 20, max: 300, default: null },
  bmi: { type: Number, min: 5, max: 100, default: null },
  recordedAt: { type: Date, default: null },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { _id: false });

const vitalsReadingSchema = new mongoose.Schema({
  bloodPressure: {
    systolic: { type: Number, min: 40, max: 300, default: null },
    diastolic: { type: Number, min: 30, max: 200, default: null },
  },
  pulseRate: { type: Number, min: 20, max: 250, default: null },
  spo2: { type: Number, min: 50, max: 100, default: null },
  temperature: { type: Number, min: 80, max: 115, default: null },
  weight: { type: Number, min: 1, max: 500, default: null },
  bmi: { type: Number, min: 5, max: 100, default: null },
  recordedAt: { type: Date, required: true },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { _id: false });

const VITALS_HISTORY_LIMIT = 100;

const interactionWarningSchema = new mongoose.Schema({
  severity: { type: String, enum: ['critical', 'major', 'moderate', 'minor'], default: 'major' },
  drugs: [{ type: String, trim: true }],
  description: { type: String, required: true, trim: true },
  actionRequired: { type: String, trim: true, default: '' },
}, { _id: false });

const treatmentPlanFields = {
  investigations: { type: [String], default: [] },
  ayushAdvice: {
    pathya: { type: String, trim: true, maxlength: 2000, default: '' },
    apathya: { type: String, trim: true, maxlength: 2000, default: '' },
  },
  generalAdvice: { type: String, trim: true, maxlength: 3000, default: '' },
  followUpDate: { type: Date, default: null },
};

const prescriptionVersionSchema = new mongoose.Schema({
  ...treatmentPlanFields,
  version: { type: Number, required: true },
  medications: [medicationItemSchema],
  instructions: { type: String, trim: true, maxlength: 2000, default: '' },
  warnings: [interactionWarningSchema],
  prescribedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  prescribedAt: { type: Date, default: Date.now },
}, { _id: false });

const prescriptionSchema = new mongoose.Schema({
  ...treatmentPlanFields,
  version: { type: Number, default: 0 },
  medications: [medicationItemSchema],
  instructions: { type: String, trim: true, maxlength: 2000, default: '' },
  warnings: [interactionWarningSchema],
  prescribedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  prescribedAt: { type: Date, default: null },
  updatedAt: { type: Date, default: null },
  history: [prescriptionVersionSchema],
}, { _id: false });

const patientSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    unique: true,
    immutable: true,
    default: () => `MK-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
  },
  fullName: { type: String, required: true, trim: true, maxlength: 150 },
  dateOfBirth: { type: Date, default: null },
  gender: { type: String, enum: ['female', 'male', 'other', 'prefer_not_to_say', 'unknown'], default: 'unknown' },
  phone: { type: String, trim: true, maxlength: 20, default: '' },
  email: { type: String, lowercase: true, trim: true, maxlength: 254, default: '' },
  preferredLanguage: { type: String, enum: ['en', 'hi', 'other'], default: 'en' },
  department: { type: String, trim: true, maxlength: 100, default: 'General Medicine' },
  queueToken: { type: String, trim: true, maxlength: 20, default: '' },
  roomNumber: { type: String, trim: true, maxlength: 50, default: 'Room 1' },
  callStatus: { type: String, enum: ['waiting', 'called', 'in_consultation', 'done'], default: 'waiting' },
  calledAt: { type: Date, default: null },
  consultationStartedAt: { type: Date, default: null },
  consultationEndedAt: { type: Date, default: null },
  emergencyContact: { type: emergencyContactSchema, default: () => ({}) },
  abhaId: { type: String, trim: true, maxlength: 32, default: '', select: false },
  abhaStatus: { type: String, enum: ['unverified', 'verified', 'failed'], default: 'unverified', index: true },
  abhaVerifiedAt: { type: Date, default: null },
  abhaAuthMethods: { type: [String], default: [] },
  consent: { type: consentSchema, default: () => ({}) },
  consentHistory: { type: [consentHistorySchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  registrationSource: { type: String, enum: ['kiosk', 'staff'], default: 'kiosk' },
  caseHistory: { type: caseHistorySchema, default: () => ({}) },
  caseStatus: { type: String, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started', index: true },
  caseHistoryUpdatedAt: { type: Date, default: null },
  clinicalReview: { type: clinicalReviewSchema, default: () => ({}) },
  ayurvedaAssessment: { type: ayurvedaAssessmentSchema, default: () => ({}) },
  clinicalSummary: { type: clinicalSummarySchema, default: () => ({}) },
  vitals: { type: vitalsSchema, default: () => ({}) },
  vitalsHistory: { type: [vitalsReadingSchema], default: [] },
  prescription: { type: prescriptionSchema, default: () => ({}) },
  intakeCredentialHash: { type: String, select: false, default: undefined },
  intakeExpiresAt: { type: Date, select: false, default: null },
}, { timestamps: true, versionKey: false });

patientSchema.index({ fullName: 1 });
patientSchema.index({ phone: 1 }, { sparse: true });
patientSchema.index({ createdAt: -1 });
patientSchema.index({ createdAt: 1, department: 1 });

patientSchema.set('toJSON', {
  transform(_document, value) {
    delete value.abhaId;
    delete value.intakeCredentialHash;
    delete value.intakeExpiresAt;
    return value;
  },
});

module.exports = mongoose.model('Patient', patientSchema);
module.exports.VITALS_HISTORY_LIMIT = VITALS_HISTORY_LIMIT;
