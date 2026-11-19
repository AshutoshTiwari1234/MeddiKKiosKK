import { ArrowLeft, Bell, CalendarDays, Clock, Expand, HeartPulse, RefreshCw, Sparkles, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';

const HEALTH_TICKERS = [
  '🌿 AYUSH Wellness Tip: Drinking warm water throughout the day stimulates Agni (digestive fire) and removes accumulated toxins (Ama).',
  '🩺 Clinic Advisory: Please keep your MediKiosk printed OPD slip or ABHA ID ready when your token is announced.',
  '🧘 Mindful Living: 5 minutes of rhythmic deep breathing (Pranayama) in the waiting lounge helps regulate blood pressure and eases visit anxiety.',
  '💧 Seasonal Care: In dry weather, consume freshly prepared warm meals and stay hydrated with ginger or herbal tea.',
  '✨ Emergency Notice: If you experience chest pain, sudden breathlessness, or severe dizziness, inform the nursing station immediately.',
];

export default function WaitingHallDisplayPage() {
  const [liveData, setLiveData] = useState({ nowCalling: [], waiting: [], totalToday: 0 });
  const [loading, setLoading] = useState(true);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [lastAnnouncedToken, setLastAnnouncedToken] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(true);

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);

  const fetchLiveQueue = useCallback(async () => {
    try {
      const { data } = await api.get('/patients/queue/live');
      setLiveData(data);

      // Check if a new token is being called and play announcement
      if (audioEnabled && data.nowCalling?.length > 0) {
        const topCalled = data.nowCalling[0];
        if (topCalled.queueToken && topCalled.queueToken !== lastAnnouncedToken) {
          setLastAnnouncedToken(topCalled.queueToken);
          announceToken(topCalled.queueToken, topCalled.roomNumber);
        }
      }
    } catch (_err) {
      // Fallback: graceful degradation
    } finally {
      setLoading(false);
    }
  }, [audioEnabled, lastAnnouncedToken]);

  useEffect(() => {
    fetchLiveQueue();
    const interval = setInterval(fetchLiveQueue, 4000); // Poll every 4 seconds
    return () => clearInterval(interval);
  }, [fetchLiveQueue]);

  useEffect(() => {
    const tickerTimer = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % HEALTH_TICKERS.length);
    }, 8000);
    return () => clearInterval(tickerTimer);
  }, []);

  const announceToken = (token, room) => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const text = `Attention please. Token number ${token.replace('-', ' ')}, please proceed to ${room || 'the consultation room'}.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      window.speechSynthesis.speak(utterance);
    } catch (_e) {
      // Ignore audio synthesis errors
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Sample fallback demo tokens if none currently in DB
  const displayNowCalling = liveData.nowCalling?.length > 0 ? liveData.nowCalling : [
    { queueToken: 'AY-104', fullName: 'Rajesh Sharma', department: 'Ayurveda / AYUSH', roomNumber: 'Room 3 (AYUSH OPD)' },
    { queueToken: 'GM-102', fullName: 'Sunita Verma', department: 'General Medicine', roomNumber: 'Room 1 (General OPD)' },
  ];

  const displayWaiting = liveData.waiting?.length > 0 ? liveData.waiting : [
    { queueToken: 'GM-103', fullName: 'Amit Patel', department: 'General Medicine', roomNumber: 'Room 1' },
    { queueToken: 'AY-105', fullName: 'Priya Nair', department: 'Ayurveda / AYUSH', roomNumber: 'Room 3' },
    { queueToken: 'PED-106', fullName: 'Aarav Mehta', department: 'Pediatrics', roomNumber: 'Room 2' },
    { queueToken: 'ORT-107', fullName: 'Mohan Lal', department: 'Orthopedics', roomNumber: 'Room 4' },
  ];

  return (
    <main className="display-screen-root">
      {/* Top TV Header Bar */}
      <header className="display-topbar">
        <div className="display-brand">
          <Link to="/" className="display-back-link" title="Return to Dashboard">
            <ArrowLeft size={18} />
          </Link>
          <span className="brand-mark"><HeartPulse size={22} /></span>
          <div>
            <h1>MediKiosk Care Centre</h1>
            <small>SMART OPD QUEUE &amp; AYUSH INTEGRATED CARE PLATFORM</small>
          </div>
        </div>

        <div className="display-clock-group">
          <div className="display-status-tag">
            <span className="live-dot pulse" /> LIVE OPD
          </div>
          <div className="display-datetime">
            <div className="display-time"><Clock size={16} /> {timeStr}</div>
            <div className="display-date"><CalendarDays size={14} /> {dateStr}</div>
          </div>
          <div className="display-controls">
            <button
              type="button"
              className={`display-icon-btn ${audioEnabled ? 'active' : ''}`}
              onClick={() => {
                setAudioEnabled(!audioEnabled);
                if (!audioEnabled) announceToken('AY-104', 'Room 3');
              }}
              title="Toggle Audio Announcements"
            >
              <Volume2 size={18} />
            </button>
            <button
              type="button"
              className="display-icon-btn"
              onClick={toggleFullscreen}
              title="Fullscreen Mode"
            >
              <Expand size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Screen Content */}
      <div className="display-content-grid">
        {/* Left 60%: NOW SERVING / CALLING CARDS */}
        <section className="display-calling-section">
          <div className="display-section-header">
            <div className="header-pill calling-pill">
              <Bell size={18} className="ringing-bell" />
              <span>NOW CALLING / CURRENT CONSULTATIONS</span>
            </div>
            <button
              type="button"
              className="test-chime-btn"
              onClick={() => announceToken(displayNowCalling[0].queueToken, displayNowCalling[0].roomNumber)}
            >
              <Volume2 size={14} /> Play Chime
            </button>
          </div>

          <div className="calling-cards-container">
            {displayNowCalling.map((item, idx) => (
              <div key={item.queueToken || idx} className="calling-token-card">
                <div className="calling-card-left">
                  <span className="calling-badge">PLEASE PROCEED TO</span>
                  <div className="calling-room-name">{item.roomNumber || 'Consultation Room'}</div>
                  <div className="calling-patient-meta">
                    <b>{item.fullName?.split(' ')[0]} {item.fullName?.split(' ')[1]?.[0] ? `${item.fullName.split(' ')[1][0]}.` : ''}</b>
                    <span>· {item.department || 'General Medicine'}</span>
                  </div>
                </div>

                <div className="calling-card-right">
                  <span className="token-small-title">TOKEN</span>
                  <div className="calling-huge-token">{item.queueToken}</div>
                  <span className="calling-pulse-ring" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right 40%: NEXT IN LINE QUEUE */}
        <aside className="display-waiting-section">
          <div className="display-section-header">
            <div className="header-pill waiting-pill">
              <Clock size={16} />
              <span>NEXT IN LINE</span>
            </div>
            <span className="waiting-total-badge">{displayWaiting.length} in queue</span>
          </div>

          <div className="display-waiting-list">
            {displayWaiting.map((item, idx) => (
              <div key={item.queueToken || idx} className="display-waiting-row">
                <div className="waiting-rank">#{idx + 1}</div>
                <div className="waiting-token-chip">{item.queueToken}</div>
                <div className="waiting-info">
                  <strong>{item.fullName}</strong>
                  <small>{item.department}</small>
                </div>
                <div className="waiting-room-tag">
                  {item.roomNumber || 'Room 1'}
                </div>
              </div>
            ))}
          </div>

          <div className="display-kiosk-prompt">
            <Sparkles size={16} />
            <div>
              <b>New to the hospital today?</b>
              <p>Self check-in is available at the MediKiosk touch screen at the entrance.</p>
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom Health & AYUSH Marquee Ticker */}
      <footer className="display-ticker-bar">
        <div className="ticker-label">
          <Sparkles size={14} /> HEALTH &amp; AYUSH ADVISORY
        </div>
        <div className="ticker-viewport">
          <div className="ticker-text">{HEALTH_TICKERS[tickerIndex]}</div>
        </div>
      </footer>
    </main>
  );
}
