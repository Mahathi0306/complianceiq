import mongoose from 'mongoose';

export const CASE_STATUSES = ['OPEN', 'INVESTIGATING', 'ESCALATED', 'CLOSED', 'STR_FILED'];

const noteSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const generatedSchema = new mongoose.Schema(
  {
    text: String,
    model: String,
    generatedAt: Date,
    status: { type: String, enum: ['DRAFT', 'APPROVED'], default: 'DRAFT' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
  },
  { _id: false }
);

const caseSchema = new mongoose.Schema(
  {
    reference: { type: String, unique: true },
    accountId: { type: String, required: true, index: true },
    alerts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Alert' }],
    status: { type: String, enum: CASE_STATUSES, default: 'OPEN', index: true },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: [noteSchema],
    summary: generatedSchema,
    strDraft: generatedSchema,
    closedAt: Date,
  },
  { timestamps: true }
);

caseSchema.index({ status: 1, createdAt: 1 });

export const Case = mongoose.model('Case', caseSchema);
