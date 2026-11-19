import { Download, FileText, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { useToast } from './ToastProvider.jsx';

const categoryLabels = {
  prescription: 'Prescription',
  lab_report: 'Laboratory report',
  discharge_summary: 'Discharge summary',
  other: 'Other document',
};

export default function MedicalDocumentsPanel({ patient, onUpdated }) {
  const toast = useToast();
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState('');
  const documents = patient.documents || [];

  useEffect(() => {
    setDrafts(Object.fromEntries(documents.map((document) => [document._id, {
      text: document.reviewedText || document.extractedText || '',
      notes: document.reviewNotes || '',
    }])));
  }, [patient.documents]);

  const downloadOriginal = async (document) => {
    setBusyId(document._id);
    try {
      const { data } = await api.get(`/patients/${encodeURIComponent(patient.patientId)}/documents/${document._id}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.originalName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      toast.error(requestError.response?.data?.error?.message || 'Could not download the original document.');
    } finally {
      setBusyId('');
    }
  };

  const saveReview = async (document, reviewStatus) => {
    setBusyId(document._id);
    try {
      const draft = drafts[document._id] || { text: '', notes: '' };
      await api.patch(`/patients/${encodeURIComponent(patient.patientId)}/documents/${document._id}/review`, {
        reviewedText: draft.text,
        reviewNotes: draft.notes,
        reviewStatus,
      });
      toast.success('Document review saved.');
      await onUpdated();
    } catch (requestError) {
      toast.error(requestError.response?.data?.error?.message || 'Could not save the document review.');
    } finally {
      setBusyId('');
    }
  };

  return <section className="panel medical-documents-panel">
    <div className="panel-heading"><div><h2><FileText size={16} /> Previous medical documents</h2><p>Original uploads are retained. OCR text is a draft and must be checked against the source.</p></div><span className="document-count">{documents.length} {documents.length === 1 ? 'document' : 'documents'}</span></div>
    {!documents.length ? <div className="admin-empty document-empty"><FileText size={20} /><b>No documents uploaded</b><span>Documents appear here after a patient consents to document processing and uploads a file.</span></div> : <div className="medical-document-list">{documents.map((document) => {
      const draft = drafts[document._id] || { text: '', notes: '' };
      return <article className="medical-document-card" key={document._id}>
        <div className="medical-document-header"><div><span className={`document-review-badge ${document.reviewStatus}`}>{document.reviewStatus === 'reviewed' ? 'Clinician reviewed' : 'Review required'}</span><h3>{document.originalName}</h3><p>{categoryLabels[document.category] || 'Medical document'} <span>·</span> {(document.sizeBytes / 1024).toFixed(0)} KB <span>·</span> {new Date(document.createdAt).toLocaleDateString('en-IN')}</p></div><button type="button" className="document-download-button" disabled={busyId === document._id} onClick={() => downloadOriginal(document)}><Download size={15} /> Original</button></div>
        <div className="ocr-status-line"><span className={`ocr-status-dot ${document.ocrStatus}`} /> OCR: {document.ocrStatus}{document.ocrMessage ? ` — ${document.ocrMessage}` : ''}</div>
        {(document.extractionCandidates?.dates?.length > 0 || document.extractionCandidates?.measurementLines?.length > 0) && <div className="ocr-candidates"><b>Text candidates · verify against original</b>{document.extractionCandidates.dates?.length > 0 && <p>Dates: {document.extractionCandidates.dates.join(', ')}</p>}{document.extractionCandidates.measurementLines?.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}</div>}
        <label className="document-text-label">Extracted text · editable for clinician correction<textarea rows={7} maxLength={20000} value={draft.text} onChange={(event) => setDrafts((current) => ({ ...current, [document._id]: { ...draft, text: event.target.value } }))} placeholder="OCR text will appear here when extraction is available. You can transcribe or correct it after checking the original." /></label>
        <label className="document-text-label">Clinician review notes<textarea rows={2} maxLength={2000} value={draft.notes} onChange={(event) => setDrafts((current) => ({ ...current, [document._id]: { ...draft, notes: event.target.value } }))} placeholder="Optional note about the source document" /></label>
        <div className="document-review-actions"><span><ShieldCheck size={14} /> {document.reviewedAt ? `Last reviewed ${new Date(document.reviewedAt).toLocaleString('en-IN')}` : 'Not yet verified'}</span><div><button type="button" className="review-button secondary" disabled={busyId === document._id} onClick={() => saveReview(document, 'pending')}>{busyId === document._id ? 'Saving…' : 'Save draft'}</button><button type="button" className="review-button primary" disabled={busyId === document._id} onClick={() => saveReview(document, 'reviewed')}>{busyId === document._id ? 'Saving…' : 'Mark reviewed'}</button></div></div>
      </article>;
    })}</div>}
  </section>;
}
