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
- `PATCH /api/patients/:patientId/clinical-review` is restricted to doctors and administrators. It accepts `status` (`pending`, `approved`, or `revisions_needed`), `doctorNotes`, and clinician-verified history. Approval is rejected until the patient completes intake. Original patient responses are retained separately, previous clinician review versions are snapshotted, and every update is audited.
- `PATCH /api/patients/:patientId/ayurveda` is restricted to doctors and administrators. It accepts the structured Dashavidha Pariksha, Prakriti/Vikriti, Agni, Koshtha, and Nidana assessment fields and records the assessing staff member and time.
- `GET /api/patients/:patientId/documents/:documentId` and `GET .../:documentId/file` require doctor/administrator role. The file endpoint streams the original; storage paths are never returned.
- `PATCH /api/patients/:patientId/documents/:documentId/review` lets doctors/administrators correct OCR text and notes while retaining the original extracted text and file.
- `POST /api/patients/:patientId/summary/generate` assembles a draft from patient responses, verified history, Ayurveda assessment, and only clinician-reviewed document text. If the patient gave AI-assistance consent and an optional provider is configured, the provider may create the draft. Otherwise it is assembled deterministically.
- `PATCH /api/patients/:patientId/summary` accepts `{ "text", "status": "draft" | "approved" }`; approval requires completed intake. Previous summary versions are retained.
- `GET /api/patients/:patientId/fhir-r4` is restricted to doctors and administrators. It returns a downloadable FHIR R4 `Bundle` of type `collection` containing a `Patient` and a `DocumentReference` for the approved clinical summary. Intake must be complete and the summary approved. The response is audit logged and is not sent to an external server.

## Emergency alerts

- `GET /api/alerts` returns open and acknowledged human-assessment alerts to authenticated staff.
- `PATCH /api/alerts/:alertId` accepts `{ "status": "acknowledged" | "resolved" }`. A staff member must acknowledge an alert before resolving it. Alerts retain the patient link and timestamps, not the triggering answer text.

Every patient list/detail read and kiosk write is audit logged. The list response includes a clinical review status but no clinical history. Patient responses remain unverified until a clinician reviews them. These endpoints do not produce diagnoses or treatment recommendations.

## AI service

The Python service exposes `GET /health`, `POST /api/v1/conversation/next`, `POST /api/v1/ocr/extract`, and `POST /api/v1/summary/generate`. OCR extracts embedded PDF text and uses Tesseract for images/scanned pages. The health response reports whether the Tesseract executable is available. OCR candidates remain unverified. An optional OpenAI-compatible adapter is disabled by default and can only be used for summary generation when patient AI-assistance consent is recorded. Bind the service to loopback during development and a private network in deployment.

The FHIR export is a local file workflow. It does not authenticate to or transmit data to an ABDM sandbox; that requires a registered client, target profiles, and deployment-specific consent and authentication configuration.
