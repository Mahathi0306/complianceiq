import mongoose from 'mongoose';

const screeningSchema = new mongoose.Schema(
  {
    topScore: Number,
    matches: [{ name: String, source: String, score: Number }],
    checkedAt: Date,
  },
  { _id: false }
);

const riskFactorSchema = new mongoose.Schema(
  { factor: String, points: Number, detail: String },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    fullName: { type: String, required: true, trim: true },
    dob: { type: Date, required: true },
    pan: { type: String, required: true, uppercase: true, trim: true, unique: true },
    country: { type: String, required: true, uppercase: true, trim: true },
    occupation: { type: String, required: true, trim: true },
    annualIncome: { type: Number, required: true, min: 0 },
    expectedMonthlyVolume: { type: Number, required: true, min: 0 },
    isPep: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    accountId: { type: String, unique: true, sparse: true },
    riskScore: Number,
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'] },
    riskBreakdown: [riskFactorSchema],
    riskExplanation: String,
    screening: screeningSchema,
  },
  { timestamps: true }
);

customerSchema.index({ riskLevel: 1, status: 1 });

export const Customer = mongoose.model('Customer', customerSchema);
