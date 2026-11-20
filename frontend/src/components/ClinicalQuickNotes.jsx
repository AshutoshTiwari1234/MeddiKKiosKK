import './clinical-quick-notes.css';

const templates = [
  { label: 'Visit context', text: 'Reason for visit: [main concern]\nPatient priorities: [goals or questions]' },
  { label: 'Findings', text: 'Relevant findings: [history, exam or results]\nAdditional observations: [details]' },
  { label: 'Assessment', text: 'Assessment: [clinical impression]\nOpen questions: [uncertainties to document]' },
  { label: 'Follow-up plan', text: 'Follow-up: [timing and next steps discussed]\nReturn precautions: [guidance discussed]' },
];

export default function ClinicalQuickNotes({ onInsert, disabled, error }) {
  return (
    <div className="clinical-quick-notes" role="group" aria-labelledby="clinical-quick-notes-label">
      <span id="clinical-quick-notes-label">Quick notes</span>
      <div className="clinical-quick-notes-options">
        {templates.map(({ label, text }) => (
          <button
            key={label}
            className="button button-secondary"
            type="button"
            disabled={disabled}
            onClick={() => onInsert(text)}
          >
            {label}
          </button>
        ))}
      </div>
      {error && <p className="form-field-error" role="alert">{error}</p>}
    </div>
  );
}
