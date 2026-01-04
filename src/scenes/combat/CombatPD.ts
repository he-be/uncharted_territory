import Phaser from 'phaser';

export class CombatPD {
  private scene: Phaser.Scene;
  private pdProjectiles: Phaser.Physics.Arcade.Group;
  private lasers: Phaser.Physics.Arcade.Group;
  private lastPdTime = 0;

  constructor(
    scene: Phaser.Scene,
    pdProjectiles: Phaser.Physics.Arcade.Group,
    lasers: Phaser.Physics.Arcade.Group
  ) {
    this.scene = scene;
    this.pdProjectiles = pdProjectiles;
    this.lasers = lasers;

    // Gen Texture
    if (!this.scene.textures.exists('projectile_pd')) {
      const pdG = this.scene.make.graphics({ x: 0, y: 0 });
      pdG.fillStyle(0xffff00, 1);
      pdG.fillRect(0, 0, 2, 16);
      pdG.generateTexture('projectile_pd', 2, 16);
    }
  }

  update(
    time: number,
    player: Phaser.Physics.Arcade.Image,
    friendlies: Phaser.Physics.Arcade.Group
  ) {
    if (!player.active) return;
    if (time < this.lastPdTime + 20) return; // 50 shots/sec = 20ms

    // Find Threat
    let nearestLaser: Phaser.Physics.Arcade.Image | null = null;
    let minD = 500;

    this.lasers.getChildren().forEach((l: Phaser.GameObjects.GameObject) => {
      const laser = l as Phaser.Physics.Arcade.Image;
      if (!laser.active) return;

      const owner = laser.getData('owner');
      // Ignore friendly fire
      if (owner === player || friendlies.contains(owner)) return;

      const d = Phaser.Math.Distance.Between(player.x, player.y, laser.x, laser.y);
      if (d < minD) {
        minD = d;
        nearestLaser = laser;
      }
    });

    if (nearestLaser) {
      this.firePD(player, nearestLaser);
      this.lastPdTime = time;
    }

    // Cleanup
    this.pdProjectiles.getChildren().forEach((p: Phaser.GameObjects.GameObject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pd = p as any;
      if (pd.active && (pd.x < 0 || pd.x > 4000 || pd.y < 0 || pd.y > 4000)) {
        pd.destroy();
      }
    });
  }

  private firePD(player: Phaser.Physics.Arcade.Image, target: Phaser.Physics.Arcade.Image) {
    const angle = Phaser.Math.Angle.Between(player.x, player.y, target.x, target.y);
    const offsets = [0];

    offsets.forEach((off) => {
      const rightVec = new Phaser.Math.Vector2().setToPolar(player.rotation + Math.PI / 2, off);
      const spawnX = player.x + rightVec.x;
      const spawnY = player.y + rightVec.y;

      const pd = this.pdProjectiles.create(spawnX, spawnY, 'projectile_pd');
      if (!pd) return;

      pd.setRotation(angle + Math.PI / 2);

      this.scene.physics.velocityFromRotation(angle, 800, pd.body.velocity); // 400 * 2 = 800

      this.scene.cameras.getCamera('minimap')?.ignore(pd);

      this.scene.time.delayedCall(1500, () => {
        if (pd.active) pd.destroy();
      });
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public handleIntercept(pd: any, laser: any) {
    if (pd.active) pd.destroy();
    if (laser.active) laser.destroy();
  }
}
