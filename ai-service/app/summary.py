import json
import os
from urllib.request import Request, urlopen


FIELD_LABELS = {
    'chiefComplaint': 'Chief complaint', 'onset': 'Onset', 'duration': 'Duration', 'location': 'Location',
    'character': 'Character', 'severity': 'Severity (patient reported)', 'timing': 'Timing',
    'aggravatingFactors': 'Aggravating factors', 'relievingFactors': 'Relieving factors',
    'associatedSymptoms': 'Associated symptoms', 'pastMedicalHistory': 'Past medical history',
    'surgicalHistory': 'Surgical history', 'familyHistory': 'Family history', 'personalHistory': 'Personal history',
    'medicationHistory': 'Medication history', 'allergies': 'Allergies', 'reviewOfSystems': 'Review of systems',
}


def assemble_summary(payload: dict) -> str:
    reported = payload.get('patientReported', {})
    verified = payload.get('verifiedHistory', {})
    history_lines = []
    missing = []
    for field, label in FIELD_LABELS.items():
        verified_value = verified.get(field)
        value = verified_value if verified_value not in ('', None) else reported.get(field)
        if value in ('', None):
            missing.append(label)
            value = 'Not provided'
        elif isinstance(value, str) and len(value) > 240:
            value = value[:240] + '…'
        history_lines.append(f'{label}: {value}')

    documents = payload.get('reviewedDocuments', [])
    documents_text = '\n\n'.join(
        f"{item.get('category', 'Medical document').replace('_', ' ')}\n{item.get('text', '')[:500]}"
        for item in documents[:3] if item.get('text', '').strip()
    ) or 'No clinician-reviewed document text.'
    ayurveda = payload.get('ayurvedaAssessment', {})
    ayurveda_lines = [f'{key}: {str(value)[:200]}' for key, value in ayurveda.items() if value not in ('', None, 'not_assessed')]
    text = '\n\n'.join([
        'MediKiosk structured history draft',
        'Presenting history (clinician-verified values take precedence where entered)\n' + '\n'.join(history_lines),
        'Reviewed document text (OCR; clinician-reviewed)\n' + documents_text,
        'Ayurveda assessment\n' + ('\n'.join(ayurveda_lines) or 'Not documented'),
        'Information not provided\n' + (', '.join(missing) or 'No missing fields in the structured case history.'),
        'Verification: This draft assembles patient-reported history, clinician-entered values, and reviewed document text. Check it against source records before clinical use. It contains no diagnosis or treatment recommendation.',
    ])
    return text[:12_000]


def generate_summary(payload: dict) -> dict:
    fallback = assemble_summary(payload)
    required = ('AI_PROVIDER_URL', 'AI_PROVIDER_API_KEY', 'AI_PROVIDER_MODEL')
    if not payload.get('allowExternalModel') or os.getenv('MEDIKIOSK_AI_MODE') != 'openai-compatible' or not all(os.getenv(key, '').strip() for key in required):
        return {'mode': 'assembled', 'text': fallback}

    provider_payload = {
        'model': os.environ['AI_PROVIDER_MODEL'],
        'temperature': 0.1,
        'response_format': {'type': 'json_object'},
        'messages': [
            {
                'role': 'system',
                'content': (
                    'Create a concise structured clinical history draft only from the supplied patient history. '
                    'Return JSON with one key: text. Preserve uncertainty and missing information. Do not infer, '
                    'diagnose, interpret results, or recommend treatment. Mark the result as a draft requiring clinician verification. '
                    'Do not include identifying information. Use the requested language.'
                ),
            },
            {'role': 'user', 'content': json.dumps(payload, ensure_ascii=False)},
        ],
    }
    request = Request(
        os.environ['AI_PROVIDER_URL'],
        data=json.dumps(provider_payload).encode('utf-8'),
        headers={'Authorization': f"Bearer {os.environ['AI_PROVIDER_API_KEY']}", 'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urlopen(request, timeout=8) as response:
            provider_response = json.loads(response.read(256_000).decode('utf-8'))
        text = json.loads(provider_response['choices'][0]['message']['content']).get('text')
        if not isinstance(text, str) or not text.strip() or len(text) > 12_000:
            return {'mode': 'assembled', 'text': fallback}
        return {'mode': 'llm', 'text': text.strip()}
    except Exception:
        return {'mode': 'assembled', 'text': fallback}
