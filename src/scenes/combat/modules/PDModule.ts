import Phaser from 'phaser';
import { CombatModule } from '../structure/CombatModule';
import type { ModuleConfig } from '../structure/CombatStructure';

export class PDModule extends CombatModule {
  private lastFired = 0;
  private cooldown: number;
  private range: number;
  private pdProjectiles: Phaser.Physics.Arcade.Group;
  private lasers: Phaser.Physics.Arcade.Group;

  constructor(
    scene: Phaser.Scene,
    parent: Phaser.GameObjects.GameObject,
    config: ModuleConfig,
    pdGroup: Phaser.Physics.Arcade.Group,
    laserGroup: Phaser.Physics.Arcade.Group
  ) {
    super(scene, parent, config);
    this.cooldown = (config.params?.cooldown as number) || 20; // Fast fire
    this.range = (config.params?.range as number) || 500;
    this.pdProjectiles = pdGroup;
    this.lasers = laserGroup;
  }

  update(time: number, _delta: number) {
    if (!this.parent.active) return;
    if (time < this.lastFired + this.cooldown) return;

    // Scan for threats
    let nearest: Phaser.Physics.Arcade.Image | null = null;
    let minD = this.range;

    // We need 'friendlies' info effectively to ignore own team shots?
    // Or just ignore shots whose 'owner' is same faction?
    // Parent should have data 'faction' or similar?
    // For now, let's assume parent has 'faction' data ('player' | 'enemy')
    const myFaction = this.parent.getData('faction'); // We'll need to ensure this is set on Ship

    // Optimization: This scan is O(N_Lasers) per module per frame.
    // If we have 20 PD modules, it might be heavy.
    // But let's implement naive first as per instructions.

    // Note: To optimize, we should access a spatial hash or the global laser list.
    // Usage of group.getChildren() is slow if large.

    const parentImage = this.parent as Phaser.Physics.Arcade.Image;

    this.lasers.getChildren().forEach((l: Phaser.GameObjects.GameObject) => {
      const laser = l as Phaser.Physics.Arcade.Image;
      if (!laser.active) return;

      const owner = laser.getData('owner');
      if (!owner || !owner.active) return;

      // Faction Check
      if (owner === this.parent) return; // Self check

      const targetFaction = owner.getData('faction');
      if (myFaction && targetFaction) {
        // Friendly fire check
        const isFriendly =
          (myFaction === 'player' || myFaction === 'ally') &&
          (targetFaction === 'player' || targetFaction === 'ally');
        const isBothEnemy = myFaction === 'enemy' && targetFaction === 'enemy';

        if (isFriendly || isBothEnemy) return;
      }

      const d = Phaser.Math.Distance.Between(parentImage.x, parentImage.y, laser.x, laser.y);
      if (d < minD) {
        minD = d;
        nearest = laser;
      }
    });

    if (nearest) {
      this.firePD(nearest);
      this.lastFired = time;
    }
  }

  private firePD(target: Phaser.Physics.Arcade.Image) {
    const parentImage = this.parent as Phaser.Physics.Arcade.Image;
    const angle = Phaser.Math.Angle.Between(parentImage.x, parentImage.y, target.x, target.y);

    // Spawn at module offset
    const rot = parentImage.rotation;
    const offsetVec = new Phaser.Math.Vector2(
      this.config.offset?.x || 0,
      this.config.offset?.y || 0
    ).rotate(rot);

    const spawnX = parentImage.x + offsetVec.x;
    const spawnY = parentImage.y + offsetVec.y;

    const pd = this.pdProjectiles.create(spawnX, spawnY, 'projectile_pd');
    if (!pd) return;

    // Tag owner for collision logic
    pd.setData('owner', this.parent);

    pd.setRotation(angle + Math.PI / 2);
    this.scene.physics.velocityFromRotation(angle, 800, pd.body.velocity);

    this.scene.cameras.getCamera('minimap')?.ignore(pd);

    this.scene.time.delayedCall(1500, () => {
      if (pd.active) pd.destroy();
    });
  }
}
