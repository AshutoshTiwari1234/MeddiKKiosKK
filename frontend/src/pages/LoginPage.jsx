import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Eye, EyeOff, HeartPulse, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { loginUser } from '../redux/authSlice.js';
import { loginSchema } from '../schemas/loginSchema.js';
import { accountRequestSchema } from '../schemas/accountRequestSchema.js';
import { api } from '../services/api.js';

export default function LoginPage() {
  const dispatch = useDispatch();
  const { error, status } = useSelector((state) => state.auth);
  const [showPassword, setShowPassword] = useState(false);
  const [view, setView] = useState('login');
  const [requestNotice, setRequestNotice] = useState('');
  const [requestError, setRequestError] = useState('');
  const [requesting, setRequesting] = useState(false);
  const { register: registerLogin, handleSubmit: handleLogin, formState: { errors: loginErrors } } = useForm({ resolver: zodResolver(loginSchema), mode: 'onTouched' });
  const { register: registerAccount, handleSubmit: handleAccount, reset: resetAccount, watch: watchAccount, formState: { errors: accountErrors } } = useForm({
    resolver: zodResolver(accountRequestSchema), mode: 'onTouched',
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', role: 'patient', department: '' },
  });
  const selectedAccountRole = watchAccount('role');
  const isSubmitting = status === 'signing-in';

  const submit = (values) => dispatch(loginUser(values));
  const submitAccountRequest = async (values) => {
    setRequesting(true);
    setRequestError('');
    setRequestNotice('');
    const { confirmPassword, ...accountRequest } = values;
    try {
      const { data } = await api.post('/auth/account-requests', accountRequest);
      setRequestNotice(data.message || 'Your request was sent for administrator review.');
      resetAccount({ ...values, name: '', email: '', password: '', confirmPassword: '' });
    } catch (requestFailure) {
      setRequestError(requestFailure.response?.data?.error?.message || 'Could not submit the account request. Please try again.');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <main className="login-screen">
      <section className="login-brand-panel">
        <a className="brand login-brand" href="/"><span className="brand-mark"><HeartPulse size={19} /></span><span>medikiosk<small>CARE PLATFORM</small></span></a>
        <div className="login-brand-content">
          <span className="eyebrow"><span className="live-dot" /> A MORE THOUGHTFUL OPD</span>
          <h1>More time for<br /><span>what matters.</span></h1>
          <p>Start each consultation with a clearer picture of the person in front of you.</p>
          <div className="login-trust"><ShieldCheck size={18} /><span>Secure access for your care team</span></div>
        </div>
        <span className="login-decoration login-decoration-one" /><span className="login-decoration login-decoration-two" />
        <small className="login-brand-footer">Patient-first care, thoughtfully prepared.</small>
      </section>
      <section className="login-form-panel">
        <div className="login-form-wrap">
          <div className="login-mobile-brand"><span className="brand-mark"><HeartPulse size={18} /></span><b>medikiosk</b></div>
          <div className="login-tabs" role="tablist" aria-label="Staff account options"><button type="button" role="tab" aria-selected={view === 'login'} className={view === 'login' ? 'selected' : ''} onClick={() => { setView('login'); setRequestNotice(''); setRequestError(''); }}>Staff sign in</button><button type="button" role="tab" aria-selected={view === 'create'} className={view === 'create' ? 'selected' : ''} onClick={() => { setView('create'); setRequestNotice(''); setRequestError(''); }}>Staff account</button></div>
          {view === 'login' ? <>
          <span className="login-kicker">STAFF PORTAL</span>
          <h2>Welcome back</h2>
          <p className="login-subtitle">Sign in with your hospital account to continue.</p>
          {error && <div className="login-error" role="alert">{error}</div>}
          <form onSubmit={handleLogin(submit)} noValidate>
            <label className="form-label" htmlFor="email">Work email</label>
            <div className={`login-input ${loginErrors.email ? 'has-error' : ''}`}><Mail size={17} /><input id="email" type="email" autoComplete="username" placeholder="you@hospital.org" {...registerLogin('email')} /></div>
            {loginErrors.email && <small className="field-error">{loginErrors.email.message}</small>}
            <label className="form-label password-label" htmlFor="password">Password</label>
            <div className={`login-input ${loginErrors.password ? 'has-error' : ''}`}><LockKeyhole size={17} /><input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" {...registerLogin('password')} /><button className="password-toggle" type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
            {loginErrors.password && <small className="field-error">{loginErrors.password.message}</small>}
            <button className="button button-primary login-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? <><span className="button-spinner" /> Signing in…</> : <>Sign in securely <ArrowRight size={17} /></>}</button>
          </form>
          <div className="login-patient-link"><span>Patient or visitor?</span><Link to="/patient">Start patient check-in <ArrowRight size={14} /></Link><small>No patient account or password is needed.</small></div>
          <div className="login-security"><LockKeyhole size={13} /><span>Your session is protected with a secure, short-lived cookie.</span></div>
          <small className="login-help">Hospital staff? Request access here. Patients can register for a visit without a staff account.</small>
          </> : <>
          <span className="login-kicker">STAFF PORTAL</span>
          <h2>Request an account</h2>
          <p className="login-subtitle">For doctors and receptionists. Your hospital administrator must approve your request before you can sign in.</p>
          {requestNotice && <div className="login-success" role="status">{requestNotice}</div>}{requestError && <div className="login-error" role="alert">{requestError}</div>}
          <form className="account-request-form" onSubmit={handleAccount(submitAccountRequest)} noValidate>
            <label className="form-label" htmlFor="request-role">I am a</label><select id="request-role" className="login-select" {...registerAccount('role')}><option value="patient">Patient</option><option value="doctor">Doctor</option><option value="receptionist">Receptionist</option></select>
            {selectedAccountRole === 'patient' ? <><p className="login-subtitle">Patients register for a visit here. A patient login and password are not needed.</p><Link className="button button-primary login-submit" to="/patient">Continue to patient registration <ArrowRight size={17} /></Link></> : <>
            <label className="form-label" htmlFor="request-name">Full name</label><div className={`login-input ${accountErrors.name ? 'has-error' : ''}`}><input id="request-name" autoComplete="name" placeholder="Your full name" {...registerAccount('name')} /></div>{accountErrors.name && <small className="field-error">{accountErrors.name.message}</small>}
            <label className="form-label" htmlFor="request-email">Work email</label><div className={`login-input ${accountErrors.email ? 'has-error' : ''}`}><Mail size={17} /><input id="request-email" type="email" autoComplete="email" placeholder="you@hospital.org" {...registerAccount('email')} /></div>{accountErrors.email && <small className="field-error">{accountErrors.email.message}</small>}
            <label className="form-label" htmlFor="request-department">Department <span>Optional</span></label><div className="login-input"><input id="request-department" placeholder="e.g. General medicine" {...registerAccount('department')} /></div>{accountErrors.department && <small className="field-error">{accountErrors.department.message}</small>}
            <label className="form-label password-label" htmlFor="request-password">Password</label><div className={`login-input ${accountErrors.password ? 'has-error' : ''}`}><LockKeyhole size={17} /><input id="request-password" type="password" autoComplete="new-password" placeholder="At least 12 characters" {...registerAccount('password')} /></div>{accountErrors.password && <small className="field-error">{accountErrors.password.message}</small>}
            <label className="form-label password-label" htmlFor="request-confirm-password">Confirm password</label><div className={`login-input ${accountErrors.confirmPassword ? 'has-error' : ''}`}><LockKeyhole size={17} /><input id="request-confirm-password" type="password" autoComplete="new-password" placeholder="Enter the password again" {...registerAccount('confirmPassword')} /></div>{accountErrors.confirmPassword && <small className="field-error">{accountErrors.confirmPassword.message}</small>}
            <button className="button button-primary login-submit" type="submit" disabled={requesting}>{requesting ? <><span className="button-spinner" /> Sending request…</> : <>Submit account request <ArrowRight size={17} /></>}</button>
            </>}
          </form>
          {selectedAccountRole !== 'patient' && <small className="login-help">New staff requests are reviewed by your hospital administrator in Staff accounts.</small>}
          </>}
        </div>
        <footer className="login-footer">© 2026 MediKiosk <span>·</span> For authorized care teams</footer>
      </section>
    </main>
  );
}
