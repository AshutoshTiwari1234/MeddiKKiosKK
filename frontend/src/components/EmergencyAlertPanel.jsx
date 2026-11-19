import { AlertTriangle, Check, ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import './emergency-alert.css';
import { useToast } from './ToastProvider.jsx';

export default function EmergencyAlertPanel() {
  const toast = useToast();
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/alerts');
      setAlerts(data.alerts || []);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Urgent alerts are temporarily unavailable.');
    }
  }, []);

  useEffect(() => {
    refresh();
    const intervalId = window.setInterval(refresh, 8000);
    return () => window.clearInterval(intervalId);
  }, [refresh]);

  const update = async (alert, status) => {
    setBusyId(alert._id);
    try {
      await api.patch(`/alerts/${encodeURIComponent(alert._id)}`, { status });
      await refresh();
    } catch (requestError) {
      toast.error(requestError.response?.data?.error?.message || 'The alert could not be updated.');
    } finally {
      setBusyId('');
    }
  };

  if (!alerts.length && !error) return null;

  return <section className="emergency-alert-panel" aria-label="Urgent alerts">
    <div className="emergency-alert-heading"><span className="emergency-alert-icon"><AlertTriangle size={18} /></span><div><h2>Urgent human assessment</h2><p>Patient responses flagged for immediate staff attention. This is not a diagnosis.</p></div></div>
    {error && <div className="admin-alert error" role="alert">{error}</div>}
    {alerts.map((alert) => <article className="emergency-alert-row" key={alert._id}>
      <div><b>{alert.patient?.fullName || alert.patientId}</b><small>{alert.patientId} · {new Date(alert.createdAt).toLocaleString('en-IN')}</small><span>{alert.status === 'open' ? 'Awaiting staff acknowledgement' : 'Acknowledged by staff'}</span></div>
      <div className="emergency-alert-actions"><Link to={`/patients/${encodeURIComponent(alert.patientId)}`} aria-label="Open patient record"><ExternalLink size={15} /></Link>{alert.status === 'open' ? <button disabled={busyId === alert._id} onClick={() => update(alert, 'acknowledged')}><Check size={14} /> Acknowledge</button> : <button disabled={busyId === alert._id} onClick={() => update(alert, 'resolved')}>Resolve</button>}</div>
    </article>)}
  </section>;
}
