import { zodResolver } from '@hookform/resolvers/zod';
import { Check, ClipboardCheck, LoaderCircle, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { clinicalReviewSchema } from '../schemas/clinicalReviewSchema.js';
import { api } from '../services/api.js';

const fields = [
  ['Chief complaint', 'chiefComplaint', 2], ['Onset', 'onset', 1], ['Duration', 'duration', 1], ['Location', 'location', 1],
  ['Character', 'character', 2], ['Severity (0–10)', 'severity', 0], ['Timing', 'timing', 1],
  ['Aggravating factors', 'aggravatingFactors', 1], ['Relieving factors', 'relievingFactors', 1], ['Associated symptoms', 'associatedSymptoms', 2],
  ['Past medical history', 'pastMedicalHistory', 2], ['Surgical history', 'surgicalHistory', 2], ['Medication history', 'medicationHistory', 2],
  ['Allergies', 'allergies', 2], ['Family history', 'familyHistory', 2], ['Personal history', 'personalHistory', 2], ['Review of systems', 'reviewOfSystems', 2],
];

function initialValues(patient) {
  const original = patient.caseHistory || {};
  const verified = patient.clinicalReview?.verifiedHistory || {};
  return {
    doctorNotes: patient.clinicalReview?.doctorNotes || '',
    verifiedHistory: Object.fromEntries(fields.map(([, field]) => [field, verified[field] ?? original[field] ?? (field === 'severity' ? null : '')])),
  };
}

export default function ClinicalReviewPanel({ patient, onUpdated }) {
  const [savingStatus, setSavingStatus] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(clinicalReviewSchema), defaultValues: initialValues(patient) });

  useEffect(() => { reset(initialValues(patient)); }, [patient, reset]);

  const save = async (values, status) => {
    setSavingStatus(status);
    setError('');
    setNotice('');
    try {
      await api.patch(`/patients/${encodeURIComponent(patient.patientId)}/clinical-review`, { ...values, status });
      setNotice(status === 'approved' ? 'History approved and marked as clinician reviewed.' : status === 'revisions_needed' ? 'Follow-up was requested for this history.' : 'Review changes saved as a draft.');
      await onUpdated();
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not save the clinical review.');
    } finally {
      setSavingStatus('');
    }
  };

  const reviewStatus = patient.clinicalReview?.status || 'pending';
  const statusLabel = { pending: 'Pending review', approved: 'Clinician reviewed', revisions_needed: 'Follow-up requested' }[reviewStatus];

  return <section className="panel review-panel"><div className="panel-heading"><div><h2><ClipboardCheck size={16} /> Clinician review</h2><p>Patient responses remain preserved separately from verified entries.</p></div><span className={`review-status ${reviewStatus}`}>{statusLabel}</span></div>
    {error && <div className="admin-alert error" role="alert">{error}</div>}{notice && <div className="admin-alert success" role="status"><Check size={15} />{notice}</div>}
    <form onSubmit={(event) => { event.preventDefault(); handleSubmit((values) => save(values, 'pending'))(); }}>
      <div className="review-fields">{fields.map(([label, field, rows]) => {
        const reported = patient.caseHistory?.[field];
        return <div className="review-field-row" key={field}><div className="review-reported"><small>Patient reported · {label}</small><p>{reported === null || reported === undefined || reported === '' ? 'Not provided' : field === 'severity' ? `${reported} / 10` : reported}</p></div><label className="review-verified" htmlFor={`verified-${field}`}><span>Clinician verified</span>{rows === 0 ? <input id={`verified-${field}`} type="number" min="0" max="10" {...register(`verifiedHistory.${field}`, { setValueAs: (value) => value === '' ? null : Number(value) })} /> : rows === 1 ? <input id={`verified-${field}`} type="text" {...register(`verifiedHistory.${field}`)} /> : <textarea id={`verified-${field}`} rows={2} {...register(`verifiedHistory.${field}`)} />}{errors.verifiedHistory?.[field] && <small className="form-field-error">{errors.verifiedHistory[field].message}</small>}</label></div>;
      })}</div>
      <label className="review-notes" htmlFor="doctor-notes"><span>Clinician notes</span><textarea id="doctor-notes" rows={3} maxLength={3000} placeholder="Add context for the care team…" {...register('doctorNotes')} /></label>
      <div className="review-actions"><span className="review-audit-note">Your review action is recorded in the audit log.</span><div><button className="button button-secondary" type="button" disabled={Boolean(savingStatus)} onClick={handleSubmit((values) => save(values, 'revisions_needed'))}><RotateCcw size={14} /> Request follow-up</button><button className="button button-secondary" type="submit" disabled={Boolean(savingStatus)}>{savingStatus === 'pending' ? <LoaderCircle size={14} className="spin" /> : null} Save draft</button><button className="button button-primary" type="button" disabled={Boolean(savingStatus) || patient.caseStatus !== 'completed'} onClick={handleSubmit((values) => save(values, 'approved'))}>{savingStatus === 'approved' ? <LoaderCircle size={14} className="spin" /> : <Check size={15} />} Approve history</button></div></div>
      {patient.caseStatus !== 'completed' && <small className="review-hint">Complete the patient’s check-in before approving the history.</small>}
    </form>
    {patient.clinicalReview?.history?.length > 0 && <div className="review-versions"><h3>Previous review versions</h3>{[...patient.clinicalReview.history].reverse().map((version, index) => <article key={`${version.changedAt}-${index}`}><div><b>{version.status.replaceAll('_', ' ')}</b><small>{version.changedAt ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(version.changedAt)) : 'Date unavailable'}</small></div><p>{version.doctorNotes || version.verifiedHistory?.chiefComplaint || 'Review saved'}</p></article>)}</div>}
  </section>;
}
