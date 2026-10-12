import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { parsePagination, pageResult } from '../../utils/pagination.js';
import { STAFF_ROLES } from '../../config/constants.js';
import * as service from './alerts.service.js';

const router = Router();

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const listSchema = z.object({
  status: z.enum(['OPEN', 'IN_CASE', 'DISMISSED']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  ruleType: z.enum(['THRESHOLD', 'STRUCTURING', 'VELOCITY', 'DORMANT', 'CIRCULAR']).optional(),
  assignedTo: z.union([z.literal('me'), z.literal('none'), objectId]).optional(),
  accountId: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});

const searchSchema = z.object({
  q: z.string().trim().min(3).max(200),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});

const assignSchema = z.object({ userId: objectId.optional() });
const dismissSchema = z.object({ reason: z.string().trim().min(5).max(300) });

router.use(authenticate, authorize(...STAFF_ROLES));

router.get(
  '/',
  validate(listSchema, 'query'),
  asyncHandler(async (req, res) => {
    const paging = parsePagination(req.query);
    const { items, total } = await service.listAlerts(req.query, req.user, paging);
    res.json(pageResult(items, total, paging));
  })
);

router.get(
  '/search',
  validate(searchSchema, 'query'),
  asyncHandler(async (req, res) => {
    const paging = parsePagination(req.query);
    const { items, total, interpreted } = await service.searchAlerts(req.query.q, req.user, paging);
    res.json({ ...pageResult(items, total, paging), interpreted });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await service.getAlert(req.params.id));
  })
);

router.patch(
  '/:id/assign',
  validate(assignSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.assignAlert(req.params.id, req.body.userId || req.user.id, req.user));
  })
);

router.post(
  '/:id/dismiss',
  validate(dismissSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.dismissAlert(req.params.id, req.body.reason, req.user));
  })
);

export default router;
