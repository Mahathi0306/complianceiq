import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    kind: { type: String, enum: ['ID_PROOF', 'ADDRESS_PROOF', 'SELFIE'], required: true },
    originalName: String,
    mimeType: String,
    size: Number,
    storagePath: { type: String, required: true },
    extractedFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    confidence: { type: Number, default: 0 },
  },
  { timestamps: true }
);

documentSchema.index({ customer: 1, kind: 1 });

export const Document = mongoose.model('Document', documentSchema);
