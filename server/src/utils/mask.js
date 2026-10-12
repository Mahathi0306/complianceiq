const PAN_PATTERN = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;
const ACCOUNT_PATTERN = /\bACC\d{6,12}\b/g;
const PHONE_PATTERN = /\b[6-9]\d{9}\b/g;

export function scrubText(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(PAN_PATTERN, '[PAN]')
    .replace(ACCOUNT_PATTERN, '[ACCOUNT]')
    .replace(PHONE_PATTERN, '[PHONE]');
}

export function createAliaser(prefix) {
  const seen = new Map();
  return (value) => {
    if (value === null || value === undefined) return null;
    if (!seen.has(value)) seen.set(value, `${prefix}-${seen.size + 1}`);
    return seen.get(value);
  };
}

export function scrubDeep(value) {
  if (typeof value === 'string') return scrubText(value);
  if (Array.isArray(value)) return value.map(scrubDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubDeep(v)]));
  }
  return value;
}
