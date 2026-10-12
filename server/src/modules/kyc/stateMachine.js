import { HttpError } from '../../utils/httpError.js';

const TRANSITIONS = Object.freeze({
  SUBMITTED: ['DOC_VERIFIED', 'MANUAL_REVIEW', 'REJECTED'],
  DOC_VERIFIED: ['SCREENED', 'MANUAL_REVIEW', 'REJECTED'],
  SCREENED: ['RISK_SCORED', 'MANUAL_REVIEW', 'REJECTED'],
  RISK_SCORED: ['APPROVED', 'MANUAL_REVIEW', 'REJECTED'],
  MANUAL_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: [],
});

export function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new HttpError(409, `Application cannot move from ${from} to ${to}`);
  }
}

export function isTerminal(state) {
  return (TRANSITIONS[state] || []).length === 0;
}
