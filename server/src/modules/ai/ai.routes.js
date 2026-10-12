import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { STAFF_ROLES } from '../../config/constants.js';
import { scrubText } from '../../utils/mask.js';
import { askAssistant } from './ai.client.js';
import { buildCaseContext } from '../cases/cases.service.js';

const router = Router();

const askSchema = z.object({
  question: z.string().trim().min(5).max(500),
  caseId: z.string().optional(),
});

router.post(
  '/ask',
  authenticate,
  authorize(...STAFF_ROLES),
  validate(askSchema),
  asyncHandler(async (req, res) => {
    const context = req.body.caseId ? await buildCaseContext(req.body.caseId) : null;
    const result = await askAssistant({ question: scrubText(req.body.question), context });
    res.json(result);
  })
);

export default router;
