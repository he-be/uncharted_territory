import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MainScene } from '../scenes/MainScene';
import { SECTORS } from '../data/universe';

// Mock Phaser
vi.mock('phaser', () => ({
  default: {
    Scene: class {
      add = {
        sprite: vi.fn(() => ({ setScale: vi.fn(), setDepth: vi.fn() })),
        group: vi.fn(),
        text: vi.fn(),
        grid: vi.fn(),
        graphics: vi.fn(),
      };
      input = {
        keyboard: {
          createCursorKeys: vi.fn(),
          addKey: vi.fn(),
          KeyCodes: { E: 0, Z: 0, X: 0, C: 0 },
        },
        on: vi.fn(),
      };
      cameras = { main: { startFollow: vi.fn(), setZoom: vi.fn(), setBounds: vi.fn() } };
      load = { image: vi.fn() };
      game = { loop: { actualFps: 60 } };
    },
    Input: { Keyboard: { KeyCodes: {} } },
    Math: { Distance: { Between: vi.fn() } },
  },
}));

// Mock World
vi.mock('../ecs/world', () => ({
  world: {
    add: vi.fn(),
    with: vi.fn(() => []),
  },
}));

describe('Gate Layout Logic', () => {
  let scene: MainScene;

  beforeEach(() => {
    scene = new MainScene();
    // Mock createGate to spy on placement
    scene.createGate = vi.fn();
  });

  it('should strictly place at most one gate per cardinal direction', () => {
    // Manually trigger the generation logic (we might need to extract it or call generateUniverse)
    // Since generateUniverse uses the global SECTORS/CONNECTIONS, we test the logic via the scene method.
    scene.generateUniverse();

    const calls = (scene.createGate as unknown as { mock: { calls: unknown[][] } }).mock.calls;

    // Group calls by SectorID
    const gatesPerSector: Record<string, { x: number; y: number }[]> = {};

    calls.forEach((args: unknown[]) => {
      const x = args[0] as number;
      const y = args[1] as number;
      const sectorId = args[2] as string;

      if (!gatesPerSector[sectorId]) gatesPerSector[sectorId] = [];
      gatesPerSector[sectorId].push({ x, y });
    });

    // Analyze each sector
    Object.entries(gatesPerSector).forEach(([sectorId, gates]) => {
      const sector = SECTORS.find((s) => s.id === sectorId);
      if (!sector) return;
      const center = { x: sector.x * 1000, y: sector.y * 1000 };

      // Check directions
      const directions = new Set<string>();

      gates.forEach((g) => {
        let dir = '';
        // Approximate checks (assuming 5000 offset logic)
        if (g.x > center.x + 2000) dir = 'E';
        else if (g.x < center.x - 2000) dir = 'W';
        else if (g.y > center.y + 2000) dir = 'S';
        else if (g.y < center.y - 2000) dir = 'N';

        // Assert Uniqueness
        if (directions.has(dir)) {
          console.error(`Sector ${sectorId} has duplicate gate in direction ${dir}`);
        }
        expect(directions.has(dir)).toBe(false);
        directions.add(dir);
      });
    });
  });
});
