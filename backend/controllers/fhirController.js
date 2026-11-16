const Patient = require('../models/Patient');
const AppError = require('../utils/AppError');
const { recordAudit } = require('../services/auditService');
const { randomUUID } = require('node:crypto');

function toFhirPatient(patient) {
  const resource = {
    resourceType: 'Patient',
    id: patient.patientId,
    identifier: [{ system: 'urn:medikiosk:patient-id', value: patient.patientId }],
    name: [{ text: patient.fullName }],
    gender: ['female', 'male', 'other'].includes(patient.gender) ? patient.gender : 'unknown',
  };
  if (patient.dateOfBirth) resource.birthDate = patient.dateOfBirth.toISOString().slice(0, 10);
  if (patient.phone) resource.telecom = [{ system: 'phone', value: patient.phone, use: 'mobile' }];
  return resource;
}

async function exportFhirBundle(request, response) {
  const patient = await Patient.findOne({ patientId: request.params.patientId });
  if (!patient) throw new AppError('Patient record not found.', 404);
  if (patient.caseStatus !== 'completed' || patient.clinicalSummary.status !== 'approved') {
    throw new AppError('Complete intake and approve the clinical summary before exporting.', 409);
  }

  const patientResource = toFhirPatient(patient);
  const patientReference = `urn:uuid:${randomUUID()}`;
  const documentReference = `urn:uuid:${randomUUID()}`;
  const note = {
    resourceType: 'DocumentReference',
    id: `${patient.patientId}-summary`,
    status: 'current',
    docStatus: 'final',
    type: { coding: [{ system: 'http://loinc.org', code: '34117-2', display: 'History and physical note' }] },
    subject: { reference: patientReference },
    date: (patient.clinicalSummary.approvedAt || patient.clinicalSummary.updatedAt || new Date()).toISOString(),
    content: [{ attachment: {
      contentType: 'text/plain; charset=utf-8',
      language: patient.preferredLanguage === 'hi' ? 'hi' : 'en',
      title: 'Clinician-approved MediKiosk clinical history summary',
      data: Buffer.from(patient.clinicalSummary.text, 'utf8').toString('base64'),
    } }],
  };
  const bundle = {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: [
      { fullUrl: patientReference, resource: patientResource },
      { fullUrl: documentReference, resource: note },
    ],
  };
  await recordAudit(request, { action: 'patient.fhir.export', resourceType: 'patient', resourceId: patient.patientId });
  response.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
  response.setHeader('Content-Disposition', `attachment; filename="${patient.patientId}-fhir-r4.json"`);
  response.json(bundle);
}

module.exports = { exportFhirBundle };
