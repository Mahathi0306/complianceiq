import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ROLES } from '../../config/constants.js';
import { listAudit } from './audit.service.js';

const router = Router();

const querySchema = z.object({
  entity: z.string().optional(),
  entityId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

router.get(
  '/',
  authenticate,
  authorize(ROLES.OFFICER, ROLES.ADMIN),
  validate(querySchema, 'query'),
  asyncHandler(async (req, res) => {
    res.json(await listAudit(req.query));
  })
);

export default router;
