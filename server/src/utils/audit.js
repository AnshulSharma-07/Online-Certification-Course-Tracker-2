import AuditLog from '../models/AuditLog.js';

// Audit logging must never break the request it describes.
export async function audit(req, action, entityType, entityId, details = {}) {
  try {
    await AuditLog.create({ actor: req.user?._id ?? null, action, entityType, entityId: String(entityId ?? ''), details, ip: req.ip });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}
