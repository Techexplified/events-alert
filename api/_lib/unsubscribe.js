import crypto from 'node:crypto';

/**
 * Generates a base64url HMAC-SHA256 token for an email address.
 *
 * @param {string} email
 * @returns {string}
 */
export function generateToken(email) {
  const secret = process.env.UNSUBSCRIBE_SECRET || '';
  const normalized = (email || '').trim().toLowerCase();
  return crypto.createHmac('sha256', secret).update(normalized).digest('base64url');
}

/**
 * Returns the full unsubscribe URL for a given email address.
 *
 * @param {string} email
 * @returns {string}
 */
export function unsubscribeUrl(email) {
  const appUrl = (process.env.APP_URL || '').replace(/\/+$/, '');
  const normalized = (email || '').trim().toLowerCase();
  const token = generateToken(normalized);
  return `${appUrl}/api/unsubscribe?e=${encodeURIComponent(normalized)}&t=${token}`;
}

/**
 * Verifies if the provided token is valid for the given email address.
 * Uses crypto.timingSafeEqual for timing-attack resistance.
 *
 * @param {string} email
 * @param {string} token
 * @returns {boolean}
 */
export function verifyToken(email, token) {
  if (!email || !token || typeof email !== 'string' || typeof token !== 'string') {
    return false;
  }
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) {
    return false;
  }

  const expectedToken = generateToken(email);
  const tokenBuf = Buffer.from(token, 'utf8');
  const expectedBuf = Buffer.from(expectedToken, 'utf8');

  if (tokenBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(tokenBuf, expectedBuf);
}
