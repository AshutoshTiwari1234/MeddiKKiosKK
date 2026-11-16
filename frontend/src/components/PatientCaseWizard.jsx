import { ArrowLeft, ArrowRight, CheckCircle2, FileUp, HeartPulse, Mic, Volume2, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import '../patient-consent.css';

const questions = [
  { field: 'chiefComplaint', required: true, kind: 'textarea', en: 'What is bothering you most today?', hi: 'आज आपको सबसे अधिक क्या परेशानी है?', helpEn: 'In your own words, what would you like the doctor to know?', helpHi: 'अपने शब्दों में बताइए कि आप डॉक्टर को क्या बताना चाहते हैं।', placeholderEn: 'For example: I have had a headache since yesterday…', placeholderHi: 'उदाहरण: कल से मेरे सिर में दर्द है…' },
  { field: 'location', kind: 'text', en: 'Where do you feel it?', hi: 'आपको यह तकलीफ़ कहाँ महसूस होती है?', helpEn: 'You can name one area or several.', helpHi: 'आप एक या कई जगह बता सकते हैं।', placeholderEn: 'Area of the body', placeholderHi: 'शरीर का हिस्सा' },
  { field: 'onset', kind: 'text', en: 'When did it begin?', hi: 'यह कब शुरू हुआ?', helpEn: 'Tell us when you first noticed this concern.', helpHi: 'बताइए कि आपने पहली बार यह परेशानी कब महसूस की।', placeholderEn: 'For example: this morning, three days ago…', placeholderHi: 'उदाहरण: आज सुबह, तीन दिन पहले…' },
  { field: 'duration', kind: 'text', en: 'How long does it last?', hi: 'यह कितनी देर तक रहता है?', helpEn: 'If it comes and goes, tell us how often.', helpHi: 'अगर यह आता-जाता है, तो कितनी बार होता है बताइए।', placeholderEn: 'Duration or frequency', placeholderHi: 'अवधि या कितनी बार' },
  { field: 'character', kind: 'textarea', en: 'What does it feel like?', hi: 'यह कैसा महसूस होता है?', helpEn: 'Describe the feeling in your own words.', helpHi: 'अपने शब्दों में इस एहसास का वर्णन करें।', placeholderEn: 'For example: dull, sharp, burning, pressure…', placeholderHi: 'उदाहरण: हल्का, तेज़, जलन, दबाव…' },
  { field: 'severity', kind: 'scale', en: 'How strong is the discomfort?', hi: 'तकलीफ़ कितनी तेज़ है?', helpEn: '0 means none; 10 means the strongest you can imagine.', helpHi: '0 का अर्थ बिल्कुल नहीं; 10 सबसे तेज़ तकलीफ़।' },
  { field: 'timing', kind: 'text', en: 'Is there a pattern?', hi: 'क्या इसका कोई समय या क्रम है?', helpEn: 'For example: at night, after meals, or all the time.', helpHi: 'उदाहरण: रात में, खाने के बाद, या हमेशा।', placeholderEn: 'When do you notice it?', placeholderHi: 'आप इसे कब महसूस करते हैं?' },
  { field: 'aggravatingFactors', kind: 'text', en: 'Does anything make it worse?', hi: 'क्या किसी चीज़ से यह बढ़ता है?', helpEn: 'Movement, food, time of day, or something else?', helpHi: 'चलने-फिरने, भोजन, दिन के समय या किसी और कारण से?', placeholderEn: 'Optional', placeholderHi: 'वैकल्पिक' },
  { field: 'relievingFactors', kind: 'text', en: 'Does anything make it better?', hi: 'क्या किसी चीज़ से आराम मिलता है?', helpEn: 'Rest, a position, medicine, or something else?', helpHi: 'आराम, कोई स्थिति, दवा या किसी और चीज़ से?', placeholderEn: 'Optional', placeholderHi: 'वैकल्पिक' },
  { field: 'associatedSymptoms', kind: 'textarea', en: 'Have you noticed anything else?', hi: 'क्या आपने कोई और लक्षण महसूस किए हैं?', helpEn: 'Share any other changes you have noticed.', helpHi: 'आपने जो भी अन्य बदलाव महसूस किए हों, बताइए।', placeholderEn: 'Optional', placeholderHi: 'वैकल्पिक' },
  { field: 'pastMedicalHistory', kind: 'textarea', en: 'Have you had any health conditions before?', hi: 'क्या पहले आपको कोई स्वास्थ्य समस्या रही है?', helpEn: 'Include ongoing conditions if you know them.', helpHi: 'अगर पता हो तो अभी चल रही समस्याएँ भी बताएँ।', placeholderEn: 'Optional', placeholderHi: 'वैकल्पिक' },
  { field: 'surgicalHistory', kind: 'textarea', en: 'Have you had any surgeries or hospital stays?', hi: 'क्या आपकी कोई सर्जरी हुई है या अस्पताल में भर्ती हुए हैं?', helpEn: 'Share what you remember. You may skip this.', helpHi: 'जो याद हो बताएँ। आप इसे छोड़ सकते हैं।', placeholderEn: 'Optional', placeholderHi: 'वैकल्पिक' },
  { field: 'medicationHistory', kind: 'textarea', en: 'Do you take any medicines or supplements?', hi: 'क्या आप कोई दवा या सप्लीमेंट लेते हैं?', helpEn: 'Include how often you take them, if you know.', helpHi: 'अगर पता हो तो कितनी बार लेते हैं, यह भी बताएँ।', placeholderEn: 'Optional', placeholderHi: 'वैकल्पिक' },
  { field: 'allergies', kind: 'textarea', en: 'Do you have any allergies or medicine reactions?', hi: 'क्या आपको कोई एलर्जी या दवा से प्रतिक्रिया होती है?', helpEn: 'Include food, medicine, and other allergies.', helpHi: 'भोजन, दवा और अन्य एलर्जी बताएँ।', placeholderEn: 'Optional', placeholderHi: 'वैकल्पिक' },
  { field: 'familyHistory', kind: 'textarea', en: 'Is there relevant health history in your family?', hi: 'क्या आपके परिवार में कोई संबंधित स्वास्थ्य समस्या है?', helpEn: 'Share anything you think may be relevant.', helpHi: 'जो भी संबंधित लगे, वह साझा करें।', placeholderEn: 'Optional', placeholderHi: 'वैकल्पिक' },
  { field: 'personalHistory', kind: 'textarea', en: 'Would you like to share anything about your routine?', hi: 'क्या आप अपनी दिनचर्या के बारे में कुछ साझा करना चाहेंगे?', helpEn: 'Sleep, food, activity, or habits that may help your doctor.', helpHi: 'नींद, भोजन, गतिविधि या ऐसी आदतें जो डॉक्टर की मदद करें।', placeholderEn: 'Optional', placeholderHi: 'वैकल्पिक' },
  { field: 'reviewOfSystems', kind: 'textarea', en: 'Is there anything else about your health to mention?', hi: 'क्या स्वास्थ्य के बारे में कुछ और बताना चाहेंगे?', helpEn: 'You can add any other concern or leave this blank.', helpHi: 'आप कोई अन्य परेशानी बता सकते हैं या इसे खाली छोड़ सकते हैं।', placeholderEn: 'Optional', placeholderHi: 'वैकल्पिक' },
];

const copy = {
  en: { step: 'QUESTION', back: 'Back', next: 'Continue', skip: 'Skip this question', finish: 'Finish check-in', urgent: 'Need urgent help? Stop here and alert a staff member now.', saving: 'Saving your answer…', done: 'Thank you. Your care team has your answers.', doneSub: 'Please tell reception you have completed your check-in.', patientId: 'Your patient ID', home: 'Finish', required: 'Please share your main concern before continuing.', error: 'We could not save this answer. Please check your connection or ask reception for help.' },
  hi: { step: 'प्रश्न', back: 'वापस', next: 'आगे बढ़ें', skip: 'यह प्रश्न छोड़ें', finish: 'चेक-इन पूरा करें', urgent: 'तुरंत सहायता चाहिए? यहीं रुकें और अभी कर्मचारी को बुलाएँ।', saving: 'जवाब सहेजा जा रहा है…', done: 'धन्यवाद। आपकी देखभाल टीम को आपके जवाब मिल गए हैं।', doneSub: 'कृपया रिसेप्शन को बताएं कि आपका चेक-इन पूरा हो गया है।', patientId: 'आपकी रोगी आईडी', home: 'समाप्त करें', required: 'आगे बढ़ने से पहले अपनी मुख्य परेशानी बताइए।', error: 'जवाब सहेजा नहीं जा सका। कनेक्शन जाँचें या रिसेप्शन से सहायता लें।' },
};

export default function PatientCaseWizard({ language = 'en', patientId, token, documentsConsent = false, aiConsent = false, onConsentChange, onConsentRevoked, onComplete }) {
  const t = copy[language] || copy.en;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [assistantReply, setAssistantReply] = useState('');
  const [assistantMode, setAssistantMode] = useState('');
  const [followUpPrompt, setFollowUpPrompt] = useState('');
  const [followUpBaseAnswer, setFollowUpBaseAnswer] = useState('');
  const [urgentNotice, setUrgentNotice] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [listening, setListening] = useState(false);
  const [documentCategory, setDocumentCategory] = useState('lab_report');
  const [documentBusy, setDocumentBusy] = useState(false);
  const [documentMessage, setDocumentMessage] = useState('');
  const [documentError, setDocumentError] = useState('');
  const question = questions[index];
  const answer = answers[question.field] ?? (question.kind === 'scale' ? 5 : '');
  const isLast = index === questions.length - 1;

  useEffect(() => () => {
    window.speechSynthesis?.cancel();
  }, []);

  const startVoiceInput = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceError(language === 'hi' ? 'इस ब्राउज़र में आवाज़ से लिखना उपलब्ध नहीं है। कृपया टाइप करें।' : 'Voice input is not available in this browser. Please type your answer.');
      return;
    }
    setVoiceError('');
    const recognition = new Recognition();
    recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setVoiceError(language === 'hi' ? 'आवाज़ पहचानी नहीं जा सकी। कृपया फिर से कोशिश करें या टाइप करें।' : 'We could not recognize that speech. Try again or type your answer.');
    };
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      setAnswers((current) => ({ ...current, [question.field]: transcript }));
    };
    recognition.start();
  };

  const readQuestion = () => {
    if (!window.speechSynthesis) {
      setVoiceError(language === 'hi' ? 'इस ब्राउज़र में आवाज़ में पढ़ना उपलब्ध नहीं है।' : 'Text-to-speech is not available in this browser.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(followUpPrompt || question[language] || question.en);
    utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    window.speechSynthesis.speak(utterance);
  };

  const continueAfterStaffAlert = async () => {
    setSaving(true);
    setError('');
    try {
      if (isLast) {
        await api.patch('/patients/intake/case-history', { complete: true }, { headers: { 'X-Intake-Token': token } });
        sessionStorage.removeItem('medikiosk-intake-token');
        onComplete();
        return;
      }
      setAnswers((current) => ({ ...current, [question.field]: followUpPrompt ? `${followUpBaseAnswer}\nAdditional detail: ${String(answer)}` : answer }));
      setFollowUpPrompt('');
      setFollowUpBaseAnswer('');
      setUrgentNotice('');
      setIndex((current) => Math.min(current + 1, questions.length - 1));
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || t.error);
    } finally {
      setSaving(false);
    }
  };

  const uploadMedicalDocument = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setDocumentBusy(true);
    setDocumentError('');
    setDocumentMessage('');
    const form = new FormData();
    form.append('document', file);
    form.append('category', documentCategory);
    try {
      const { data } = await api.post('/patients/intake/documents', form, {
        headers: { 'X-Intake-Token': token, 'Content-Type': 'multipart/form-data' },
        timeout: 45000,
      });
      const ocrCopy = data.document.ocrStatus === 'extracted'
        ? (language === 'hi' ? 'OCR पाठ निकाला गया है; चिकित्सक इसकी जाँच करेंगे।' : 'Text extracted; a clinician will verify it.')
        : (language === 'hi' ? 'मूल दस्तावेज़ सुरक्षित है; OCR उपलब्ध नहीं था, चिकित्सक इसे देखेंगे।' : 'Original saved; OCR was unavailable, so a clinician can review it manually.');
      setDocumentMessage(`${file.name} — ${ocrCopy}`);
      event.target.value = '';
    } catch (uploadError) {
      setDocumentError(uploadError.response?.data?.error?.message || (language === 'hi' ? 'दस्तावेज़ अपलोड नहीं हो सका। कृपया फिर से कोशिश करें।' : 'The document could not be uploaded. Please try again.'));
    } finally {
      setDocumentBusy(false);
    }
  };

  const withdrawConsent = async (consent) => {
    setSaving(true);
    setError('');
    try {
      const { data } = await api.patch('/patients/intake/consent', consent, { headers: { 'X-Intake-Token': token } });
      if (data.revoked) {
        sessionStorage.removeItem('medikiosk-intake-token');
        onConsentRevoked?.();
      } else {
        onConsentChange?.(data.consent);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || t.error);
    } finally {
      setSaving(false);
    }
  };

  const saveAnswer = async (complete = false, skip = false) => {
    if (question.required && (!String(answer).trim() || String(answer).trim().length < 2)) {
      setError(t.required);
      return;
    }
    setSaving(true);
    setError('');
    setVoiceError('');
    try {
      const headers = { headers: { 'X-Intake-Token': token } };
      let conversation = null;
      if (!skip) {
        try {
          const result = await api.post('/patients/intake/conversation', {
            field: question.field,
            answer: String(answer),
            language: language === 'hi' ? 'hi' : 'en',
            followUpAnswer: Boolean(followUpPrompt),
          }, headers);
          conversation = result.data;
          setAssistantReply(conversation.reply || '');
          setAssistantMode(conversation.mode || 'guided');
        } catch (_conversationError) {
          setAssistantReply(language === 'hi' ? 'धन्यवाद। अगला प्रश्न आपकी जानकारी को समझने में मदद करेगा।' : 'Thank you for sharing. The next question will help your care team understand your experience.');
          setAssistantMode('guided_fallback');
        }
      }

      const submittedAnswer = skip ? '' : followUpPrompt
        ? `${followUpBaseAnswer}\nAdditional detail: ${String(answer)}`
        : question.kind === 'scale' ? Number(answer) : String(answer);
      const valueLimit = ['chiefComplaint', 'character', 'associatedSymptoms'].includes(question.field) ? 1000 : question.field === 'severity' ? Infinity : 2000;
      const patch = skip ? {} : { [question.field]: typeof submittedAnswer === 'string' ? submittedAnswer.slice(0, valueLimit) : submittedAnswer };

      if (Object.keys(patch).length) await api.patch('/patients/intake/case-history', patch, headers);

      if (conversation?.urgent) {
        setUrgentNotice(conversation.urgentMessage || (language === 'hi' ? 'कृपया अभी कर्मचारी को बताएं और तत्काल मानवीय सहायता लें।' : 'Please alert a staff member now for immediate human assessment.'));
        return;
      }

      if (!skip && conversation?.followUpQuestion && !followUpPrompt) {
        setFollowUpBaseAnswer(String(submittedAnswer));
        setFollowUpPrompt(conversation.followUpQuestion);
        setAnswers((current) => ({ ...current, [question.field]: '' }));
        return;
      }

      if (complete) {
        if (!skip) await api.patch('/patients/intake/case-history', { complete: true }, headers);
        sessionStorage.removeItem('medikiosk-intake-token');
        onComplete();
      } else {
        if (!skip) setAnswers((current) => ({ ...current, [question.field]: submittedAnswer }));
        else {
          setAssistantReply('');
          setAssistantMode('');
        }
        setFollowUpPrompt('');
        setFollowUpBaseAnswer('');
        setUrgentNotice('');
        setIndex((current) => Math.min(current + 1, questions.length - 1));
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || t.error);
    } finally {
      setSaving(false);
    }
  };

  return <section className="case-wizard panel">
    <div className="case-wizard-top"><div><span className="intake-step-label">{t.step} {index + 1} / {questions.length}</span><div className="case-progress"><span style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div></div><span className="patient-id-chip">{patientId}</span></div>
    <details className="consent-controls"><summary>Privacy and consent options</summary><p>Your choices are recorded. You can stop optional processing or withdraw case-taking consent at any time.</p><div>{aiConsent && <button type="button" disabled={saving} onClick={() => withdrawConsent({ aiAssistance: false })}>Turn off AI assistance</button>}{documentsConsent && <button type="button" disabled={saving || documentBusy} onClick={() => withdrawConsent({ documentProcessing: false })}>Turn off document processing</button>}<button type="button" className="consent-withdraw" disabled={saving} onClick={() => withdrawConsent({ caseTaking: false, aiAssistance: false, documentProcessing: false })}>Stop check-in and withdraw consent</button></div></details>
    {documentsConsent && <section className="patient-document-upload" aria-label="Upload a previous medical document"><div className="document-upload-copy"><FileUp size={17} /><div><b>{language === 'hi' ? 'पिछली रिपोर्ट अपलोड करें' : 'Upload a previous medical record'}</b><small>{language === 'hi' ? 'PDF, JPG या PNG · अधिकतम 10 MB' : 'PDF, JPG, or PNG · up to 10 MB'}</small></div></div><div className="document-upload-controls"><select value={documentCategory} onChange={(event) => setDocumentCategory(event.target.value)} aria-label={language === 'hi' ? 'दस्तावेज़ का प्रकार' : 'Document type'}><option value="prescription">{language === 'hi' ? 'पर्चा' : 'Prescription'}</option><option value="lab_report">{language === 'hi' ? 'लैब रिपोर्ट' : 'Lab report'}</option><option value="discharge_summary">{language === 'hi' ? 'डिस्चार्ज सारांश' : 'Discharge summary'}</option><option value="other">{language === 'hi' ? 'अन्य' : 'Other'}</option></select><label className={`button button-secondary document-pick ${documentBusy ? 'is-busy' : ''}`}><FileUp size={14} /> {documentBusy ? (language === 'hi' ? 'अपलोड हो रहा है…' : 'Uploading…') : (language === 'hi' ? 'फ़ाइल चुनें' : 'Choose file')}<input type="file" accept="application/pdf,image/jpeg,image/png" disabled={documentBusy} onChange={uploadMedicalDocument} /></label></div>{documentMessage && <p className="document-upload-status success">{documentMessage}</p>}{documentError && <p className="document-upload-status error" role="alert">{documentError}</p>}</section>}
    <div className="case-question"><span className="case-question-icon"><HeartPulse size={19} /></span><h1>{followUpPrompt || question[language] || question.en}</h1>{assistantReply && <span className="assistant-mode">{assistantMode === 'demo' ? (language === 'hi' ? 'वार्तालाप डेमो' : 'Conversation demo') : assistantMode === 'llm' ? (language === 'hi' ? 'AI सहायक' : 'AI assistant') : assistantMode === 'guided_fallback' ? (language === 'hi' ? 'AI सेवा उपलब्ध नहीं · सामान्य प्रश्न जारी' : 'AI unavailable · guided questions continue') : (language === 'hi' ? 'निर्देशित चेक-इन' : 'Guided check-in')}</span>}<p>{assistantReply || question[`help${language === 'hi' ? 'Hi' : 'En'}`]}</p>
      {question.kind === 'scale' && !followUpPrompt ? <div className="severity-control"><input type="range" min="0" max="10" value={answer} onChange={(event) => setAnswers((current) => ({ ...current, severity: event.target.value }))} aria-label={question.en} /><div><span>0</span><b>{answer} / 10</b><span>10</span></div></div> : question.kind === 'textarea' ? <textarea autoFocus rows={5} value={answer} onChange={(event) => setAnswers((current) => ({ ...current, [question.field]: event.target.value }))} placeholder={followUpPrompt ? (language === 'hi' ? 'वैकल्पिक विवरण' : 'Add any detail you remember') : question[`placeholder${language === 'hi' ? 'Hi' : 'En'}`]} maxLength={question.field === 'chiefComplaint' || question.field === 'character' || question.field === 'associatedSymptoms' ? 1000 : 2000} /> : <input autoFocus type="text" value={answer} onChange={(event) => setAnswers((current) => ({ ...current, [question.field]: event.target.value }))} placeholder={followUpPrompt ? (language === 'hi' ? 'वैकल्पिक विवरण' : 'Add any detail you remember') : question[`placeholder${language === 'hi' ? 'Hi' : 'En'}`]} maxLength={500} />}
      {question.kind !== 'scale' && <div className="voice-actions"><button type="button" className="voice-button" onClick={startVoiceInput} disabled={saving || listening}><Mic size={15} /> {listening ? (language === 'hi' ? 'सुन रहे हैं…' : 'Listening…') : (language === 'hi' ? 'बोलकर बताएं' : 'Speak answer')}</button><button type="button" className="voice-button voice-read" onClick={readQuestion}><Volume2 size={15} /> {language === 'hi' ? 'प्रश्न सुनें' : 'Read question'}</button><span>{language === 'hi' ? 'आवाज़ आपके ब्राउज़र की speech सुविधा से पहचानी जाएगी।' : 'Speech recognition uses your browser’s speech feature.'}</span></div>}
    </div>
    <div className={`urgent-reminder${urgentNotice ? ' urgent-notice' : ''}`}><ShieldAlert size={16} /><span>{urgentNotice || t.urgent}</span></div>
    {error && <div className="patient-api-error" role="alert">{error}</div>}
    {voiceError && <div className="patient-api-error" role="status">{voiceError}</div>}
    <div className="case-actions"><button type="button" className="patient-back-button" disabled={index === 0 || saving || Boolean(followUpPrompt) || Boolean(urgentNotice)} onClick={() => setIndex((current) => Math.max(0, current - 1))}><ArrowLeft size={16} /> {t.back}</button><div className="case-forward-actions">{!urgentNotice && !followUpPrompt && !question.required && <button type="button" className="skip-button" disabled={saving} onClick={() => saveAnswer(isLast, true)}>{t.skip}</button>}{urgentNotice ? <button type="button" className="button button-primary patient-next" disabled={saving} onClick={continueAfterStaffAlert}>{saving ? t.saving : language === 'hi' ? 'मैंने कर्मचारी को बता दिया है' : 'I have alerted a staff member'} <ArrowRight size={17} /></button> : <button type="button" className="button button-primary patient-next" disabled={saving || listening} onClick={() => saveAnswer(isLast)}>{saving ? t.saving : isLast ? t.finish : t.next} {saving ? null : isLast ? <CheckCircle2 size={17} /> : <ArrowRight size={17} />}</button>}</div></div>
  </section>;
}

export function PatientCheckInComplete({ language, patientId, onDone }) {
  const t = copy[language] || copy.en;
  return <section className="checkin-complete panel"><span className="complete-icon"><CheckCircle2 size={31} /></span><h1>{t.done}</h1><p>{t.doneSub}</p><small>{t.patientId}</small><strong>{patientId}</strong><button className="button button-primary" onClick={onDone}>{t.home} <ArrowRight size={16} /></button></section>;
}
