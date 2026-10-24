import crypto from 'node:crypto';

function getKeyBuffer() {
  const keyBase64 = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyBase64 || typeof keyBase64 !== 'string') {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is not configured');
  }

  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error(`TOKEN_ENCRYPTION_KEY must be a 32-byte base64-encoded key, got ${key.length} bytes`);
  }

  return key;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: iv.tag.ciphertext (all base64-encoded).
 */
export function encrypt(text) {
  if (text === null || text === undefined) {
    throw new Error('Text to encrypt cannot be null or undefined');
  }

  const key = getKeyBuffer();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(String(text), 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

/**
 * Decrypts a payload formatted as iv.tag.ciphertext (all base64-encoded).
 * Returns the plaintext string.
 */
export function decrypt(payload) {
  if (!payload || typeof payload !== 'string') {
    throw new Error('Invalid encrypted payload');
  }

  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format: expected iv.tag.ciphertext');
  }

  const [ivB64, tagB64, cipherB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(cipherB64, 'base64');

  if (iv.length !== 12) {
    throw new Error(`Invalid IV length: expected 12 bytes, got ${iv.length}`);
  }
  if (tag.length !== 16) {
    throw new Error(`Invalid auth tag length: expected 16 bytes, got ${tag.length}`);
  }

  const key = getKeyBuffer();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}
