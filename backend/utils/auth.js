const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'medikiosk_session';

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32 || secret.startsWith('replace-with-')) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters.');
  }
  return secret;
}

function signSession(userId, sessionVersion = 0) {
  return jwt.sign({ sv: sessionVersion }, jwtSecret(), { subject: userId.toString(), expiresIn: '30m', issuer: 'medikiosk-api', audience: 'medikiosk-web' });
}

function verifySession(token) {
  return jwt.verify(token, jwtSecret(), { issuer: 'medikiosk-api', audience: 'medikiosk-web' });
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 30 * 60 * 1000,
  };
}

module.exports = { COOKIE_NAME, cookieOptions, jwtSecret, signSession, verifySession };
