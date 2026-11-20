import './patient-queue-filters.css';

const severityOptions = [
  ...Array.from({ length: 11 }, (_, score) => [String(score), `${score}/10`]),
  ['not_recorded', 'Not recorded'],
];

const statusOptions = [
  ['not_started', 'Not started'],
  ['in_progress', 'In progress'],
  ['needs_review', 'Needs review'],
  ['reviewed', 'Reviewed'],
];

export function matchesQueueFilters(patient, { department, severity, status }) {
  const caseStatus = patient.caseStatus === 'completed'
    ? (patient.clinicalReview?.status === 'approved' ? 'reviewed' : 'needs_review')
    : patient.caseStatus;
  const severityValue = patient.reportedSeverity == null ? 'not_recorded' : String(patient.reportedSeverity);

  return (!department || patient.department === department)
    && (!severity || severityValue === severity)
    && (!status || caseStatus === status);
}

export default function PatientQueueFilters({ patients, filters, showSeverity, onChange }) {
  const departments = [...new Set([filters.department, ...patients.map((patient) => patient.department)].filter(Boolean))]
    .sort((first, second) => first.localeCompare(second));

  return (
    <div className="queue-quick-filters" role="group" aria-label="Patient queue filters">
      <label>
        <span>Department</span>
        <select value={filters.department} onChange={(event) => onChange('department', event.target.value)}>
          <option value="">All departments</option>
          {departments.map((department) => <option key={department} value={department}>{department}</option>)}
        </select>
      </label>
      {showSeverity && (
        <label>
          <span>Reported severity</span>
          <select value={filters.severity} onChange={(event) => onChange('severity', event.target.value)}>
            <option value="">All scores</option>
            {severityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      )}
      <label>
        <span>Case status</span>
        <select value={filters.status} onChange={(event) => onChange('status', event.target.value)}>
          <option value="">All statuses</option>
          {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </div>
  );
}
