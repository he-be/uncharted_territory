import { world, type Entity } from '../world';
import { world as universeWorld } from '../world'; // Query gate entities
import { findPath } from '../../utils/pathfinding';

const ROTATION_SPEED = 3; // Rad per sec
const THRUST_FORCE = 8;
const MAX_SPEED = 500;
const ARRIVAL_TOLERANCE = 100; // Units
const ALIGN_TOLERANCE = 0.1; // Radians

export const autoPilotSystem = (player: Entity, delta: number) => {
  if (!player.autoPilot || !player.transform || !player.velocity) return;

  const ap = player.autoPilot;
  const dt = delta / 1000;

  // 1. Path Queue Management (Cross-Sector)
  if (ap.pathQueue && ap.pathQueue.length > 0) {
    // We have a route. Check if we are in the next target sector?
    const nextSector = ap.pathQueue[0];

    if (player.sectorId === nextSector) {
      // Arrived at next sector node!
      console.log(`[AutoPilot] Arrived at sector ${nextSector}`);
      ap.pathQueue.shift(); // Remove it

      // If we have more to go, find next gate
      if (ap.pathQueue.length > 0) {
        const followingSector = ap.pathQueue[0];
        const gate = findGateTo(player.sectorId, followingSector);
        if (gate && gate.transform) {
          ap.targetX = gate.transform.x;
          ap.targetY = gate.transform.y;

          // Check if this is the gate we just exited (re-entry protection)
          if (player.lastGateId === gate.id) {
            const dist = Phaser.Math.Distance.Between(
              player.transform.x,
              player.transform.y,
              gate.transform.x,
              gate.transform.y
            );
            if (dist < 350) {
              console.log('[AutoPilot] Clearing Gate before re-entry...');
              ap.state = 'CLEARING_GATE';
              // Pick a random direction or forward direction to clear
              // Simple: fly 400 units in current facing direction
              ap.targetX = player.transform.x + Math.cos(player.transform.rotation) * 400;
              ap.targetY = player.transform.y + Math.sin(player.transform.rotation) * 400;
            } else {
              ap.state = 'ALIGNING';
            }
          } else {
            ap.state = 'ALIGNING';
          }
        } else {
          console.warn(`[AutoPilot] No gate found to ${followingSector}`);
          ap.pathQueue = []; // Abort
          ap.state = 'IDLE';
        }
      } else {
        // Done with route!
        ap.state = 'BRAKING'; // Or IDLE if we just want to drift
      }
    } else {
      // We are NOT in the target sector yet.
      // Do we have a local target?
      if (ap.targetX === undefined || ap.targetY === undefined) {
        // Find gate to nextSector
        const gate = findGateTo(player.sectorId || '', nextSector);
        if (gate && gate.transform) {
          ap.targetX = gate.transform.x;
          ap.targetY = gate.transform.y;

          // Check re-entry
          if (player.lastGateId === gate.id) {
            const dist = Phaser.Math.Distance.Between(
              player.transform.x,
              player.transform.y,
              gate.transform.x,
              gate.transform.y
            );
            if (dist < 350) {
              console.log('[AutoPilot] Clearing Gate before re-entry...');
              ap.state = 'CLEARING_GATE';
              ap.targetX = player.transform.x + Math.cos(player.transform.rotation) * 400;
              ap.targetY = player.transform.y + Math.sin(player.transform.rotation) * 400;
            } else {
              ap.state = 'ALIGNING';
            }
          } else {
            ap.state = 'ALIGNING';
          }
        }
      }
    }
  }

  // 2. Logic Handler
  if (ap.state === 'CLEARING_GATE') {
    // Just fly to the temporary target
    if (ap.targetX !== undefined && ap.targetY !== undefined) {
      const dx = ap.targetX - player.transform.x;
      const dy = ap.targetY - player.transform.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Check if we are physically far enough from the LAST gate?
      // Or just trust the temp target is far enough.
      // Let's trust the temp target arrival.
      if (dist < ARRIVAL_TOLERANCE) {
        // We have cleared it. Now re-evaluate route (ALIGINING)
        // We need to re-find the actual gate target.
        // Force re-evaluation next frame by clearing target
        ap.targetX = undefined;
        ap.targetY = undefined;
        ap.state = 'IDLE'; // Next frame will pick up pathQueue again
      } else {
        // Standard Fly behavior
        // ... duplicate steering logic or refactor?
        // Let's refactor steering into helper or just copy for safety now.
        const targetAngle = Math.atan2(dy, dx);
        let diff = targetAngle - player.transform.rotation;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        if (Math.abs(diff) > ALIGN_TOLERANCE) {
          const rotdir = diff > 0 ? 1 : -1;
          player.transform.rotation += rotdir * ROTATION_SPEED * dt;
        }
        player.velocity.vx += Math.cos(player.transform.rotation) * THRUST_FORCE;
        player.velocity.vy += Math.sin(player.transform.rotation) * THRUST_FORCE;
      }
    }
    return; // Skip standard logic
  }

  // 3. Local Navigation (Physics)
  if (
    (ap.state === 'ALIGNING' || ap.state === 'THRUSTING') &&
    ap.targetX !== undefined &&
    ap.targetY !== undefined
  ) {
    const dx = ap.targetX - player.transform.x;
    const dy = ap.targetY - player.transform.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < ARRIVAL_TOLERANCE) {
      // Arrived
      ap.targetX = undefined;
      ap.targetY = undefined;
      ap.state = 'BRAKING'; // Stop upon arrival
    } else {
      // Steering
      const targetAngle = Math.atan2(dy, dx);
      const angleData = Phaser.Math.Angle.ShortestBetween(
        Phaser.Math.RadToDeg(player.transform.rotation),
        Phaser.Math.RadToDeg(targetAngle)
      );

      // Normalize current rotation to 0-360 or PI?
      // Phaser Rotation is radians.
      // ShortestBetween takes Degrees.
      // Let's stick to Radians manually to avoid dependency mess if we can.

      let diff = targetAngle - player.transform.rotation;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      if (Math.abs(diff) > ALIGN_TOLERANCE) {
        ap.state = 'ALIGNING';
        // Rotate towards
        const rotdir = diff > 0 ? 1 : -1;
        player.transform.rotation += rotdir * ROTATION_SPEED * dt;
      } else {
        // Aligned!
        // Should we thrust?
        // Simple cruise control: if speed < max, thrust
        ap.state = 'THRUSTING';
        const speed = Math.sqrt(player.velocity.vx ** 2 + player.velocity.vy ** 2);

        // Breaking distance check? (v^2 / 2a)
        // If we are getting close, maybe coast?
        // For now, simple approach.
        if (speed < MAX_SPEED) {
          player.velocity.vx += Math.cos(player.transform.rotation) * THRUST_FORCE;
          player.velocity.vy += Math.sin(player.transform.rotation) * THRUST_FORCE;
        }
      }
    }
  } else if (ap.state === 'BRAKING') {
    // Apply drag until stop
    player.velocity.vx *= 0.95;
    player.velocity.vy *= 0.95;
    if (Math.abs(player.velocity.vx) < 1 && Math.abs(player.velocity.vy) < 1) {
      ap.state = 'IDLE';
      player.velocity.vx = 0;
      player.velocity.vy = 0;
    }
  }
};

// Helper
const findGateTo = (currentSector: string, targetSector: string): Entity | undefined => {
  // We need to query gates. Since we are in an ECS, we can query world.
  // Ideally this query is cached.
  const gates = universeWorld.with('gate', 'transform', 'sectorId');
  for (const g of gates) {
    if (g.sectorId === currentSector && g.gate?.destinationSectorId === targetSector) {
      return g;
    }
  }
  return undefined;
};
