import { describe, it, expect, beforeEach, vi } from 'vitest';
import { world } from '../ecs/world';
import { playerControlSystem } from '../ecs/systems/playerControl';
import { movementSystem } from '../ecs/systems/movement';

// Mock Phaser
vi.mock('phaser', () => {
  return {
    default: {
      Input: {
        Keyboard: {
          KeyCodes: {},
          CursorKeys: {},
        },
      },
      GameObjects: {
        Sprite: class {},
      },
    },
  };
});

const mockCursor = { isDown: false };
const mockCursors = {
  up: { ...mockCursor },
  left: { ...mockCursor },
  right: { ...mockCursor },
  down: { ...mockCursor },
  space: { ...mockCursor },
  shift: { ...mockCursor },
} as unknown as Phaser.Types.Input.Keyboard.CursorKeys;

describe('Player Controls & Movement', () => {
  beforeEach(() => {
    world.clear();
    mockCursors.up.isDown = false;
    mockCursors.left.isDown = false;
    mockCursors.right.isDown = false;
  });

  it('should increase velocity when UP is pressed', () => {
    const player = {
      id: 'player',
      playerControl: true,
      transform: { x: 0, y: 0, rotation: 0 },
      velocity: { vx: 0, vy: 0 },
      sectorId: 'sector-1',
    };
    world.add(player);

    mockCursors.up.isDown = true;
    playerControlSystem(mockCursors);

    expect(player.velocity.vx).toBeGreaterThan(0); // cos(0) * THRUST
    expect(player.velocity.vy).toBe(0); // sin(0) * THRUST
  });

  it('should update position based on velocity', () => {
    const player = {
      id: 'player',
      playerControl: true,
      transform: { x: 0, y: 0, rotation: 0 },
      velocity: { vx: 100, vy: 50 },
      sectorId: 'sector-1',
    };
    world.add(player);

    movementSystem(1000); // 1 second delta

    expect(player.transform.x).toBe(100);
    expect(player.transform.y).toBe(50);
  });

  it('should sync sprite position if present', () => {
    const mockSprite = {
      x: 0,
      y: 0,
      rotation: 0,
      setPosition: vi.fn(),
      setRotation: vi.fn(),
      setVisible: vi.fn(),
    };

    const player = {
      id: 'player',
      playerControl: true,
      transform: { x: 10, y: 20, rotation: 1.5 },
      velocity: { vx: 0, vy: 0 },
      sprite: mockSprite as unknown as Phaser.GameObjects.Sprite,
      sectorId: 'sector-1',
    };
    world.add(player);

    movementSystem(16);

    expect(mockSprite.x).toBe(10);
    expect(mockSprite.y).toBe(20);
    expect(mockSprite.rotation).toBe(1.5);
  });
});
