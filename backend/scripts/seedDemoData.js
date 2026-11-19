require('../config/loadEnv');
const mongoose = require('mongoose');
const Patient = require('../models/Patient');
const { connectDatabase } = require('../config/database');

async function seed() {
  await connectDatabase();
  console.log('Seeding demo patient records for today...');

  const today = new Date();

  const demoPatients = [
    {
      fullName: 'Rajesh Sharma',
      dateOfBirth: new Date('1978-04-12'),
      gender: 'male',
      phone: '9876543210',
      email: 'rajesh.sharma@example.com',
      preferredLanguage: 'hi',
      department: 'Ayurveda / AYUSH',
      queueToken: 'AY-104',
      roomNumber: 'Room 3 (AYUSH OPD)',
      callStatus: 'called',
      caseStatus: 'completed',
      emergencyContact: { name: 'Pooja Sharma', relationship: 'Spouse', phone: '9876543211' },
      abhaId: '14-8899-2345-6712',
      consent: { caseTaking: true, documentProcessing: true, aiAssistance: true, recordedAt: today, policyVersion: '1.0' },
      caseHistory: {
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
        pastMedicalHistory: 'Mild hypertension controlled with lifestyle',
        surgicalHistory: 'None',
        medicationHistory: 'Occasional paracetamol',
        allergies: 'No known drug allergies',
        familyHistory: 'Father had osteoarthritis; mother has diabetes',
        personalHistory: 'Sedentary desk job, disturbed sleep when pain flares',
        reviewOfSystems: 'Normal bowel movements, no chest pain',
      },
      ayurvedaAssessment: {
        prakriti: 'vata_kapha',
        vikriti: 'vata',
        sara: 'Madhyama Asthi & Majja Sara',
        samhanana: 'Madhyama',
        pramana: 'Madhyama',
        satmya: 'Mishra Satmya',
        sattva: 'Madhyama Sattva',
        aharaShakti: 'Manda Agni with sluggish digestion',
        vyayamaShakti: 'Avara (reduced stamina due to joint stiffness)',
        vaya: 'madhya',
        agni: 'vishama',
        koshtha: 'krura',
        nidana: 'Amavata caused by Mandagni, Vata-Kapha prakopa, and Guru-Sheeta ahara sevana.',
        assessedAt: today,
      },
      vitals: {
        bloodPressure: { systolic: 128, diastolic: 82 },
        pulseRate: 74,
        spo2: 98,
        temperature: 98.4,
        weight: 74,
        height: 172,
        bmi: 25.0,
        recordedAt: today,
      },
      prescription: {
        medications: [
          { name: 'Yogaraj Guggulu', dosage: '2 tablets', form: 'Tablet', frequency: '1-0-1', duration: '15 days', instructions: 'After food with lukewarm water' },
          { name: 'Dashamularishta', dosage: '20 ml', form: 'Kashaya', frequency: '1-0-1', duration: '15 days', instructions: 'With equal water after meals' },
          { name: 'Ashwagandha Churna', dosage: '3 g', form: 'Churna', frequency: '0-0-1', duration: '30 days', instructions: 'At bedtime with warm milk' },
        ],
        investigations: ['Bilateral Knee X-Ray (AP/Lat)', 'Serum Uric Acid', 'ESR'],
        ayushAdvice: {
          pathya: 'Warm water, barley/barley water, garlic, ginger, hot fomentation (Swedana) twice daily.',
          apathya: 'Avoid cold refrigerated foods, curd at night, sedentary long sitting, and direct cold wind.',
        },
        generalAdvice: 'Gentle non-weight bearing knee mobilization exercises. Review if swelling increases.',
        followUpDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        prescribedAt: today,
      },
      createdAt: today,
      updatedAt: today,
    },
    {
      fullName: 'Sunita Verma',
      dateOfBirth: new Date('1992-08-20'),
      gender: 'female',
      phone: '9123456789',
      email: 'sunita.verma@example.com',
      preferredLanguage: 'en',
      department: 'General Medicine',
      queueToken: 'GM-102',
      roomNumber: 'Room 1 (General OPD)',
      callStatus: 'waiting',
      caseStatus: 'completed',
      emergencyContact: { name: 'Vikram Verma', relationship: 'Brother', phone: '9123456788' },
      abhaId: '91-3344-5566-7788',
      consent: { caseTaking: true, documentProcessing: true, aiAssistance: true, recordedAt: today, policyVersion: '1.0' },
      caseHistory: {
        chiefComplaint: 'Throbbing right-sided headache with sensitivity to light and nausea',
        location: 'Head & Face: Temples / Behind right eye',
        onset: 'Started yesterday morning after poor sleep and skipping breakfast',
        duration: 'Continuous pulsating pain for the last 24 hours',
        character: 'Sharp, throbbing, pounding sensation behind the right temple',
        severity: 8,
        timing: 'Continuous; worsens with movement and bright light',
        aggravatingFactors: 'Bright sunlight, smartphone screen, loud noises',
        relievingFactors: 'Resting in a dark quiet room, ice pack on forehead',
        associatedSymptoms: 'Nausea, photophobia (light sensitivity)',
        pastMedicalHistory: 'History of episodic migraines twice a year',
        surgicalHistory: 'None',
        medicationHistory: 'Took ibuprofen 400mg yesterday with partial relief',
        allergies: 'Allergic to Sulfa drugs (skin rash)',
        familyHistory: 'Mother has migraine history',
        personalHistory: 'High screen time work, erratic sleep hours',
        reviewOfSystems: 'No vision blackout, no limb weakness',
      },
      vitals: {
        bloodPressure: { systolic: 118, diastolic: 76 },
        pulseRate: 80,
        spo2: 99,
        temperature: 98.6,
        weight: 58,
        height: 163,
        bmi: 21.8,
        recordedAt: today,
      },
      prescription: {
        medications: [
          { name: 'Naproxen', dosage: '250 mg', form: 'Tablet', frequency: '1-0-1', duration: '3 days', instructions: 'After meals' },
          { name: 'Pantoprazole', dosage: '40 mg', form: 'Tablet', frequency: '1-0-0', duration: '5 days', instructions: '30 mins before breakfast' },
          { name: 'Domperidone', dosage: '10 mg', form: 'Tablet', frequency: '1-0-1', duration: '3 days', instructions: 'Before food for nausea' },
        ],
        investigations: ['Routine Complete Blood Count (CBC)'],
        generalAdvice: 'Hydrate well with 2.5L water daily. Maintain regular sleep timings and limit screen glare.',
        followUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        prescribedAt: today,
      },
      createdAt: today,
      updatedAt: today,
    },
    {
      fullName: 'Amit Patel',
      dateOfBirth: new Date('1996-11-05'),
      gender: 'male',
      phone: '9988776655',
      email: 'amit.patel@example.com',
      preferredLanguage: 'en',
      department: 'General Medicine',
      queueToken: 'GM-103',
      roomNumber: 'Room 1 (General OPD)',
      callStatus: 'waiting',
      caseStatus: 'in_progress',
      emergencyContact: { name: 'Kavita Patel', relationship: 'Mother', phone: '9988776654' },
      abhaId: '22-1144-7788-9900',
      consent: { caseTaking: true, documentProcessing: false, aiAssistance: true, recordedAt: today, policyVersion: '1.0' },
      caseHistory: {
        chiefComplaint: 'Dry persistent cough, throat irritation, and low-grade evening fever',
        location: 'Neck & Throat: Throat / Center chest',
        onset: 'Started 4 days ago after dust exposure during festival cleaning',
        duration: 'Cough bouts occur 10-15 times a day',
        character: 'Dry hacking cough with scratchy raw sensation in throat',
        severity: 5,
        timing: 'Worse at night while lying down and early morning',
        aggravatingFactors: 'Dust, cold water, AC air, smoke',
        relievingFactors: 'Warm tea with honey, steam inhalation',
        associatedSymptoms: 'Runny nose, sneezing',
        pastMedicalHistory: 'Seasonal allergic rhinitis during spring',
        surgicalHistory: 'None',
        medicationHistory: 'Cetirizine 10mg taken at bedtime',
        allergies: 'Dust mites and pollen allergy',
        familyHistory: 'Brother has mild asthma',
        personalHistory: 'Non-smoker, exercises 3 times weekly',
        reviewOfSystems: 'No shortness of breath, no wheezing',
      },
      vitals: {
        bloodPressure: { systolic: 122, diastolic: 78 },
        pulseRate: 84,
        spo2: 98,
        temperature: 99.1,
        weight: 70,
        height: 175,
        bmi: 22.9,
        recordedAt: today,
      },
      createdAt: today,
      updatedAt: today,
    },
  ];

  for (const patientData of demoPatients) {
    const existing = await Patient.findOne({ fullName: patientData.fullName });
    if (existing) {
      Object.assign(existing, patientData);
      await existing.save();
      console.log(`Updated existing patient: ${patientData.fullName} (${existing.patientId})`);
    } else {
      const created = await Patient.create(patientData);
      console.log(`Created new demo patient: ${patientData.fullName} (${created.patientId})`);
    }
  }

  console.log('Demo seed completed successfully!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
