import { CONNECTIONS } from '../data/universe';

const pathCache = new Map<string, string[] | null>();

export const findPath = (startSectorId: string, endSectorId: string): string[] | null => {
  if (startSectorId === endSectorId) return [];

  const cacheKey = `${startSectorId}->${endSectorId}`;
  if (pathCache.has(cacheKey)) {
    return pathCache.get(cacheKey)!;
  }

  const queue: { id: string; path: string[] }[] = [{ id: startSectorId, path: [] }];
  const visited = new Set<string>();
  visited.add(startSectorId);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    // Check neighbors
    const neighbors = CONNECTIONS.filter((c) => c.from === current.id || c.to === current.id).map(
      (c) => (c.from === current.id ? c.to : c.from)
    );

    for (const neighborId of neighbors) {
      if (neighborId === endSectorId) {
        const fullPath = [...current.path, neighborId];
        pathCache.set(cacheKey, fullPath);
        return fullPath;
      }

      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({ id: neighborId, path: [...current.path, neighborId] });
      }
    }
  }

  pathCache.set(cacheKey, null);
  return null;
};
