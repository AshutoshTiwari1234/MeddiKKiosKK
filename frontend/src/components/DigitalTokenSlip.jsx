import { ArrowRight, CheckCircle2, Clock, Download, HeartPulse, MapPin, Printer, QrCode, RefreshCw, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createFeedbackRetryKey, submitPatientFeedback } from '../services/patientFeedback.js';
import PatientFeedbackModal from './PatientFeedbackModal.jsx';

// Generates an attractive stylized deterministic QR matrix SVG for the slip
function SimpleQRCode({ text = 'MEDIKIOSK-TOKEN', size = 110 }) {
  // Generate a reproducible pseudo-random pattern based on string hash
  const hash = Array.from(text).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 1000000007, 7);
  const gridSize = 15;
  const cellSize = size / gridSize;

  const cells = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      // Corner alignment squares (standard QR look)
      const isTopLeft = r < 4 && c < 4;
      const isTopRight = r < 4 && c >= gridSize - 4;
      const isBottomLeft = r >= gridSize - 4 && c < 4;
      const isCorner = isTopLeft || isTopRight || isBottomLeft;

      let filled = false;
      if (isCorner) {
        // Outer ring or inner dot
        const border = (r === 0 || r === 3 || c === 0 || c === 3) && isTopLeft
          || (r === 0 || r === 3 || c === gridSize - 4 || c === gridSize - 1) && isTopRight
          || (r === gridSize - 4 || r === gridSize - 1 || c === 0 || c === 3) && isBottomLeft;
        const inner = (r === 1 || r === 2) && (c === 1 || c === 2) && isTopLeft
          || (r === 1 || r === 2) && (c === gridSize - 3 || c === gridSize - 2) && isTopRight
          || (r === gridSize - 3 || r === gridSize - 2) && (c === 1 || c === 2) && isBottomLeft;
        filled = border || inner;
      } else {
        filled = ((r * 13 + c * 17 + hash) % 5 === 0) || ((r + c + (hash % 7)) % 3 === 0);
      }

      if (filled) {
        cells.push(
          <rect
            key={`${r}-${c}`}
            x={c * cellSize}
            y={r * cellSize}
            width={cellSize * 0.9}
            height={cellSize * 0.9}
            rx={cellSize * 0.15}
            fill="#0f172a"
          />
        );
      }
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="token-qr-svg">
      <rect width={size} height={size} fill="#ffffff" rx="8" />
      {cells}
    </svg>
  );
}

export default function DigitalTokenSlip({
  language = 'en',
  patientId = 'MK-DEMO1234',
  patientName = 'Patient',
  department = 'General Medicine',
  queueToken = 'OPD-101',
  roomNumber = 'Room 1 (General OPD)',
  onDone,
  onSubmitRating,
}) {
  const isHindi = language === 'hi';
  const [countdown, setCountdown] = useState(45);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const feedbackRetryKey = useRef(null);
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(now);
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          onDone?.();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onDone]);

  const handleSubmitRating = (rating) => {
    feedbackRetryKey.current ??= createFeedbackRetryKey();
    return submitPatientFeedback(rating, feedbackRetryKey.current);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="digital-token-container">
      {/* Top success badge */}
      <div className="checkin-success-banner">
        <CheckCircle2 size={24} className="success-icon-pulse" />
        <div>
          <h3>{isHindi ? 'चेक-इन सफलतापूर्वक पूरा हुआ!' : 'Check-In Completed Successfully!'}</h3>
          <p>{isHindi ? 'कृपया अपना टोकन पर्ची लें और प्रतीक्षा कक्ष में बैठें।' : 'Please take your OPD pass and proceed to the waiting area.'}</p>
        </div>
      </div>

      {/* The Printable OPD Token Slip Card */}
      <div className="opd-slip-card printable-ticket" id="opd-print-area">
        {/* Slip Header */}
        <div className="slip-header">
          <div className="slip-brand">
            <span className="brand-mark"><HeartPulse size={18} /></span>
            <div>
              <strong>MediKiosk Care Centre</strong>
              <small>OUTPATIENT DEPARTMENT · OPD PASS</small>
            </div>
          </div>
          <div className="slip-meta">
            <span>{dateStr}</span>
            <b>{timeStr}</b>
          </div>
        </div>

        {/* Big Token Number Callout */}
        <div className="slip-token-banner">
          <div className="token-label-group">
            <span className="token-eyebrow">{isHindi ? 'आपका टोकन नंबर' : 'YOUR QUEUE TOKEN'}</span>
            <div className="token-number-hero">{queueToken || 'OPD-101'}</div>
            <span className="department-badge">
              <Sparkles size={13} /> {department || 'General Medicine'}
            </span>
          </div>

          <div className="slip-qr-box">
            <SimpleQRCode text={`${patientId}|${queueToken}|${now.toISOString()}`} size={96} />
            <small>Scan at Cabin</small>
          </div>
        </div>

        {/* Clinic & Room Details */}
        <div className="slip-details-grid">
          <div className="slip-detail-item">
            <span className="detail-icon"><MapPin size={15} /></span>
            <div>
              <small>{isHindi ? 'आबंटित कमरा / केबिन' : 'Assigned Consultation Cabin'}</small>
              <strong>{roomNumber || 'Room 1 (General OPD)'}</strong>
            </div>
          </div>

          <div className="slip-detail-item">
            <span className="detail-icon"><Clock size={15} /></span>
            <div>
              <small>{isHindi ? 'अनुमानित प्रतीक्षा समय' : 'Estimated Wait Time'}</small>
              <strong>~10 - 15 mins <span className="queue-ahead">(2 ahead)</span></strong>
            </div>
          </div>

          <div className="slip-detail-item">
            <span className="detail-icon"><ShieldCheck size={15} /></span>
            <div>
              <small>{isHindi ? 'रोगी आईडी' : 'Patient ID'}</small>
              <strong className="patient-id-code">{patientId}</strong>
            </div>
          </div>

          <div className="slip-detail-item">
            <span className="detail-icon"><HeartPulse size={15} /></span>
            <div>
              <small>{isHindi ? 'रोगी का नाम' : 'Patient Name'}</small>
              <strong>{patientName || 'Patient'}</strong>
            </div>
          </div>
        </div>

        {/* Patient Instructions */}
        <div className="slip-instructions">
          <b>{isHindi ? 'महत्वपूर्ण निर्देश:' : 'Important Instructions:'}</b>
          <ul>
            <li>{isHindi ? 'कृपया प्रतीक्षा हॉल में स्क्रीन पर अपने टोकन नंबर पर ध्यान दें।' : 'Watch the waiting hall screen for your token announcement.'}</li>
            <li>{isHindi ? 'आवाज़ द्वारा आपका टोकन बुलाए जाने पर संबंधित कमरे में प्रवेश करें।' : 'When your token is called by voice, proceed to your designated cabin.'}</li>
            <li>{isHindi ? 'यदि कोई गंभीर आपात स्थिति हो तो तुरंत रिसेप्शन डेस्क को सूचित करें।' : 'If experiencing severe discomfort, notify hospital staff immediately.'}</li>
          </ul>
        </div>

        {/* Slip Footer */}
        <div className="slip-footer">
          <span>ABHA Enabled · Smart India Hackathon 2026 Prototype</span>
          <span>Verified Digital Check-In</span>
        </div>
      </div>

      {/* Slip Actions */}
      <div className="token-slip-actions patient-feedback-slip-actions">
        <button type="button" className="button button-secondary slip-action-btn" onClick={handlePrint}>
          <Printer size={16} /> {isHindi ? 'पर्ची प्रिंट करें' : 'Print OPD Pass'}
        </button>

        <button type="button" className="button button-secondary slip-action-btn" lang={isHindi ? 'hi' : 'en'} onClick={() => setFeedbackOpen(true)}>
          <Star size={16} aria-hidden="true" /> {isHindi ? 'अपने अनुभव को रेटिंग दें' : 'Rate your experience'}
        </button>

        <button type="button" className="button button-primary slip-action-btn" onClick={onDone}>
          {isHindi ? 'समाप्त करें (अगला रोगी)' : 'Finish & Return Home'} <ArrowRight size={16} />
        </button>
      </div>

      {feedbackOpen && (
        <PatientFeedbackModal
          language={language}
          onClose={() => setFeedbackOpen(false)}
          onSubmitRating={onSubmitRating ?? handleSubmitRating}
        />
      )}

      <div className="token-reset-timer">
        <RefreshCw size={13} className="spin-slow" />
        <span>
          {isHindi
            ? `यह स्क्रीन ${countdown} सेकंड में अगले रोगी के लिए स्वचालित रूप से रीसेट हो जाएगी`
            : `Kiosk will automatically reset for the next patient in ${countdown}s`}
        </span>
      </div>
    </div>
  );
}
