import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowLeft, ArrowRight, HeartPulse, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { patientRegistrationSchema } from '../schemas/patientRegistrationSchema.js';
import { api } from '../services/api.js';

const labels = {
  en: {
    heading: 'A few details first', sub: 'This helps your care team prepare for your visit.', name: 'Full name', dob: 'Date of birth', gender: 'Gender',
    select: 'Select', female: 'Female', male: 'Male', other: 'Other', prefer: 'Prefer not to say', phone: 'Phone number', email: 'Email address',
    language: 'Preferred language', emergency: 'Emergency contact (optional)', contactName: 'Contact name', relationship: 'Relationship', contactPhone: 'Contact phone',
    abha: 'ABHA ID (optional)', consentTitle: 'Your consent', caseConsent: 'I agree to share this information with my care team for this visit.',
    docsConsent: 'I agree to document digitization if I upload medical records.', aiConsent: 'I agree to send my health responses to the hospital configured AI service for organization and clinician review. It will not diagnose or prescribe.',
    privacy: 'Your information is kept private and shared with authorized care staff.', next: 'Continue to health questions', back: 'Back', saving: 'Saving…',
  },
  hi: {
    heading: 'पहले कुछ जानकारी', sub: 'इससे आपकी देखभाल टीम आपकी मुलाक़ात की तैयारी कर सकेगी।', name: 'पूरा नाम', dob: 'जन्म तिथि', gender: 'लिंग',
    select: 'चुनें', female: 'महिला', male: 'पुरुष', other: 'अन्य', prefer: 'बताना नहीं चाहते', phone: 'फ़ोन नंबर', email: 'ईमेल पता',
    language: 'पसंदीदा भाषा', emergency: 'आपातकालीन संपर्क (वैकल्पिक)', contactName: 'संपर्क का नाम', relationship: 'रिश्ता', contactPhone: 'संपर्क फ़ोन',
    abha: 'आभा आईडी (वैकल्पिक)', consentTitle: 'आपकी सहमति', caseConsent: 'मैं इस मुलाक़ात के लिए अपनी जानकारी देखभाल टीम के साथ साझा करने की सहमति देता/देती हूँ।',
    docsConsent: 'मैं चिकित्सा दस्तावेज़ अपलोड करने पर उन्हें डिजिटल करने की सहमति देता/देती हूँ।', aiConsent: 'मैं अपने स्वास्थ्य संबंधी जवाबों को व्यवस्थित करने और चिकित्सक की समीक्षा के लिए अस्पताल की कॉन्फ़िगर की गई AI सेवा को भेजने की सहमति देता/देती हूँ। AI निदान या दवा नहीं बताएगा.',
    privacy: 'आपकी जानकारी सुरक्षित रखी जाती है और केवल अधिकृत देखभाल कर्मचारियों के साथ साझा होती है।', next: 'स्वास्थ्य प्रश्नों पर जाएँ', back: 'वापस', saving: 'सहेज रहे हैं…',
  },
};

export default function PatientRegistrationForm({ language, onBack, onRegistered }) {
  const t = labels[language];
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, getFieldState, formState: { errors } } = useForm({
    resolver: zodResolver(patientRegistrationSchema),
    defaultValues: {
      fullName: '', dateOfBirth: '', gender: 'unknown', phone: '', email: '', preferredLanguage: language,
      emergencyContact: { name: '', relationship: '', phone: '' }, abhaId: '',
      consent: { caseTaking: false, documentProcessing: false, aiAssistance: false },
    },
  });

  const submit = async (values) => {
    setServerError('');
    setSaving(true);
    try {
      const { data } = await api.post('/patients/register', values);
      sessionStorage.setItem('medikiosk-intake-token', data.intakeToken);
      sessionStorage.setItem('medikiosk-patient-id', data.patient.patientId);
      onRegistered(data.patient, data.intakeToken);
    } catch (error) {
      setServerError(error.response?.data?.error?.message || 'We could not save your details. Please ask reception for help.');
    } finally {
      setSaving(false);
    }
  };

  const textField = (name, label, options = {}) => <label className="patient-field" htmlFor={name} key={name}><span>{label}</span><input id={name} type={options.type || 'text'} placeholder={options.placeholder || ''} autoComplete={options.autoComplete} {...register(name)} />{getFieldState(name).error && <small className="patient-field-error">{getFieldState(name).error.message}</small>}</label>;

  return <div className="intake-layout"><section className="panel patient-form-panel">
    <div className="intake-heading"><span className="intake-icon"><HeartPulse size={19} /></span><div><span className="intake-step-label">STEP 1 OF 2</span><h1>{t.heading}</h1><p>{t.sub}</p></div></div>
    {serverError && <div className="patient-api-error" role="alert"><AlertCircle size={16} />{serverError}</div>}
    <form onSubmit={handleSubmit(submit)} noValidate>
      <div className="patient-form-grid">{textField('fullName', t.name, { autoComplete: 'name' })}{textField('dateOfBirth', t.dob, { type: 'date', autoComplete: 'bday' })}
        <label className="patient-field" htmlFor="gender"><span>{t.gender}</span><select id="gender" {...register('gender')}><option value="unknown">{t.select}</option><option value="female">{t.female}</option><option value="male">{t.male}</option><option value="other">{t.other}</option><option value="prefer_not_to_say">{t.prefer}</option></select></label>
        {textField('phone', t.phone, { type: 'tel', autoComplete: 'tel' })}{textField('email', t.email, { type: 'email', autoComplete: 'email' })}
        <label className="patient-field" htmlFor="preferredLanguage"><span>{t.language}</span><select id="preferredLanguage" {...register('preferredLanguage')}><option value="en">English</option><option value="hi">हिन्दी</option><option value="other">Other</option></select></label>
      </div>
      <div className="patient-subsection"><h2>{t.emergency}</h2><div className="patient-form-grid">{textField('emergencyContact.name', t.contactName)}{textField('emergencyContact.relationship', t.relationship)}{textField('emergencyContact.phone', t.contactPhone, { type: 'tel' })}</div></div>
      <div className="patient-subsection"><h2>{t.abha}</h2>{textField('abhaId', t.abha, { placeholder: 'ABHA ID' })}</div>
      <div className="consent-box"><h2><ShieldCheck size={17} /> {t.consentTitle}</h2>
        <label className="consent-row required-consent"><input type="checkbox" {...register('consent.caseTaking')} /><span>{t.caseConsent} <b>*</b></span></label>{errors.consent?.caseTaking && <small className="patient-field-error consent-error">{errors.consent.caseTaking.message}</small>}
        <label className="consent-row"><input type="checkbox" {...register('consent.documentProcessing')} /><span>{t.docsConsent}</span></label>
        <label className="consent-row"><input type="checkbox" {...register('consent.aiAssistance')} /><span>{t.aiConsent}</span></label>
        <p className="consent-privacy">{t.privacy}</p>
        <p className="consent-privacy safety-consent-note">A limited local phrase check can alert staff even when AI assistance is off. It can miss emergencies; tell a staff member directly if urgent help is needed.</p>
      </div>
      <div className="patient-form-actions"><button className="patient-back-button" type="button" onClick={onBack}><ArrowLeft size={16} /> {t.back}</button><button className="button button-primary patient-next" type="submit" disabled={saving}>{saving ? t.saving : t.next} <ArrowRight size={16} /></button></div>
    </form>
  </section><aside className="intake-side-note"><div className="intake-side-icon"><ShieldCheck size={20} /></div><h2>Your story, at your pace.</h2><p>You can skip optional questions and ask the front desk for help at any time.</p><div className="side-note-rule" /><small>Only share what you feel comfortable sharing. Your doctor can ask follow-up questions in person.</small></aside></div>;
}
