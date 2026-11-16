import { ClipboardCheck, Download, FileText, WandSparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

export default function ClinicalSummaryPanel({ patient, onUpdated }) {
  const summary = patient.clinicalSummary || {};
  const [text, setText] = useState(summary.text || '');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => setText(patient.clinicalSummary?.text || ''), [patient.clinicalSummary?.text]);

  const generate = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.post(`/patients/${encodeURIComponent(patient.patientId)}/summary/generate`);
      setText(data.clinicalSummary.text);
      setNotice(data.clinicalSummary.generationMode === 'llm' ? 'An AI-generated draft is ready. Verify and edit every section before approval.' : 'A structured draft was assembled. Review and edit it before approval.');
      await onUpdated();
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not assemble the summary.');
    } finally {
      setBusy(false);
    }
  };

  const save = async (status) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.patch(`/patients/${encodeURIComponent(patient.patientId)}/summary`, { text, status });
      setNotice(status === 'approved' ? 'Summary approved and saved.' : 'Summary draft saved.');
      await onUpdated();
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not save the summary.');
    } finally {
      setBusy(false);
    }
  };

  const exportFhir = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.get(`/patients/${encodeURIComponent(patient.patientId)}/fhir-r4`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${patient.patientId}-fhir-r4.json`;
      link.click();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      setNotice('FHIR R4 bundle downloaded. Review the data and target profile before sharing it with another system.');
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not export the FHIR bundle.');
    } finally {
      setBusy(false);
    }
  };

  return <section className="panel clinical-summary-panel">
    <div className="panel-heading"><div><h2><ClipboardCheck size={16} /> Clinical history summary</h2><p>Structured draft from patient answers, clinician edits, reviewed documents, and Ayurveda assessment. No diagnosis or treatment is generated.</p></div><span className={`summary-status ${summary.status || 'not_generated'}`}>{(summary.status || 'not_generated').replaceAll('_', ' ')}</span></div>
    <div className="summary-toolbar"><button type="button" className="review-button secondary" disabled={busy} onClick={generate}><WandSparkles size={14} /> {busy ? 'Working…' : 'Generate draft'}</button>{summary.generatedAt && <span>Last assembled {new Date(summary.generatedAt).toLocaleString('en-IN')}</span>}{summary.status === 'approved' && patient.caseStatus === 'completed' && <button type="button" className="review-button secondary" disabled={busy} onClick={exportFhir}><Download size={14} /> Download FHIR R4</button>}</div>
    {notice && <div className="review-notice success" role="status">{notice}</div>}{error && <div className="admin-alert error" role="alert">{error}</div>}
    <label className="summary-editor-label"><FileText size={14} /> Review and edit the complete draft<textarea rows={16} maxLength={12000} value={text} onChange={(event) => setText(event.target.value)} placeholder="Generate a draft to assemble available patient history. The summary remains unapproved until a clinician approves it." /></label>
    {summary.history?.length > 0 && <details className="summary-history"><summary>Previous versions ({summary.history.length})</summary>{summary.history.slice().reverse().map((version, index) => <article key={`${version.changedAt}-${index}`}><b>{version.status} · {new Date(version.changedAt).toLocaleString('en-IN')}</b><pre>{version.text}</pre></article>)}</details>}
    <div className="summary-actions"><button type="button" className="review-button secondary" disabled={busy || !text.trim()} onClick={() => save('draft')}>{busy ? 'Saving…' : 'Save draft'}</button><button type="button" className="review-button primary" disabled={busy || !text.trim() || patient.caseStatus !== 'completed'} onClick={() => save('approved')}><ClipboardCheck size={14} /> {busy ? 'Saving…' : 'Approve summary'}</button></div>
    {patient.caseStatus !== 'completed' && <small className="summary-approval-note">Complete patient intake before approving this summary.</small>}
  </section>;
}
