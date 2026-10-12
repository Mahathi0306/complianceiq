import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ROLES } from '../../config/constants.js';
import { User } from '../../models/User.js';
import { createStaffUser } from '../auth/auth.service.js';
import { recordAudit } from '../audit/audit.service.js';

const router = Router();

const listSchema = z.object({
  role: z.enum([ROLES.ANALYST, ROLES.OFFICER, ROLES.ADMIN]).optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8).max(72),
  role: z.enum([ROLES.ANALYST, ROLES.OFFICER, ROLES.ADMIN]),
});

router.get(
  '/',
  authenticate,
  authorize(ROLES.OFFICER, ROLES.ADMIN),
  validate(listSchema, 'query'),
  asyncHandler(async (req, res) => {
    const filter = req.query.role
      ? { role: req.query.role }
      : { role: { $in: [ROLES.ANALYST, ROLES.OFFICER, ROLES.ADMIN] } };
    const users = await User.find(filter).select('name email role active').sort({ name: 1 }).lean();
    res.json(users);
  })
);

router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const user = await createStaffUser(req.body);
    await recordAudit({
      actor: req.user.id,
      action: 'USER_CREATED',
      entity: 'User',
      entityId: user.id,
      after: { email: user.email, role: user.role },
    });
    res.status(201).json(user);
  })
);

export default router;
