import { ArrowLeft, CalendarDays, FileHeart, ShieldCheck, UserRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import AyurvedaAssessmentForm from '../components/AyurvedaAssessmentForm.jsx';
import ClinicalReviewPanel from '../components/ClinicalReviewPanel.jsx';
import ClinicalSummaryPanel from '../components/ClinicalSummaryPanel.jsx';
import MedicalDocumentsPanel from '../components/MedicalDocumentsPanel.jsx';
import { api } from '../services/api.js';

const historyFields = [
  ['Chief complaint', 'chiefComplaint'], ['Onset', 'onset'], ['Duration', 'duration'], ['Location', 'location'],
  ['Character', 'character'], ['Severity (patient reported)', 'severity'], ['Timing', 'timing'],
  ['Aggravating factors', 'aggravatingFactors'], ['Relieving factors', 'relievingFactors'],
  ['Associated symptoms', 'associatedSymptoms'], ['Past medical history', 'pastMedicalHistory'],
  ['Surgical history', 'surgicalHistory'], ['Medication history', 'medicationHistory'], ['Allergies', 'allergies'],
  ['Family history', 'familyHistory'], ['Personal history', 'personalHistory'], ['Review of systems', 'reviewOfSystems'],
];

function formatDate(value) {
  if (!value) return 'Not provided';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
}

export default function PatientRecordPage() {
  const { patientId } = useParams();
  const currentUser = useSelector((state) => state.auth.user);
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPatient = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get(`/patients/${encodeURIComponent(patientId)}`);
      setPatient(data.patient);
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not load this patient record.');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { loadPatient(); }, [loadPatient]);
  const canReview = ['doctor', 'administrator'].includes(currentUser?.role);
  const reviewLabel = { pending: 'Pending clinician review', approved: 'Clinician reviewed', revisions_needed: 'Follow-up requested' }[patient?.clinicalReview?.status || 'pending'];

  return <div className="app-root min-h-screen font-sans"><DashboardLayout><header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> <Link to="/patients">Patient records</Link> <span>/</span> <b>{patientId}</b></div></header>
    <div className="page-content records-page"><Link to="/patients" className="record-back"><ArrowLeft size={15} /> All patient records</Link>
      {loading ? <div className="panel admin-loading record-loading"><span className="loading-spinner" /> Loading patient history…</div> : error ? <div className="admin-alert error" role="alert">{error}</div> : patient && <>
        <div className="record-title-row"><div><span className="admin-eyebrow"><FileHeart size={15} /> PATIENT HISTORY</span><h1>{patient.fullName}</h1><p>{patient.patientId} <span>·</span> Patient-reported information · {reviewLabel}</p></div><div className="record-status-stack"><span className={`case-status large ${patient.caseStatus}`}>{patient.caseStatus.replaceAll('_', ' ')}</span><span className={`review-status ${patient.clinicalReview?.status || 'pending'}`}>{reviewLabel}</span></div></div>
        <section className="panel record-summary"><h2><UserRound size={16} /> Patient information</h2><div className="record-info-grid"><div><small>Date of birth</small><b>{formatDate(patient.dateOfBirth)}</b></div><div><small>Gender</small><b>{patient.gender?.replaceAll('_', ' ') || 'Not provided'}</b></div><div><small>Phone</small><b>{patient.phone || 'Not provided'}</b></div><div><small>Email</small><b>{patient.email || 'Not provided'}</b></div><div><small>Preferred language</small><b>{patient.preferredLanguage === 'hi' ? 'Hindi' : patient.preferredLanguage === 'en' ? 'English' : 'Other'}</b></div><div><small>Emergency contact</small><b>{patient.emergencyContact?.name ? `${patient.emergencyContact.name}${patient.emergencyContact.phone ? ` · ${patient.emergencyContact.phone}` : ''}` : 'Not provided'}</b></div>{currentUser?.role !== 'receptionist' && <div><small>ABHA ID</small><b>{patient.abhaId || 'Not provided'}</b></div>}<div><small>Check-in date</small><b>{formatDate(patient.createdAt)}</b></div></div><div className="consent-summary"><ShieldCheck size={15} /><span>Case-taking consent recorded {patient.consent?.recordedAt ? formatDate(patient.consent.recordedAt) : 'not available'}.</span></div></section>
        {patient.consentHistory?.length > 0 && <section className="panel record-history consent-history-panel"><div className="panel-heading"><div><h2><ShieldCheck size={16} /> Consent history</h2><p>Patient consent choices and withdrawals recorded during check-in.</p></div></div><div className="consent-history-list">{patient.consentHistory.slice().reverse().map((entry, index) => <article key={`${entry.recordedAt}-${index}`}><b>{new Date(entry.recordedAt).toLocaleString('en-IN')}</b><span>Case-taking: {entry.caseTaking ? 'granted' : 'withdrawn'}</span><span>Documents: {entry.documentProcessing ? 'granted' : 'withdrawn'}</span><span>AI assistance: {entry.aiAssistance ? 'granted' : 'withdrawn'}</span></article>)}</div></section>}
        {patient.caseHistory ? <section className="panel record-history"><div className="panel-heading"><div><h2><CalendarDays size={16} /> Patient-reported case history</h2><p>These original responses remain unchanged when clinician-verified entries are edited.</p></div></div><div className="history-grid">{historyFields.map(([label, field]) => <article className="history-item" key={field}><small>{label}</small><p>{patient.caseHistory[field] === null || patient.caseHistory[field] === undefined || patient.caseHistory[field] === '' ? 'Not provided' : field === 'severity' ? `${patient.caseHistory[field]} / 10` : patient.caseHistory[field]}</p></article>)}</div><div className="history-timestamp">Last saved: {formatDate(patient.caseHistoryUpdatedAt)}</div></section> : <section className="panel record-history"><div className="admin-empty"><FileHeart size={23} /><b>Patient history is not available in this view</b><span>Reception staff can view registration details. Clinical history is restricted to clinicians.</span></div></section>}
        {canReview && <><MedicalDocumentsPanel patient={patient} onUpdated={loadPatient} /><ClinicalSummaryPanel patient={patient} onUpdated={loadPatient} /><ClinicalReviewPanel patient={patient} onUpdated={loadPatient} /><AyurvedaAssessmentForm patient={patient} onUpdated={loadPatient} /></>}
      </>}
    </div>
  </DashboardLayout></div>;
}
