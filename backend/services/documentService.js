const fs = require('node:fs/promises');
const path = require('node:path');
const { uploadRoot } = require('../middleware/documentUpload');

function isSupportedSignature(buffer, mimeType) {
  if (mimeType === 'application/pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (mimeType === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return false;
}

async function validateDocumentFile(file) {
  if (!file) return false;
  const handle = await fs.open(file.path, 'r');
  try {
    const buffer = Buffer.alloc(8);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return isSupportedSignature(buffer.subarray(0, bytesRead), file.mimetype);
  } finally {
    await handle.close();
  }
}

async function removeStoredFile(storageName) {
  if (!storageName || path.basename(storageName) !== storageName) return;
  await fs.rm(path.join(uploadRoot, storageName), { force: true });
}

async function runOcr(filePath, mimeType, language = 'en') {
  const baseUrl = (process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  const buffer = await fs.readFile(filePath);
  const body = new FormData();
  body.append('file', new Blob([buffer], { type: mimeType }), 'medical-document');
  body.append('language', language === 'hi' ? 'hi' : 'en');
  const response = await fetch(`${baseUrl}/api/v1/ocr/extract`, { method: 'POST', body, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    let message = 'OCR is unavailable; the original document was saved for manual review.';
    try {
      const detail = await response.json();
      message = detail.detail || message;
    } catch (_error) {
      // Keep the safe generic message if the AI service returned a non-JSON error.
    }
    const error = new Error(message);
    error.statusCode = response.status === 503 ? 503 : 422;
    throw error;
  }
  return response.json();
}

module.exports = { removeStoredFile, runOcr, uploadRoot, validateDocumentFile };
