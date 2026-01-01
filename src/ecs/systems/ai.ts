import { world } from '../world';

// Simple AI System
// 1. If IDLE, pick a random target (Station or Random Point).
// 2. If MOVING, steer towards target.
// 3. If close to target, stop and switch to IDLE (or DOCKING).

const ARRIVAL_RADIUS = 50;

export const aiSystem = (_delta: number) => {
  // Entities with AI components
  const entities = world.with('transform', 'velocity', 'aiState', 'speedStats');
  const stations = world.with('station', 'transform');

  for (const entity of entities) {
    // 1. Decision Making (IDLE -> MOVING)
    if (entity.aiState === 'IDLE') {
      // 50% chance to go to a station, 50% to a random point
      if (stations.size > 0 && Math.random() > 0.5) {
        // Pick random station
        const stationsArray = Array.from(stations);
        const targetStation = stationsArray[Math.floor(Math.random() * stationsArray.length)];
        entity.target = { x: targetStation.transform.x, y: targetStation.transform.y };
      } else {
        // Pick random point in valid range (approx -2000 to 2000 for now)
        entity.target = {
          x: (Math.random() - 0.5) * 4000,
          y: (Math.random() - 0.5) * 4000,
        };
      }
      entity.aiState = 'MOVING';
    }

    // 2. Movement Logic (MOVING)
    if (entity.aiState === 'MOVING' && entity.target) {
      const dx = entity.target.x - entity.transform.x;
      const dy = entity.target.y - entity.transform.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < ARRIVAL_RADIUS) {
        // Arrived
        entity.velocity.vx = 0;
        entity.velocity.vy = 0;
        entity.aiState = 'IDLE'; // Wait here, then pick new target next frame (or add a timer later)
      } else {
        // Steer
        const angle = Math.atan2(dy, dx);
        entity.transform.rotation = angle; // Face target (Assuming Right-facing sprite)

        // Accelerate
        const speed = entity.speedStats.maxSpeed; // Simple constant speed for now
        entity.velocity.vx = Math.cos(angle) * speed;
        entity.velocity.vy = Math.sin(angle) * speed;
      }
    }
  }
};
