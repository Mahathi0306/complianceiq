import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import kycRoutes from './modules/kyc/kyc.routes.js';
import transactionRoutes from './modules/transactions/transactions.routes.js';
import alertRoutes from './modules/alerts/alerts.routes.js';
import caseRoutes from './modules/cases/cases.routes.js';
import ruleRoutes from './modules/rules/rules.routes.js';
import watchlistRoutes from './modules/watchlist/watchlist.routes.js';
import reportRoutes from './modules/reports/reports.routes.js';
import aiRoutes from './modules/ai/ai.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/kyc', kycRoutes);
router.use('/transactions', transactionRoutes);
router.use('/alerts', alertRoutes);
router.use('/cases', caseRoutes);
router.use('/rules', ruleRoutes);
router.use('/watchlist', watchlistRoutes);
router.use('/reports', reportRoutes);
router.use('/ai', aiRoutes);
router.use('/audit', auditRoutes);

export default router;
