import { world } from '../world';
import { v4 as uuidv4 } from 'uuid';

const SPAWN_INTERVAL = 10000; // 10 seconds
let lastSpawnTime = 0;

export const npcSpawnerSystem = (scene: Phaser.Scene, _delta: number) => {
  const existingNpcs = world.with('aiState');
  const maxNpcs = 25;

  if (existingNpcs.size < maxNpcs) {
    const now = scene.time.now;
    if (now - lastSpawnTime > SPAWN_INTERVAL) {
      lastSpawnTime = now;

      // Maintain 5 traders
      // Random edge spawn
      const angle = Math.random() * Math.PI * 2;
      const radius = 2000;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      const sprite = scene.add.sprite(x, y, 'npc_trader');
      sprite.setScale(0.12);
      sprite.setDepth(2);

      world.add({
        id: uuidv4(),
        transform: { x, y, rotation: angle },
        velocity: { vx: 0, vy: 0 },
        sprite: sprite,
        // AI Components
        aiState: 'PLANNING',
        speedStats: { maxSpeed: 100, acceleration: 100 },
        // Economy
        cargo: {},
        wallet: 1000,
        totalProfit: 0,
        target: undefined,
        sectorId: 'sector-a', // Spawn in Sector A
      });
      console.log(`[NPC Spawner] Spawned new NPC. Total: ${existingNpcs.size + 1}`);
    }
  }
};
