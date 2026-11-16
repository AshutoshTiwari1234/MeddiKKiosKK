from __future__ import annotations

from io import BytesIO
import re
import shutil


MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_PDF_PAGES = 20
MAX_TEXT_CHARS = 20_000


class OcrUnavailable(Exception):
    pass


def ocr_engine_available() -> bool:
    return shutil.which('tesseract') is not None


def _image_text(data: bytes, language: str = 'en') -> str:
    import pytesseract
    from PIL import Image

    with Image.open(BytesIO(data)) as image:
        image.verify()
    with Image.open(BytesIO(data)) as image:
        if image.width > 12_000 or image.height > 12_000 or image.width * image.height > 40_000_000:
            raise ValueError('Image dimensions exceed the supported limit.')
        if not ocr_engine_available():
            raise OcrUnavailable('Tesseract OCR is not installed on the AI service host.')
        ocr_language = 'eng+hin' if language == 'hi' else 'eng'
        try:
            return pytesseract.image_to_string(image, lang=ocr_language, timeout=20)
        except pytesseract.TesseractError as error:
            if language == 'hi' and ('hin.traineddata' in str(error) or 'Failed loading language' in str(error)):
                return pytesseract.image_to_string(image, lang='eng', timeout=20)
            raise


def extract_document_text(data: bytes, content_type: str, language: str = 'en') -> dict:
    if not data or len(data) > MAX_FILE_BYTES:
        raise ValueError('Document is empty or exceeds the 10 MB limit.')

    if content_type == 'application/pdf':
        import pymupdf as fitz

        document = fitz.open(stream=data, filetype='pdf')
        try:
            if document.page_count > MAX_PDF_PAGES:
                raise ValueError(f'PDF exceeds the {MAX_PDF_PAGES}-page limit.')
            pages = []
            for page in document:
                if page.rect.width > 12_000 or page.rect.height > 12_000:
                    raise ValueError('PDF page dimensions exceed the supported limit.')
                page_text = page.get_text('text').strip()
                if len(page_text) < 20:
                    if not ocr_engine_available():
                        raise OcrUnavailable('This scanned PDF needs Tesseract OCR, which is not installed on the AI service host.')
                    pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                    page_text = _image_text(pixmap.tobytes('png'), language)
                pages.append(page_text)
            text = '\n\n'.join(pages)
        finally:
            document.close()
    elif content_type in ('image/jpeg', 'image/png'):
        text = _image_text(data, language)
    else:
        raise ValueError('Only PDF, JPEG, and PNG documents are supported.')

    text = text[:MAX_TEXT_CHARS].strip()
    return {'text': text, 'candidates': extract_candidates(text)}


def extract_candidates(text: str) -> dict:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    date_pattern = re.compile(r'\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b')
    measurement_pattern = re.compile(r'\b\d+(?:\.\d+)?\s*(?:(?:mg/dl|g/dl|mmol/l|mmhg|bpm|iu/l|u/l|ml|mg|g|cm|kg)\b|%)', re.I)
    dates = list(dict.fromkeys(match.group(0) for match in date_pattern.finditer(text)))[:20]
    measurements = [line[:240] for line in lines if measurement_pattern.search(line)][:50]
    return {'dates': dates, 'measurementLines': measurements}
