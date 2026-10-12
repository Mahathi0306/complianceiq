import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema(
  {
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
    rule: { type: mongoose.Schema.Types.ObjectId, ref: 'Rule', required: true },
    ruleName: String,
    ruleType: String,
    accountId: { type: String, required: true, index: true },
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], required: true },
    priority: { type: Number, required: true },
    status: {
      type: String,
      enum: ['OPEN', 'IN_CASE', 'DISMISSED'],
      default: 'OPEN',
    },
    details: mongoose.Schema.Types.Mixed,
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    case: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', default: null },
    dismissReason: String,
    slaDueAt: { type: Date, required: true },
  },
  { timestamps: true }
);

alertSchema.index({ transaction: 1, rule: 1 }, { unique: true });
alertSchema.index({ status: 1, priority: -1, createdAt: 1 });
alertSchema.index({ assignedTo: 1, status: 1 });

export const Alert = mongoose.model('Alert', alertSchema);
