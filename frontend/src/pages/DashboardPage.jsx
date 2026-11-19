import { Activity, ArrowRight, ArrowUpRight, CalendarDays, Clock3, FileText, HeartPulse, LogOut, Plus, Search, ShieldAlert, UsersRound, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { logoutUser } from '../redux/authSlice.js';
import { toggleTheme } from '../redux/uiSlice.js';
import { api } from '../services/api.js';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import EmergencyAlertPanel from '../components/EmergencyAlertPanel.jsx';

export default function DashboardPage() {
  const dispatch = useDispatch();
  const darkMode = useSelector((state) => state.ui.darkMode);
  const user = useSelector((state) => state.auth.user);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [todayPatients, setTodayPatients] = useState([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState('');
  const initials = user?.name?.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'MK';
  const today = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const firstName = user?.name?.split(/\s+/)[0] || 'Care team';

  useEffect(() => {
    let active = true;
    api.get('/patients', { params: { today: 'true', limit: 100 } })
      .then(({ data }) => { if (active) setTodayPatients(data.patients); })
      .catch((error) => { if (active) setQueueError(error.response?.data?.error?.message || 'Patient queue is temporarily unavailable.'); })
      .finally(() => { if (active) setQueueLoading(false); });
    return () => { active = false; };
  }, []);

  const visiblePatients = todayPatients.filter((patient) => {
    const matchesSearch = `${patient.fullName} ${patient.patientId} ${patient.queueToken || ''} ${patient.department || ''} ${patient.phone || ''}`.toLowerCase().includes(search.toLowerCase());
    const needsReview = patient.caseStatus === 'completed' && patient.clinicalReview?.status !== 'approved';
    const matchesFilter = filter === 'all'
      || (filter === 'review' && needsReview)
      || (filter === 'progress' && patient.caseStatus === 'in_progress')
      || (filter === 'ayush' && patient.department === 'Ayurveda / AYUSH');
    return matchesSearch && matchesFilter;
  });

  const handleQuickCall = async (e, patientId) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.post(`/patients/${encodeURIComponent(patientId)}/call`, { status: 'called' });
      // Refresh
      const { data } = await api.get('/patients', { params: { today: 'true', limit: 100 } });
      setTodayPatients(data.patients);
    } catch (_err) {}
  };
  const stats = [
    { label: 'Patients today', value: todayPatients.length, delta: 'Registered for today’s visit', icon: UsersRound, tone: 'blue' },
    { label: 'Awaiting review', value: todayPatients.filter((patient) => patient.caseStatus === 'completed' && patient.clinicalReview?.status !== 'approved').length, delta: 'Case histories completed', icon: FileText, tone: 'teal' },
    { label: 'Case-taking in progress', value: todayPatients.filter((patient) => patient.caseStatus === 'in_progress').length, delta: 'Patients answering questions', icon: HeartPulse, tone: 'violet' },
    { label: 'Avg. wait time', value: '—', delta: 'Available with appointment workflow', icon: Clock3, tone: 'amber' },
  ];

  return <div className={darkMode ? 'app-root dark min-h-screen font-sans' : 'app-root min-h-screen font-sans'}><DashboardLayout>
    <header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> <b>Overview</b></div><div className="top-actions"><span className="role-badge">{user?.role || 'Staff'}</span><button className="icon-button theme-toggle" title="Toggle dark mode" onClick={() => dispatch(toggleTheme())}><span>{darkMode ? '◐' : '◑'}</span></button><button className="icon-button signout-top" title="Sign out" onClick={() => dispatch(logoutUser())}><LogOut size={16} /></button><div className="top-avatar">{initials}</div></div></header>
    <div className="page-content">
      <div className="welcome-row">
        <div>
          <div className="date-line"><CalendarDays size={15} /> {today} <span className="status-chip"><span className="live-dot" /> CLINIC OPEN</span></div>
          <h1>Good morning, {firstName} <span className="wave">✳</span></h1>
          <p>Here’s what’s happening across your care centre today.</p>
        </div>
        <div className="welcome-actions-row">
          <Link to="/display" target="_blank" rel="noopener noreferrer" className="button button-secondary" title="Open Public TV Screen for Waiting Room">
            <Activity size={17} /> Live Waiting TV Display
          </Link>
          <Link to="/patient" className="button button-primary">
            <Plus size={17} /> New patient check-in
          </Link>
        </div>
      </div>
      <EmergencyAlertPanel />
      <section className="stat-grid" aria-label="Today’s clinic metrics">{stats.map(({ label, value, delta, icon: Icon, tone }) => <article className="stat-card" key={label}><div className="stat-head"><span>{label}</span><span className={`stat-icon ${tone}`}><Icon size={17} /></span></div><div className="stat-value">{value}</div><div className="stat-foot"><span>{delta}</span></div></article>)}</section>
      <div className="content-grid"><section className="panel queue-panel"><div className="panel-heading"><div><h2>Patient queue</h2><p>Today’s check-ins and case history progress.</p></div></div><div className="queue-toolbar"><div className="queue-tabs">{[{ key: 'all', label: 'All patients', count: todayPatients.length }, { key: 'review', label: 'Needs review', count: todayPatients.filter((patient) => patient.caseStatus === 'completed' && patient.clinicalReview?.status !== 'approved').length }, { key: 'ayush', label: 'Ayurveda / AYUSH', count: todayPatients.filter((patient) => patient.department === 'Ayurveda / AYUSH').length }, { key: 'progress', label: 'In progress', count: todayPatients.filter((patient) => patient.caseStatus === 'in_progress').length }].map((tab) => <button key={tab.key} className={filter === tab.key ? 'selected' : ''} onClick={() => setFilter(tab.key)}>{tab.label} <span>{tab.count}</span></button>)}</div><label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patients" aria-label="Search patients" /></label></div>
        {queueError && <div className="admin-alert error queue-error" role="alert">{queueError}</div>}
        {queueLoading ? <div className="queue-loading"><span className="loading-spinner" /> Loading today’s queue…</div> : visiblePatients.length ? <div className="queue-patient-list">{visiblePatients.slice(0, 8).map((patient) => { const needsReview = patient.caseStatus === 'completed' && patient.clinicalReview?.status !== 'approved'; const label = patient.caseStatus === 'completed' ? needsReview ? 'Needs review' : 'Reviewed' : patient.caseStatus.replaceAll('_', ' '); return <Link key={patient._id} to={`/patients/${encodeURIComponent(patient.patientId)}`} className="queue-patient-row"><span className="queue-patient-avatar">{patient.fullName.slice(0, 1).toUpperCase()}</span><span className="queue-patient-name"><b>{patient.fullName}</b><small>{patient.queueToken ? <strong className="queue-token-tag">{patient.queueToken}</strong> : patient.patientId} {patient.department ? `· ${patient.department}` : ''} {patient.phone ? `· ${patient.phone}` : ''}</small></span><button type="button" className="quick-call-btn" title="Call next to consultation cabin" onClick={(e) => handleQuickCall(e, patient.patientId)}><Volume2 size={13} /> Call</button><span className={`case-status ${needsReview ? 'needs-review' : patient.caseStatus === 'completed' ? 'reviewed' : patient.caseStatus}`}>{label}</span><ArrowRight size={15} /></Link>;})}</div> : <div className="empty-state"><div className="empty-illustration"><div className="empty-ring"><UsersRound size={24} /></div><span className="empty-spark">✳</span><span className="empty-plus">+</span></div><h3>{search ? 'No matching patients' : 'Your queue is clear'}</h3><p>{search ? 'There are no checked-in patients matching your search.' : 'When patients check in, they’ll appear here for your team to review.'}</p><Link to="/patient" className="text-button">Start a patient check-in <ArrowRight size={15} /></Link></div>}<div className="queue-legend"><span><i className="legend-dot teal-dot" /> Clinician reviewed</span><span><i className="legend-dot blue-dot" /> Needs review / in progress</span><span><i className="legend-dot gray-dot" /> Not started</span></div></section>
        <aside className="right-column"><section id="appointments" className="panel schedule-panel"><div className="panel-heading"><div><h2>Today’s schedule</h2><p>Clinic OPD sessions &amp; doctor allocations.</p></div><CalendarDays size={17} className="schedule-icon" /></div><div className="active-clinic-schedule"><div className="schedule-slot active-slot"><span className="slot-dot live" /><div><b>09:00 AM – 01:00 PM</b><p>General Medicine &amp; AYUSH OPD (Active Now)</p><small>Cabin 1 &amp; Cabin 3 · Dr. Ashutosh Tiwari</small></div></div><div className="schedule-slot"><span className="slot-dot" /><div><b>02:00 PM – 05:00 PM</b><p>Follow-Up Reviews &amp; Panchakarma Consults</p><small>OPD Block B · Scheduled Visits</small></div></div></div></section>
          <section className="safety-card"><div className="safety-icon"><ShieldAlert size={18} /></div><div><b>Urgent care comes first</b><p>If a patient appears seriously unwell, alert a clinician immediately. Don’t wait for digital check-in.</p></div><ArrowUpRight className="safety-arrow" size={16} /></section>
          <section className="activity-panel"><div className="activity-heading"><div><h2>Care centre pulse</h2><p>A live view of today’s activity.</p></div><span className="pulse-icon"><Activity size={17} /></span></div><div className="pulse-chart"><div className="chart-y"><span>12</span><span>8</span><span>4</span><span>0</span></div><div className="chart-body"><div className="chart-grid"><i /><i /><i /><i /></div><svg viewBox="0 0 380 112" preserveAspectRatio="none" aria-label="No patient activity recorded"><path d="M0 108 L380 108" fill="none" stroke="#ccd7e2" strokeWidth="2" strokeDasharray="5 6" /></svg><div className="chart-labels"><span>8 am</span><span>10 am</span><span>12 pm</span><span>2 pm</span><span>4 pm</span></div></div></div><div className="chart-note"><span className="legend-dot teal-dot" /> Patient check-ins <span className="chart-no-data">No activity yet</span></div></section>
        </aside></div>
      <footer className="dashboard-footer"><span>© 2026 MediKiosk <i /> Built for more thoughtful care</span><span>Clinical summaries always need a clinician’s review.</span></footer>
    </div>
  </DashboardLayout></div>;
}
