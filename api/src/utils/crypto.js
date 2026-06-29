import crypto from 'crypto';
import fs from 'fs';

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReceiptCode() {
  let code = '';
  // Generate 8 characters
  for (let i = 0; i < 8; i++) {
    const idx = crypto.randomInt(0, CHARSET.length);
    code += CHARSET[idx];
  }
  // Format as XXXX-XXXX
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function generateMagicToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function computeFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}
