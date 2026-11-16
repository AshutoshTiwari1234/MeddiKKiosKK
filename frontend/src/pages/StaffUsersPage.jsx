import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Check, LoaderCircle, Plus, RefreshCw, UserRoundCog, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import { staffUserSchema } from '../schemas/staffUserSchema.js';
import { api } from '../services/api.js';

const initialValues = { name: '', email: '', password: '', role: 'doctor', department: '' };

export default function StaffUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(staffUserSchema), defaultValues: initialValues });
  const pendingCount = users.filter((user) => user.approvalStatus === 'pending').length;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/users');
      setUsers(data.users.slice().sort((left, right) => Number(right.approvalStatus === 'pending') - Number(left.approvalStatus === 'pending')));
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not load staff accounts. Check the API connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const createUser = async (values) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api.post('/users', values);
      reset(initialValues);
      setNotice('Staff account created. They can sign in with the email and temporary password you set.');
      await loadUsers();
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not create the staff account.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user) => {
    setError('');
    setNotice('');
    try {
      const { data } = await api.patch(`/users/${user._id}/status`, { active: !user.active });
      setUsers((current) => current.map((item) => item._id === user._id ? data.user : item).sort((left, right) => Number(right.approvalStatus === 'pending') - Number(left.approvalStatus === 'pending')));
      setNotice(user.approvalStatus === 'pending' ? `${user.name}’s account request was approved.` : `${user.name}’s account is now ${data.user.active ? 'active' : 'deactivated'}.`);
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not update this account.');
    }
  };

  const rejectRequest = async (user) => {
    if (!window.confirm(`Reject the account request from ${user.name}?`)) return;
    setError('');
    setNotice('');
    try {
      await api.delete(`/users/${encodeURIComponent(user._id)}`);
      setUsers((current) => current.filter((item) => item._id !== user._id));
      setNotice(`${user.name}’s account request was rejected.`);
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not reject this account request.');
    }
  };

  return <div className="app-root min-h-screen font-sans"><DashboardLayout><header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> <b>Staff accounts</b></div><div className="top-actions"><span className="role-badge">Administrator</span></div></header>
    <div className="page-content admin-page"><div className="welcome-row"><div><span className="admin-eyebrow"><UserRoundCog size={15} /> ADMINISTRATION</span><h1>Staff accounts</h1><p>Manage authorized access to the MediKiosk workspace.</p></div><div className="admin-count"><UsersRound size={17} /><b>{users.length}</b><span>accounts</span></div></div>
      {pendingCount > 0 && <div className="account-request-callout" role="status"><b>{pendingCount} account {pendingCount === 1 ? 'request' : 'requests'} waiting for approval</b><span>Pending requests appear first below. Select Approve to activate an account or Reject to remove the request.</span></div>}
      {error && <div className="admin-alert error" role="alert"><AlertCircle size={17} />{error}</div>}{notice && <div className="admin-alert success" role="status"><Check size={17} />{notice}</div>}
      <div className="admin-grid"><section className="panel users-panel"><div className="panel-heading"><div><h2>Team members</h2><p>Only active accounts can access staff tools.</p></div><button className="icon-button small-icon" title="Refresh staff list" onClick={loadUsers}><RefreshCw size={15} /></button></div>
        {loading ? <div className="admin-loading"><LoaderCircle size={19} className="spin" /> Loading staff accounts…</div> : users.length === 0 ? <div className="admin-empty"><UsersRound size={23} /><b>No staff accounts found</b><span>Create a staff account to get started.</span></div> : <div className="table-scroll"><table className="staff-table"><thead><tr><th>TEAM MEMBER</th><th>ROLE</th><th>DEPARTMENT</th><th>STATUS</th><th /></tr></thead><tbody>{users.map((user) => { const pending = user.approvalStatus === 'pending'; return <tr key={user._id}><td><b>{user.name}</b><small>{user.email}</small></td><td><span className={`role-pill ${user.role}`}>{user.role}</span></td><td>{user.department || '—'}</td><td><span className={`account-status ${pending ? 'pending' : user.active ? 'active' : 'inactive'}`}><i />{pending ? 'Pending approval' : user.active ? 'Active' : 'Inactive'}</span></td><td><button className="account-action" disabled={saving} onClick={() => toggleActive(user)}>{pending ? 'Approve' : user.active ? 'Deactivate' : 'Activate'}</button>{pending && <button className="account-action reject-action" onClick={() => rejectRequest(user)}>Reject</button>}</td></tr>;})}</tbody></table></div>}
      </section>
      <section className="panel create-user-panel"><div className="panel-heading"><div><h2><Plus size={16} /> Add a team member</h2><p>Administrator-created accounts can sign in right away.</p></div></div><form className="staff-form" onSubmit={handleSubmit(createUser)} noValidate>
        <label htmlFor="staff-name">Full name</label><input id="staff-name" placeholder="e.g. Asha Sharma" {...register('name')} />{errors.name && <small className="form-field-error">{errors.name.message}</small>}
        <label htmlFor="staff-email">Work email</label><input id="staff-email" type="email" placeholder="name@hospital.org" {...register('email')} />{errors.email && <small className="form-field-error">{errors.email.message}</small>}
        <label htmlFor="staff-role">Role</label><select id="staff-role" {...register('role')}><option value="doctor">Doctor</option><option value="receptionist">Receptionist</option><option value="administrator">Administrator</option></select>
        <label htmlFor="staff-department">Department <span>Optional</span></label><input id="staff-department" placeholder="e.g. General medicine" {...register('department')} />
        <label htmlFor="staff-password">Temporary password</label><input id="staff-password" type="password" autoComplete="new-password" placeholder="At least 12 characters" {...register('password')} />{errors.password && <small className="form-field-error">{errors.password.message}</small>}
        <small className="password-hint">Share the temporary password securely. Staff should change it after their first sign-in.</small>
        <button className="button button-primary create-user-submit" type="submit" disabled={saving}>{saving ? 'Creating account…' : 'Create account'} <Plus size={16} /></button>
      </form></section></div>
      <footer className="dashboard-footer"><span>Account access is limited by role and can be revoked here.</span><span>Account changes are recorded in the audit log.</span></footer>
    </div>
  </DashboardLayout></div>;
}
