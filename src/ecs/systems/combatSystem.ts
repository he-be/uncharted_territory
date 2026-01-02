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

    // Potential targets: All ships with combat capability or loot
    const potentialTargets: Entity[] = [];
    for (const e of world.with('combatStats', 'transform', 'sectorId', 'faction')) {
      potentialTargets.push(e);
    }

    // Iterate all "Aggressors" (Pirates and Bounty Hunters)
    for (const attacker of pirates) {
      if (attacker.faction === 'TRADER') continue; // Traders are passive

      // if ALREADY in an encounter, skip targeting
      if (attacker.combatEncounter) continue;

      const currentTarget = attacker.combatTarget ? entityMap.get(attacker.combatTarget) : null;

      if (!currentTarget || !currentTarget.combatStats || currentTarget.combatStats.hp <= 0) {
        // Find new target
        let bestTarget: Entity | null = null;
        let bestScore = -1;

        for (const target of potentialTargets) {
          if (target.id === attacker.id) continue;
          if (target.sectorId !== attacker.sectorId) continue;
          if (!target.transform) continue;
          if (target.combatEncounter) continue; // Don't interrupt

          // Faction Check
          let isValidTarget = false;
          if (attacker.faction === 'PIRATE') {
            // Pirates attack Traders (Loot) and Bounty Hunters (Threat)
            if (target.faction === 'TRADER' || target.faction === 'BOUNTY_HUNTER')
              isValidTarget = true;
          } else if (attacker.faction === 'BOUNTY_HUNTER') {
            // Bounty Hunters attack Pirates
            if (target.faction === 'PIRATE') isValidTarget = true;
          }

          if (!isValidTarget) continue;

          const dist = Phaser.Math.Distance.Between(
            attacker.transform.x,
            attacker.transform.y,
            target.transform.x,
            target.transform.y
          );

          // Scoring
          // Pirates love money, but also close targets
          // BH just want to kill pirates
          let score = 0;
          if (attacker.faction === 'PIRATE') {
            const profitScore = Math.max(0, target.totalProfit || 0) + 100;
            score = profitScore / (dist + 100);
          } else {
            // Bounty Hunter: Proximity is king
            score = 10000 / (dist + 10);
          }

          if (score > bestScore) {
            bestScore = score;
            bestTarget = target;
          }
        }

        if (bestTarget) {
          attacker.combatTarget = bestTarget.id;
        }
      }
    }
  }

  // 3. Combat Movement and Resolution
  for (const attacker of pirates) {
    if (attacker.faction === 'TRADER') continue; // Skip Traders

    // --- ENCOUNTER START / CHASE ---
    if (!attacker.combatEncounter && attacker.combatTarget) {
      const target = entityMap.get(attacker.combatTarget);

      if (
        !target ||
        !target.transform ||
        target.sectorId !== attacker.sectorId ||
        target.combatEncounter
      ) {
        // Target invalid or taken
        attacker.combatTarget = undefined;
        continue;
      }

      const dist = Phaser.Math.Distance.Between(
        attacker.transform.x,
        attacker.transform.y,
        target.transform.x,
        target.transform.y
      );

      if (dist > COMBAT_RANGE) {
        // Chase
        const angle = Math.atan2(
          target.transform.y - attacker.transform.y,
          target.transform.x - attacker.transform.x
        );
        const speed = attacker.speedStats?.maxSpeed || 150;

        if (attacker.velocity) {
          attacker.velocity.vx = Math.cos(angle) * speed;
          attacker.velocity.vy = Math.sin(angle) * speed;
          attacker.transform.rotation = angle;
        }
      } else {
        // ENTER COMBAT ENCOUNTER (LOCK)
        if (attacker.velocity) {
          attacker.velocity.vx = 0;
          attacker.velocity.vy = 0;
        }
        if (target.velocity) {
          target.velocity.vx = 0;
          target.velocity.vy = 0;
        }

        const encounterId = uuidv4();
        const centerX = (attacker.transform.x + target.transform.x) / 2;
        const centerY = (attacker.transform.y + target.transform.y) / 2;

        // Create Zone Entity
        world.add({
          id: encounterId,
          transform: { x: centerX, y: centerY, rotation: 0 },
          sectorId: attacker.sectorId,
          encounterZone: {
            radius: 200,
            center: { x: centerX, y: centerY }, // Stored for convenience, strictly redundant with transform
            participants: [attacker.id, target.id],
          },
        });

        // Critical: Set AI State to COMBAT to stop aiSystem from moving them
        attacker.aiState = 'COMBAT';
        if (target.aiState) target.aiState = 'COMBAT';

        attacker.combatEncounter = { encounterId: encounterId, role: 'ATTACKER' };
        target.combatEncounter = { encounterId: encounterId, role: 'DEFENDER' };
      }
    }

    // --- ENCOUNTER UPDATE (FIGHT) ---
    if (attacker.combatEncounter && attacker.combatTarget) {
      const target = entityMap.get(attacker.combatTarget);

      // Check validity
      if (
        target &&
        target.combatEncounter &&
        target.combatEncounter.encounterId === attacker.combatEncounter.encounterId
      ) {
        // RE-ENFORCE LOCK EVERY FRAME (In case physics/other systems nudged them)
        if (attacker.velocity) {
          attacker.velocity.vx = 0;
          attacker.velocity.vy = 0;
        }
        if (target.velocity) {
          target.velocity.vx = 0;
          target.velocity.vy = 0;
        }

        const lastFire = entityCooldowns.get(attacker.id) || 0;
        if (now - lastFire > FIRE_COOLDOWN) {
          entityCooldowns.set(attacker.id, now);

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
              // LOOTING (Only Pirates loot money)
              if (attacker.faction === 'PIRATE') {
                const loot = Math.max(0, target.totalProfit || 0);
                if (!attacker.piracy) attacker.piracy = { revenue: 0 };
                attacker.piracy.revenue += loot;
                console.log(
                  `[Combat] Pirate ${attacker.id} looted ${loot} from ${target.faction}!`
                );
              } else {
                console.log(`[Combat] ${attacker.faction} destroyed ${target.faction}!`);
              }

              // Cleanup Encounter Zone
              const encounterId = attacker.combatEncounter.encounterId;
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

              // Reset Attacker
              attacker.combatTarget = undefined;
              attacker.combatEncounter = undefined;
              attacker.aiState = 'PLANNING'; // Resume hunting
            }
          }
        }
      } else {
        // Encounter Broken (Target Lost/Fled/Bug)
        // Clean up zone
        if (attacker.combatEncounter) {
          const encounterId = attacker.combatEncounter.encounterId;
          const zone = entityMap.get(encounterId);
          if (zone) {
            if (zone.textOverlay) zone.textOverlay.destroy();
            world.remove(zone);
          }
        }

        attacker.combatEncounter = undefined;
        attacker.combatTarget = undefined;
        attacker.aiState = 'PLANNING';
      }
    }
  }
};
