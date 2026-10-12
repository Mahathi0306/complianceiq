import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './auth.service.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8).max(72),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({ refreshToken: z.string().min(10) });

router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.registerCustomer(req.body));
  })
);

router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.login(req.body));
  })
);

router.post(
  '/refresh',
  authLimiter,
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.refreshSession(req.body.refreshToken));
  })
);

router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    await service.revokeSessions(req.user.id);
    res.status(204).end();
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await service.getProfile(req.user.id));
  })
);

export default router;
