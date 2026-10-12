const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'shri', 'smt', 'sri', 'late']);

const SOUNDEX_CODES = {
  B: 1, F: 1, P: 1, V: 1,
  C: 2, G: 2, J: 2, K: 2, Q: 2, S: 2, X: 2, Z: 2,
  D: 3, T: 3,
  L: 4,
  M: 5, N: 5,
  R: 6,
};

export function normalizeName(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !HONORIFICS.has(token))
    .join(' ');
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

export function levenshteinRatio(a, b) {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - levenshtein(a, b) / longest;
}

export function jaroWinkler(a, b) {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched = new Array(a.length).fill(false);
  const bMatched = new Array(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i += 1) {
    const start = Math.max(0, i - window);
    const end = Math.min(i + window + 1, b.length);
    for (let j = start; j < end; j += 1) {
      if (!bMatched[j] && a[i] === b[j]) {
        aMatched[i] = true;
        bMatched[j] = true;
        matches += 1;
        break;
      }
    }
  }
  if (!matches) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k += 1;
    if (a[i] !== b[k]) transpositions += 1;
    k += 1;
  }
  const jaro = (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < Math.min(4, a.length, b.length) && a[prefix] === b[prefix]) prefix += 1;
  return jaro + prefix * 0.1 * (1 - jaro);
}

export function soundex(word) {
  const letters = String(word).toUpperCase().replace(/[^A-Z]/g, '');
  if (!letters) return '';
  let result = letters[0];
  let previous = SOUNDEX_CODES[letters[0]] || 0;
  for (let i = 1; i < letters.length && result.length < 4; i += 1) {
    const ch = letters[i];
    const code = SOUNDEX_CODES[ch] || 0;
    if (code && code !== previous) result += code;
    if (ch !== 'H' && ch !== 'W') previous = code;
  }
  return result.padEnd(4, '0');
}

function sortTokens(name) {
  return name.split(' ').sort().join(' ');
}

function phoneticMatch(a, b) {
  const left = a.split(' ').map(soundex).sort();
  const right = b.split(' ').map(soundex).sort();
  return left.length === right.length && left.every((code, i) => code === right[i]);
}

export function nameSimilarity(rawA, rawB) {
  const a = normalizeName(rawA);
  const b = normalizeName(rawB);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ordered = Math.max(jaroWinkler(a, b), levenshteinRatio(a, b));
  const reordered = Math.max(
    jaroWinkler(sortTokens(a), sortTokens(b)),
    levenshteinRatio(sortTokens(a), sortTokens(b))
  );
  const compact = jaroWinkler(a.replace(/ /g, ''), b.replace(/ /g, ''));
  const score = Math.max(ordered, reordered * 0.98, compact * 0.97);
  return phoneticMatch(a, b) ? Math.max(score, 0.93) : score;
}
