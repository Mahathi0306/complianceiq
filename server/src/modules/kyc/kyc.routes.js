import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { ROLES, STAFF_ROLES } from '../../config/constants.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HttpError } from '../../utils/httpError.js';
import { parsePagination, pageResult } from '../../utils/pagination.js';
import * as service from './kyc.service.js';

const router = Router();

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);

const upload = multer({
  storage: multer.diskStorage({
    destination: env.uploadDir,
    filename: (req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) return cb(new HttpError(415, 'Only JPEG, PNG or PDF files are accepted'));
    cb(null, true);
  },
});

const MIN_AGE_MS = 18 * 365.25 * 24 * 3600 * 1000;

const applicationSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  dob: z.coerce.date().refine((d) => Date.now() - d.getTime() >= MIN_AGE_MS, 'Applicant must be at least 18'),
  pan: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN format'),
  country: z.string().trim().length(2).toUpperCase(),
  occupation: z.string().trim().min(2).max(80),
  annualIncome: z.number().nonnegative(),
  expectedMonthlyVolume: z.number().nonnegative(),
  isPep: z.boolean().default(false),
});

const listSchema = z.object({
  state: z
    .enum(['SUBMITTED', 'DOC_VERIFIED', 'SCREENED', 'RISK_SCORED', 'MANUAL_REVIEW', 'APPROVED', 'REJECTED'])
    .optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});

const documentKindSchema = z.object({ kind: z.enum(['ID_PROOF', 'ADDRESS_PROOF', 'SELFIE']) });

const decisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().trim().min(3).max(500),
});

router.use(authenticate);

router.post(
  '/applications',
  authorize(ROLES.CUSTOMER, ...STAFF_ROLES),
  validate(applicationSchema),
  asyncHandler(async (req, res) => {
    const { application, customer } = await service.createApplication(req.body, req.user);
    res.status(201).json({ application, customer });
  })
);

router.get(
  '/applications',
  validate(listSchema, 'query'),
  asyncHandler(async (req, res) => {
    const paging = parsePagination(req.query);
    const { items, total } = await service.listApplications(req.user, { state: req.query.state, ...paging });
    res.json(pageResult(items, total, paging));
  })
);

router.get(
  '/applications/:id',
  asyncHandler(async (req, res) => {
    res.json(await service.getApplication(req.params.id, req.user));
  })
);

router.post(
  '/applications/:id/documents',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'A file is required');
    const { kind } = documentKindSchema.parse(req.body);
    const document = await service.attachDocument(req.params.id, req.user, { kind, file: req.file });
    res.status(201).json(document);
  })
);

router.post(
  '/applications/:id/process',
  asyncHandler(async (req, res) => {
    res.json(await service.processApplication(req.params.id, req.user));
  })
);

router.post(
  '/applications/:id/decision',
  authorize(ROLES.OFFICER, ROLES.ADMIN),
  validate(decisionSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.decideApplication(req.params.id, req.user, req.body));
  })
);

export default router;
