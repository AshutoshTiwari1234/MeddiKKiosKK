# MediKiosk

MediKiosk is an SIH 2026 prototype for patient case-taking in hospital OPD settings, including AYUSH workflows. Its design keeps patient intake distinct from the staff workspace and treats AI-generated information as clinician-reviewed input.

## Phase 1 architecture

- `frontend/`: React 19, JavaScript/JSX, Vite, Tailwind CSS, React Router, Redux Toolkit and Axios. The patient welcome flow and staff dashboard are separate routes and experiences.
- `backend/`: Express REST API with security headers, origin-restricted CORS, request logging, MongoDB/Mongoose persistence and centralized error handling.
- `ai-service/`: Python/FastAPI conversation service with a local demo engine and optional provider adapter.
- `docs/`: architecture and API notes.

The dashboards use database-backed patient records. Development should use synthetic data only. MediKiosk supports case-taking and clinician review workflows, but it is not a production clinical system and does not diagnose or recommend treatment.

## Phase 2: identity and patient data foundation

- MongoDB connection status is visible at `/api/health`; database-backed requests return `503` when MongoDB is unavailable.
- Staff accounts use bcrypt password hashes, login throttling and temporary lockout after repeated failures. Doctors and receptionists can submit account requests; accounts remain inactive until an administrator approves them. Public requests cannot create administrators.
- JWT sessions are held in HTTP-only, short-lived cookies. API authorization reloads the account and role from MongoDB on every protected request.
- Administrators can create staff accounts, approve or reject account requests, and deactivate/reactivate accounts from `/team`. Doctors and receptionists do not have access to account administration.
- Staff can update their password at `/account`; a password change invalidates older sessions.
- Patient and audit-log Mongoose models are present with indexes. Patient intake and record APIs are Phase 3.

## Phase 3: patient registration and case history

- The patient kiosk supports English and Hindi registration, demographic details, optional ABHA ID, emergency contact, and consent capture. Consent to case-taking is required; document-processing and AI-assistance consent are optional and default off.
- Successful registration creates a unique `MK-` patient ID and returns a random, short-lived intake capability. Only its hash is stored, it expires after two hours, and it is revoked when the case history is completed.
- A guided, one-question-at-a-time form captures chief complaint and SOCRATES-style symptom details, past medical/surgical history, medication, allergy, family and personal history, and review of systems. Answers save as the patient proceeds.
- Staff can search patient records and view registration/history. API routes require a staff session. Receptionists see demographic details; clinical history and ABHA are restricted to doctors and administrators.
- The dashboard queue and patient counts use saved records. No patient examples are hardcoded.
- This phase stores patient-reported information only. It does not diagnose or recommend treatment; clinicians must verify the history.

## Phase 4: clinician review and Ayurveda assessment

- The doctor workspace supports reviewing patient-reported history separately from clinician-verified history. Clinicians can save drafts, request follow-up, or approve a completed intake.
- Review status and changes are audit logged. Prior clinician review snapshots remain available for comparison; the original patient responses are retained.
- Doctors and administrators can record Dashavidha Pariksha fields, Prakriti/Vikriti, Agni, Koshtha and Nidana. This is clinician-entered structured documentation, not an AI-generated diagnosis.
- Receptionists can see queue/review status but cannot view or edit clinical history or Ayurveda assessments.
- Patient record views include prior review versions and the clinical review/Ayurveda forms. The queue reflects pending and completed reviews.

## Phase 5: multilingual conversation and voice

- The kiosk can call a local FastAPI conversation service when the patient explicitly opts into AI assistance. With consent off, the answer is not sent to the AI service and the kiosk continues in guided mode.
- The included assistant is a deterministic, clearly labeled demo. It can ask one clarification when the main concern is too brief and flags a small set of explicit emergency phrases for immediate staff attention. It does not diagnose, recommend treatment, or create clinical summaries.
- An OpenAI-compatible chat completion adapter is available behind an explicit `MEDIKIOSK_AI_MODE=openai-compatible` setting and server-only `AI_PROVIDER_URL`, `AI_PROVIDER_API_KEY`, and `AI_PROVIDER_MODEL` variables. It is disabled by default; configure it only for a provider approved for the hospital's consent and data-handling policy.
- If the AI service is unavailable, the backend returns a guided fallback so the patient's intake can continue.
- The kiosk offers browser-based speech recognition and speech playback in English and Hindi, with text input always available. Speech recognition behavior and processing depend on the browser.
- The AI service does not persist prompts. The backend sends only the question field, answer, language, and follow-up state after opt-in; it omits patient name, ID, and contact details.

## Phase 6: medical documents and clinical summary drafts

- Patients may upload PDF, JPEG, or PNG records during check-in only after document-processing consent. Uploads are limited to 10 MB and 20 PDF pages, named with random storage identifiers, and kept under a private directory that is not served as static content.
- The AI service extracts embedded PDF text and uses Tesseract for scanned PDFs and images. OCR text, candidate dates, and measurement lines remain unverified; original uploads are preserved.
- Doctors and administrators can download originals through an authorized, audited API, correct OCR text, add review notes, and mark documents reviewed. Receptionists cannot access documents or extracted medical text.
- Clinicians can assemble a structured summary from patient responses, clinician-verified fields, Ayurveda assessment, and clinician-reviewed document text. The summary remains an editable draft until approved; previous versions are retained.
- If AI assistance was consented to and an OpenAI-compatible provider is configured, summary generation can use that provider. Otherwise it uses a deterministic structured assembly. Provider mode is disabled by default and generated drafts require clinician approval.

## Phase 7: safety, consent history, and FHIR export

- A local safety phrase check runs on intake answers even when AI assistance is off. Matching phrases create a staff alert without sending that answer to an external model; the alert stores no answer text. Staff see open alerts on the dashboard, acknowledge them, and resolve them after follow-up. The phrase check is limited and does not replace direct requests for urgent help or clinical assessment.
- Patients can withdraw case-taking consent or turn off optional document processing and AI assistance during check-in. Each choice is timestamped and retained in the patient record; withdrawal immediately prevents further processing of that type for the active intake session.
- Doctors and administrators can download a FHIR R4 collection Bundle after intake is complete and a clinician has approved the summary. It contains a Patient resource and a DocumentReference for the approved note, and the export is audit logged. The FHIR resource structure follows the HL7 FHIR R4 specification.
- This release exports a local FHIR file only. ABDM sandbox authentication, consent-manager flows, profiles, and network exchange still require a registered sandbox client and deployment configuration; no patient data is sent to an external health network by this prototype.

## Phase 8: Smart Kiosk Experience & Complete End-to-End Flow

- **Interactive Body Map Selector**: When specifying symptom locations, patients can tap an interactive anatomical body silhouette with hotspot zones (Head, Throat, Chest, Abdomen, Arms, Spine, Knees, Skin) or pick detailed sub-location chips in English or Hindi.
- **Wong-Baker Animated Pain Scale**: A 0–10 visual scale with 6 color-coded expressive face emojis (😄 to 😭), bilingual descriptions, and smooth gradient slider.
- **Symptom Quick Suggestions & Voice Visualizer**: Quick-entry symptom pills for chief complaints, and a pulsating audio waveform that provides reassuring visual feedback during microphone speech input and question read-out.
- **1-Click Evaluator Demo Presets**: Pre-configured real-world case templates (🌿 AYUSH Amavata joint stiffness, ⚡ Acute Migraine & Acidity, 🩺 Seasonal Bronchial Allergy) with 1-click auto-fill for instant hackathon demonstrations.
- **Digital OPD Token Slip / Printable Pass**: Generates an official OPD Pass upon check-in completion, displaying large queue tokens (e.g. `AY-104`), assigned consultation cabin/room, estimated wait time, scannable QR verification code, 45-second auto reset timer, and print support (`window.print()`).
- **Waiting Hall Public TV Display (`/display`)**: Dedicated full-screen waiting room TV monitor board showing real-time called tokens, upcoming queue status, audio voice chime announcements, and rotating AYUSH wellness tips.
- **Objective Triage Vitals**: Record blood pressure, pulse rate, SpO2, temperature, weight, and height, with automatic BMI calculation and clinical hypertension/BMI classification badges.
- **Prescription & Treatment Builder**: Clinicians can prescribe medications with dosage, frequency, and food instructions, add AYUSH Pathya (Dietary regimen) and Apathya (Strict restrictions), and generate/print official hospital prescription slips with doctor signature lines and Rx letterhead.
- **Interactive Ayurveda Tri-Dosha Radar**: Visual balance gauges for Vata, Pitta, and Kapha energies that update in real time based on selected Prakriti and Vikriti constitutions.
- **Instant Demo Database Seed**: Run `npm run seed:demo` in `backend` to populate active patients with realistic vitals, case histories, and prescriptions.

Before using Phase 2, configure MongoDB and a private JWT secret. From the project root in PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env.local
```

Edit `backend/.env.local`: the local default uses a separate `medikiosk_dev` database; set `MONGODB_URI` to another development database only if needed. Replace `JWT_SECRET` with a random value. `.env.local` is ignored by Git. Generate a secret with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Then create the first administrator through the hidden-password interactive prompt:

```powershell
cd backend
npm.cmd run create-admin
```

Start the backend and frontend in separate terminals using the commands below, then sign in at `/login`. Staff accounts can be created by the administrator from the Staff accounts page. Do not use real patient data in this prototype.

## Requirements

- Node.js 20 or later and npm
- Python 3.10+ for the AI service
- Tesseract OCR executable on the AI-service host for image OCR and scanned PDFs; embedded-text PDFs work without it
- MongoDB is required for Phase 2 authentication and protected API routes

## Run locally

In separate terminals:

```sh
cd backend
npm install
npm run dev
```

```sh
cd frontend
npm install
npm run dev
```

For the AI conversation demo, use another terminal:

```powershell
cd ai-service
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Open http://localhost:5173. The backend health endpoint is http://localhost:5000/api/health and AI service health is http://localhost:8000/health; AI health reports Tesseract availability. Set `VITE_API_URL` in `frontend/.env.local` to change the API base URL; set `PORT`, `FRONTEND_URL`, `AI_SERVICE_URL`, and optionally `MEDICAL_DOCUMENT_DIR` in `backend/.env.local` to configure the API, AI service, and private document volume. Install Tesseract separately and add its executable to `PATH` to enable scanned/image OCR.

Backend checks:

```sh
npm test
npm run test:integration
```

AI service checks (from `ai-service`):

```powershell
python -m unittest discover -s tests -v
```

The integration test requires a reachable MongoDB and uses a uniquely named temporary database that it drops after the test completes.

## Deployment work

Before any hospital deployment, complete the ABDM sandbox integration against the target implementation guide, configure operational alert delivery and retention, and validate the workflow with the hospital's clinical and privacy owners. Keep AI-generated content labeled and subject to clinician approval. Emergency warning signs must route to immediate human assessment.
