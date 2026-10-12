import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { parsePagination, pageResult } from '../../utils/pagination.js';
import { ROLES, STAFF_ROLES } from '../../config/constants.js';
import { CASE_STATUSES } from '../../models/Case.js';
import * as service from './cases.service.js';

const router = Router();

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const createSchema = z.object({ alertIds: z.array(objectId).min(1).max(50) });
const listSchema = z.object({
  status: z.enum(CASE_STATUSES).optional(),
  assignee: z.literal('me').optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});
const statusSchema = z.object({ status: z.enum(['INVESTIGATING', 'ESCALATED', 'CLOSED']) });
const noteSchema = z.object({ text: z.string().trim().min(2).max(2000) });
const assignSchema = z.object({ userId: objectId });
const strSchema = z.object({ text: z.string().trim().min(20).max(12000) });

router.use(authenticate, authorize(...STAFF_ROLES));

router.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.createCase(req.body.alertIds, req.user));
  })
);

router.get(
  '/',
  validate(listSchema, 'query'),
  asyncHandler(async (req, res) => {
    const paging = parsePagination(req.query);
    const { items, total } = await service.listCases({ ...req.query, ...paging }, req.user);
    res.json(pageResult(items, total, paging));
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await service.getCase(req.params.id));
  })
);

router.patch(
  '/:id/status',
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.changeStatus(req.params.id, req.body.status, req.user));
  })
);

router.patch(
  '/:id/assignee',
  authorize(ROLES.OFFICER, ROLES.ADMIN),
  validate(assignSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.assignCase(req.params.id, req.body.userId, req.user));
  })
);

router.post(
  '/:id/notes',
  validate(noteSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.addNote(req.params.id, req.body.text, req.user));
  })
);

router.post(
  '/:id/summary',
  asyncHandler(async (req, res) => {
    res.json(await service.generateSummary(req.params.id, req.user));
  })
);

router.post(
  '/:id/str',
  asyncHandler(async (req, res) => {
    res.json(await service.generateStrDraft(req.params.id, req.user));
  })
);

router.put(
  '/:id/str',
  validate(strSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.editStrDraft(req.params.id, req.body.text, req.user));
  })
);

router.post(
  '/:id/str/approve',
  authorize(ROLES.OFFICER, ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    res.json(await service.approveStr(req.params.id, req.user));
  })
);

export default router;
