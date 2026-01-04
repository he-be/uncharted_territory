import Phaser from 'phaser';
import { CombatModule } from '../structure/CombatModule';
import type { ModuleConfig } from '../structure/CombatStructure';

export class DroneBayModule extends CombatModule {
  private droneCount: number;
  private maxDrones: number;
  private droneGroup: Phaser.Physics.Arcade.Group;
  private spawnInterval: number;
  private lastSpawn: number = 0;

  constructor(
    scene: Phaser.Scene,
    parent: Phaser.GameObjects.GameObject,
    config: ModuleConfig,
    droneGroup: Phaser.Physics.Arcade.Group
  ) {
    super(scene, parent, config);
    this.maxDrones = (config.params?.count as number) || 5;
    this.droneCount = 0; // Currently active from this bay
    this.droneGroup = droneGroup;
    this.spawnInterval = 2000; // 2 sec per drone launch
  }

  update(time: number, _delta: number) {
    if (!this.parent.active) return;

    // Auto-replenish check? Or just initial spawn?
    // "Carrier" style: Replenish if destroyed.
    // But we need to track WHICH drones belong to THIS bay to count them.
    // For prototype simplicity: "Spawn X drones at start" or "Spawn if low".
    // Let's implement: Spawn until max.

    // We assume we don't track dead drones yet, just spawn until we emitted N.
    // A real system would track living children.
    // Let's try to track simple count.
    // Ideally, the drone entity should signal back when it dies.

    if (this.droneCount < this.maxDrones && time > this.lastSpawn + this.spawnInterval) {
      this.spawnDrone();
      this.lastSpawn = time;
      this.droneCount++;
    }
  }

  private spawnDrone() {
    const parentImage = this.parent as Phaser.Physics.Arcade.Image;
    const x = parentImage.x + (Math.random() - 0.5) * 50;
    const y = parentImage.y + (Math.random() - 0.5) * 50;

    // We need to know if we are spawning Friendly or Enemy drones.
    // Parent Faction?
    const faction = this.parent.getData('faction') || 'enemy';
    const isFriendly = faction === 'player'; // or 'ally'

    const drone = this.droneGroup.create(x, y, 'npc_fighter');
    drone.setScale(0.015);
    drone.setDepth(5);
    drone.setTint(isFriendly ? 0x00ff00 : 0xff0000);
    drone.setDrag(50);
    drone.setMaxVelocity(150);

    drone.setData('name', isFriendly ? 'Ally Drone' : 'Enemy Drone');
    drone.setData('hp', 30);
    drone.setData('target', null);
    drone.setData('lastFired', 0);
    drone.setData('type', 'drone');
    drone.setData('faction', faction);

    // Strafing Init
    drone.setData('strafeDir', Math.random() < 0.5 ? 1 : -1);
    drone.setData('nextStrafeTime', 0);

    // Setup Minimap?
    // Accessing Minimap System is tricky from here without reference.
    // Maybe dispatch event? Or Scene global?
    // Scene.events.emit('droneSpawned', drone);
    this.scene.events.emit('spawn_drone', drone, isFriendly);
  }
}
