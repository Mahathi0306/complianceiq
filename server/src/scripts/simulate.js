import { randomUUID } from 'node:crypto';
import { connectDb, disconnectDb } from '../config/db.js';
import { Customer } from '../models/Customer.js';

const API = process.env.API_URL || 'http://localhost:4000/api';
const EMAIL = process.env.SIM_EMAIL || 'analyst@complianceiq.dev';
const PASSWORD = process.env.SEED_PASSWORD || 'Passw0rd!2024';

const people = [
  ['Meera Krishnan', 'Teacher', 'IN', 600000, 40000],
  ['Sanjay Rao', 'Trader', 'IN', 900000, 120000],
  ['Pooja Nambiar', 'Software engineer', 'IN', 1800000, 90000],
  ['Imran Qureshi', 'Jeweller', 'IN', 1200000, 400000],
  ['Divya Chandran', 'Consultant', 'IN', 1500000, 150000],
  ['Arun Pillai', 'Business owner', 'IN', 2400000, 300000],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

async function login() {
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!response.ok) throw new Error(`login failed with ${response.status}`);
  return (await response.json()).accessToken;
}

async function ensureCustomers() {
  const accounts = [];
  for (let i = 0; i < people.length; i += 1) {
    const [fullName, occupation, country, annualIncome, expectedMonthlyVolume] = people[i];
    const pan = `SIMUL${String(1000 + i)}${String.fromCharCode(65 + i)}`;
    const accountId = `ACC${String(7000000000 + i)}`;
    await Customer.updateOne(
      { pan },
      {
        $setOnInsert: {
          fullName,
          dob: new Date('1990-05-14'),
          pan,
          country,
          occupation,
          annualIncome,
          expectedMonthlyVolume,
          status: 'ACTIVE',
          accountId,
          riskLevel: 'LOW',
          riskScore: 10,
        },
      },
      { upsert: true }
    );
    accounts.push(accountId);
  }
  return accounts;
}

function sender(token) {
  return async (payload) => {
    const response = await fetch(`${API}/transactions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'idempotency-key': randomUUID(),
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) console.error('rejected', response.status, await response.text());
  };
}

async function main() {
  await connectDb();
  const accounts = await ensureCustomers();
  const send = sender(await login());
  const [a, b, c, d, e] = accounts;

  console.log('background traffic');
  for (let i = 0; i < 25; i += 1) {
    await send({
      accountId: pick(accounts),
      type: pick(['DEPOSIT', 'WITHDRAWAL']),
      amount: 2000 + Math.round(Math.random() * 60000),
      country: 'IN',
    });
    await sleep(80);
  }

  console.log('structuring pattern');
  for (const amount of [980000, 960000, 990000, 975000]) {
    await send({ accountId: a, type: 'DEPOSIT', amount, country: 'IN' });
    await sleep(120);
  }

  console.log('velocity burst');
  for (let i = 0; i < 8; i += 1) {
    await send({ accountId: b, type: 'WITHDRAWAL', amount: 5000 + i * 100, country: 'IN' });
  }

  console.log('circular transfers');
  await send({ accountId: c, counterpartyAccountId: d, type: 'TRANSFER', amount: 450000 });
  await sleep(150);
  await send({ accountId: d, counterpartyAccountId: e, type: 'TRANSFER', amount: 440000 });
  await sleep(150);
  await send({ accountId: e, counterpartyAccountId: c, type: 'TRANSFER', amount: 430000 });

  console.log('large cross border style transfer');
  await send({ accountId: e, counterpartyAccountId: 'EXT-OFFSHORE-009', type: 'TRANSFER', amount: 2500000, country: 'PA' });

  console.log('simulation sent, alerts appear once the worker processes the queue');
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
