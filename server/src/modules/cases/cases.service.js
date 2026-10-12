import { randomBytes } from 'node:crypto';
import { Alert } from '../../models/Alert.js';
import { Case } from '../../models/Case.js';
import { Customer } from '../../models/Customer.js';
import { Transaction } from '../../models/Transaction.js';
import { HttpError } from '../../utils/httpError.js';
import { createAliaser, scrubDeep } from '../../utils/mask.js';
import { recordAudit } from '../audit/audit.service.js';
import { draftStr, summarizeCase } from '../ai/ai.client.js';

const STATUS_FLOW = {
  OPEN: ['INVESTIGATING', 'CLOSED'],
  INVESTIGATING: ['ESCALATED', 'CLOSED'],
  ESCALATED: ['INVESTIGATING', 'CLOSED'],
  CLOSED: [],
  STR_FILED: [],
};

function newReference() {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `CASE-${day}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

async function loadCase(caseId) {
  const found = await Case.findById(caseId);
  if (!found) throw new HttpError(404, 'Case not found');
  return found;
}

export async function createCase(alertIds, actor) {
  const alerts = await Alert.find({ _id: { $in: alertIds } }).select('accountId status').lean();
  if (alerts.length !== alertIds.length) throw new HttpError(404, 'One or more alerts were not found');
  if (new Set(alerts.map((a) => a.accountId)).size !== 1) {
    throw new HttpError(400, 'All alerts in a case must belong to the same account');
  }

  const claim = await Alert.updateMany(
    { _id: { $in: alertIds }, status: 'OPEN' },
    { $set: { status: 'IN_CASE', assignedTo: actor.id } }
  );
  if (claim.modifiedCount !== alertIds.length) {
    await Alert.updateMany(
      { _id: { $in: alertIds }, status: 'IN_CASE', case: null },
      { $set: { status: 'OPEN' } }
    );
    throw new HttpError(409, 'Some alerts are no longer open');
  }

  const created = await Case.create({
    reference: newReference(),
    accountId: alerts[0].accountId,
    alerts: alertIds,
    assignee: actor.id,
    createdBy: actor.id,
  });
  await Alert.updateMany({ _id: { $in: alertIds } }, { $set: { case: created._id } });
  await recordAudit({
    actor: actor.id,
    action: 'CASE_CREATED',
    entity: 'Case',
    entityId: created._id,
    after: { reference: created.reference, alerts: alertIds },
  });
  return created;
}

export async function listCases({ status, assignee, skip, limit }, actor) {
  const filter = {};
  if (status) filter.status = status;
  if (assignee === 'me') filter.assignee = actor.id;
  const [items, total] = await Promise.all([
    Case.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('assignee', 'name')
      .select('-notes')
      .lean(),
    Case.countDocuments(filter),
  ]);
  return { items, total };
}

export async function getCase(caseId) {
  const found = await Case.findById(caseId)
    .populate('assignee', 'name')
    .populate('notes.author', 'name')
    .populate('alerts')
    .lean();
  if (!found) throw new HttpError(404, 'Case not found');
  const customer = await Customer.findOne({ accountId: found.accountId })
    .select('fullName country occupation riskLevel riskScore riskBreakdown riskExplanation isPep')
    .lean();
  return { ...found, customer };
}

export async function changeStatus(caseId, status, actor) {
  const found = await loadCase(caseId);
  if (!STATUS_FLOW[found.status].includes(status)) {
    throw new HttpError(409, `A ${found.status} case cannot move to ${status}`);
  }
  const before = found.status;
  found.status = status;
  if (status === 'CLOSED') found.closedAt = new Date();
  await found.save();
  await recordAudit({
    actor: actor.id,
    action: 'CASE_STATUS_CHANGED',
    entity: 'Case',
    entityId: found._id,
    before: { status: before },
    after: { status },
  });
  return found;
}

export async function addNote(caseId, text, actor) {
  const found = await Case.findOneAndUpdate(
    { _id: caseId },
    { $push: { notes: { author: actor.id, text, at: new Date() } } },
    { new: true }
  );
  if (!found) throw new HttpError(404, 'Case not found');
  await recordAudit({
    actor: actor.id,
    action: 'CASE_NOTE_ADDED',
    entity: 'Case',
    entityId: found._id,
    after: { length: text.length },
  });
  return found.notes[found.notes.length - 1];
}

export async function assignCase(caseId, userId, actor) {
  const found = await Case.findOneAndUpdate({ _id: caseId }, { $set: { assignee: userId } }, { new: true });
  if (!found) throw new HttpError(404, 'Case not found');
  await recordAudit({
    actor: actor.id,
    action: 'CASE_ASSIGNED',
    entity: 'Case',
    entityId: found._id,
    after: { assignee: String(userId) },
  });
  return found;
}

export async function buildCaseContext(caseId) {
  const found = await loadCase(caseId);
  const [customer, alerts] = await Promise.all([
    Customer.findOne({ accountId: found.accountId }).lean(),
    Alert.find({ _id: { $in: found.alerts } }).sort({ createdAt: 1 }).lean(),
  ]);
  const since = new Date(Date.now() - 90 * 86400 * 1000);
  const transactions = await Transaction.find({ accountId: found.accountId, occurredAt: { $gte: since } })
    .sort({ occurredAt: -1 })
    .limit(50)
    .lean();

  const accountAlias = createAliaser('Account');
  accountAlias(found.accountId);
  const maskAccounts = (value) =>
    JSON.parse(
      JSON.stringify(value ?? null).replace(/ACC\d{6,12}/g, (match) => accountAlias(match))
    );

  const inflow = transactions.filter((t) => t.type === 'DEPOSIT').reduce((s, t) => s + t.amount, 0);
  const outflow = transactions.filter((t) => t.type !== 'DEPOSIT').reduce((s, t) => s + t.amount, 0);

  return scrubDeep({
    caseRef: found.reference,
    customer: {
      alias: 'Customer-1',
      riskLevel: customer?.riskLevel,
      riskScore: customer?.riskScore,
      country: customer?.country,
      occupation: customer?.occupation,
      isPep: customer?.isPep,
    },
    alerts: alerts.map((a) => ({
      rule: a.ruleName,
      ruleType: a.ruleType,
      severity: a.severity,
      details: maskAccounts(a.details),
      at: a.createdAt,
    })),
    transactions: transactions.map((t) => ({
      type: t.type,
      amount: t.amount,
      counterparty: t.counterpartyAccountId ? accountAlias(t.counterpartyAccountId) : null,
      at: t.occurredAt,
    })),
    totals: { count: transactions.length, inflow, outflow },
  });
}

export async function generateSummary(caseId, actor) {
  const found = await loadCase(caseId);
  const result = await summarizeCase(await buildCaseContext(caseId));
  found.summary = { text: result.text, model: result.model, generatedAt: new Date(), status: 'DRAFT' };
  await found.save();
  await recordAudit({
    actor: actor.id,
    action: 'CASE_SUMMARY_GENERATED',
    entity: 'Case',
    entityId: found._id,
    after: { model: result.model },
  });
  return found.summary;
}

export async function generateStrDraft(caseId, actor) {
  const found = await loadCase(caseId);
  if (found.strDraft?.status === 'APPROVED') throw new HttpError(409, 'The STR has already been approved');
  const result = await draftStr(await buildCaseContext(caseId));
  found.strDraft = { text: result.text, model: result.model, generatedAt: new Date(), status: 'DRAFT' };
  await found.save();
  await recordAudit({
    actor: actor.id,
    action: 'STR_DRAFT_GENERATED',
    entity: 'Case',
    entityId: found._id,
    after: { model: result.model },
  });
  return found.strDraft;
}

export async function editStrDraft(caseId, text, actor) {
  const found = await loadCase(caseId);
  if (!found.strDraft || found.strDraft.status !== 'DRAFT') {
    throw new HttpError(409, 'There is no editable STR draft on this case');
  }
  found.strDraft.text = text;
  await found.save();
  await recordAudit({
    actor: actor.id,
    action: 'STR_DRAFT_EDITED',
    entity: 'Case',
    entityId: found._id,
    after: { length: text.length },
  });
  return found.strDraft;
}

export async function approveStr(caseId, actor) {
  const found = await loadCase(caseId);
  if (!found.strDraft || found.strDraft.status !== 'DRAFT') {
    throw new HttpError(409, 'There is no STR draft waiting for approval');
  }
  if (found.status === 'CLOSED') throw new HttpError(409, 'A closed case cannot file an STR');
  found.strDraft.status = 'APPROVED';
  found.strDraft.approvedBy = actor.id;
  found.strDraft.approvedAt = new Date();
  found.status = 'STR_FILED';
  found.closedAt = new Date();
  await found.save();
  await recordAudit({
    actor: actor.id,
    action: 'STR_APPROVED',
    entity: 'Case',
    entityId: found._id,
    after: { reference: found.reference },
  });
  return found;
}
