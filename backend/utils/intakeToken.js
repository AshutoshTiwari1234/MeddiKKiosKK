const crypto = require('node:crypto');

function hashIntakeToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isIntakeToken(token) {
  return typeof token === 'string' && /^[a-f0-9]{64}$/i.test(token);
}

module.exports = { hashIntakeToken, isIntakeToken };
