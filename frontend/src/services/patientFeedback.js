import { api } from './api.js';

export function createFeedbackRetryKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function submitPatientFeedback(rating, retryKey) {
  return api.post('/feedback', { rating }, {
    withCredentials: false,
    headers: { 'Idempotency-Key': retryKey },
  });
}
