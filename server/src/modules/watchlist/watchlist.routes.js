import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ROLES, STAFF_ROLES } from '../../config/constants.js';
import { Watchlist } from '../../models/Watchlist.js';
import { invalidateWatchlistIndex, searchWatchlist } from '../screening/screening.service.js';
import { recordAudit } from '../audit/audit.service.js';

const router = Router();

const entrySchema = z.object({
  name: z.string().trim().min(2).max(120),
  aliases: z.array(z.string().trim().min(2).max(120)).max(20).default([]),
  source: z.enum(['SANCTIONS', 'PEP', 'INTERNAL']),
  country: z.string().trim().length(2).toUpperCase().optional(),
});

const searchSchema = z.object({ name: z.string().trim().min(2).max(120) });

router.get(
  '/',
  authenticate,
  authorize(...STAFF_ROLES),
  asyncHandler(async (req, res) => {
    res.json(await Watchlist.find().sort({ name: 1 }).limit(500).lean());
  })
);

router.get(
  '/search',
  authenticate,
  authorize(...STAFF_ROLES),
  validate(searchSchema, 'query'),
  asyncHandler(async (req, res) => {
    res.json(await searchWatchlist(req.query.name));
  })
);

router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(entrySchema),
  asyncHandler(async (req, res) => {
    const entry = await Watchlist.create(req.body);
    invalidateWatchlistIndex();
    await recordAudit({
      actor: req.user.id,
      action: 'WATCHLIST_ENTRY_ADDED',
      entity: 'Watchlist',
      entityId: entry.id,
      after: { name: entry.name, source: entry.source },
    });
    res.status(201).json(entry);
  })
);

export default router;
