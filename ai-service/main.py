from fastapi import FastAPI
from fastapi import File, Form, HTTPException, UploadFile
import os

from app.conversation import get_engine
from app.ocr import MAX_FILE_BYTES, OcrUnavailable, extract_document_text, ocr_engine_available
from app.ocr_schemas import OcrResponse
from app.schemas import ConversationRequest, ConversationResponse
from app.summary import generate_summary
from app.summary_schemas import SummaryRequest, SummaryResponse

app = FastAPI(
    title='MediKiosk AI Service',
    version='0.1.0',
    description='Consent-gated demo conversation support for patient case-taking. Not a diagnostic service.',
)
engine = get_engine()


@app.get('/health')
def health():
    configured = all(os.getenv(key, '').strip() for key in ('AI_PROVIDER_URL', 'AI_PROVIDER_API_KEY', 'AI_PROVIDER_MODEL'))
    llm_enabled = os.getenv('MEDIKIOSK_AI_MODE', 'demo') == 'openai-compatible' and configured
    return {
        'status': 'ok',
        'mode': 'openai_compatible' if llm_enabled else 'rule_based_demo',
        'ocr': {'tesseractAvailable': ocr_engine_available()},
        'diagnosis': False,
    }


@app.post('/api/v1/conversation/next', response_model=ConversationResponse)
def next_conversation_turn(payload: ConversationRequest):
    result = engine.next_turn(payload.field, payload.answer, payload.language, payload.followUpAnswer)
    return ConversationResponse(
        mode=result.mode,
        reply=result.reply,
        followUpQuestion=result.follow_up_question,
        followUpField=result.follow_up_field,
        urgent=result.urgent,
        urgentMessage=result.urgent_message,
    )


@app.post('/api/v1/ocr/extract', response_model=OcrResponse)
async def extract_uploaded_document(file: UploadFile = File(...), language: str = Form('en')):
    if file.content_type not in ('application/pdf', 'image/jpeg', 'image/png'):
        raise HTTPException(status_code=415, detail='Only PDF, JPEG, and PNG documents are supported.')
    if language not in ('en', 'hi'):
        raise HTTPException(status_code=400, detail='OCR language must be en or hi.')
    data = await file.read(MAX_FILE_BYTES + 1)
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail='Document exceeds the 10 MB limit.')
    try:
        extracted = extract_document_text(data, file.content_type, language)
    except OcrUnavailable as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=422, detail='The document could not be read. The original is preserved for manual review.') from error
    return {
        'status': 'extracted',
        **extracted,
        'disclaimer': 'OCR can be inaccurate. Verify all extracted text and values against the original document.',
    }


@app.post('/api/v1/summary/generate', response_model=SummaryResponse)
def generate_clinical_summary(payload: SummaryRequest):
    return generate_summary(payload.model_dump())
