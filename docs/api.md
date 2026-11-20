# API notes

## `GET /`

Returns a short service welcome response with the health endpoint path. This is useful when opening the backend port in a browser.

## `GET /api/health`

Returns service liveness without touching patient data or requiring MongoDB.

```json
{
  "status": "ok",
  "service": "medikiosk-api",
  "timestamp": "2026-11-16T00:00:00.000Z"
}
```

Unknown `/api` routes return a JSON 404. Future routes must validate inputs, authenticate callers, authorize by role and record access to sensitive patient records.

## Staff identity endpoints

All session endpoints require MongoDB. Sessions use the `medikiosk_session` HTTP-only cookie; the browser client must send credentials.

- `POST /api/auth/login` accepts `{ "email", "password" }`; throttled to 10 attempts per 15 minutes per client.
- `POST /api/auth/account-requests` accepts a doctor or receptionist request, including a password of at least 12 characters. It creates an inactive account and returns a generic `202` response; an administrator must approve the request before sign-in. Requests are limited to five per hour per client.
- `POST /api/auth/logout` clears an authenticated session.
- `GET /api/auth/me` returns the current active staff identity and role.
- `POST /api/auth/password` accepts `{ "currentPassword", "newPassword" }`; new passwords must contain at least 12 characters and prior sessions are invalidated.
- `GET /api/users`, `POST /api/users`, `PATCH /api/users/:userId/status`, and `DELETE /api/users/:userId` require the `administrator` role. The delete route only rejects an inactive pending request. Activating a pending request marks it approved.

The first administrator is created through the interactive `npm run create-admin` command. Public requests cannot create administrator accounts. Roles are `administrator`, `doctor`, and `receptionist`. Password hashes and session version fields are never returned by the API.

## Patient endpoints

- `POST /api/patients/register` is the public kiosk registration endpoint. It requires `consent.caseTaking: true`; optional processing/AI consent defaults to false. It returns the patient record (with ABHA and internal intake credentials omitted), patient ID, and a random intake token.
- `POST /api/patients/intake/conversation` accepts `{ "field", "answer", "language", "followUpAnswer?" }` and the intake capability in `X-Intake-Token`. It sends the answer to the configured local AI service only when the patient opted into AI assistance and the local safety phrase check does not match. Without AI consent, it returns a guided response without forwarding the answer; the local phrase check can still create a human-assessment alert. It returns a guided fallback if the AI service is unavailable. The AI service does not persist requests.
- `POST /api/patients/intake/documents` is a multipart upload with `document` and `category` fields. It requires a valid intake token and `consent.documentProcessing: true`, accepts PDF/JPEG/PNG up to 10 MB, and stores the original in a private directory. OCR may report `unavailable` when Tesseract is absent; the original remains available for clinician review.
- `PATCH /api/patients/intake/case-history` accepts one or more allowlisted patient-reported case-history fields; send the capability in the `X-Intake-Token` header. The token expires after two hours and is revoked when `{ "complete": true }` is saved. Do not log or share this capability token.
- `PATCH /api/patients/intake/consent` accepts boolean updates for `caseTaking`, `documentProcessing`, and/or `aiAssistance` with the intake capability. Every change is stored as a timestamped consent snapshot. Turning off case-taking revokes the token; turning off optional processing blocks later requests that need that consent.
- `GET /api/patients?today=true&limit=100` requires an authenticated staff account and returns dashboard queue fields without clinical history or ABHA. Doctors and administrators can opt in with `includeSeverity=true` to receive `reportedSeverity` (the patient-reported 0–10 score, or `null` if absent) on each row.
- `POST /api/patients/search` accepts `{ "q", "page", "limit" }` in the JSON body and requires an authenticated staff account. It returns paginated results without clinical history or ABHA, keeping search terms out of request URLs.
- `GET /api/patients/:patientId` requires an authenticated staff account. Doctors and administrators receive case history and ABHA; receptionists receive registration details only.
- `PATCH /api/patients/:patientId/vitals` accepts blood pressure, pulse, SpO₂, temperature, weight and height. Each save updates the current vitals and appends a timestamped reading to `vitalsHistory` (the most recent 100 readings are kept).
- `GET /api/patients/:patientId/vitals/history` requires an authenticated staff account and returns `{ patientId, readings }`, oldest first, for the vitals trend chart.
- `PATCH /api/patients/:patientId/clinical-review` is restricted to doctors and administrators. It accepts `status` (`pending`, `approved`, or `revisions_needed`), `doctorNotes`, and clinician-verified history. Approval is rejected until the patient completes intake. Original patient responses are retained separately, previous clinician review versions are snapshotted, and every update is audited.
- `PATCH /api/patients/:patientId/ayurveda` is restricted to doctors and administrators. It accepts the structured Dashavidha Pariksha, Prakriti/Vikriti, Agni, Koshtha, and Nidana assessment fields and records the assessing staff member and time.
- `GET /api/patients/:patientId/documents/:documentId` and `GET .../:documentId/file` require doctor/administrator role. The file endpoint streams the original; storage paths are never returned.
- `PATCH /api/patients/:patientId/documents/:documentId/review` lets doctors/administrators correct OCR text and notes while retaining the original extracted text and file.
- `POST /api/patients/:patientId/summary/generate` assembles a draft from patient responses, verified history, Ayurveda assessment, and only clinician-reviewed document text. If the patient gave AI-assistance consent and an optional provider is configured, the provider may create the draft. Otherwise it is assembled deterministically.
- `PATCH /api/patients/:patientId/summary` accepts `{ "text", "status": "draft" | "approved" }`; approval requires completed intake. Previous summary versions are retained.
- `GET /api/patients/:patientId/fhir-r4` is restricted to doctors and administrators. It returns a downloadable FHIR R4 `Bundle` of type `collection` containing a `Patient` and a `DocumentReference` for the approved clinical summary. Intake must be complete and the summary approved. The response is audit logged and is not sent to an external server.

## Prescriptions and treatment plans

- `GET /api/patients/:patientId/prescription` and `GET /api/patients/:patientId/prescription/history` return the current prescription and its saved versions to doctors and administrators.
- `PUT /api/patients/:patientId/prescription` replaces the medication list and accepts optional `instructions`, `investigations`, `ayushAdvice`, `generalAdvice`, and `followUpDate` (a `YYYY-MM-DD` date or `null`). Medication rows can include `form`. Omitted optional treatment-plan fields retain their saved values. An empty medication list requires submitted treatment-plan details.
- Each successful save snapshots the previous version, including its treatment plan and interaction warnings, and returns the updated prescription with recalculated warnings. A competing save can return `409` if another request saved the same version first.

## OPD analytics

- `GET /api/analytics/opd?from=YYYY-MM-DD&to=YYYY-MM-DD&department=` requires an authenticated staff account. Both dates are optional (default: today) and the range may cover up to 366 days. It returns:
  - `overview`: `totalPatients`, `patientsCalled`, `averageWaitMinutes`, `maxWaitMinutes`, `averageConsultationMinutes`, `casesCompleted`, `reviewsApproved`, counts `byStatus`, and the `peakHour`.
  - `departments`: one row per department with `totalPatients`, `sharePercent`, average waiting and consultation time, and counts by status.
  - `hourly` and `daily` check-in counts.
- Waiting time is measured from check-in to the first time the patient is called. `POST /api/patients/:patientId/call` accepts `{ "status": "waiting" | "called" | "in_consultation" | "done" }` (default `called`) and records `calledAt`, `consultationStartedAt` and `consultationEndedAt`. Patients without a call timestamp are left out of the averages.

## Clinic sessions (OPD schedules)

A clinic session is one doctor's OPD shift in one cabin on one day. Times are local 24-hour `HH:MM`. Shift presets: `morning` 09:00–13:00, `afternoon` 14:00–17:00, `evening` 17:00–20:00; `custom` needs `startTime` and `endTime` (a preset may also be given explicit times).

- `GET /api/sessions?date=YYYY-MM-DD` or `?from=&to=` (default today, up to 92 days), with optional `doctorId`, `department`, `cabin`, `status` and `includeCancelled=true`. Available to all staff.
- `GET /api/sessions/cabins?date=` returns cabin allocation for a day: each allocated cabin with its sessions and, for today, the session occupying it right now.
- `GET /api/sessions/:sessionId` returns one session.
- `POST /api/sessions` (administrator or doctor) accepts `{ doctorId, date, shift, startTime?, endTime?, cabin, department?, slotMinutes? (default 15), maxPatients?, notes? }`. Doctors can only schedule themselves and may omit `doctorId`. Administrators must name an active doctor. Past dates are rejected.
- `PATCH /api/sessions/:sessionId` (administrator or the assigned doctor) changes date, shift, times, cabin, department, slot length, capacity or notes. Completed and cancelled sessions cannot be edited.
- `PATCH /api/sessions/:sessionId/status` accepts `{ "status": "active" | "completed" | "cancelled", "reason"? }`. Allowed changes: scheduled → active or cancelled, active → completed or cancelled.
- Creating or moving a session returns `409` if the doctor already has an overlapping session, or if the cabin is already allocated at that time (cabin names are compared ignoring case and extra spaces). Back-to-back sessions are allowed, and cancelled sessions free their slot.

## Follow-up appointments

A follow-up takes one slot inside one of the doctor's clinic sessions. The slot length is the session's `slotMinutes`, and start times must fall on the session's slot grid (for a 09:00 session with 15-minute slots: 09:00, 09:15, …).

- `POST /api/appointments` (administrator or doctor) accepts `{ patientId, doctorId?, date, startTime, reason?, notes? }`. Doctors may omit `doctorId` to book with themselves.
- `GET /api/appointments/availability?doctorId=&date=` lists the doctor's sessions that day with every slot marked `available` or not (`booked`, `past` or `session_full`).
- `GET /api/appointments` filters by `date` or `from`/`to` (default today), `doctorId`, `patientId` and `status`. With only `patientId`, it returns that patient's full follow-up history.
- `GET /api/appointments/:appointmentId` returns one appointment.
- `PATCH /api/appointments/:appointmentId/reschedule` accepts `{ date, startTime, doctorId? }` and keeps the previous times in `rescheduledFrom`.
- `PATCH /api/appointments/:appointmentId/status` accepts `{ "status": "completed" | "cancelled" | "no_show", "reason"? }`. Only booked appointments can change, and completed or no-show only once the appointment time has started.

Double bookings are rejected with `409`:
- The doctor already has a booked appointment in that slot.
- The patient already has a follow-up in the same clinic session, or another appointment at the same time.
- The session has reached `maxPatients`.
- The time is not covered by a scheduled or active session for that doctor.

Unique database indexes on booked appointments (doctor + start time, patient + session) also stop two requests that arrive at the same moment from both getting the slot. A clinic session with booked follow-ups cannot be cancelled, or moved so that a booking falls outside it, until those bookings are rescheduled or cancelled.

## Emergency alerts

- `GET /api/alerts` returns open and acknowledged human-assessment alerts to authenticated staff.
- `PATCH /api/alerts/:alertId` accepts `{ "status": "acknowledged" | "resolved" }`. A staff member must acknowledge an alert before resolving it. Alerts retain the patient link and timestamps, not the triggering answer text.

Every patient list/detail read and kiosk write is audit logged. The list response includes a clinical review status but no clinical history. Patient responses remain unverified until a clinician reviews them. These endpoints do not produce diagnoses or treatment recommendations.

## Kiosk feedback

- `POST /api/feedback` accepts only `{ "rating": 1 }`, where the rating is an integer from 1 to 5. It accepts anonymous survey responses independently of intake status and does not use session credentials or patient identifiers. Requests are limited to 30 per 15 minutes per client IP.
- The kiosk sends a random `Idempotency-Key` header (32 lowercase hexadecimal characters) for the life of the token slip. The first submission returns `201`. Repeating that key returns `200` and preserves the first accepted rating, even if requests overlap. Other clients may omit the header, in which case each accepted request creates a response.
- `GET /api/feedback/average` requires the `administrator` role and returns `{ "averageRating": 4.25, "count": 4 }` across all responses. An empty survey returns `{ "averageRating": null, "count": 0 }`.

## AI service

The Python service exposes `GET /health`, `POST /api/v1/conversation/next`, `POST /api/v1/ocr/extract`, and `POST /api/v1/summary/generate`. OCR extracts embedded PDF text and uses Tesseract for images/scanned pages. The health response reports whether the Tesseract executable is available. OCR candidates remain unverified. An optional OpenAI-compatible adapter is disabled by default and can only be used for summary generation when patient AI-assistance consent is recorded. Bind the service to loopback during development and a private network in deployment.

The FHIR export is a local file workflow. It does not authenticate to or transmit data to an ABDM sandbox; that requires a registered client, target profiles, and deployment-specific consent and authentication configuration.
