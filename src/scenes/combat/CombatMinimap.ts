import Phaser from 'phaser';

export class CombatMinimap {
  private scene: Phaser.Scene;
  private minimapGroup: Phaser.GameObjects.Group;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.minimapGroup = this.scene.add.group();
  }

  create(ignoreObjects: (Phaser.GameObjects.GameObject | Phaser.GameObjects.Group)[]) {
    const size = 320;
    const margin = 20;
    const x = this.scene.scale.width - size - margin;
    const y = this.scene.scale.height - size - margin;

    const minimap = this.scene.cameras.add(x, y, size, size).setZoom(0.08).setName('minimap');
    minimap.setBackgroundColor(0x000000);
    minimap.scrollX = 2000;
    minimap.scrollY = 2000;

    // Ignores
    ignoreObjects.forEach((obj) => minimap.ignore(obj));

    // Border
    const graphics = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    graphics.lineStyle(2, 0x00ff00);
    graphics.strokeRect(x, y, size, size);

    // Main Camera needs to ignore symbols
    this.scene.cameras.main.ignore(this.minimapGroup);
  }

  getGroup() {
    return this.minimapGroup;
  }

  createSymbol(
    entity: Phaser.GameObjects.GameObject,
    type: 'player' | 'ally' | 'mother' | 'enemy'
  ) {
    const graphics = this.scene.add.graphics();

    if (type === 'player') {
      graphics.fillStyle(0x00ffff, 1);
      graphics.fillTriangle(60, 0, -40, -40, -40, 40);
    } else if (type === 'ally') {
      graphics.fillStyle(0x00ffff, 0.8);
      graphics.fillCircle(0, 0, 40);
    } else if (type === 'mother') {
      graphics.fillStyle(0xff0000, 1);
      graphics.fillRect(-100, -100, 200, 200);
    } else if (type === 'enemy') {
      graphics.fillStyle(0xff0000, 0.8);
      graphics.fillCircle(0, 0, 40);
    }

    this.minimapGroup.add(graphics);
    this.scene.cameras.main.ignore(graphics); // IMPORTANT: Ignore explicitly for dynamic additions
    entity.setData('minimapSymbol', graphics);

    entity.on('destroy', () => {
      graphics.destroy();
    });
  }

  update(entities: Phaser.GameObjects.GameObject[]) {
    entities.forEach((e: Phaser.GameObjects.GameObject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entity = e as any;
      if (entity.active) {
        const symbol = entity.getData('minimapSymbol') as Phaser.GameObjects.Graphics;
        if (symbol) {
          symbol.setPosition(entity.x, entity.y);
          symbol.setRotation(entity.rotation);
        }
      }
    });
  }
}
