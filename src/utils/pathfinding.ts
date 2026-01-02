import { CONNECTIONS, SECTORS } from '../data/universe';

const pathCache = new Map<string, string[] | null>();
let initialized = false;

const precomputePaths = () => {
  if (initialized) return;

  // BFS from every sector to every other sector
  for (const start of SECTORS) {
    // Run BFS
    const queue: { id: string; path: string[] }[] = [{ id: start.id, path: [] }];
    const visited = new Set<string>();
    visited.add(start.id);

    // We need to store paths to ALL others.
    // But BFS only finds shortest path to targets found.
    // Since graph is small, we can just run full traversal.

    while (queue.length > 0) {
      const current = queue.shift()!;

      // Cache this path (from start to current)
      if (current.id !== start.id) {
        const key = `${start.id}->${current.id}`;
        pathCache.set(key, current.path); // path is list of *next* hops? No, implementation returns list of sector IDs?
        // Original implementations: findPath returns string[] | null.
        // "path" in queue was accumulating sector IDs.
        // Wait, original implementation: "const fullPath = [...current.path, neighborId];"
        // And returns it. So likely [nextSector, nextNextSector, ... targetSector]
        // (or maybe excluding start? current.path starts empty).
        // Yes, current.path starts empty. neighborId is added.
        // So path to neighborId is [s1, s2, ... neighborId].
        // Wait, if start to start is [], then start to neighbor is [neighbor].
      }

      // Neighbors
      const neighbors = CONNECTIONS.filter((c) => c.from === current.id || c.to === current.id).map(
        (c) => (c.from === current.id ? c.to : c.from)
      );

      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          const newPath = [...current.path, n];
          queue.push({ id: n, path: newPath });

          // Store
          const key = `${start.id}->${n}`;
          pathCache.set(key, newPath);
        }
      }
    }
  }
  initialized = true;
  console.log(`[Pathfinding] Pre-computed ${pathCache.size} routes.`);
};

export const findPath = (startSectorId: string, endSectorId: string): string[] | null => {
  if (!initialized) precomputePaths();
  if (startSectorId === endSectorId) return [];

  const cacheKey = `${startSectorId}->${endSectorId}`;
  return pathCache.get(cacheKey) || null;
};
