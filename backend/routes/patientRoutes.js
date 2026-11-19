const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { downloadPatientDocument, getPatientDocument, reviewPatientDocument, uploadPatientDocument } = require('../controllers/documentController');
const { generateClinicalSummary, updateClinicalSummary } = require('../controllers/summaryController');
const { getConversationReply, getPatient, getPatientAuditLogs, listPatients, registerPatient, saveIntakeProgress, searchPatients, updateAyurvedaAssessment, updateClinicalReview, updateIntakeConsent } = require('../controllers/patientController');
const { exportFhirBundle } = require('../controllers/fhirController');
const { authenticate, requireRole } = require('../middleware/authenticate');
const authorizeDocumentIntake = require('../middleware/authorizeDocumentIntake');
const { uploadDocument } = require('../middleware/documentUpload');
const requireDatabase = require('../middleware/requireDatabase');
const requireIntakeToken = require('../middleware/requireIntakeToken');
const validate = require('../middleware/validate');
const { ayurvedaAssessmentSchema, caseHistoryPatchSchema, clinicalReviewSchema, clinicalSummarySchema, consentUpdateSchema, conversationSchema, documentReviewSchema, patientSearchSchema, registrationSchema } = require('../schemas/patientSchemas');

const router = express.Router();
const registrationLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
const documentUploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });

router.use(requireDatabase);
router.post('/register', registrationLimiter, validate(registrationSchema), registerPatient);
router.post('/intake/conversation', requireIntakeToken, validate(conversationSchema), getConversationReply);
router.patch('/intake/consent', requireIntakeToken, validate(consentUpdateSchema), updateIntakeConsent);
router.post('/intake/documents', documentUploadLimiter, requireIntakeToken, authorizeDocumentIntake, uploadDocument.single('document'), uploadPatientDocument);
router.patch('/intake/case-history', requireIntakeToken, validate(caseHistoryPatchSchema), saveIntakeProgress);

router.use(authenticate, requireRole('administrator', 'doctor', 'receptionist'));
router.get('/', listPatients);
router.post('/search', validate(patientSearchSchema), searchPatients);
router.get('/:patientId', getPatient);
router.get('/:patientId/audit-logs', requireRole('administrator', 'doctor'), getPatientAuditLogs);
router.get('/:patientId/fhir-r4', requireRole('administrator', 'doctor'), exportFhirBundle);
router.post('/:patientId/summary/generate', requireRole('administrator', 'doctor'), generateClinicalSummary);
router.patch('/:patientId/summary', requireRole('administrator', 'doctor'), validate(clinicalSummarySchema), updateClinicalSummary);
router.get('/:patientId/documents/:documentId/file', requireRole('administrator', 'doctor'), downloadPatientDocument);
router.get('/:patientId/documents/:documentId', requireRole('administrator', 'doctor'), getPatientDocument);
router.patch('/:patientId/documents/:documentId/review', requireRole('administrator', 'doctor'), validate(documentReviewSchema), reviewPatientDocument);
router.patch('/:patientId/clinical-review', requireRole('administrator', 'doctor'), validate(clinicalReviewSchema), updateClinicalReview);
router.patch('/:patientId/ayurveda', requireRole('administrator', 'doctor'), validate(ayurvedaAssessmentSchema), updateAyurvedaAssessment);

module.exports = router;
