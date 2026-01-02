import Phaser from 'phaser';
import { world } from '../ecs/world';

export class SectorMapScene extends Phaser.Scene {
  private playerSectorId: string | null = null;
  private graphics!: Phaser.GameObjects.Graphics;
  private closeKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'SectorMapScene' });
  }

  create() {
    // Semi-transparent background
    this.add.rectangle(400, 300, 800, 600, 0x000000, 0.8).setOrigin(0.5);

    this.add
      .text(400, 50, 'SECTOR MAP', {
        fontSize: '32px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(400, 550, 'Press C or ESC to Close', {
        fontSize: '16px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);

    this.graphics = this.add.graphics();

    // Register Keys
    if (this.input.keyboard) {
      this.closeKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
      this.input.keyboard
        .addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
        .on('down', () => this.closeMap());
    }

    this.drawMap();
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.closeKey)) {
      this.closeMap();
    }

    // Check for player sector update
    const player = world.with('playerControl', 'sectorId').first;
    if (player && player.sectorId !== this.playerSectorId) {
      this.playerSectorId = player.sectorId;
      this.drawMap();
    }
  }

  private closeMap() {
    this.scene.stop();
    this.scene.resume('MainScene');
  }

  private drawMap() {
    // Ideally, get this from World/Config. For now, hardcoded layout based on MainScene.
    const nodes = [
      { id: 'sector-a', x: 200, y: 300, label: 'Sector A\n(Production)' },
      { id: 'sector-b', x: 600, y: 300, label: 'Sector B\n(Market)' },
    ];

    const edges = [{ from: 'sector-a', to: 'sector-b' }];

    // Find Player Sector
    const player = world.with('playerControl', 'sectorId').first;
    this.playerSectorId = player ? player.sectorId || null : null;

    this.graphics.clear();

    // Draw Edges
    this.graphics.lineStyle(2, 0x444444);
    for (const edge of edges) {
      const from = nodes.find((n) => n.id === edge.from);
      const to = nodes.find((n) => n.id === edge.to);
      if (from && to) {
        this.graphics.beginPath();
        this.graphics.moveTo(from.x, from.y);
        this.graphics.lineTo(to.x, to.y);
        this.graphics.strokePath();
      }
    }

    // Draw Nodes
    for (const node of nodes) {
      const isPlayerHere = this.playerSectorId === node.id;
      const color = isPlayerHere ? 0x00ff00 : 0x0088ff;
      const radius = 40;

      // Circle
      this.graphics.fillStyle(color, 1);
      this.graphics.fillCircle(node.x, node.y, radius);

      // Border
      this.graphics.lineStyle(2, 0xffffff);
      this.graphics.strokeCircle(node.x, node.y, radius);

      // Label
      this.add
        .text(node.x, node.y + radius + 10, node.label, {
          fontSize: '14px',
          color: '#ffffff',
          align: 'center',
        })
        .setOrigin(0.5, 0);

      if (isPlayerHere) {
        this.add
          .text(node.x, node.y, 'YOU', {
            fontSize: '12px',
            color: '#000000',
            fontStyle: 'bold',
          })
          .setOrigin(0.5);
      }
    }
  }
}
