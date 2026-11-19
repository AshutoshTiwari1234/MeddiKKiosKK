from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ConversationRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    field: Literal[
        'chiefComplaint', 'onset', 'duration', 'location', 'character', 'aggravatingFactors',
        'relievingFactors', 'timing', 'severity', 'associatedSymptoms', 'pastMedicalHistory',
        'surgicalHistory', 'familyHistory', 'personalHistory', 'medicationHistory', 'allergies', 'reviewOfSystems',
    ]
    answer: str = Field(max_length=2000)
    language: Literal['en', 'hi']
    followUpAnswer: bool = False


class ConversationResponse(BaseModel):
    mode: Literal['demo', 'llm']
    reply: str
    followUpQuestion: str | None = None
    followUpField: Literal['onset', 'duration', 'location', 'character', 'timing', 'severity', 'aggravatingFactors', 'relievingFactors', 'associatedSymptoms'] | None = None
    urgent: bool = False
    urgentMessage: str | None = None
