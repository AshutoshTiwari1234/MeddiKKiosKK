import { ArrowLeft, ArrowRight, Languages, ShieldCheck, Stethoscope } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import PatientCaseWizard, { PatientCheckInComplete } from '../components/PatientCaseWizard.jsx';
import PatientRegistrationForm from '../components/PatientRegistrationForm.jsx';

const welcomeCopy = {
  en: { eyebrow: 'YOUR VISIT STARTS HERE', title: <>Let’s get to know<br />you <span>better.</span></>, intro: 'Share a little about how you’re feeling. Your care team will have more time to focus on what matters to you.', private: 'Your information is private', pace: 'One question at a time, at your pace', start: 'Start check-in', note: 'Usually takes about 5 minutes · You can ask for help anytime', footer: 'Thoughtful care begins with understanding.', help: 'Need assistance? Ask our front desk team.' },
  hi: { eyebrow: 'आपकी मुलाक़ात यहाँ शुरू होती है', title: <>आइए आपको<br /><span>समझें।</span></>, intro: 'आप कैसा महसूस कर रहे हैं, थोड़ा साझा करें। इससे आपकी देखभाल टीम आपकी ज़रूरत पर ध्यान दे सकेगी।', private: 'आपकी जानकारी सुरक्षित है', pace: 'एक समय में एक प्रश्न, आपकी गति से', start: 'चेक-इन शुरू करें', note: 'आमतौर पर 5 मिनट · कभी भी सहायता माँगें', footer: 'समझदारी से देखभाल शुरू होती है।', help: 'सहायता चाहिए? रिसेप्शन टीम से पूछें।' },
};

export default function PatientWelcomePage() {
  const [language, setLanguage] = useState('en');
  const [stage, setStage] = useState(() => sessionStorage.getItem('medikiosk-intake-token') ? 'case' : 'welcome');
  const [patient, setPatient] = useState(() => {
    const patientId = sessionStorage.getItem('medikiosk-patient-id');
    return patientId ? { patientId } : null;
  });
  const [token, setToken] = useState(() => sessionStorage.getItem('medikiosk-intake-token') || '');
  const [documentsConsent, setDocumentsConsent] = useState(() => sessionStorage.getItem('medikiosk-document-consent') === 'true');
  const [aiConsent, setAiConsent] = useState(() => sessionStorage.getItem('medikiosk-ai-consent') === 'true');
  const t = welcomeCopy[language];

  const resetKiosk = () => {
    sessionStorage.removeItem('medikiosk-intake-token');
    sessionStorage.removeItem('medikiosk-patient-id');
    sessionStorage.removeItem('medikiosk-document-consent');
    sessionStorage.removeItem('medikiosk-ai-consent');
    setPatient(null);
    setToken('');
    setDocumentsConsent(false);
    setAiConsent(false);
    setStage('welcome');
  };

  return <main className="patient-screen">
    <header className="patient-top">
      <div className="patient-top-left">
        <Link to="/login" className="back-link"><ArrowLeft size={18} /> Staff portal</Link>
        <Link to="/display" target="_blank" rel="noopener noreferrer" className="back-link waiting-display-pill" title="Open TV Waiting Room Screen">
          <span className="live-dot" /> Waiting Room TV
        </Link>
      </div>
      <Link to="/patient" className="brand"><span className="brand-mark"><Stethoscope size={19} /></span> medikiosk</Link>
      <button className="language-button" onClick={() => setLanguage((current) => current === 'en' ? 'hi' : 'en')} aria-label="Change language">
        <Languages size={17} /> {language === 'en' ? 'English' : 'हिन्दी'} <span>⌄</span>
      </button>
    </header>
    {stage === 'welcome' && <section className="patient-hero">
      <div className="patient-copy"><span className="eyebrow"><span className="live-dot" /> {t.eyebrow}</span><h1>{t.title}</h1><p>{t.intro}</p><div className="patient-assurances"><div><ShieldCheck size={18} /><span>{t.private}</span></div><div><span className="question-dot">1</span><span>{t.pace}</span></div></div><button className="button button-primary patient-start" onClick={() => setStage('register')}>{t.start} <ArrowRight size={18} /></button><small className="patient-note">{t.note}</small></div>
      <div className="patient-art" aria-hidden="true"><div className="art-halo" /><div className="art-card"><div className="art-card-top"><span className="art-icon"><Stethoscope size={19} /></span><span className="art-spark">✳</span></div><div className="art-line wide" /><div className="art-line mid" /><div className="art-wave"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div><div className="art-caption"><div className="art-avatar">M</div><div><b>Here to listen</b><small>At your own pace</small></div><span className="art-check">✓</span></div></div><div className="art-pill"><span className="live-dot" /> A calmer start to care</div><span className="art-orbit orbit-one" /><span className="art-orbit orbit-two" /></div>
    </section>}
    {stage === 'register' && <PatientRegistrationForm language={language} onBack={() => setStage('welcome')} onRegistered={(createdPatient, intakeToken) => { const allowDocuments = Boolean(createdPatient.consent?.documentProcessing); const allowAi = Boolean(createdPatient.consent?.aiAssistance); sessionStorage.setItem('medikiosk-document-consent', String(allowDocuments)); sessionStorage.setItem('medikiosk-ai-consent', String(allowAi)); setDocumentsConsent(allowDocuments); setAiConsent(allowAi); setPatient(createdPatient); setToken(intakeToken); setStage('case'); }} />}
    {stage === 'case' && patient && token && <div className="case-page-wrap"><PatientCaseWizard language={language} patientId={patient.patientId} token={token} documentsConsent={documentsConsent} aiConsent={aiConsent} onConsentChange={(consent) => { if (typeof consent.documentProcessing === 'boolean') { setDocumentsConsent(consent.documentProcessing); sessionStorage.setItem('medikiosk-document-consent', String(consent.documentProcessing)); } if (typeof consent.aiAssistance === 'boolean') { setAiConsent(consent.aiAssistance); sessionStorage.setItem('medikiosk-ai-consent', String(consent.aiAssistance)); } }} onConsentRevoked={resetKiosk} onComplete={() => setStage('done')} /></div>}
    {stage === 'done' && patient && <PatientCheckInComplete language={language} patientId={patient.patientId} patient={patient} onDone={resetKiosk} />}
    <footer className="patient-footer"><span>{t.footer}</span><span>{t.help}</span></footer>
  </main>;
}
