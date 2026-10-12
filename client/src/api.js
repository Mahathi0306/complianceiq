const BASE = '/api';
const STORAGE_KEY = 'ciq.session';

let session = null;
try {
  session = JSON.parse(localStorage.getItem(STORAGE_KEY));
} catch {
  session = null;
}

export function getSession() {
  return session;
}

export function saveSession(next) {
  session = next;
  if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  else localStorage.removeItem(STORAGE_KEY);
}

async function refresh() {
  if (!session?.refreshToken) return false;
  const response = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  if (!response.ok) {
    saveSession(null);
    return false;
  }
  saveSession(await response.json());
  return true;
}

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, form } = {}, canRetry = true) {
  const headers = {};
  if (session?.accessToken) headers.authorization = `Bearer ${session.accessToken}`;
  if (body) headers['content-type'] = 'application/json';
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  if (response.status === 401 && canRetry && session?.refreshToken && (await refresh())) {
    return request(path, { method, body, form }, false);
  }
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, payload.error || 'Request failed', payload.details);
  return payload;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: body ?? {} }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  upload: (path, form) => request(path, { method: 'POST', form }),
};

export function describeError(err) {
  const fields = err?.details?.fieldErrors;
  if (fields) {
    const first = Object.entries(fields)[0];
    if (first) return `${first[0]}: ${first[1][0]}`;
  }
  return err?.message || 'Something went wrong';
}
