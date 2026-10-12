import { Customer } from '../../models/Customer.js';
import { Transaction } from '../../models/Transaction.js';
import { HttpError } from '../../utils/httpError.js';
import { getTransactionQueue } from './transactions.queue.js';

export async function ingestTransaction(input, idempotencyKey) {
  const existing = await Transaction.findOne({ idempotencyKey });
  if (existing) return { transaction: existing, duplicate: true };

  const account = await Customer.exists({ accountId: input.accountId, status: 'ACTIVE' });
  if (!account) throw new HttpError(404, 'Unknown or inactive account');

  let transaction;
  try {
    transaction = await Transaction.create({ ...input, idempotencyKey, status: 'PENDING' });
  } catch (err) {
    if (err?.code === 11000) {
      const duplicate = await Transaction.findOne({ idempotencyKey });
      if (duplicate) return { transaction: duplicate, duplicate: true };
    }
    throw err;
  }

  await getTransactionQueue().add('evaluate', { transactionId: transaction.id }, { jobId: transaction.id });
  return { transaction, duplicate: false };
}

export async function listTransactions({ accountId, type, from, to, skip, limit }) {
  const filter = {};
  if (accountId) filter.accountId = accountId;
  if (type) filter.type = type;
  if (from || to) {
    filter.occurredAt = {};
    if (from) filter.occurredAt.$gte = from;
    if (to) filter.occurredAt.$lte = to;
  }
  const [items, total] = await Promise.all([
    Transaction.find(filter).sort({ occurredAt: -1 }).skip(skip).limit(limit).lean(),
    Transaction.countDocuments(filter),
  ]);
  return { items, total };
}
