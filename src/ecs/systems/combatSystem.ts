import { world, type Entity } from '../world';
import Phaser from 'phaser';
import { v4 as uuidv4 } from 'uuid';
import { entityCooldowns } from '../cooldowns';
import { recordKill } from './analyticsSystem';

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

    // Pre-calculate attackers on target (for distribution)
    const attackersOnTarget = new Map<string, number>();
    for (const attacker of pirates) {
      if (attacker.combatTarget) {
        attackersOnTarget.set(
          attacker.combatTarget,
          (attackersOnTarget.get(attacker.combatTarget) || 0) + 1
        );
      }
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

          // Faction Check & Validity
          let isValidTarget = false;

          if (attacker.faction === 'PIRATE') {
            // Pirates attack Traders (Loot) and Bounty Hunters (Threat)
            // Rule: Pirates generally don't interrupt existing fights to avoid KS/Conflict unless desperate?
            // For now, Pirates stick to 1v1 or open targets.
            if (target.combatEncounter) continue;

            if (target.faction === 'TRADER' || target.faction === 'BOUNTY_HUNTER')
              isValidTarget = true;
          } else if (attacker.faction === 'BOUNTY_HUNTER') {
            // Bounty Hunters attack Pirates
            if (target.faction === 'PIRATE') isValidTarget = true;

            // ALLOW BH to join existing battles! (No combatEncounter check here)
          }

          if (!isValidTarget) continue;

          const dist = Phaser.Math.Distance.Between(
            attacker.transform.x,
            attacker.transform.y,
            target.transform.x,
            target.transform.y
          );

          // Scoring
          let score = 0;
          if (attacker.faction === 'PIRATE') {
            const profitScore = Math.max(0, target.totalProfit || 0) + 100;
            score = profitScore / (dist + 100);
          } else {
            // Bounty Hunter AI:
            // 1. Proximity (Base)
            score = 10000 / (dist + 10);

            // 2. Priority: Active Threat (Target is fighting someone)
            if (target.combatEncounter) {
              score += 5000;

              // If Target is attacking a TRADER? We need to know who they are fighting.
              // We can check the encounter participants. Not easy directly from here without lookup.
              // But we know 'target.combatTarget' is their victim? Not necessarily, could be attacker.
              // Let's assume ANY combat is worth stopping.
            }

            // 3. Distribution: Avoid Swarming (Diminishing returns)
            // If 5 hunters are already on this pirate, go elsewhere.
            const currentAttackers = attackersOnTarget.get(target.id) || 0;
            score -= currentAttackers * 2000; // Penalty per existing attacker
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
        (target.combatEncounter && attacker.faction !== 'BOUNTY_HUNTER') // Allow BH to engage busy targets
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

        // Only create zone if target is free (avoids visual clutter of multiple zones on one guy)
        // OR create it anyway? Let's create it for now to track "My Fight".
        // Actually, if we want to share the zone, we probably need lookup.
        // Simplest: Create a new zone for THIS pair.

        // Create Zone Entity
        world.add({
          id: encounterId,
          transform: { x: centerX, y: centerY, rotation: 0 },
          sectorId: attacker.sectorId,
          encounterZone: {
            radius: 200,
            center: { x: centerX, y: centerY },
            participants: [attacker.id, target.id],
          },
        });

        // Critical: Set AI State to COMBAT
        attacker.aiState = 'COMBAT';

        // Only lock target if they aren't already fighting
        if (!target.combatEncounter) {
          target.aiState = 'COMBAT';
          target.combatEncounter = { encounterId: encounterId, role: 'DEFENDER' };
        }

        attacker.combatEncounter = { encounterId: encounterId, role: 'ATTACKER' };
      }
    }

    // --- ENCOUNTER UPDATE (FIGHT) ---
    if (attacker.combatEncounter && attacker.combatTarget) {
      const target = entityMap.get(attacker.combatTarget);

      // Check validity
      // Check validity (Asymmetric)
      const isValidEncounter =
        target &&
        // Case A: Mutual Lock (1v1)
        ((target.combatEncounter &&
          target.combatEncounter.encounterId === attacker.combatEncounter.encounterId) ||
          // Case B: I am a Joiner (Target is fighting someone else, but still valid for me)
          (target.combatEncounter && attacker.faction === 'BOUNTY_HUNTER'));

      if (isValidEncounter) {
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
              // Record Kill for Sector Danger Map
              // Only count "hostile" kills or all? User asked for "number of sinkings" -> All seems fair.
              // Assuming sectorId is accessible
              if (target.sectorId) {
                recordKill(target.sectorId);
              }

              // Drop Loot
              if (target.cargo && target.transform) {
                /* loot money */
              }
              // LOOTING (Only Pirates loot money)
              if (attacker.faction === 'PIRATE') {
                const loot = Math.max(0, target.totalProfit || 0);
                if (!attacker.piracy) attacker.piracy = { revenue: 0 };
                attacker.piracy.revenue += loot;
                console.log(
                  `[Combat] Pirate ${attacker.id} looted ${loot} from ${target.faction} !`
                );
              } else {
                console.log(`[Combat] ${attacker.faction} destroyed ${target.faction} !`);
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

              // --- VICTIM RELEASE LOGIC (Fix for "Frozen Combatant" Bug) ---
              // If the dying entity (target) was attacking someone else, release that victim.
              // AND destroy the zone associated with that "other" encounter.
              if (target.combatTarget) {
                const victim = entityMap.get(target.combatTarget);

                // If the target had a DIFFERENT encounter ID where they were the attacker (likely), destroy it.
                // Note: target.combatEncounter might be:
                // 1. Same as attacker's (if 1v1) - Already cleaned up by main logic.
                // 2. Different (if target was Attacker of Victim, and 'attacker' is Hunter/3rd party) - NEED TO CLEAN.

                if (target.combatEncounter && target.combatEncounter.encounterId !== encounterId) {
                  const danglingEncounterId = target.combatEncounter.encounterId;
                  const danglingZone = entityMap.get(danglingEncounterId);
                  if (danglingZone) {
                    if (danglingZone.textOverlay) danglingZone.textOverlay.destroy();
                    world.remove(danglingZone);
                    console.log(
                      `[Combat] Cleaned up dangling encounter zone ${danglingEncounterId} `
                    );
                  }
                }

                // Check if victim exists and is seemingly locked by US (the dying entity)
                if (victim && victim.combatEncounter) {
                  // Force release victim
                  victim.combatEncounter = undefined;
                  victim.combatTarget = undefined;
                  victim.aiState = 'PLANNING';
                  entityCooldowns.delete(victim.id);
                  console.log(`[Combat] Released victim ${victim.id} from combat lock.`);
                }
              }
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
