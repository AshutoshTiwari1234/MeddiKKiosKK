import { Activity, AlertCircle, Check, Edit3, Heart, Save, Scale, Thermometer, Wind } from 'lucide-react';
import { useState } from 'react';
import { api } from '../services/api.js';

export function getBmiCategory(bmi) {
  if (!bmi || Number.isNaN(bmi)) return null;
  const val = Number(bmi);
  if (val < 18.5) return { label: 'Underweight', tone: 'blue', desc: '< 18.5' };
  if (val < 25) return { label: 'Normal Weight', tone: 'teal', desc: '18.5 – 24.9' };
  if (val < 30) return { label: 'Overweight', tone: 'amber', desc: '25.0 – 29.9' };
  return { label: 'Obese', tone: 'rose', desc: '≥ 30.0' };
}

export function getBpCategory(systolic, diastolic) {
  if (!systolic || !diastolic) return null;
  const sys = Number(systolic);
  const dia = Number(diastolic);
  if (sys < 120 && dia < 80) return { label: 'Normal BP', tone: 'teal' };
  if (sys <= 129 && dia < 80) return { label: 'Elevated BP', tone: 'amber' };
  if (sys <= 139 || dia <= 89) return { label: 'Stage 1 HTN', tone: 'orange' };
  return { label: 'Stage 2 HTN', tone: 'rose' };
}

export default function TriageVitalsPanel({ patient, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const currentVitals = patient?.vitals || {};
  const [form, setForm] = useState({
    systolic: currentVitals.bloodPressure?.systolic ?? '',
    diastolic: currentVitals.bloodPressure?.diastolic ?? '',
    pulseRate: currentVitals.pulseRate ?? '',
    spo2: currentVitals.spo2 ?? '',
    temperature: currentVitals.temperature ?? '',
    weight: currentVitals.weight ?? '',
    height: currentVitals.height ?? '',
  });

  const bmiCalc = form.weight && form.height
    ? Number((Number(form.weight) / ((Number(form.height) / 100) ** 2)).toFixed(1))
    : currentVitals.bmi;

  const bmiInfo = getBmiCategory(bmiCalc);
  const bpInfo = getBpCategory(
    editing ? form.systolic : currentVitals.bloodPressure?.systolic,
    editing ? form.diastolic : currentVitals.bloodPressure?.diastolic
  );

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        bloodPressure: {
          systolic: form.systolic ? Number(form.systolic) : null,
          diastolic: form.diastolic ? Number(form.diastolic) : null,
        },
        pulseRate: form.pulseRate ? Number(form.pulseRate) : null,
        spo2: form.spo2 ? Number(form.spo2) : null,
        temperature: form.temperature ? Number(form.temperature) : null,
        weight: form.weight ? Number(form.weight) : null,
        height: form.height ? Number(form.height) : null,
      };

      await api.patch(`/patients/${encodeURIComponent(patient.patientId)}/vitals`, payload);
      setSuccess('Vitals updated successfully.');
      setEditing(false);
      onUpdated?.();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save vitals.');
    } finally {
      setSaving(false);
    }
  };

  const hasAnyVitals = currentVitals.pulseRate || currentVitals.bloodPressure?.systolic || currentVitals.spo2 || currentVitals.temperature || currentVitals.weight;

  return (
    <section className="panel record-history triage-vitals-panel">
      <div className="panel-heading">
        <div>
          <h2><Activity size={16} /> Patient Triage Vitals</h2>
          <p>Objective clinical baseline recorded at reception or OPD nursing station.</p>
        </div>
        {!editing ? (
          <button type="button" className="button button-secondary compact-btn" onClick={() => setEditing(true)}>
            <Edit3 size={14} /> {hasAnyVitals ? 'Update Vitals' : 'Record Vitals'}
          </button>
        ) : (
          <button type="button" className="text-button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
      </div>

      {error && <div className="admin-alert error" role="alert"><AlertCircle size={15} /> {error}</div>}
      {success && <div className="admin-alert success" role="status"><Check size={15} /> {success}</div>}

      {!editing ? (
        <div className="vitals-display-grid">
          {/* BP */}
          <article className="vitals-card">
            <div className="vitals-card-top">
              <span>Blood Pressure</span>
              <Heart size={16} className="vitals-icon text-rose" />
            </div>
            <div className="vitals-val">
              {currentVitals.bloodPressure?.systolic && currentVitals.bloodPressure?.diastolic
                ? `${currentVitals.bloodPressure.systolic}/${currentVitals.bloodPressure.diastolic}`
                : '—'}
              <small>mmHg</small>
            </div>
            {bpInfo && <span className={`vitals-badge ${bpInfo.tone}`}>{bpInfo.label}</span>}
          </article>

          {/* Pulse */}
          <article className="vitals-card">
            <div className="vitals-card-top">
              <span>Pulse Rate</span>
              <Activity size={16} className="vitals-icon text-amber" />
            </div>
            <div className="vitals-val">
              {currentVitals.pulseRate || '—'}
              <small>bpm</small>
            </div>
            <span className="vitals-foot">Normal: 60 - 100</span>
          </article>

          {/* SpO2 */}
          <article className="vitals-card">
            <div className="vitals-card-top">
              <span>SpO₂ (Oxygen)</span>
              <Wind size={16} className="vitals-icon text-teal" />
            </div>
            <div className="vitals-val">
              {currentVitals.spo2 ? `${currentVitals.spo2}%` : '—'}
            </div>
            <span className="vitals-foot">{currentVitals.spo2 >= 95 ? 'Normal (≥95%)' : currentVitals.spo2 ? 'Attention Needed' : 'Normal ≥95%'}</span>
          </article>

          {/* Temperature */}
          <article className="vitals-card">
            <div className="vitals-card-top">
              <span>Body Temp</span>
              <Thermometer size={16} className="vitals-icon text-orange" />
            </div>
            <div className="vitals-val">
              {currentVitals.temperature ? `${currentVitals.temperature}°` : '—'}
              <small>°F</small>
            </div>
            <span className="vitals-foot">Baseline: 98.6°F</span>
          </article>

          {/* Weight & Height / BMI */}
          <article className="vitals-card vitals-card-wide">
            <div className="vitals-card-top">
              <span>Body Mass Index (BMI)</span>
              <Scale size={16} className="vitals-icon text-blue" />
            </div>
            <div className="vitals-val">
              {currentVitals.bmi ? currentVitals.bmi : '—'}
              <small>kg/m²</small>
            </div>
            <div className="vitals-extra-line">
              <span>Weight: {currentVitals.weight ? `${currentVitals.weight} kg` : 'Not provided'}</span>
              <span>·</span>
              <span>Height: {currentVitals.height ? `${currentVitals.height} cm` : 'Not provided'}</span>
            </div>
            {bmiInfo && <span className={`vitals-badge ${bmiInfo.tone}`}>{bmiInfo.label} ({bmiInfo.desc})</span>}
          </article>
        </div>
      ) : (
        <form onSubmit={handleSave} className="vitals-edit-form">
          <div className="vitals-form-grid">
            <label className="vitals-field">
              <span>Systolic BP (mmHg)</span>
              <input
                type="number"
                placeholder="120"
                min="50"
                max="260"
                value={form.systolic}
                onChange={(e) => setForm({ ...form, systolic: e.target.value })}
              />
            </label>

            <label className="vitals-field">
              <span>Diastolic BP (mmHg)</span>
              <input
                type="number"
                placeholder="80"
                min="30"
                max="160"
                value={form.diastolic}
                onChange={(e) => setForm({ ...form, diastolic: e.target.value })}
              />
            </label>

            <label className="vitals-field">
              <span>Pulse Rate (bpm)</span>
              <input
                type="number"
                placeholder="72"
                min="30"
                max="220"
                value={form.pulseRate}
                onChange={(e) => setForm({ ...form, pulseRate: e.target.value })}
              />
            </label>

            <label className="vitals-field">
              <span>SpO₂ (%)</span>
              <input
                type="number"
                placeholder="98"
                min="60"
                max="100"
                value={form.spo2}
                onChange={(e) => setForm({ ...form, spo2: e.target.value })}
              />
            </label>

            <label className="vitals-field">
              <span>Temperature (°F)</span>
              <input
                type="number"
                step="0.1"
                placeholder="98.6"
                min="85"
                max="110"
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: e.target.value })}
              />
            </label>

            <label className="vitals-field">
              <span>Weight (kg)</span>
              <input
                type="number"
                step="0.5"
                placeholder="68"
                min="2"
                max="300"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
              />
            </label>

            <label className="vitals-field">
              <span>Height (cm)</span>
              <input
                type="number"
                placeholder="172"
                min="40"
                max="250"
                value={form.height}
                onChange={(e) => setForm({ ...form, height: e.target.value })}
              />
            </label>

            <div className="vitals-field vitals-preview-box">
              <span>Calculated BMI</span>
              <strong>{bmiCalc ? `${bmiCalc} kg/m²` : 'Enter weight & height'}</strong>
              {bmiInfo && <small className={`bmi-tag ${bmiInfo.tone}`}>{bmiInfo.label}</small>}
            </div>
          </div>

          <div className="vitals-form-actions">
            <button type="button" className="text-button" onClick={() => setEditing(false)}>Cancel</button>
            <button type="submit" className="button button-primary" disabled={saving}>
              <Save size={15} /> {saving ? 'Saving Vitals…' : 'Save Vitals'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
