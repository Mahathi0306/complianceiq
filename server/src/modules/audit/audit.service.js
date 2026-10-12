import { AuditLog } from '../../models/AuditLog.js';

export function recordAudit({ actor, action, entity, entityId, before, after }) {
  return AuditLog.create({
    actor: String(actor),
    action,
    entity,
    entityId: String(entityId),
    before,
    after,
  });
}

export function listAudit({ entity, entityId, limit = 100 }) {
  const filter = {};
  if (entity) filter.entity = entity;
  if (entityId) filter.entityId = entityId;
  return AuditLog.find(filter).sort({ at: -1 }).limit(limit).lean();
}
