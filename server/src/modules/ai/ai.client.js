import { z } from 'zod';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/httpError.js';

const generated = z.object({ text: z.string().min(1), model: z.string() });

const schemas = {
  summarize: generated,
  strDraft: generated,
  explainRisk: z.object({ text: z.string().min(1) }),
  ask: z.object({
    answer: z.string().min(1),
    sources: z.array(z.object({ title: z.string(), snippet: z.string() })),
  }),
  extract: z.object({
    fields: z.record(z.any()),
    confidence: z.number().min(0).max(1),
  }),
  parseQuery: z.object({
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).nullable().optional(),
    ruleType: z
      .enum(['THRESHOLD', 'STRUCTURING', 'VELOCITY', 'DORMANT', 'CIRCULAR'])
      .nullable()
      .optional(),
    status: z.enum(['OPEN', 'IN_CASE', 'DISMISSED']).nullable().optional(),
    days: z.number().int().min(1).max(365).nullable().optional(),
  }),
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(path, body, schema, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`${env.aiServiceUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(env.aiTimeoutMs),
      });
      if (!response.ok) throw new Error(`AI service responded with ${response.status}`);
      return schema.parse(await response.json());
    } catch (err) {
      lastError = err;
      if (attempt < attempts - 1) await sleep(250 * 2 ** attempt);
    }
  }
  console.error('AI call failed', path, lastError?.message);
  throw new HttpError(502, 'The AI service is unavailable right now');
}

export const summarizeCase = (context) => call('/summarize', { context }, schemas.summarize);
export const draftStr = (context) => call('/str-draft', { context }, schemas.strDraft);
export const explainRisk = (payload) => call('/explain-risk', payload, schemas.explainRisk);
export const askAssistant = (payload) => call('/ask', payload, schemas.ask);
export const extractDocument = (payload) => call('/extract', payload, schemas.extract, 1);
export const parseQuery = (query) => call('/parse-query', { query }, schemas.parseQuery, 2);
