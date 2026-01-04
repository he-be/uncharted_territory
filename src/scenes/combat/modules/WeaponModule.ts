import Phaser from 'phaser';
import { CombatModule } from '../structure/CombatModule';
import type { ModuleConfig } from '../structure/CombatStructure';

export class WeaponModule extends CombatModule {
  private lastFired = 0;
  private cooldown: number;
  private lasers: Phaser.Physics.Arcade.Group;

  constructor(
    scene: Phaser.Scene,
    parent: Phaser.GameObjects.GameObject,
    config: ModuleConfig,
    lasers: Phaser.Physics.Arcade.Group
  ) {
    super(scene, parent, config);
    this.cooldown = (config.params?.cooldown as number) || 1000;
    this.lasers = lasers;
  }

  update(_time: number, _delta: number) {
    // Weapon logic usually requires an explicit "fire" command from AI or Player input.
    // However, for simple auto-turrets, we might check target here.
    // For now, we expose a public method 'fire()' and let the controller (AI/Input) call it.
  }

  public fire(time: number) {
    if (!this.parent.active) return;
    if (time < this.lastFired + this.cooldown) return;

    this.lastFired = time;

    // Calculate Spawn Position
    // Parent rotation assume 0=Right.
    // Offset is relative to parent rotation.
    const rot = this.parent instanceof Phaser.GameObjects.Image ? this.parent.rotation : 0;
    const x = this.parent instanceof Phaser.GameObjects.Image ? this.parent.x : 0;
    const y = this.parent instanceof Phaser.GameObjects.Image ? this.parent.y : 0;

    const offsetVec = new Phaser.Math.Vector2(
      this.config.offset?.x || 0,
      this.config.offset?.y || 0
    ).rotate(rot);

    const spawnX = x + offsetVec.x;
    const spawnY = y + offsetVec.y;

    const faction = this.parent.getData('faction');
    const isFriendly = faction === 'player' || faction === 'ally';
    const textureKey =
      faction === undefined ? 'projectile_laser' : isFriendly ? 'laser_friendly' : 'laser_enemy';

    const laser = this.lasers.create(spawnX, spawnY, textureKey);
    if (!laser) return;

    if (textureKey !== 'projectile_laser') {
      laser.setScale(1);
    } else {
      laser.setScale(0.01);
      laser.setTint(0xffff00);
    }

    laser.setRotation(rot);
    laser.setData('owner', this.parent);

    this.scene.cameras.getCamera('minimap')?.ignore(laser);

    this.scene.physics.velocityFromRotation(rot, 400, laser.body.velocity);

    // No-collision brief window
    laser.body.enable = false;
    this.scene.time.delayedCall(50, () => {
      if (laser.active) laser.body.enable = true;
    });

    this.scene.time.delayedCall(2000, () => {
      if (laser.active) laser.destroy();
    });
  }
}
