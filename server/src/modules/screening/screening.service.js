import { Watchlist } from '../../models/Watchlist.js';
import { NgramIndex } from './ngramIndex.js';
import { nameSimilarity, normalizeName } from './similarity.js';

let indexPromise = null;

async function buildIndex() {
  const entries = await Watchlist.find().lean();
  const index = new NgramIndex(3);
  for (const entry of entries) {
    const names = [entry.name, ...(entry.aliases || [])];
    names.forEach((name, position) => {
      const normalized = normalizeName(name);
      if (!normalized) return;
      index.add(`${entry._id}:${position}`, normalized, {
        entryId: String(entry._id),
        listedName: entry.name,
        source: entry.source,
      });
    });
  }
  return index;
}

export function invalidateWatchlistIndex() {
  indexPromise = null;
}

export async function searchWatchlist(name, { limit = 5, threshold = 0.78 } = {}) {
  if (!indexPromise) indexPromise = buildIndex();
  const index = await indexPromise;
  const query = normalizeName(name);
  if (!query) return [];
  const candidates = index.candidates(query, { minDice: 0.25, limit: 60 });
  const best = new Map();
  for (const candidate of candidates) {
    const score = nameSimilarity(query, candidate.text);
    if (score < threshold) continue;
    const current = best.get(candidate.payload.entryId);
    if (!current || score > current.score) {
      best.set(candidate.payload.entryId, {
        name: candidate.payload.listedName,
        source: candidate.payload.source,
        score: Number(score.toFixed(3)),
      });
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function screenCustomer(customer) {
  const matches = await searchWatchlist(customer.fullName);
  return {
    topScore: matches.length ? matches[0].score : 0,
    matches,
    checkedAt: new Date(),
  };
}
