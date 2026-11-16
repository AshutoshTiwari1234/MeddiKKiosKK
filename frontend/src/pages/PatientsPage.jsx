import { Search, UserRound, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import { api } from '../services/api.js';

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

export default function PatientsPage() {
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.post('/patients/search', { q: query.trim(), page, limit: 50 });
        if (active) { setPatients(data.patients); setTotal(data.pagination.total); setPages(data.pagination.pages || 1); }
      } catch (requestError) {
        if (active) setError(requestError.response?.data?.error?.message || 'Could not load patient records.');
      } finally {
        if (active) setLoading(false);
      }
    }, query ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [page, query]);

  return <div className="app-root min-h-screen font-sans"><DashboardLayout><header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> <b>Patient records</b></div></header>
    <div className="page-content records-page"><div className="welcome-row"><div><span className="admin-eyebrow"><UsersRound size={15} /> CARE RECORDS</span><h1>Patient records</h1><p>Search for a patient by name, patient ID, or phone number.</p></div><div className="admin-count"><UsersRound size={17} /><b>{total}</b><span>records</span></div></div>
      <section className="panel records-panel"><div className="records-toolbar"><label className="records-search"><Search size={17} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search patients…" aria-label="Search patient records" /></label><span className="records-result-count">{loading ? 'Searching…' : `${total} ${total === 1 ? 'record' : 'records'}`}</span></div>
        {error && <div className="admin-alert error" role="alert">{error}</div>}
        {loading ? <div className="admin-loading"><span className="loading-spinner" /> Loading patient records…</div> : patients.length === 0 ? <div className="admin-empty"><UserRound size={24} /><b>{query ? 'No matching records' : 'No patients registered yet'}</b><span>{query ? 'Try a different name, ID, or phone number.' : 'Patients who check in at the kiosk will appear here.'}</span></div> : <div className="table-scroll"><table className="staff-table patient-table"><thead><tr><th>PATIENT</th><th>PATIENT ID</th><th>DATE OF BIRTH</th><th>STATUS</th><th>CHECKED IN</th></tr></thead><tbody>{patients.map((patient) => <tr key={patient._id}><td><Link className="patient-name-link" to={`/patients/${encodeURIComponent(patient.patientId)}`}><b>{patient.fullName}</b><small>{patient.phone || 'No phone provided'}</small></Link></td><td><span className="patient-id-table">{patient.patientId}</span></td><td>{formatDate(patient.dateOfBirth)}</td><td><span className={`case-status ${patient.caseStatus}`}>{patient.caseStatus.replaceAll('_', ' ')}</span></td><td>{formatDate(patient.createdAt)}</td></tr>)}</tbody></table></div>}
        {!loading && pages > 1 && <div className="records-pagination"><button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Next</button></div>}
      </section>
      <footer className="dashboard-footer"><span>Patient-reported information should be reviewed by a clinician.</span><span>Access to records is restricted to authorized staff.</span></footer>
    </div>
  </DashboardLayout></div>;
}
