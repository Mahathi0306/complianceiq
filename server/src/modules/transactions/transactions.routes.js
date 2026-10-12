import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HttpError } from '../../utils/httpError.js';
import { parsePagination, pageResult } from '../../utils/pagination.js';
import { STAFF_ROLES } from '../../config/constants.js';
import { ingestTransaction, listTransactions } from './transactions.service.js';

const router = Router();

const createSchema = z
  .object({
    accountId: z.string().trim().min(6),
    counterpartyAccountId: z.string().trim().min(3).nullable().optional(),
    type: z.enum(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER']),
    amount: z.number().positive().max(1_000_000_000),
    currency: z.string().trim().length(3).toUpperCase().default('INR'),
    country: z.string().trim().length(2).toUpperCase().optional(),
    channel: z.string().trim().max(30).optional(),
    occurredAt: z.coerce.date().optional(),
  })
  .refine((v) => v.type !== 'TRANSFER' || Boolean(v.counterpartyAccountId), {
    message: 'Transfers need a counterparty account',
    path: ['counterpartyAccountId'],
  });

const listSchema = z.object({
  accountId: z.string().optional(),
  type: z.enum(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});

router.use(authenticate, authorize(...STAFF_ROLES));

router.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const key = req.get('Idempotency-Key');
    if (!key || key.length < 8 || key.length > 128) {
      throw new HttpError(400, 'An Idempotency-Key header of 8 to 128 characters is required');
    }
    const input = { ...req.body, occurredAt: req.body.occurredAt || new Date() };
    const { transaction, duplicate } = await ingestTransaction(input, key);
    res.status(duplicate ? 200 : 202).json({ transaction, duplicate });
  })
);

router.get(
  '/',
  validate(listSchema, 'query'),
  asyncHandler(async (req, res) => {
    const paging = parsePagination(req.query);
    const { items, total } = await listTransactions({ ...req.query, ...paging });
    res.json(pageResult(items, total, paging));
  })
);

export default router;
