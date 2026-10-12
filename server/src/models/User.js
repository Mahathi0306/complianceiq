import mongoose from 'mongoose';
import { ROLES } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.CUSTOMER, index: true },
    tokenVersion: { type: Number, default: 0, select: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
