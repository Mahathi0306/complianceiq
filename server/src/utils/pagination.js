export function parsePagination(query, defaults = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || defaults.limit || 20));
  return { page, limit, skip: (page - 1) * limit };
}

export function pageResult(items, total, { page, limit }) {
  return { items, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}
