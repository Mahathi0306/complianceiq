import { Rule } from '../../models/Rule.js';
import { evaluators } from './evaluators.js';

const CACHE_TTL_MS = 30_000;
let cache = { loadedAt: 0, rules: [] };

async function loadRules() {
  if (Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.rules;
  const rules = await Rule.find({ enabled: true }).lean();
  cache = { loadedAt: Date.now(), rules };
  return rules;
}

export function invalidateRuleCache() {
  cache = { loadedAt: 0, rules: [] };
}

export async function evaluateRules(tx, deps) {
  const rules = await loadRules();
  const outcomes = await Promise.all(
    rules.map(async (rule) => {
      const evaluator = evaluators[rule.type];
      if (!evaluator) return null;
      const details = await evaluator(rule, tx, deps);
      return details ? { rule, details } : null;
    })
  );
  return outcomes.filter(Boolean);
}
