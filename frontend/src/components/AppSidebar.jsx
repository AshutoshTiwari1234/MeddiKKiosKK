import { Activity, BookOpenCheck, CalendarDays, CircleHelp, ClipboardList, HeartPulse, LayoutDashboard, LogOut, Settings2, UserRoundCog, UsersRound } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink } from 'react-router-dom';
import { logoutUser } from '../redux/authSlice.js';

const mainLinks = [
  { label: 'Overview', icon: LayoutDashboard, href: '/' },
  { label: 'Consultations', icon: ClipboardList, href: '/patients' },
  { label: 'Patient records', icon: UsersRound, href: '/patients' },
  { label: 'Appointments', icon: CalendarDays, href: '/#appointments' },
];

export default function AppSidebar() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const initials = user?.name?.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'MK';

  return <aside className="sidebar">
    <NavLink to="/" className="brand sidebar-brand"><span className="brand-mark"><HeartPulse size={18} /></span><span>medikiosk<small>CARE PLATFORM</small></span></NavLink>
    <div className="workspace-switch"><span className="workspace-avatar">M</span><span className="workspace-name"><b>MediKiosk</b><small>Hospital workspace</small></span></div>
    <div className="nav-section-label">WORKSPACE</div>
    <nav className="side-nav">{mainLinks.map(({ label, icon: Icon, href }) => <NavLink key={label} to={href} end={href === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title={label}><Icon size={18} strokeWidth={1.8} /><span>{label}</span></NavLink>)}</nav>
    {user?.role === 'administrator' && <><div className="nav-section-label tools-label">ADMINISTRATION</div><nav className="side-nav"><NavLink to="/team" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><UserRoundCog size={18} strokeWidth={1.8} /><span>Staff accounts</span></NavLink></nav></>}
    <div className="nav-section-label tools-label">CARE TOOLS</div>
    <nav className="side-nav"><div className="nav-link nav-link-muted" aria-disabled="true"><BookOpenCheck size={18} strokeWidth={1.8} /><span>Clinical summaries</span></div><div className="nav-link nav-link-muted" aria-disabled="true"><Activity size={18} strokeWidth={1.8} /><span>Care insights</span></div></nav>
    <div className="sidebar-spacer" />
    <div className="sidebar-help"><span className="help-icon"><CircleHelp size={17} /></span><b>Need a hand?</b><small>Our team is here to help.</small><span className="support-note">Ask your hospital administrator.</span></div>
    <NavLink to="/account" className={({ isActive }) => `nav-link settings-link ${isActive ? 'active' : ''}`} title="Account and security"><Settings2 size={18} /><span>Account &amp; security</span></NavLink>
    <div className="profile-card"><div className="profile-avatar">{initials}</div><div><b>{user?.name || 'Care team'}</b><small>{user?.role || 'Staff'} workspace</small></div><button aria-label="Sign out" title="Sign out" onClick={() => dispatch(logoutUser())}><LogOut size={15} /></button></div>
  </aside>;
}
