import mongoose from 'mongoose';

export const APPLICATION_STATES = [
  'SUBMITTED',
  'DOC_VERIFIED',
  'SCREENED',
  'RISK_SCORED',
  'MANUAL_REVIEW',
  'APPROVED',
  'REJECTED',
];

const historySchema = new mongoose.Schema(
  {
    from: String,
    to: String,
    by: String,
    note: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, unique: true },
    state: { type: String, enum: APPLICATION_STATES, default: 'SUBMITTED', index: true },
    history: [historySchema],
    reviewNote: String,
  },
  { timestamps: true }
);

export const Application = mongoose.model('Application', applicationSchema);
