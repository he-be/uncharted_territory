import { world } from '../world';
import Phaser from 'phaser';
import { v4 as uuidv4 } from 'uuid';

// NPC Spawner
// Ensures a minimum number of NPC ships are alive.

const MAX_NPCS = 10;
const SPAWN_INTERVAL = 2000; // Check every 2s
let timeSinceLastSpawn = 0;

export const npcSpawnerSystem = (scene: Phaser.Scene, delta: number) => {
  timeSinceLastSpawn += delta;
  if (timeSinceLastSpawn < SPAWN_INTERVAL) return;
  timeSinceLastSpawn = 0;

  // Count current Traders (approximate by checking for aiState without 'station')
  // A better way would be a 'type' component, but checks 'aiState' is enough for now.
  let npcCount = 0;
  for (const _entity of world.with('aiState')) {
    npcCount++;
  }

  if (npcCount < MAX_NPCS) {
    spawnNpc(scene);
  }
};

const spawnNpc = (scene: Phaser.Scene) => {
  // Spawn at random location
  const x = (Math.random() - 0.5) * 3000;
  const y = (Math.random() - 0.5) * 3000;

  const sprite = scene.add.sprite(x, y, 'npc_trader');
  sprite.setScale(0.12); // 80% of previous 0.15
  sprite.setDepth(9); // Below player (10), above trail (5)

  world.add({
    id: uuidv4(),
    transform: { x, y, rotation: 0 },
    velocity: { vx: 0, vy: 0 },
    sprite: sprite,
    aiState: 'IDLE',
    speedStats: { maxSpeed: 150, acceleration: 200 }, // Slower than player
  });
};
