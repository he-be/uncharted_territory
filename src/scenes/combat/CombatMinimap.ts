import Phaser from 'phaser';

export class CombatMinimap {
  private scene: Phaser.Scene;
  private minimapGroup: Phaser.GameObjects.Group;
  private borderGraphics!: Phaser.GameObjects.Graphics;

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
    this.borderGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.borderGraphics.lineStyle(2, 0x00ff00);
    this.borderGraphics.strokeRect(x, y, size, size);

    // Minimap should NOT see its own UI border (it's drawn on Main cam)
    minimap.ignore(this.borderGraphics);

    // Main Camera needs to ignore symbols

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
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let hasEntities = false;

    // 1. Calculate Bounds
    entities.forEach((e: Phaser.GameObjects.GameObject) => {
      if (e.active) {
        hasEntities = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entity = e as any;
        minX = Math.min(minX, entity.x);
        maxX = Math.max(maxX, entity.x);
        minY = Math.min(minY, entity.y);
        maxY = Math.max(maxY, entity.y);
      }
    });

    let finalZoom = 0.08; // Default fallback

    if (hasEntities) {
      const cam = this.scene.cameras.getCamera('minimap');
      if (cam) {
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;
        const width = maxX - minX;
        const height = maxY - minY;
        const maxDim = Math.max(width, height, 4000); // Minimum view area 4000 units

        const minimapSize = 320;
        const padding = 1.2;
        const targetZoom = minimapSize / (maxDim * padding);

        // Clamp Zoom
        // 20000 units -> approx 0.016 zoom
        finalZoom = Phaser.Math.Clamp(targetZoom, 0.005, 0.2);

        cam.centerOn(midX, midY);
        cam.setZoom(finalZoom);
      }
    }

    // 2. Update Symbols with Scale Compensation
    // Target World Scale = Base / Zoom

    entities.forEach((e: Phaser.GameObjects.GameObject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entity = e as any;
      if (entity.active) {
        const symbol = entity.getData('minimapSymbol') as Phaser.GameObjects.Graphics;
        if (symbol) {
          symbol.setPosition(entity.x, entity.y);
          symbol.setRotation(entity.rotation);

          // Inverse Scale to keep constant visual size when zoomed out
          // Base scale 1 means 80px.
          // At zoom 0.01 (very far), we want it to look like say 8px?
          // 8px / 80px = 0.1 visual scale.
          // 0.1 visual = WorldScale * Zoom
          // WorldScale = 0.1 / Zoom.
          // But we don't want to enlarge it if zoom is 1. (Max(1, ...))
          // Let's try constant visual size factor 0.15
          const targetScale = Math.max(1, 0.08 / finalZoom);
          symbol.setScale(targetScale);
        }
      }
    });
  }
}
