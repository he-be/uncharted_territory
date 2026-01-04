import Phaser from 'phaser';

export class CombatAI {
  private scene: Phaser.Scene;
  private lastAiUpdate = 0;

  // Dependencies
  private lasers: Phaser.Physics.Arcade.Group;

  constructor(scene: Phaser.Scene, lasers: Phaser.Physics.Arcade.Group) {
    this.scene = scene;
    this.lasers = lasers;
  }

  update(
    time: number,
    friendlies: Phaser.Physics.Arcade.Group,
    enemies: Phaser.Physics.Arcade.Group,
    player: Phaser.GameObjects.GameObject
  ) {
    if (time > this.lastAiUpdate + 100) {
      this.updateGroupAI(friendlies, enemies.getChildren(), time);

      const allEnemies: Phaser.GameObjects.GameObject[] = [
        player,
        ...friendlies.getChildren(),
      ].filter((e) => e.active);

      this.updateGroupAI(enemies, allEnemies, time);

      this.lastAiUpdate = time;
    }
  }

  private updateGroupAI(
    group: Phaser.Physics.Arcade.Group,
    validTargets: Phaser.GameObjects.GameObject[],
    time: number
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    group.getChildren().forEach((entity: any) => {
      if (!entity.active) return;

      const isMother = entity.getData('type') === 'mother';

      // 1. Acquire Target
      let target = entity.getData('target');
      if (!target || !target.active) {
        target = this.findNearestTarget(entity, validTargets);
        entity.setData('target', target);
      }

      // 2. Engage
      if (target && target.active) {
        const dist = Phaser.Math.Distance.Between(entity.x, entity.y, target.x, target.y);
        const angle = Phaser.Math.Angle.Between(entity.x, entity.y, target.x, target.y);

        // Turn logic
        if (isMother) {
          entity.setRotation(angle);
        } else {
          entity.setRotation(angle);
        }

        if (isMother) {
          // Mothership Logic
          if (dist > 800) {
            this.scene.physics.velocityFromRotation(angle, 30, entity.body.acceleration);
          } else if (dist < 400) {
            this.scene.physics.velocityFromRotation(angle, -10, entity.body.acceleration);
          } else {
            entity.setAcceleration(0);
          }
        } else {
          // Drone Logic (Orbit 200-400) with Strafe

          // Manage Strafe Direction
          let strafeDir = entity.getData('strafeDir') || 1;
          const nextStrafe = entity.getData('nextStrafeTime') || 0;
          if (time > nextStrafe) {
            strafeDir *= -1;
            entity.setData('strafeDir', strafeDir);
            entity.setData('nextStrafeTime', time + 2000 + Math.random() * 2000); // 2-4s switch
          }

          const speed = 150; // SPEED_DRONE_MAX
          const correction = new Phaser.Math.Vector2();

          // Distance Maintenance
          if (dist > 400) {
            // Too far: approach
            correction.setToPolar(angle, speed);
          } else if (dist < 200) {
            // Too close: back off
            correction.setToPolar(angle, -speed);
          } else {
            // In sweet spot: weak approach/retreat to maintain ~300
            const diff = dist - 300;
            correction.setToPolar(angle, diff * 0.5);
          }

          // Strafing Component (Perpendicular)
          const strafeVec = new Phaser.Math.Vector2().setToPolar(
            angle + Math.PI / 2,
            speed * 0.8 * strafeDir
          );

          // Combine
          const finalAccel = correction.add(strafeVec);

          // Apply
          entity.setAcceleration(finalAccel.x, finalAccel.y);
        }

        // Fire
        const range = isMother ? 1000 : 600;
        if (dist < range) {
          const lastFired = entity.getData('lastFired') || 0;
          const cooldown = isMother ? 800 : 1000;

          if (time > lastFired + cooldown) {
            if (Math.random() < 0.5) {
              this.fireLaser(entity);
              entity.setData('lastFired', time);
            }
          }
        }
      } else {
        entity.setAcceleration(0); // Idle
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private findNearestTarget(source: any, targets: any[]): any {
    let nearest = null;
    let minD = 99999;
    for (const t of targets) {
      if (!t.active) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const target = t as any;
      const d = Phaser.Math.Distance.Between(source.x, source.y, target.x, target.y);
      if (d < minD) {
        minD = d;
        nearest = t;
      }
    }
    return nearest;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fireLaser(source: any) {
    if (!source.active) return;

    // Duplicate fire logic for now to avoid circular deps or complex passing
    // Spawn Offset: 60px ahead
    const offset = new Phaser.Math.Vector2().setToPolar(source.rotation, 60);
    const spawnX = source.x + offset.x;
    const spawnY = source.y + offset.y;

    const laser = this.lasers.create(spawnX, spawnY, 'projectile_laser');
    if (!laser) return;

    laser.setScale(0.01); // SCALE_LASER
    laser.setRotation(source.rotation);
    laser.setTint(0xffff00);

    laser.setData('owner', source);
    this.scene.cameras.getCamera('minimap')?.ignore(laser);

    this.scene.physics.velocityFromRotation(source.rotation, 400, laser.body.velocity); // SPEED_LASER

    laser.body.enable = false;
    this.scene.time.delayedCall(50, () => {
      if (laser.active) laser.body.enable = true;
    });

    this.scene.time.delayedCall(2000, () => {
      if (laser.active) laser.destroy();
    });
  }
}
