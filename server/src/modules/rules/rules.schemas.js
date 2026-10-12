import { z } from 'zod';

export const paramSchemas = {
  THRESHOLD: z.object({ amount: z.number().positive() }),
  STRUCTURING: z.object({
    limit: z.number().positive(),
    margin: z.number().min(0.01).max(0.5),
    windowHours: z.number().positive().max(24 * 30),
    minCount: z.number().int().min(2),
  }),
  VELOCITY: z.object({
    windowSeconds: z.number().int().min(10).max(86400),
    maxCount: z.number().int().min(1),
  }),
  DORMANT: z.object({
    inactiveDays: z.number().int().min(1),
    minAmount: z.number().positive(),
  }),
  CIRCULAR: z.object({
    maxHops: z.number().int().min(3).max(8),
    windowDays: z.number().int().min(1).max(90),
  }),
};

const base = {
  name: z.string().trim().min(3).max(80),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  enabled: z.boolean().default(true),
};

export const createRuleSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('THRESHOLD'), params: paramSchemas.THRESHOLD }),
  z.object({ ...base, type: z.literal('STRUCTURING'), params: paramSchemas.STRUCTURING }),
  z.object({ ...base, type: z.literal('VELOCITY'), params: paramSchemas.VELOCITY }),
  z.object({ ...base, type: z.literal('DORMANT'), params: paramSchemas.DORMANT }),
  z.object({ ...base, type: z.literal('CIRCULAR'), params: paramSchemas.CIRCULAR }),
]);

export const updateRuleSchema = z.object({
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  enabled: z.boolean().optional(),
  params: z.record(z.any()).optional(),
});
