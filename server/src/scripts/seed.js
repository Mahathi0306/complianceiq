import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb } from '../config/db.js';
import { User } from '../models/User.js';
import { Rule } from '../models/Rule.js';
import { Watchlist } from '../models/Watchlist.js';

const staff = [
  { name: 'Asha Verma', email: 'admin@complianceiq.dev', role: 'ADMIN' },
  { name: 'Ravi Menon', email: 'officer@complianceiq.dev', role: 'OFFICER' },
  { name: 'Neha Iyer', email: 'analyst@complianceiq.dev', role: 'ANALYST' },
  { name: 'Karan Shah', email: 'analyst2@complianceiq.dev', role: 'ANALYST' },
];

const rules = [
  { name: 'Large transaction', type: 'THRESHOLD', severity: 'MEDIUM', params: { amount: 1000000 } },
  {
    name: 'Deposits just under reporting limit',
    type: 'STRUCTURING',
    severity: 'HIGH',
    params: { limit: 1000000, margin: 0.1, windowHours: 72, minCount: 3 },
  },
  {
    name: 'Rapid transaction burst',
    type: 'VELOCITY',
    severity: 'MEDIUM',
    params: { windowSeconds: 600, maxCount: 5 },
  },
  {
    name: 'Dormant account reactivation',
    type: 'DORMANT',
    severity: 'HIGH',
    params: { inactiveDays: 90, minAmount: 200000 },
  },
  {
    name: 'Circular fund movement',
    type: 'CIRCULAR',
    severity: 'CRITICAL',
    params: { maxHops: 5, windowDays: 14 },
  },
];

const watchlist = [
  { name: 'Viktor Dmitrievich Petrov', aliases: ['Victor Petrov', 'V D Petrov'], source: 'SANCTIONS', country: 'RU' },
  { name: 'Muhammad Al Rashid', aliases: ['Mohammed Alrashid', 'M Al-Rashid'], source: 'SANCTIONS', country: 'SY' },
  { name: 'Carlos Eduardo Mendes', aliases: ['Carlos E Mendez'], source: 'SANCTIONS', country: 'VE' },
  { name: 'Ananya Deshpande', aliases: ['Ananya R Deshpande'], source: 'PEP', country: 'IN' },
  { name: 'Rajendra Prasad Nair', aliases: ['R P Nair'], source: 'PEP', country: 'IN' },
  { name: 'Sun Wei Ling', aliases: ['Wei Ling Sun'], source: 'INTERNAL', country: 'CN' },
];

async function main() {
  await connectDb();
  const password = process.env.SEED_PASSWORD || 'Passw0rd!2024';
  const passwordHash = await bcrypt.hash(password, 12);

  for (const person of staff) {
    await User.updateOne({ email: person.email }, { $setOnInsert: { ...person, passwordHash } }, { upsert: true });
  }
  for (const rule of rules) {
    await Rule.updateOne({ name: rule.name }, { $setOnInsert: rule }, { upsert: true });
  }
  for (const entry of watchlist) {
    await Watchlist.updateOne({ name: entry.name, source: entry.source }, { $setOnInsert: entry }, { upsert: true });
  }

  console.log(`seeded ${staff.length} staff, ${rules.length} rules, ${watchlist.length} watchlist entries`);
  console.log(`staff password: ${password}`);
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
