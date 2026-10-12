import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { ROLES } from '../../config/constants.js';
import { User } from '../../models/User.js';
import { HttpError } from '../../utils/httpError.js';

const SALT_ROUNDS = 12;

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function issueTokens(user) {
  const accessToken = jwt.sign({ role: user.role, email: user.email }, env.jwtSecret, {
    subject: String(user._id),
    expiresIn: env.accessTtl,
  });
  const refreshToken = jwt.sign({ v: user.tokenVersion || 0 }, env.jwtRefreshSecret, {
    subject: String(user._id),
    expiresIn: env.refreshTtl,
  });
  return { accessToken, refreshToken };
}

export async function registerCustomer({ name, email, password }) {
  const existing = await User.exists({ email: email.toLowerCase() });
  if (existing) throw new HttpError(409, 'An account with this email already exists');
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ name, email, passwordHash, role: ROLES.CUSTOMER });
  return { user: publicUser(user), ...issueTokens(user) };
}

export async function createStaffUser({ name, email, password, role }) {
  const existing = await User.exists({ email: email.toLowerCase() });
  if (existing) throw new HttpError(409, 'An account with this email already exists');
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ name, email, passwordHash, role });
  return publicUser(user);
}

export async function login({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash +tokenVersion');
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) throw new HttpError(401, 'Incorrect email or password');
  if (!user.active) throw new HttpError(403, 'This account has been disabled');
  return { user: publicUser(user), ...issueTokens(user) };
}

export async function refreshSession(refreshToken) {
  let payload;
  try {
    payload = jwt.verify(refreshToken, env.jwtRefreshSecret);
  } catch {
    throw new HttpError(401, 'Invalid or expired refresh token');
  }
  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user || !user.active || (user.tokenVersion || 0) !== payload.v) {
    throw new HttpError(401, 'Session is no longer valid');
  }
  return { user: publicUser(user), ...issueTokens(user) };
}

export async function revokeSessions(userId) {
  await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
}

export async function getProfile(userId) {
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'User not found');
  return publicUser(user);
}
