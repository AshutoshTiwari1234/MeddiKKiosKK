from dataclasses import dataclass
import json
import os
from urllib.request import Request, urlopen


URGENT_PHRASES = (
    'severe chest pain', 'crushing chest pain', 'difficulty breathing',
    'trouble breathing', "can't breathe", 'cannot breathe', 'slurred speech',
    'sudden speech difficulty', 'face drooping', 'loss of consciousness',
    'unconscious', 'severe bleeding', 'सांस लेने में कठिनाई', 'सांस नहीं ले पा',
    'बेहोश', 'बोलने में अचानक', 'बहुत ज्यादा खून बहना', 'सीने में तेज दर्द',
)

VAGUE_COMPLAINTS = {'pain', 'problem', 'unwell', 'not well', 'issue', 'discomfort', 'दर्द', 'तकलीफ', 'परेशानी'}
NEGATION_SUFFIXES = ('no', 'not', 'never', 'without', 'denies', 'denied', "don't have", 'do not have', "doesn't have", 'does not have', 'नहीं', 'नही')


@dataclass
class ConversationResult:
    mode: str
    reply: str
    follow_up_question: str | None = None
    urgent: bool = False
    urgent_message: str | None = None


class ConversationEngine:
    """Interface for a future consent-aware language model provider."""

    def next_turn(self, field: str, answer: str, language: str, follow_up_answer: bool) -> ConversationResult:
        raise NotImplementedError


class RuleBasedDemoEngine(ConversationEngine):
    """Local, deterministic demo. It does not diagnose or recommend treatment."""

    def next_turn(self, field: str, answer: str, language: str, follow_up_answer: bool) -> ConversationResult:
        normalized = answer.casefold()
        urgent = _has_urgent_phrase(normalized)
        if urgent:
            return ConversationResult(
                mode='demo',
                reply='Please stop and alert a staff member now.' if language == 'en' else 'कृपया रुकें और अभी कर्मचारी को बताएं।',
                urgent=True,
                urgent_message=(
                    'This response may need urgent attention. Please alert a staff member now for immediate human assessment. Do not wait for check-in to finish.'
                    if language == 'en'
                    else 'इस जानकारी पर तुरंत ध्यान देना आवश्यक हो सकता है। कृपया चेक-इन पूरा होने की प्रतीक्षा किए बिना अभी कर्मचारी को बताएं।'
                ),
            )

        if field == 'chiefComplaint' and not follow_up_answer:
            trimmed = answer.strip().casefold().rstrip(' .!?')
            if trimmed in VAGUE_COMPLAINTS or len(trimmed) < 12:
                return ConversationResult(
                    mode='demo',
                    reply='I can ask one more question to make sure we understand your concern.' if language == 'en' else 'आपकी परेशानी को बेहतर समझने के लिए मैं एक और प्रश्न पूछूंगा।',
                    follow_up_question=(
                        'Could you describe the main concern in a little more detail, in your own words?'
                        if language == 'en'
                        else 'कृपया अपनी मुख्य परेशानी के बारे में अपने शब्दों में थोड़ा और बताएं।'
                    ),
                )

        return ConversationResult(
            mode='demo',
            reply=(
                'Thank you for sharing. You can skip any question you are unsure about.'
                if language == 'en'
                else 'जानकारी साझा करने के लिए धन्यवाद। जिस प्रश्न का उत्तर न पता हो, उसे छोड़ सकते हैं।'
            ),
        )


def get_engine() -> ConversationEngine:
    if os.getenv('MEDIKIOSK_AI_MODE', 'demo') == 'openai-compatible':
        return OpenAICompatibleEngine()
    return RuleBasedDemoEngine()


def _has_urgent_phrase(answer: str) -> bool:
    for phrase in URGENT_PHRASES:
        start = 0
        while (position := answer.find(phrase.casefold(), start)) != -1:
            prefix = answer[max(0, position - 35):position].strip().casefold()
            negated = any(
                prefix.endswith(term)
                and (len(prefix) == len(term) or prefix[-len(term) - 1].isspace())
                for term in NEGATION_SUFFIXES
            )
            if not negated:
                return True
            start = position + len(phrase)
    return False


class OpenAICompatibleEngine(ConversationEngine):
    """Optional provider adapter. Configure only for a consented, approved endpoint."""

    def __init__(self):
        self.endpoint = os.getenv('AI_PROVIDER_URL', '').strip()
        self.api_key = os.getenv('AI_PROVIDER_API_KEY', '').strip()
        self.model = os.getenv('AI_PROVIDER_MODEL', '').strip()

    def next_turn(self, field: str, answer: str, language: str, follow_up_answer: bool) -> ConversationResult:
        if _has_urgent_phrase(answer.casefold()):
            return RuleBasedDemoEngine().next_turn(field, answer, language, follow_up_answer)
        if not self.endpoint or not self.api_key or not self.model:
            return RuleBasedDemoEngine().next_turn(field, answer, language, follow_up_answer)

        language_name = 'Hindi' if language == 'hi' else 'English'
        payload = {
            'model': self.model,
            'temperature': 0.1,
            'response_format': {'type': 'json_object'},
            'messages': [
                {
                    'role': 'system',
                    'content': (
                        'You help collect a patient history. Return JSON with keys reply and follow_up_question. '
                        'Use ' + language_name + '. Be neutral and brief. Ask at most one neutral clarification question '
                        'only if the answer is unclear and no follow-up was already asked. Otherwise set follow_up_question to null. '
                        'Never diagnose, infer a condition, recommend treatment, or provide triage. Do not repeat sensitive details. '
                        'Emergency screening is handled separately.'
                    ),
                },
                {
                    'role': 'user',
                    'content': json.dumps({'field': field, 'answer': answer, 'follow_up_already_asked': follow_up_answer}, ensure_ascii=False),
                },
            ],
        }
        request = Request(
            self.endpoint,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Authorization': f'Bearer {self.api_key}', 'Content-Type': 'application/json'},
            method='POST',
        )
        try:
            with urlopen(request, timeout=6) as response:
                data = json.loads(response.read(256_000).decode('utf-8'))
            content = data['choices'][0]['message']['content']
            generated = json.loads(content)
            question = generated.get('follow_up_question')
            forbidden = ('diagnos', 'treatment', 'medication', 'medicine', 'prescription', 'should take', 'recommend')
            if (
                not isinstance(question, str)
                or not question.strip()
                or follow_up_answer
                or len(question) > 240
                or question.count('?') > 1
                or any(term in question.casefold() for term in forbidden)
            ):
                question = None
            return ConversationResult(
                mode='llm',
                reply='Thank you for sharing.' if language == 'en' else 'जानकारी साझा करने के लिए धन्यवाद।',
                follow_up_question=question,
            )
        except Exception:
            return RuleBasedDemoEngine().next_turn(field, answer, language, follow_up_answer)
