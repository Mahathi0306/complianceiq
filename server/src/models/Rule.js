import mongoose from 'mongoose';

export const RULE_TYPES = ['THRESHOLD', 'STRUCTURING', 'VELOCITY', 'DORMANT', 'CIRCULAR'];

const ruleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    type: { type: String, enum: RULE_TYPES, required: true },
    params: { type: mongoose.Schema.Types.Mixed, required: true },
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
    enabled: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const Rule = mongoose.model('Rule', ruleSchema);
