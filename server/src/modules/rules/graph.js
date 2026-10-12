export function buildAdjacency(edges) {
  const adjacency = new Map();
  for (const { from, to } of edges) {
    if (!from || !to || from === to) continue;
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    adjacency.get(from).add(to);
  }
  return adjacency;
}

export function findCycleThrough(adjacency, start, maxHops, minHops = 3) {
  const path = [start];

  const walk = (node, depth) => {
    const neighbours = adjacency.get(node);
    if (!neighbours) return null;
    for (const next of neighbours) {
      if (next === start) {
        if (depth + 1 >= minHops) return [...path, start];
        continue;
      }
      if (path.includes(next) || depth + 1 >= maxHops) continue;
      path.push(next);
      const found = walk(next, depth + 1);
      if (found) return found;
      path.pop();
    }
    return null;
  };

  return walk(start, 0);
}
