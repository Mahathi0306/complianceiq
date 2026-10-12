import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HttpError } from '../../utils/httpError.js';
import { ROLES, STAFF_ROLES } from '../../config/constants.js';
import { Rule } from '../../models/Rule.js';
import { recordAudit } from '../audit/audit.service.js';
import { invalidateRuleCache } from './rules.engine.js';
import { createRuleSchema, paramSchemas, updateRuleSchema } from './rules.schemas.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize(...STAFF_ROLES),
  asyncHandler(async (req, res) => {
    res.json(await Rule.find().sort({ type: 1, name: 1 }).lean());
  })
);

router.post(
  '/',
  authorize(ROLES.ADMIN),
  validate(createRuleSchema),
  asyncHandler(async (req, res) => {
    const rule = await Rule.create(req.body);
    invalidateRuleCache();
    await recordAudit({
      actor: req.user.id,
      action: 'RULE_CREATED',
      entity: 'Rule',
      entityId: rule.id,
      after: req.body,
    });
    res.status(201).json(rule);
  })
);

router.patch(
  '/:id',
  authorize(ROLES.ADMIN),
  validate(updateRuleSchema),
  asyncHandler(async (req, res) => {
    const rule = await Rule.findById(req.params.id);
    if (!rule) throw new HttpError(404, 'Rule not found');
    const before = rule.toObject();
    if (req.body.params) {
      const parsed = paramSchemas[rule.type].safeParse(req.body.params);
      if (!parsed.success) throw new HttpError(400, 'Invalid rule parameters', parsed.error.flatten());
      rule.params = parsed.data;
    }
    if (req.body.severity) rule.severity = req.body.severity;
    if (typeof req.body.enabled === 'boolean') rule.enabled = req.body.enabled;
    await rule.save();
    invalidateRuleCache();
    await recordAudit({
      actor: req.user.id,
      action: 'RULE_UPDATED',
      entity: 'Rule',
      entityId: rule.id,
      before: { params: before.params, severity: before.severity, enabled: before.enabled },
      after: { params: rule.params, severity: rule.severity, enabled: rule.enabled },
    });
    res.json(rule);
  })
);

export default router;
