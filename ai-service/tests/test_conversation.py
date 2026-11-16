import os
import unittest
from unittest.mock import patch

import pymupdf as fitz

from app.conversation import OpenAICompatibleEngine, RuleBasedDemoEngine
from app.ocr import OcrUnavailable, extract_candidates, extract_document_text, ocr_engine_available
from app.summary import assemble_summary, generate_summary


class ConversationEngineTests(unittest.TestCase):
    def setUp(self):
        self.engine = RuleBasedDemoEngine()

    def test_short_main_concern_gets_one_clarification(self):
        result = self.engine.next_turn('chiefComplaint', 'pain', 'en', False)
        self.assertIsNotNone(result.follow_up_question)

    def test_follow_up_answer_does_not_loop(self):
        result = self.engine.next_turn('chiefComplaint', 'headache since morning', 'en', True)
        self.assertIsNone(result.follow_up_question)

    def test_explicit_breathing_emergency_routes_to_staff(self):
        result = self.engine.next_turn('associatedSymptoms', "I can't breathe", 'en', False)
        self.assertTrue(result.urgent)
        self.assertIn('staff member', result.urgent_message)

    def test_negated_emergency_phrase_does_not_raise_alert(self):
        result = self.engine.next_turn('associatedSymptoms', 'I have no difficulty breathing', 'en', False)
        self.assertFalse(result.urgent)

    def test_optional_provider_falls_back_without_credentials(self):
        os.environ.pop('AI_PROVIDER_URL', None)
        os.environ.pop('AI_PROVIDER_API_KEY', None)
        os.environ.pop('AI_PROVIDER_MODEL', None)
        result = OpenAICompatibleEngine().next_turn('chiefComplaint', 'pain', 'en', False)
        self.assertEqual(result.mode, 'demo')
        self.assertIsNotNone(result.follow_up_question)

    def test_hindi_response_is_localized(self):
        result = self.engine.next_turn('duration', 'दो दिन', 'hi', False)
        self.assertIn('धन्यवाद', result.reply)


class OcrExtractionTests(unittest.TestCase):
    def test_text_pdf_extracts_content_without_image_ocr(self):
        pdf = fitz.open()
        page = pdf.new_page()
        page.insert_text((72, 72), 'Lab report 2026-05-04 Glucose 106 mg/dL')
        data = pdf.tobytes()
        pdf.close()

        result = extract_document_text(data, 'application/pdf')
        self.assertIn('Glucose 106 mg/dL', result['text'])
        self.assertIn('2026-05-04', result['candidates']['dates'])
        self.assertTrue(any('Glucose 106 mg/dL' in row for row in result['candidates']['measurementLines']))

    def test_image_ocr_reports_missing_tesseract_instead_of_fake_text(self):
        if ocr_engine_available():
            self.skipTest('Tesseract is installed on this host.')
        from io import BytesIO
        from PIL import Image

        image = BytesIO()
        Image.new('RGB', (2, 2), 'white').save(image, format='PNG')
        with self.assertRaises(OcrUnavailable):
            extract_document_text(image.getvalue(), 'image/png')

    def test_candidate_extraction_keeps_original_measurement_line(self):
        result = extract_candidates('HbA1c   6.5 %\nBlood pressure 120/80 mmHg')
        self.assertIn('HbA1c   6.5 %', result['measurementLines'])
        self.assertIn('Blood pressure 120/80 mmHg', result['measurementLines'])


class SummaryGenerationTests(unittest.TestCase):
    def test_structured_summary_prefers_verified_fields_and_marks_draft(self):
        text = assemble_summary({
            'patientReported': {'chiefComplaint': 'Patient answer'},
            'verifiedHistory': {'chiefComplaint': 'Clinician correction'},
            'reviewedDocuments': [{'category': 'lab_report', 'text': 'Glucose 106 mg/dL'}],
            'ayurvedaAssessment': {},
        })
        self.assertIn('Chief complaint: Clinician correction', text)
        self.assertIn('Glucose 106 mg/dL', text)
        self.assertIn('Check it against source records', text)
        self.assertNotIn('diagnosis:', text.casefold())

    def test_provider_mode_is_not_used_without_assistance_consent(self):
        settings = {
            'MEDIKIOSK_AI_MODE': 'openai-compatible',
            'AI_PROVIDER_URL': 'https://invalid.example/v1/chat/completions',
            'AI_PROVIDER_API_KEY': 'test-only',
            'AI_PROVIDER_MODEL': 'test-model',
        }
        with patch.dict(os.environ, settings):
            result = generate_summary({'patientReported': {}, 'allowExternalModel': False})
        self.assertEqual(result['mode'], 'assembled')


if __name__ == '__main__':
    unittest.main()
