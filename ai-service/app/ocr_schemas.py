from typing import Literal

from pydantic import BaseModel, Field


class OcrResponse(BaseModel):
    status: Literal['extracted']
    text: str = Field(max_length=20_000)
    candidates: dict[str, list[str]]
    disclaimer: str
