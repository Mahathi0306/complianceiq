export const ROLES = Object.freeze({
  CUSTOMER: 'CUSTOMER',
  ANALYST: 'ANALYST',
  OFFICER: 'OFFICER',
  ADMIN: 'ADMIN',
});

export const STAFF_ROLES = [ROLES.ANALYST, ROLES.OFFICER, ROLES.ADMIN];

export const SEVERITY_WEIGHT = Object.freeze({
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
});

export const SLA_HOURS = Object.freeze({
  LOW: 168,
  MEDIUM: 72,
  HIGH: 24,
  CRITICAL: 4,
});

export const REQUIRED_DOCUMENTS = ['ID_PROOF', 'ADDRESS_PROOF', 'SELFIE'];
