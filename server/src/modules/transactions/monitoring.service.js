import { Alert } from '../../models/Alert.js';
import { Transaction } from '../../models/Transaction.js';
import { SEVERITY_WEIGHT, SLA_HOURS } from '../../config/constants.js';
import { getRedis } from '../../config/redis.js';
import { evaluateRules } from '../rules/rules.engine.js';

export async function evaluateTransaction(transactionId) {
  const transaction = await Transaction.findById(transactionId);
  if (!transaction || transaction.status === 'PROCESSED') return 0;

  const hits = await evaluateRules(transaction, { redis: getRedis() });
  let created = 0;

  for (const { rule, details } of hits) {
    try {
      await Alert.create({
        transaction: transaction._id,
        rule: rule._id,
        ruleName: rule.name,
        ruleType: rule.type,
        accountId: transaction.accountId,
        severity: rule.severity,
        priority: SEVERITY_WEIGHT[rule.severity],
        details,
        slaDueAt: new Date(Date.now() + SLA_HOURS[rule.severity] * 3600 * 1000),
      });
      created += 1;
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
  }

  await Transaction.updateOne(
    { _id: transaction._id },
    { $set: { status: 'PROCESSED', alertCount: hits.length } }
  );
  return created;
}
