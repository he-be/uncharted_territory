export type SectorType = 'core' | 'industrial' | 'mining' | 'frontier' | 'pirate';

export interface UniverseSector {
  id: string;
  name: string;
  type: SectorType;
  x: number; // For Map visualization
  y: number; // For Map visualization
  // Sector layout physics offset (to keep physics engines separate roughly, or just logically separate)
  // In this engine, we use 'sectorId' component so physics coords can overlap.
}

export interface UniverseConnection {
  from: string;
  to: string;
}

export const WORLD_SCALE = 1000;

export const getSectorWorldPosition = (sector: UniverseSector) => {
  return { x: sector.x * WORLD_SCALE, y: sector.y * WORLD_SCALE };
};

export const SECTORS: UniverseSector[] = [
  { id: 'sector-1', name: 'Prime Core', type: 'core', x: 400, y: 300 },
  { id: 'sector-2', name: 'Alpha Centauri', type: 'core', x: 600, y: 200 },
  { id: 'sector-3', name: 'Sirius Hub', type: 'industrial', x: 600, y: 400 },
  { id: 'sector-4', name: 'Orion Forge', type: 'industrial', x: 800, y: 400 },
  { id: 'sector-5', name: 'Kepler Drift', type: 'mining', x: 800, y: 600 },
  { id: 'sector-6', name: 'Vega Reach', type: 'mining', x: 1000, y: 600 },
  { id: 'sector-7', name: 'Outer Rim', type: 'frontier', x: 800, y: 200 },
  { id: 'sector-8', name: 'Shadow Belt', type: 'pirate', x: 200, y: 300 },
  { id: 'sector-9', name: 'Deep Void', type: 'frontier', x: 1200, y: 400 },
  { id: 'sector-10', name: 'Omega End', type: 'pirate', x: 1400, y: 400 },
  { id: 'sector-11', name: "Dead Man's Chest", type: 'pirate', x: 1200, y: 200 },
  { id: 'sector-12', name: "Viper's Nest", type: 'pirate', x: 1600, y: 400 },
  { id: 'sector-13', name: 'The Abyss', type: 'pirate', x: 1400, y: 600 },
];

export const CONNECTIONS: UniverseConnection[] = [
  { from: 'sector-1', to: 'sector-2' },
  { from: 'sector-1', to: 'sector-3' },
  { from: 'sector-1', to: 'sector-8' }, // NEW: Direct link to Shadow Belt for testing
  { from: 'sector-3', to: 'sector-4' },
  { from: 'sector-3', to: 'sector-7' },
  { from: 'sector-4', to: 'sector-5' },
  { from: 'sector-5', to: 'sector-6' }, // Deep mining chain
  { from: 'sector-7', to: 'sector-8' }, // Pirate route
  { from: 'sector-4', to: 'sector-9' },
  { from: 'sector-9', to: 'sector-10' },
  { from: 'sector-8', to: 'sector-11' },
  { from: 'sector-10', to: 'sector-12' },
  { from: 'sector-10', to: 'sector-13' },
];
