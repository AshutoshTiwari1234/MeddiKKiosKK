const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const multer = require('multer');
const AppError = require('../utils/AppError');

const uploadRoot = path.resolve(process.env.MEDICAL_DOCUMENT_DIR || path.join(__dirname, '..', 'private-uploads'));
fs.mkdirSync(uploadRoot, { recursive: true });

const extensions = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' };

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => callback(null, uploadRoot),
  filename: (_request, file, callback) => callback(null, `${crypto.randomUUID()}${extensions[file.mimetype] || '.upload'}`),
});

const uploadDocument = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!extensions[file.mimetype]) return callback(new AppError('Choose a PDF, JPEG, or PNG file.', 415));
    callback(null, true);
  },
});

module.exports = { uploadDocument, uploadRoot };
