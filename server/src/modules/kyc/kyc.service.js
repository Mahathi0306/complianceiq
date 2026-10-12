import fs from 'node:fs/promises';
import { randomInt } from 'node:crypto';
import { Application } from '../../models/Application.js';
import { Customer } from '../../models/Customer.js';
import { Document } from '../../models/Document.js';
import { REQUIRED_DOCUMENTS, ROLES } from '../../config/constants.js';
import { HttpError } from '../../utils/httpError.js';
import { createAliaser } from '../../utils/mask.js';
import { recordAudit } from '../audit/audit.service.js';
import { screenCustomer } from '../screening/screening.service.js';
import { nameSimilarity } from '../screening/similarity.js';
import { computeRisk } from '../risk/risk.engine.js';
import { explainRisk, extractDocument } from '../ai/ai.client.js';
import { assertTransition } from './stateMachine.js';

const SCREENING_REVIEW_THRESHOLD = 0.92;

async function moveTo(application, to, actor, note) {
  assertTransition(application.state, to);
  const entry = { from: application.state, to, by: String(actor), note, at: new Date() };
  const updated = await Application.findOneAndUpdate(
    { _id: application._id, state: application.state },
    { $set: { state: to }, $push: { history: entry } },
    { new: true }
  );
  if (!updated) throw new HttpError(409, 'Application was changed by another request');
  await recordAudit({
    actor,
    action: 'APPLICATION_STATE_CHANGED',
    entity: 'Application',
    entityId: application._id,
    before: { state: entry.from },
    after: { state: to, note },
  });
  return updated;
}

async function allocateAccountId() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `ACC${randomInt(1_000_000_000, 9_999_999_999)}`;
    if (!(await Customer.exists({ accountId: candidate }))) return candidate;
  }
  throw new HttpError(500, 'Could not allocate an account number');
}

function toCustomerView(application) {
  const plain = typeof application.toObject === 'function' ? application.toObject() : application;
  return {
    _id: plain._id,
    state: plain.state,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    customer: plain.customer?.fullName
      ? { _id: plain.customer._id, fullName: plain.customer.fullName, status: plain.customer.status }
      : undefined,
    history: (plain.history || []).map((entry) => ({ to: entry.to, at: entry.at })),
  };
}

const presentFor = (actor, application) =>
  actor.role === ROLES.CUSTOMER ? toCustomerView(application) : application;

async function loadForActor(applicationId, actor) {
  const application = await Application.findById(applicationId).populate('customer');
  if (!application) throw new HttpError(404, 'Application not found');
  if (actor.role === ROLES.CUSTOMER && String(application.customer.user) !== String(actor.id)) {
    throw new HttpError(404, 'Application not found');
  }
  return application;
}

export async function createApplication(input, actor) {
  const customer = await Customer.create({
    ...input,
    user: actor.role === ROLES.CUSTOMER ? actor.id : undefined,
  });
  const application = await Application.create({
    customer: customer._id,
    history: [{ from: null, to: 'SUBMITTED', by: String(actor.id), at: new Date() }],
  });
  await recordAudit({
    actor: actor.id,
    action: 'APPLICATION_CREATED',
    entity: 'Application',
    entityId: application._id,
    after: { customer: String(customer._id) },
  });
  return { application, customer };
}

export async function listApplications(actor, { state, page, limit, skip }) {
  const filter = {};
  if (state) filter.state = state;
  if (actor.role === ROLES.CUSTOMER) {
    const own = await Customer.find({ user: actor.id }).select('_id').lean();
    filter.customer = { $in: own.map((c) => c._id) };
  }
  const [items, total] = await Promise.all([
    Application.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('customer', 'fullName country occupation riskLevel riskScore status accountId')
      .lean(),
    Application.countDocuments(filter),
  ]);
  return {
    items: actor.role === ROLES.CUSTOMER ? items.map(toCustomerView) : items,
    total,
    page,
    limit,
  };
}

export async function getApplication(applicationId, actor) {
  const application = await loadForActor(applicationId, actor);
  const documents = await Document.find({ customer: application.customer._id })
    .select('-storagePath')
    .lean();
  return {
    application: presentFor(actor, application),
    documents: documents.map(({ extractedFields, confidence, ...rest }) =>
      actor.role === ROLES.CUSTOMER ? rest : { ...rest, extractedFields, confidence }
    ),
  };
}

export async function attachDocument(applicationId, actor, { kind, file }) {
  const application = await loadForActor(applicationId, actor);
  if (application.state !== 'SUBMITTED') {
    throw new HttpError(409, 'Documents can only be changed before processing starts');
  }
  const previous = await Document.findOne({ customer: application.customer._id, kind });
  if (previous) {
    await fs.rm(previous.storagePath, { force: true });
    await previous.deleteOne();
  }
  const document = await Document.create({
    customer: application.customer._id,
    kind,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    storagePath: file.path,
  });

  if (kind !== 'SELFIE' && file.mimetype.startsWith('image/')) {
    try {
      const data = await fs.readFile(file.path);
      const extraction = await extractDocument({
        kind,
        mimeType: file.mimetype,
        imageBase64: data.toString('base64'),
      });
      document.extractedFields = extraction.fields;
      document.confidence = extraction.confidence;
      await document.save();
    } catch {
      document.extractedFields = {};
      document.confidence = 0;
    }
  }

  await recordAudit({
    actor: actor.id,
    action: 'DOCUMENT_UPLOADED',
    entity: 'Application',
    entityId: application._id,
    after: { kind, size: file.size },
  });
  const { storagePath, ...safe } = document.toObject();
  return safe;
}

function checkDocuments(customer, documents) {
  const missing = REQUIRED_DOCUMENTS.filter((kind) => !documents.some((d) => d.kind === kind));
  if (missing.length) return { ok: false, missing, issues: [] };
  const issues = [];
  const idDocument = documents.find((d) => d.kind === 'ID_PROOF');
  const fields = idDocument?.extractedFields || {};
  if (fields.pan && String(fields.pan).toUpperCase() !== customer.pan) {
    issues.push('PAN on the document does not match the application');
  }
  if (fields.name && nameSimilarity(fields.name, customer.fullName) < 0.85) {
    issues.push('Name on the document does not match the application');
  }
  return { ok: issues.length === 0, missing: [], issues };
}

async function approve(application, customer, actor, note) {
  const accountId = customer.accountId || (await allocateAccountId());
  const updated = await moveTo(application, 'APPROVED', actor, note);
  customer.status = 'ACTIVE';
  customer.accountId = accountId;
  await customer.save();
  return updated;
}

export async function processApplication(applicationId, actor) {
  let application = await loadForActor(applicationId, actor);
  const customer = application.customer;
  if (application.state !== 'SUBMITTED') {
    throw new HttpError(409, `Application is already ${application.state}`);
  }

  const documents = await Document.find({ customer: customer._id }).lean();
  const check = checkDocuments(customer, documents);
  if (check.missing.length) {
    throw new HttpError(422, 'Required documents are missing', { missing: check.missing });
  }
  if (!check.ok) {
    application = await moveTo(application, 'MANUAL_REVIEW', actor.id, check.issues.join('; '));
    return presentFor(actor, application);
  }
  application = await moveTo(application, 'DOC_VERIFIED', actor.id);

  const screening = await screenCustomer(customer);
  customer.screening = screening;
  await customer.save();
  if (screening.topScore >= SCREENING_REVIEW_THRESHOLD) {
    application = await moveTo(application, 'MANUAL_REVIEW', actor.id, 'Strong watchlist match');
    return presentFor(actor, application);
  }
  application = await moveTo(application, 'SCREENED', actor.id);

  const risk = computeRisk(customer, { screeningScore: screening.topScore });
  customer.riskScore = risk.score;
  customer.riskLevel = risk.level;
  customer.riskBreakdown = risk.breakdown;
  try {
    const alias = createAliaser('Customer');
    const explanation = await explainRisk({
      customer: {
        alias: alias(String(customer._id)),
        country: customer.country,
        occupation: customer.occupation,
        isPep: customer.isPep,
      },
      score: risk.score,
      level: risk.level,
      breakdown: risk.breakdown,
    });
    customer.riskExplanation = explanation.text;
  } catch {
    customer.riskExplanation = undefined;
  }
  await customer.save();
  application = await moveTo(application, 'RISK_SCORED', actor.id, `${risk.level} (${risk.score})`);

  if (risk.level === 'HIGH') {
    application = await moveTo(application, 'MANUAL_REVIEW', actor.id, 'High risk customer');
    return presentFor(actor, application);
  }
  return presentFor(actor, await approve(application, customer, actor.id, 'Auto approved'));
}

export async function decideApplication(applicationId, actor, { decision, note }) {
  const application = await loadForActor(applicationId, actor);
  if (application.state !== 'MANUAL_REVIEW') {
    throw new HttpError(409, 'Only applications in manual review can be decided');
  }
  const customer = application.customer;
  application.reviewNote = note;
  await application.save();
  if (decision === 'APPROVED') {
    return approve(application, customer, actor.id, note);
  }
  const updated = await moveTo(application, 'REJECTED', actor.id, note);
  customer.status = 'REJECTED';
  await customer.save();
  return updated;
}
