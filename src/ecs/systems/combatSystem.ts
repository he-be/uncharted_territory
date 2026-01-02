import { world, type Entity } from '../world';
import Phaser from 'phaser';
import { v4 as uuidv4 } from 'uuid';

const COMBAT_RANGE = 150;
const WEAPON_DAMAGE = 10; // Doubled from 5
const SHIELD_REGEN_DELAY = 3000; // 3 seconds delay before regen starts
const FIRE_COOLDOWN = 1000; // ms
const TARGET_SEARCH_INTERVAL = 3000; // ms

// Simple state tracking for cooldowns
const entityCooldowns = new Map<string, number>();
let lastTargetSearch = 0;

// Entity Cache to avoid O(N) lookups every frame
const entityMap = new Map<string, Entity>();

export const combatSystem = (scene: Phaser.Scene, delta: number) => {
  // 0. Update Entity Cache every frame to ensure freshness
  entityMap.clear();
  for (const e of world.entities) {
    entityMap.set(e.id, e);
  }

  const dt = delta / 1000; // seconds
  const now = scene.time.now;

  const combatants = world.with('combatStats', 'transform', 'sectorId');
  const pirates = world.with('faction', 'combatStats', 'transform', 'sectorId');

  // 1. Shield Recharge (All ships)
  for (const entity of combatants) {
    if (entity.combatStats) {
      // Check time since last damage
      const lastDamage = entity.combatStats.lastDamageTime || 0;

      if (now - lastDamage > SHIELD_REGEN_DELAY) {
        if (entity.combatStats.shields < entity.combatStats.maxShields) {
          entity.combatStats.shields += entity.combatStats.shieldRechargeRate * dt;
          if (entity.combatStats.shields > entity.combatStats.maxShields) {
            entity.combatStats.shields = entity.combatStats.maxShields;
          }
        }
      }
    }
  }

  // 2. Targeting Logic (Throttled)
  if (now - lastTargetSearch > TARGET_SEARCH_INTERVAL) {
    lastTargetSearch = now;

    // Potential targets: Non-Pirate ships with cargo/money
    const potentialTargets: Entity[] = [];
    for (const e of world.with('combatStats', 'totalProfit', 'transform', 'sectorId')) {
      if (e.faction !== 'PIRATE') {
        potentialTargets.push(e);
      }
    }

    for (const pirate of pirates) {
      if (pirate.faction !== 'PIRATE') continue; // Failsafe

      // if ALREADY in an encounter, skip targeting
      if (pirate.combatEncounter) continue;

      const currentTarget = pirate.combatTarget ? entityMap.get(pirate.combatTarget) : null;

      if (!currentTarget || !currentTarget.combatStats || currentTarget.combatStats.hp <= 0) {
        // Find new target
        let bestTarget: Entity | null = null;
        let bestScore = -1;

        for (const target of potentialTargets) {
          if (target.sectorId !== pirate.sectorId) continue;
          if (!target.transform) continue;
          // Don't target ships already in an encounter
          if (target.combatEncounter) continue;

          const dist = Phaser.Math.Distance.Between(
            pirate.transform.x,
            pirate.transform.y,
            target.transform.x,
            target.transform.y
          );

          const profitScore = Math.max(0, target.totalProfit || 0) + 100;
          const score = profitScore / (dist + 100);

          if (score > bestScore) {
            bestScore = score;
            bestTarget = target;
          }
        }

        if (bestTarget) {
          pirate.combatTarget = bestTarget.id;
        }
      }
    }
  }

  // 3. Combat Movement and Resolution
  for (const pirate of pirates) {
    if (pirate.faction !== 'PIRATE') continue;

    // --- ENCOUNTER START / CHASE ---
    if (!pirate.combatEncounter && pirate.combatTarget) {
      const target = entityMap.get(pirate.combatTarget);

      if (
        !target ||
        !target.transform ||
        target.sectorId !== pirate.sectorId ||
        target.combatEncounter
      ) {
        // Target invalid or taken
        pirate.combatTarget = undefined;
        continue;
      }

      const dist = Phaser.Math.Distance.Between(
        pirate.transform.x,
        pirate.transform.y,
        target.transform.x,
        target.transform.y
      );

      if (dist > COMBAT_RANGE) {
        // Chase
        const angle = Math.atan2(
          target.transform.y - pirate.transform.y,
          target.transform.x - pirate.transform.x
        );
        const speed = pirate.speedStats?.maxSpeed || 150;

        if (pirate.velocity) {
          pirate.velocity.vx = Math.cos(angle) * speed;
          pirate.velocity.vy = Math.sin(angle) * speed;
          pirate.transform.rotation = angle;
        }
      } else {
        // ENTER COMBAT ENCOUNTER (LOCK)
        if (pirate.velocity) {
          pirate.velocity.vx = 0;
          pirate.velocity.vy = 0;
        }
        if (target.velocity) {
          target.velocity.vx = 0;
          target.velocity.vy = 0;
        }

        const encounterId = uuidv4();
        const centerX = (pirate.transform.x + target.transform.x) / 2;
        const centerY = (pirate.transform.y + target.transform.y) / 2;

        // Create Zone Entity
        world.add({
          id: encounterId,
          transform: { x: centerX, y: centerY, rotation: 0 },
          sectorId: pirate.sectorId,
          encounterZone: {
            radius: 200,
            center: { x: centerX, y: centerY }, // Stored for convenience, strictly redundant with transform
            participants: [pirate.id, target.id],
          },
        });

        // Critical: Set AI State to COMBAT to stop aiSystem from moving them
        pirate.aiState = 'COMBAT';
        if (target.aiState) target.aiState = 'COMBAT';

        pirate.combatEncounter = { encounterId: encounterId, role: 'ATTACKER' };
        target.combatEncounter = { encounterId: encounterId, role: 'DEFENDER' };
      }
    }

    // --- ENCOUNTER UPDATE (FIGHT) ---
    if (pirate.combatEncounter && pirate.combatTarget) {
      const target = entityMap.get(pirate.combatTarget);

      // Check validity
      if (
        target &&
        target.combatEncounter &&
        target.combatEncounter.encounterId === pirate.combatEncounter.encounterId
      ) {
        // RE-ENFORCE LOCK EVERY FRAME (In case physics/other systems nudged them)
        if (pirate.velocity) {
          pirate.velocity.vx = 0;
          pirate.velocity.vy = 0;
        }
        if (target.velocity) {
          target.velocity.vx = 0;
          target.velocity.vy = 0;
        }

        const lastFire = entityCooldowns.get(pirate.id) || 0;
        if (now - lastFire > FIRE_COOLDOWN) {
          entityCooldowns.set(pirate.id, now);

          // Deal Damage
          if (target.combatStats) {
            // Update Last Damage Time
            target.combatStats.lastDamageTime = now;

            if (target.combatStats.shields > 0) {
              target.combatStats.shields -= WEAPON_DAMAGE;
              if (target.combatStats.shields < 0) {
                target.combatStats.shields = 0;
              }
            } else {
              // Hull Damage
              target.combatStats.hp -= WEAPON_DAMAGE;
            }

            // Check Death
            if (target.combatStats.hp <= 0) {
              // LOOTING
              const loot = Math.max(0, target.totalProfit || 0);
              if (!pirate.piracy) pirate.piracy = { revenue: 0 };
              pirate.piracy.revenue += loot;

              console.log(
                `[Combat] ${pirate.id} destroyed ${target.id} and looted ${loot} credits!`
              );

              // Cleanup Encounter Zone
              const encounterId = pirate.combatEncounter.encounterId;
              const zone = entityMap.get(encounterId);
              if (zone) {
                if (zone.textOverlay) zone.textOverlay.destroy();
                world.remove(zone);
              }

              // Destroy Target
              if (target.sprite && 'destroy' in target.sprite) {
                (target.sprite as Phaser.GameObjects.GameObject).destroy();
              }
              if (target.textOverlay) {
                target.textOverlay.destroy();
              }
              world.remove(target);
              entityCooldowns.delete(target.id);

              // Reset Pirate
              pirate.combatTarget = undefined;
              pirate.combatEncounter = undefined;
              pirate.aiState = 'PLANNING'; // Resume hunting
            }
          }
        }
      } else {
        // Encounter Broken (Target Lost/Fled/Bug)
        // Clean up zone
        if (pirate.combatEncounter) {
          const encounterId = pirate.combatEncounter.encounterId;
          const zone = entityMap.get(encounterId);
          if (zone) {
            if (zone.textOverlay) zone.textOverlay.destroy();
            world.remove(zone);
          }
        }

        pirate.combatEncounter = undefined;
        pirate.combatTarget = undefined;
        pirate.aiState = 'PLANNING';
      }
    }
  }
};
