import { world } from '../world';
import type { Entity } from '../world';

export const gateSystem = (player: Entity) => {
  // Only check player for now? Or AI too?
  // AI has its own FSM state for jumping. This generic system could handle "Physics" collision with gates.
  // For now, let's just handle Player interaction or purely physical proximity if we want auto-jump.
  // Requirement US-3: "Utilize Jump Gates". Assumes interaction or touch.
  // Let's implement simple "Touch to Jump" for player first.

  // AI will handle its own "Jump" logic in AI System to allow for state transitions (MOVING -> JUMPING -> MOVING),
  // avoiding instant teleportation frame 1.

  if (!player.sectorId || !player.transform) return;

  // Find gates in current sector
  const currentSector = player.sectorId;
  const gates = world.with('gate', 'transform', 'sectorId');

  for (const gateEntity of gates) {
    if (gateEntity.sectorId !== currentSector) continue;

    const dist = Phaser.Math.Distance.Between(
      player.transform.x,
      player.transform.y,
      gateEntity.transform.x,
      gateEntity.transform.y
    );

    // Re-entry Protection logic
    if (player.lastGateId === gateEntity.id) {
      // If we are still close to the last used gate, ignore it.
      if (dist < 300) {
        continue;
      } else {
        // We have moved far enough away, clear the flag
        player.lastGateId = undefined;
      }
    }

    if (dist < 50) {
      // Close enough to jump
      const destSector = gateEntity.gate.destinationSectorId;
      const destGateId = gateEntity.gate.destinationGateId;

      // Find Destination Gate Entity
      const allGates = world.with('gate', 'transform', 'id');
      let targetGate: Entity | undefined;

      for (const g of allGates) {
        if (g.id === destGateId) {
          targetGate = g;
          break;
        }
      }

      if (targetGate && targetGate.transform) {
        console.log(`[Gate] Jumping to ${destSector} via ${destGateId}`);
        player.sectorId = destSector;

        // Set Last Gate ID to the DESTINATION gate (so we don't immediately jump back)
        player.lastGateId = targetGate.id;

        // Warp to Target Gate + Offset (to avoid infinite loop)
        player.transform.x = targetGate.transform.x;
        player.transform.y = targetGate.transform.y;

        // Stop movement
        if (player.velocity) {
          player.velocity.vx = 0;
          player.velocity.vy = 0;
        }
      } else {
        console.warn(`[Gate] Target gate ${destGateId} not found!`);
      }
    }
  }
};
