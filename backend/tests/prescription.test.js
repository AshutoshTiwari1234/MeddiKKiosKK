const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { checkDrugInteractions, normalizeDrugName } = require('../services/interactionService');
const { prescriptionInputSchema, interactionCheckSchema } = require('../schemas/patientSchemas');
const Patient = require('../models/Patient');

test('normalizeDrugName trims and lowercases medication names', () => {
  assert.equal(normalizeDrugName('  Aspirin 500mg '), 'aspirin 500mg');
  assert.equal(normalizeDrugName('Warfarin Sodium'), 'warfarin sodium');
});

test('checkDrugInteractions flags critical Aspirin + Warfarin bleeding risk', () => {
  const warnings = checkDrugInteractions(['Aspirin 75mg', 'Warfarin 5mg']);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].severity, 'critical');
  assert.ok(warnings[0].description.includes('bleeding'));
  assert.ok(warnings[0].actionRequired.length > 0);
});

test('checkDrugInteractions flags critical Ibuprofen + Warfarin combination', () => {
  const warnings = checkDrugInteractions([
    { name: 'Ibuprofen 400mg', dosage: '400mg' },
    { name: 'Warfarin 2mg', dosage: '2mg' },
  ]);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].severity, 'critical');
});

test('checkDrugInteractions flags Sildenafil + Nitroglycerin fatal hypotension', () => {
  const warnings = checkDrugInteractions(['Sildenafil 50mg', 'Nitroglycerin sublingual']);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].severity, 'critical');
  assert.ok(warnings[0].description.includes('hypotension'));
});

test('checkDrugInteractions detects AYUSH herb-drug interactions', () => {
  // Ashwagandha + Diazepam
  const ashwaWarnings = checkDrugInteractions(['Ashwagandha Churna', 'Diazepam 5mg']);
  assert.equal(ashwaWarnings.length, 1);
  assert.equal(ashwaWarnings[0].severity, 'moderate');
  assert.ok(ashwaWarnings[0].description.includes('sedative'));

  // Ginkgo + Warfarin
  const ginkgoWarnings = checkDrugInteractions(['Ginkgo Biloba extract', 'Warfarin 5mg']);
  assert.equal(ginkgoWarnings.length, 1);
  assert.equal(ginkgoWarnings[0].severity, 'major');

  // Licorice + Enalapril
  const licoriceWarnings = checkDrugInteractions(['Licorice (Yashtimadhu)', 'Enalapril 10mg']);
  assert.equal(licoriceWarnings.length, 1);
  assert.equal(licoriceWarnings[0].severity, 'major');
});

test('checkDrugInteractions returns empty array for safe combinations', () => {
  const safe = checkDrugInteractions(['Paracetamol 650mg', 'Amoxicillin 500mg']);
  assert.equal(safe.length, 0);
});

test('prescriptionInputSchema requires at least one medication and validates fields', () => {
  assert.throws(() => prescriptionInputSchema.parse({ medications: [] }));
  assert.throws(() => prescriptionInputSchema.parse({ medications: [{ name: '' }] }));

  const valid = prescriptionInputSchema.parse({
    medications: [{
      name: 'Amoxicillin 500mg',
      dosage: '500mg',
      frequency: 'TDS',
      duration: '5 days',
      instructions: 'After food',
    }],
    instructions: 'Complete the entire course.',
  });

  assert.equal(valid.medications.length, 1);
  assert.equal(valid.medications[0].name, 'Amoxicillin 500mg');
  assert.equal(valid.instructions, 'Complete the entire course.');
});

test('Prescription model preserves previous version in history array upon update', () => {
  const patient = new Patient({
    fullName: 'Prescription Test Patient',
    preferredLanguage: 'en',
    consent: { caseTaking: true, documentProcessing: false, aiAssistance: false },
    prescription: {
      version: 1,
      medications: [{ name: 'Aspirin 75mg', dosage: '75mg', frequency: 'OD', duration: '30 days' }],
      instructions: 'Take in the morning',
      warnings: [],
      prescribedBy: new mongoose.Types.ObjectId(),
      prescribedAt: new Date('2026-11-01T10:00:00Z'),
      history: [],
    },
  });

  assert.equal(patient.prescription.version, 1);
  assert.equal(patient.prescription.history.length, 0);

  // Simulate updating prescription: push previous version to history
  patient.prescription.history.push({
    version: patient.prescription.version,
    medications: patient.prescription.medications,
    instructions: patient.prescription.instructions,
    warnings: patient.prescription.warnings,
    prescribedBy: patient.prescription.prescribedBy,
    prescribedAt: patient.prescription.prescribedAt,
  });

  // Update current prescription
  patient.prescription.version = 2;
  patient.prescription.medications = [
    { name: 'Clopidogrel 75mg', dosage: '75mg', frequency: 'OD', duration: '30 days' },
  ];
  patient.prescription.instructions = 'Switched from Aspirin due to gastric intolerance.';
  patient.prescription.prescribedAt = new Date('2026-11-19T10:00:00Z');

  assert.equal(patient.prescription.version, 2);
  assert.equal(patient.prescription.history.length, 1);
  assert.equal(patient.prescription.history[0].version, 1);
  assert.equal(patient.prescription.history[0].medications[0].name, 'Aspirin 75mg');
  assert.equal(patient.prescription.medications[0].name, 'Clopidogrel 75mg');
});
