import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    accountId: { type: String, required: true },
    counterpartyAccountId: { type: String, default: null },
    type: { type: String, enum: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER'], required: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, default: 'INR' },
    country: { type: String, uppercase: true },
    channel: { type: String, default: 'ONLINE' },
    occurredAt: { type: Date, required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    status: { type: String, enum: ['PENDING', 'PROCESSED'], default: 'PENDING' },
    alertCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

transactionSchema.index({ accountId: 1, occurredAt: -1 });
transactionSchema.index({ type: 1, occurredAt: -1, counterpartyAccountId: 1 });

export const Transaction = mongoose.model('Transaction', transactionSchema);
