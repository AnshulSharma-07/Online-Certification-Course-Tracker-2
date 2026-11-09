import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v2 as cloudinary } from 'cloudinary';
import { cloudinaryEnabled } from '../config/env.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');

// Allowed types are verified by magic bytes, not just the client-supplied MIME type.
const SIGNATURES = [
  { mime: 'application/pdf', ext: '.pdf', test: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  { mime: 'image/png', ext: '.png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/jpeg', ext: '.jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
];

export function detectType(buffer) {
  return SIGNATURES.find((s) => s.test(buffer)) || null;
}

export const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

function configureCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/** Stores a validated upload and returns the proofFile sub-document. */
export async function saveProof(file, type) {
  const base = { originalName: file.originalname.slice(0, 200), mimeType: type.mime, size: file.size };
  if (cloudinaryEnabled()) {
    configureCloudinary();
    // type: 'authenticated' => never publicly reachable; access needs a signed URL we generate per request.
    const resourceType = type.mime === 'application/pdf' ? 'raw' : 'image';
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: 'cert-tracker', type: 'authenticated', resource_type: resourceType }, (err, res) => (err ? reject(err) : resolve(res)))
        .end(file.buffer);
    });
    return { ...base, storage: 'cloudinary', key: result.public_id, resourceType };
  }
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const key = `${crypto.randomUUID()}${type.ext}`; // random name: user input never touches the path
  await fs.writeFile(path.join(UPLOAD_DIR, key), file.buffer, { mode: 0o600 });
  return { ...base, storage: 'local', key };
}

/** Returns { kind:'redirect', url } or { kind:'file', path }. */
export async function resolveProof(proofFile) {
  if (proofFile.storage === 'cloudinary') {
    configureCloudinary();
    const url = cloudinary.url(proofFile.key, {
      resource_type: proofFile.resourceType,
      type: 'authenticated',
      sign_url: true,
      secure: true,
    });
    return { kind: 'redirect', url };
  }
  const full = path.join(UPLOAD_DIR, path.basename(proofFile.key));
  await fs.access(full);
  return { kind: 'file', path: full };
}

export async function deleteProof(proofFile) {
  if (!proofFile) return;
  try {
    if (proofFile.storage === 'cloudinary') {
      configureCloudinary();
      await cloudinary.uploader.destroy(proofFile.key, { resource_type: proofFile.resourceType, type: 'authenticated' });
    } else {
      await fs.unlink(path.join(UPLOAD_DIR, path.basename(proofFile.key)));
    }
  } catch (err) {
    console.error('Could not delete old proof file:', err.message);
  }
}
