import { world } from '../world';
import { v4 as uuidv4 } from 'uuid';
import { SECTORS, getSectorWorldPosition } from '../../data/universe';

const SPAWN_INTERVAL = 1000; // 10 seconds
let lastSpawnTime = 0;

export const npcSpawnerSystem = (scene: Phaser.Scene, _delta: number) => {
  const existingNpcs = world.with('aiState');
  const maxNpcs = 250;

  if (existingNpcs.size < maxNpcs) {
    const now = scene.time.now;
    if (now - lastSpawnTime > SPAWN_INTERVAL) {
      lastSpawnTime = now;

      // Random Sector
      const startSector = SECTORS[Math.floor(Math.random() * SECTORS.length)];
      const sectorPos = getSectorWorldPosition(startSector); // {x, y} scaled

      // Random Position within Sector (Radius 5000)
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 5000;
      const x = sectorPos.x + Math.cos(angle) * radius;
      const y = sectorPos.y + Math.sin(angle) * radius;

      const isPirate = startSector.type === 'pirate';

      const spriteKey = isPirate ? 'npc_pirate' : 'npc_trader';
      const sprite = scene.add.sprite(x, y, spriteKey);
      sprite.setScale(0.12);
      sprite.setDepth(2);

      world.add({
        id: uuidv4(),
        transform: { x, y, rotation: angle },
        velocity: { vx: 0, vy: 0 },
        sprite: sprite,
        // AI Components
        aiState: 'PLANNING',
        speedStats: { maxSpeed: isPirate ? 120 : 100, acceleration: 100 },
        // Economy
        cargo: {},
        wallet: 1000,
        totalProfit: 0,
        target: undefined,
        sectorId: startSector.id,
        // Combat
        faction: isPirate ? 'PIRATE' : 'TRADER',
        combatStats: {
          hp: 100,
          maxHp: 100,
          shields: 50,
          maxShields: 50,
          shieldRechargeRate: 5,
        },
        piracy: isPirate ? { revenue: 0 } : undefined,
      });
      console.log(
        `[NPC Spawner] Spawned new NPC in ${startSector.name}. Total: ${existingNpcs.size + 1}`
      );
    }
  }
};
