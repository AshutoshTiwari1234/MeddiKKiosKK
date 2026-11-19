import { Sparkles, Stethoscope, Zap } from 'lucide-react';

export const DEMO_PRESETS = [
  {
    id: 'ayurveda_joint',
    labelEn: '🌿 Ayurveda (Amavata Joint Pain)',
    labelHi: '🌿 आयुर्वेद (आमवात / जोड़ों का दर्द)',
    department: 'Ayurveda / AYUSH',
    patient: {
      fullName: 'Rajesh Sharma',
      dateOfBirth: '1978-04-12',
      gender: 'male',
      phone: '9876543210',
      email: 'rajesh.sharma@example.com',
      department: 'Ayurveda / AYUSH',
      emergencyContact: { name: 'Pooja Sharma', relationship: 'Spouse', phone: '9876543211' },
      abhaId: '14-8899-2345-6712',
      consent: { caseTaking: true, documentProcessing: true, aiAssistance: true },
    },
    answers: {
      chiefComplaint: 'Knee joint pain and morning stiffness with difficulty climbing stairs (Amavata pattern)',
      location: 'Knees & Legs: Both knees (bilateral)',
      onset: 'Began 3 months ago, gradually worsening during cold weather',
      duration: 'Stiffness lasts 1 to 2 hours every morning; pain comes and goes',
      character: 'Deep ache with joint stiffness, heaviness, and mild swelling around patella',
      severity: 7,
      timing: 'Most severe early morning upon waking and after prolonged sitting',
      aggravatingFactors: 'Cold exposure, morning dampness, heavy dairy products',
      relievingFactors: 'Warm fomentation (hot water bag), gentle movement, ginger water',
      associatedSymptoms: 'Mild indigestion (Agnimandya), heaviness in stomach after meals',
      pastMedicalHistory: 'Mild hypertension controlled with lifestyle, occasional gastric discomfort',
      surgicalHistory: 'None',
      medicationHistory: 'Occasional paracetamol; no regular prescription',
      allergies: 'No known drug or food allergies',
      familyHistory: 'Father had osteoarthritis; mother has diabetes',
      personalHistory: 'Sedentary desk job, prefers warm home-cooked meals, disturbed sleep when pain flares',
      reviewOfSystems: 'Normal bowel movements, no chest pain or shortness of breath',
    },
  },
  {
    id: 'migraine_case',
    labelEn: '⚡ Acute Migraine & Nausea',
    labelHi: '⚡ तीव्र माइग्रेन और मतली',
    department: 'General Medicine',
    patient: {
      fullName: 'Sunita Verma',
      dateOfBirth: '1992-08-20',
      gender: 'female',
      phone: '9123456789',
      email: 'sunita.verma@example.com',
      department: 'General Medicine',
      emergencyContact: { name: 'Vikram Verma', relationship: 'Brother', phone: '9123456788' },
      abhaId: '91-3344-5566-7788',
      consent: { caseTaking: true, documentProcessing: true, aiAssistance: true },
    },
    answers: {
      chiefComplaint: 'Throbbing right-sided headache with sensitivity to light and nausea',
      location: 'Head & Face: Temples / Behind right eye',
      onset: 'Started yesterday morning after poor sleep and skipping breakfast',
      duration: 'Continuous pulsating pain for the last 24 hours',
      character: 'Sharp, throbbing, pounding sensation behind the right temple',
      severity: 8,
      timing: 'Continuous; worsens with movement and bright light',
      aggravatingFactors: 'Bright sunlight, smartphone screen, loud noises, sudden head turns',
      relievingFactors: 'Resting in a dark quiet room, ice pack on forehead',
      associatedSymptoms: 'Nausea, photophobia (light sensitivity), phonophobia (sound sensitivity)',
      pastMedicalHistory: 'History of episodic migraines twice a year',
      surgicalHistory: 'None',
      medicationHistory: 'Took ibuprofen 400mg yesterday with only partial temporary relief',
      allergies: 'Allergic to Sulfa drugs (rash)',
      familyHistory: 'Mother has migraine history',
      personalHistory: 'High screen time work, erratic sleep hours, drinks 3 cups of coffee daily',
      reviewOfSystems: 'No vision blackout, no limb weakness, no fever',
    },
  },
  {
    id: 'bronchial_allergy',
    labelEn: '🩺 Seasonal Allergy & Cough',
    labelHi: '🩺 मौसमी एलर्जी और खांसी',
    department: 'General Medicine',
    patient: {
      fullName: 'Amit Patel',
      dateOfBirth: '1996-11-05',
      gender: 'male',
      phone: '9988776655',
      email: 'amit.patel@example.com',
      department: 'General Medicine',
      emergencyContact: { name: 'Kavita Patel', relationship: 'Mother', phone: '9988776654' },
      abhaId: '22-1144-7788-9900',
      consent: { caseTaking: true, documentProcessing: false, aiAssistance: true },
    },
    answers: {
      chiefComplaint: 'Dry persistent cough, throat irritation, and low-grade evening fever',
      location: 'Neck & Throat: Throat / Center chest',
      onset: 'Started 4 days ago after dust exposure during festival cleaning',
      duration: 'Cough bouts last 2-3 minutes, occurring 10-15 times a day',
      character: 'Dry hacking cough with scratchy raw sensation in throat',
      severity: 5,
      timing: 'Worse at night while lying down and early morning',
      aggravatingFactors: 'Dust, cold water, AC air, smoke',
      relievingFactors: 'Warm tea with honey, steam inhalation, throat lozenges',
      associatedSymptoms: 'Runny nose, sneezing, mild throat tickle',
      pastMedicalHistory: 'Seasonal allergic rhinitis during spring',
      surgicalHistory: 'None',
      medicationHistory: 'Cetirizine 10mg taken at bedtime',
      allergies: 'Dust mites and pollen allergy',
      familyHistory: 'Brother has mild asthma',
      personalHistory: 'Non-smoker, exercises 3 times weekly, drinks adequate water',
      reviewOfSystems: 'No shortness of breath, no wheezing, no chest tightness',
    },
  },
];

export default function DemoPresetsBar({ language = 'en', onSelectPreset }) {
  const isHindi = language === 'hi';

  return (
    <div className="demo-presets-banner" role="region" aria-label="Quick Demo Presets for Evaluators">
      <div className="demo-presets-label">
        <Sparkles size={14} className="sparkle-icon" />
        <span>{isHindi ? 'त्वरित डेमो केस (1-क्लिक ऑटो-फिल):' : 'Demo Presets (1-Click Auto-Fill):'}</span>
      </div>
      <div className="demo-presets-buttons">
        {DEMO_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="demo-preset-btn"
            onClick={() => onSelectPreset(preset)}
            title={`Auto-fill with sample case: ${preset.patient.fullName}`}
          >
            {isHindi ? preset.labelHi : preset.labelEn}
          </button>
        ))}
      </div>
    </div>
  );
}
