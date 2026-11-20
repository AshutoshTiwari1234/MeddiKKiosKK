import { zodResolver } from '@hookform/resolvers/zod';
import { Check, KeyRound, LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import { passwordSchema } from '../schemas/passwordSchema.js';
import { api } from '../services/api.js';
import { useToast } from '../components/ToastProvider.jsx';

export default function AccountPage() {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(passwordSchema) });

  const submit = async ({ currentPassword, newPassword }) => {
    setSaving(true);
    try {
      const { data } = await api.post('/auth/password', { currentPassword, newPassword });
      toast.success(data.message);
      reset();
    } catch (requestError) {
      toast.error(requestError.response?.data?.error?.message || 'Could not update your password.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="app-root min-h-screen font-sans"><DashboardLayout><header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> <b>Account &amp; security</b></div></header>
    <div className="page-content admin-page"><div className="welcome-row"><div><span className="admin-eyebrow"><KeyRound size={15} /> ACCOUNT SECURITY</span><h1>Account &amp; security</h1><p>Keep your staff account secure.</p></div></div>
      <section className="panel password-panel"><div className="panel-heading"><div><h2><LockKeyhole size={16} /> Change password</h2><p>Use at least 12 characters. Changing your password signs out other sessions.</p></div></div>
        <form className="password-form" onSubmit={handleSubmit(submit)} noValidate>
          <label htmlFor="current-password">Current password</label><input id="current-password" type="password" autoComplete="current-password" {...register('currentPassword')} />{errors.currentPassword && <small className="form-field-error">{errors.currentPassword.message}</small>}
          <label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" {...register('newPassword')} />{errors.newPassword && <small className="form-field-error">{errors.newPassword.message}</small>}
          <label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" type="password" autoComplete="new-password" {...register('confirmPassword')} />{errors.confirmPassword && <small className="form-field-error">{errors.confirmPassword.message}</small>}
          <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Updating…' : 'Update password'}</button>
        </form>
      </section>
    </div>
  </DashboardLayout></div>;
}
