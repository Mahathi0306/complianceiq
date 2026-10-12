import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ROLES, STAFF_ROLES } from '../../config/constants.js';
import { Alert } from '../../models/Alert.js';
import { Application } from '../../models/Application.js';
import { Case } from '../../models/Case.js';
import { Customer } from '../../models/Customer.js';

const router = Router();

const toMap = (rows) => Object.fromEntries(rows.map((row) => [row._id ?? 'UNKNOWN', row.count]));

const countBy = (Model, field, match = {}) =>
  Model.aggregate([{ $match: match }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }]);

function bucketAges(cases) {
  const buckets = { '0-2 days': 0, '3-7 days': 0, '8-14 days': 0, '15+ days': 0 };
  const now = Date.now();
  for (const item of cases) {
    const days = (now - new Date(item.createdAt).getTime()) / 86400000;
    if (days <= 2) buckets['0-2 days'] += 1;
    else if (days <= 7) buckets['3-7 days'] += 1;
    else if (days <= 14) buckets['8-14 days'] += 1;
    else buckets['15+ days'] += 1;
  }
  return buckets;
}

router.get(
  '/summary',
  authenticate,
  authorize(...STAFF_ROLES),
  asyncHandler(async (req, res) => {
    const since = new Date(Date.now() - 14 * 86400000);
    const [
      alertsBySeverity,
      alertsByStatus,
      riskLevels,
      casesByStatus,
      applicationsByState,
      openCases,
      trend,
      slaBreached,
    ] = await Promise.all([
      countBy(Alert, 'severity', { status: 'OPEN' }),
      countBy(Alert, 'status'),
      countBy(Customer, 'riskLevel', { status: 'ACTIVE' }),
      countBy(Case, 'status'),
      countBy(Application, 'state'),
      Case.find({ status: { $in: ['OPEN', 'INVESTIGATING', 'ESCALATED'] } }).select('createdAt').lean(),
      Alert.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Alert.countDocuments({ status: 'OPEN', slaDueAt: { $lt: new Date() } }),
    ]);

    const cases = toMap(casesByStatus);
    res.json({
      openAlertsBySeverity: toMap(alertsBySeverity),
      alertsByStatus: toMap(alertsByStatus),
      riskDistribution: toMap(riskLevels),
      casesByStatus: cases,
      strFiled: cases.STR_FILED || 0,
      applicationsByState: toMap(applicationsByState),
      caseAging: bucketAges(openCases),
      alertTrend: trend.map((row) => ({ day: row._id, count: row.count })),
      slaBreached,
    });
  })
);

export default router;
