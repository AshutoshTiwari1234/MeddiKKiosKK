from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class SummaryRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    language: Literal['en', 'hi'] = 'en'
    patientReported: dict[str, Any] = Field(default_factory=dict)
    verifiedHistory: dict[str, Any] = Field(default_factory=dict)
    ayurvedaAssessment: dict[str, Any] = Field(default_factory=dict)
    reviewedDocuments: list[dict[str, str]] = Field(default_factory=list, max_length=10)
    allowExternalModel: bool = False


class SummaryResponse(BaseModel):
    mode: Literal['assembled', 'llm']
    text: str = Field(min_length=1, max_length=12_000)
