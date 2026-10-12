import { Transaction } from '../../models/Transaction.js';
import { buildAdjacency, findCycleThrough } from './graph.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

async function threshold(rule, tx) {
  const { amount } = rule.params;
  return tx.amount >= amount ? { amount: tx.amount, limit: amount } : null;
}

async function structuring(rule, tx) {
  const { limit, margin, windowHours, minCount } = rule.params;
  const lower = limit * (1 - margin);
  if (tx.type !== 'DEPOSIT' || tx.amount < lower || tx.amount >= limit) return null;
  const since = new Date(tx.occurredAt.getTime() - windowHours * HOUR_MS);
  const count = await Transaction.countDocuments({
    accountId: tx.accountId,
    type: 'DEPOSIT',
    amount: { $gte: lower, $lt: limit },
    occurredAt: { $gte: since, $lte: tx.occurredAt },
  });
  if (count < minCount) return null;
  return { count, band: [Math.round(lower), limit], windowHours };
}

async function velocity(rule, tx, { redis }) {
  const { windowSeconds, maxCount } = rule.params;
  const key = `velocity:${rule._id}:${tx.accountId}`;
  const now = tx.occurredAt.getTime();
  const windowMs = windowSeconds * 1000;
  const results = await redis
    .multi()
    .zadd(key, now, String(tx._id))
    .zremrangebyscore(key, 0, now - windowMs)
    .zcard(key)
    .pexpire(key, windowMs * 2)
    .exec();
  const count = results[2][1];
  return count > maxCount ? { count, maxCount, windowSeconds } : null;
}

async function dormant(rule, tx) {
  const { inactiveDays, minAmount } = rule.params;
  const previous = await Transaction.findOne({
    accountId: tx.accountId,
    occurredAt: { $lt: tx.occurredAt },
    _id: { $ne: tx._id },
  })
    .sort({ occurredAt: -1 })
    .select('occurredAt')
    .lean();
  if (!previous) return null;
  const gapDays = (tx.occurredAt.getTime() - previous.occurredAt.getTime()) / DAY_MS;
  if (gapDays < inactiveDays || tx.amount < minAmount) return null;
  return { inactiveDays: Math.floor(gapDays), amount: tx.amount };
}

async function circular(rule, tx) {
  const { maxHops, windowDays } = rule.params;
  if (tx.type !== 'TRANSFER' || !tx.counterpartyAccountId) return null;
  const since = new Date(tx.occurredAt.getTime() - windowDays * DAY_MS);
  const edges = await Transaction.aggregate([
    {
      $match: {
        type: 'TRANSFER',
        counterpartyAccountId: { $ne: null },
        occurredAt: { $gte: since, $lte: tx.occurredAt },
      },
    },
    { $group: { _id: { from: '$accountId', to: '$counterpartyAccountId' } } },
  ]);
  const adjacency = buildAdjacency(edges.map((edge) => ({ from: edge._id.from, to: edge._id.to })));
  const cycle = findCycleThrough(adjacency, tx.accountId, maxHops);
  return cycle ? { path: cycle, hops: cycle.length - 1 } : null;
}

export const evaluators = {
  THRESHOLD: threshold,
  STRUCTURING: structuring,
  VELOCITY: velocity,
  DORMANT: dormant,
  CIRCULAR: circular,
};
