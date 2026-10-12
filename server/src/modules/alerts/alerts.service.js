import mongoose from 'mongoose';
import { Alert } from '../../models/Alert.js';
import { User } from '../../models/User.js';
import { STAFF_ROLES } from '../../config/constants.js';
import { HttpError } from '../../utils/httpError.js';
import { recordAudit } from '../audit/audit.service.js';
import { parseQuery } from '../ai/ai.client.js';

function withSla(alert) {
  return { ...alert, slaBreached: alert.status === 'OPEN' && new Date(alert.slaDueAt) < new Date() };
}

function buildFilter(query, actor) {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.severity) filter.severity = query.severity;
  if (query.ruleType) filter.ruleType = query.ruleType;
  if (query.accountId) filter.accountId = query.accountId;
  if (query.assignedTo === 'me') filter.assignedTo = new mongoose.Types.ObjectId(actor.id);
  else if (query.assignedTo === 'none') filter.assignedTo = null;
  else if (query.assignedTo) filter.assignedTo = new mongoose.Types.ObjectId(query.assignedTo);
  if (query.days) filter.createdAt = { $gte: new Date(Date.now() - query.days * 86400 * 1000) };
  return filter;
}

export async function listAlerts(query, actor, { skip, limit }) {
  const filter = buildFilter(query, actor);
  const [items, total] = await Promise.all([
    Alert.find(filter)
      .sort({ priority: -1, createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate('assignedTo', 'name')
      .lean(),
    Alert.countDocuments(filter),
  ]);
  return { items: items.map(withSla), total };
}

export async function searchAlerts(text, actor, { skip, limit }) {
  const parsed = await parseQuery(text);
  const query = {
    severity: parsed.severity || undefined,
    ruleType: parsed.ruleType || undefined,
    status: parsed.status || undefined,
    days: parsed.days || undefined,
  };
  const result = await listAlerts(query, actor, { skip, limit });
  return { ...result, interpreted: query };
}

export async function getAlert(alertId) {
  const alert = await Alert.findById(alertId)
    .populate('transaction')
    .populate('assignedTo', 'name')
    .lean();
  if (!alert) throw new HttpError(404, 'Alert not found');
  return withSla(alert);
}

export async function assignAlert(alertId, assigneeId, actor) {
  const assignee = await User.findById(assigneeId).select('role active');
  if (!assignee || !assignee.active || !STAFF_ROLES.includes(assignee.role)) {
    throw new HttpError(400, 'Alerts can only be assigned to active staff members');
  }
  const alert = await Alert.findOneAndUpdate(
    { _id: alertId, status: 'OPEN' },
    { $set: { assignedTo: assigneeId } },
    { new: true }
  );
  if (!alert) throw new HttpError(409, 'Only open alerts can be assigned');
  await recordAudit({
    actor: actor.id,
    action: 'ALERT_ASSIGNED',
    entity: 'Alert',
    entityId: alert._id,
    after: { assignedTo: String(assigneeId) },
  });
  return alert;
}

export async function dismissAlert(alertId, reason, actor) {
  const alert = await Alert.findOneAndUpdate(
    { _id: alertId, status: 'OPEN' },
    { $set: { status: 'DISMISSED', dismissReason: reason, assignedTo: actor.id } },
    { new: true }
  );
  if (!alert) throw new HttpError(409, 'Only open alerts can be dismissed');
  await recordAudit({
    actor: actor.id,
    action: 'ALERT_DISMISSED',
    entity: 'Alert',
    entityId: alert._id,
    after: { reason },
  });
  return alert;
}
