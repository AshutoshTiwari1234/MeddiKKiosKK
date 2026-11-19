import { AlertCircle, Check, FileCheck, Pill, Plus, Printer, Save, Trash2, UtensilsCrossed } from 'lucide-react';
import { useState } from 'react';
import { api } from '../services/api.js';

const COMMON_DRUGS = [
  { name: 'Paracetamol', dosage: '500 mg', form: 'Tablet', frequency: '1-0-1', duration: '3 days', instructions: 'After food' },
  { name: 'Pantoprazole', dosage: '40 mg', form: 'Tablet', frequency: '1-0-0', duration: '5 days', instructions: '30 mins before breakfast' },
  { name: 'Cetirizine', dosage: '10 mg', form: 'Tablet', frequency: '0-0-1', duration: '5 days', instructions: 'At bedtime' },
  { name: 'Yogaraj Guggulu', dosage: '2 tablets', form: 'Tablet', frequency: '1-0-1', duration: '15 days', instructions: 'After food with lukewarm water' },
  { name: 'Ashwagandha Churna', dosage: '3 g', form: 'Churna', frequency: '0-0-1', duration: '30 days', instructions: 'At bedtime with warm milk' },
  { name: 'Triphala Churna', dosage: '5 g', form: 'Churna', frequency: '0-0-1', duration: '15 days', instructions: 'At bedtime with warm water' },
  { name: 'Dashamularishta', dosage: '20 ml', form: 'Kashaya', frequency: '1-0-1', duration: '15 days', instructions: 'With equal quantity of warm water after meals' },
];

export default function PrescriptionBuilderPanel({ patient, onUpdated }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const currentRx = patient?.prescription || {};
  const [medications, setMedications] = useState(() => currentRx.medications?.length ? currentRx.medications : []);
  const [investigations, setInvestigations] = useState(() => currentRx.investigations?.join(', ') || '');
  const [pathya, setPathya] = useState(() => currentRx.ayushAdvice?.pathya || '');
  const [apathya, setApathya] = useState(() => currentRx.ayushAdvice?.apathya || '');
  const [generalAdvice, setGeneralAdvice] = useState(() => currentRx.generalAdvice || '');
  const [followUpDate, setFollowUpDate] = useState(() => currentRx.followUpDate ? currentRx.followUpDate.split('T')[0] : '');

  const addEmptyMedication = () => {
    setMedications([
      ...medications,
      { name: '', dosage: '', form: 'Tablet', frequency: '1-0-1', duration: '5 days', instructions: 'After food' },
    ]);
  };

  const addPresetDrug = (drug) => {
    setMedications([...medications, { ...drug }]);
  };

  const removeMedication = (index) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const updateMedication = (index, field, value) => {
    const updated = [...medications];
    updated[index][field] = value;
    setMedications(updated);
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const validMeds = medications.filter((m) => m.name.trim().length > 0);
      const invList = investigations.split(',').map((s) => s.trim()).filter(Boolean);

      const payload = {
        medications: validMeds,
        investigations: invList,
        ayushAdvice: {
          pathya: pathya.trim(),
          apathya: apathya.trim(),
        },
        generalAdvice: generalAdvice.trim(),
        followUpDate: followUpDate || null,
      };

      await api.patch(`/patients/${encodeURIComponent(patient.patientId)}/prescription`, payload);
      setSuccess('Prescription & treatment plan saved successfully.');
      onUpdated?.();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save prescription.');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <section className="panel record-history prescription-panel">
      <div className="panel-heading">
        <div>
          <h2><Pill size={16} /> Clinical Prescription &amp; Treatment Plan</h2>
          <p>Verified medications, AYUSH Pathya-Apathya regimens, and diagnostic recommendations.</p>
        </div>
        <div className="rx-head-actions">
          <button type="button" className="button button-secondary compact-btn" onClick={handlePrint} title="Print official prescription">
            <Printer size={14} /> Print Rx Slip
          </button>
        </div>
      </div>

      {error && <div className="admin-alert error" role="alert"><AlertCircle size={15} /> {error}</div>}
      {success && <div className="admin-alert success" role="status"><Check size={15} /> {success}</div>}

      {/* Quick Fast-Add Chips */}
      <div className="rx-fast-chips">
        <span className="fast-chip-label">Quick Add Medicine:</span>
        <div className="fast-chips-scroll">
          {COMMON_DRUGS.map((drug) => (
            <button
              key={drug.name}
              type="button"
              className="rx-fast-chip"
              onClick={() => addPresetDrug(drug)}
            >
              <Plus size={12} /> {drug.name} <small>({drug.dosage})</small>
            </button>
          ))}
        </div>
      </div>

      {/* Medications Table */}
      <div className="rx-table-wrap">
        <table className="rx-table">
          <thead>
            <tr>
              <th style={{ width: '28%' }}>Medicine Name</th>
              <th style={{ width: '15%' }}>Dosage</th>
              <th style={{ width: '14%' }}>Form</th>
              <th style={{ width: '13%' }}>Timing</th>
              <th style={{ width: '12%' }}>Duration</th>
              <th style={{ width: '14%' }}>Instructions</th>
              <th style={{ width: '4%' }}></th>
            </tr>
          </thead>
          <tbody>
            {medications.length === 0 ? (
              <tr>
                <td colSpan="7" className="rx-empty-row">
                  No medications prescribed yet. Tap a quick add chip above or click "Add Medicine".
                </td>
              </tr>
            ) : (
              medications.map((med, idx) => (
                <tr key={idx}>
                  <td>
                    <input
                      type="text"
                      className="rx-cell-input"
                      placeholder="e.g. Yogaraj Guggulu"
                      value={med.name}
                      onChange={(e) => updateMedication(idx, 'name', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="rx-cell-input"
                      placeholder="e.g. 500mg or 2 tabs"
                      value={med.dosage}
                      onChange={(e) => updateMedication(idx, 'dosage', e.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      className="rx-cell-select"
                      value={med.form}
                      onChange={(e) => updateMedication(idx, 'form', e.target.value)}
                    >
                      <option value="Tablet">Tablet</option>
                      <option value="Capsule">Capsule</option>
                      <option value="Syrup">Syrup</option>
                      <option value="Churna">Churna (Powder)</option>
                      <option value="Kashaya">Kashaya (Decoction)</option>
                      <option value="Taila">Taila (Oil)</option>
                      <option value="Ointment">Ointment</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      className="rx-cell-input"
                      placeholder="1-0-1"
                      value={med.frequency}
                      onChange={(e) => updateMedication(idx, 'frequency', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="rx-cell-input"
                      placeholder="5 days"
                      value={med.duration}
                      onChange={(e) => updateMedication(idx, 'duration', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="rx-cell-input"
                      placeholder="After food"
                      value={med.instructions}
                      onChange={(e) => updateMedication(idx, 'instructions', e.target.value)}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="rx-del-btn"
                      onClick={() => removeMedication(idx)}
                      title="Remove medicine"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rx-table-footer">
        <button type="button" className="text-button" onClick={addEmptyMedication}>
          <Plus size={15} /> Add Another Medicine
        </button>
      </div>

      {/* AYUSH Dietary Advice & Investigations */}
      <div className="rx-extra-grid">
        <div className="rx-advice-card">
          <label className="rx-block-label">
            <UtensilsCrossed size={14} /> <span>AYUSH Pathya (Recommended Diet &amp; Regimen)</span>
          </label>
          <textarea
            rows={2}
            className="rx-textarea"
            placeholder="e.g. Lukewarm water, light Khichdi, fresh green vegetables, gentle walking..."
            value={pathya}
            onChange={(e) => setPathya(e.target.value)}
          />
        </div>

        <div className="rx-advice-card">
          <label className="rx-block-label">
            <UtensilsCrossed size={14} /> <span>AYUSH Apathya (Dietary &amp; Habit Restrictions)</span>
          </label>
          <textarea
            rows={2}
            className="rx-textarea"
            placeholder="e.g. Curd at night, heavy fried food, cold drinks, direct cold wind exposure..."
            value={apathya}
            onChange={(e) => setApathya(e.target.value)}
          />
        </div>
      </div>

      <div className="rx-bottom-grid">
        <label className="rx-block-label-full">
          <span>Diagnostic Investigations / Lab Tests</span>
          <input
            type="text"
            className="rx-full-input"
            placeholder="e.g. CBC, ESR, Serum Uric Acid, Bilateral Knee X-Ray (AP/Lat)"
            value={investigations}
            onChange={(e) => setInvestigations(e.target.value)}
          />
        </label>

        <div className="rx-followup-row">
          <label className="rx-block-label-full flex-1">
            <span>General Advice &amp; Warning Signs</span>
            <input
              type="text"
              className="rx-full-input"
              placeholder="e.g. Adequate rest, avoid lifting heavy weights, review immediately if severe swelling appears"
              value={generalAdvice}
              onChange={(e) => setGeneralAdvice(e.target.value)}
            />
          </label>

          <label className="rx-block-label-full follow-date-field">
            <span>Next Follow-Up Date</span>
            <input
              type="date"
              className="rx-date-input"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="rx-save-actions">
        <button type="button" className="button button-primary" onClick={handleSave} disabled={saving}>
          <Save size={15} /> {saving ? 'Saving Treatment Plan…' : 'Save Prescription & Treatment Plan'}
        </button>
      </div>

      {/* Official OPD Prescription Slip for Printing */}
      <div className="printable-prescription-doc" aria-hidden="true">
        <div className="rx-print-header">
          <div className="rx-print-hospital">
            <h1>MEDIKIOSK HEALTH CENTRE</h1>
            <p>Smart OPD &amp; Integrated AYUSH Care System · Government Hospital OPD</p>
            <small>Phone: +91 11 2345 6789 · Email: opd@medikiosk.gov.in · New Delhi, India</small>
          </div>
          <div className="rx-print-date">
            <b>Date: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</b>
            <span>Token: {patient?.queueToken || 'OPD-101'}</span>
          </div>
        </div>

        <div className="rx-print-patient-bar">
          <div><b>Patient:</b> {patient?.fullName} ({patient?.gender}, {patient?.dateOfBirth ? `${new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()}y` : 'Adult'})</div>
          <div><b>Patient ID:</b> {patient?.patientId}</div>
          <div><b>Department:</b> {patient?.department || 'General Medicine'}</div>
          <div><b>Room:</b> {patient?.roomNumber || 'Room 1'}</div>
        </div>

        {patient?.vitals?.bloodPressure?.systolic && (
          <div className="rx-print-vitals-bar">
            <span>BP: {patient.vitals.bloodPressure.systolic}/{patient.vitals.bloodPressure.diastolic} mmHg</span>
            <span>Pulse: {patient.vitals.pulseRate} bpm</span>
            <span>SpO2: {patient.vitals.spo2}%</span>
            <span>Temp: {patient.vitals.temperature}°F</span>
            <span>BMI: {patient.vitals.bmi || '—'}</span>
          </div>
        )}

        <div className="rx-print-symbol">℞</div>

        <table className="rx-print-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Medication Name</th>
              <th>Dosage</th>
              <th>Form</th>
              <th>Frequency</th>
              <th>Duration</th>
              <th>Instructions</th>
            </tr>
          </thead>
          <tbody>
            {medications.map((m, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td><b>{m.name}</b></td>
                <td>{m.dosage}</td>
                <td>{m.form}</td>
                <td>{m.frequency}</td>
                <td>{m.duration}</td>
                <td>{m.instructions}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {pathya && (
          <div className="rx-print-advice">
            <b>Pathya (Dietary Regimen):</b> {pathya}
          </div>
        )}

        {apathya && (
          <div className="rx-print-advice">
            <b>Apathya (Strict Restrictions):</b> {apathya}
          </div>
        )}

        {investigations && (
          <div className="rx-print-advice">
            <b>Recommended Tests:</b> {investigations}
          </div>
        )}

        <div className="rx-print-signature-row">
          <div>
            <b>Next Follow-Up:</b> {followUpDate ? new Date(followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'As needed / 7 days'}
          </div>
          <div className="rx-doctor-sign">
            <div className="sign-line" />
            <b>Treating Clinician / Medical Officer</b>
            <small>Verified Digital Prescription · MediKiosk OPD</small>
          </div>
        </div>
      </div>
    </section>
  );
}
