import Phaser from 'phaser';
import { world } from '../ecs/world';
import { SECTORS, CONNECTIONS } from '../data/universe';
import { findPath } from '../utils/pathfinding';
import { getSectorKills } from '../ecs/systems/analyticsSystem';

export class SectorMapScene extends Phaser.Scene {
  private playerSectorId: string | null = null;
  private graphics!: Phaser.GameObjects.Graphics;
  private closeKey!: Phaser.Input.Keyboard.Key;
  private textGroup!: Phaser.GameObjects.Group;

  constructor() {
    super({ key: 'SectorMapScene' });
  }

  create() {
    this.textGroup = this.add.group();

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

  update(time: number, delta: number) {
    if (Phaser.Input.Keyboard.JustDown(this.closeKey)) {
      this.closeMap();
    }

    // Refresh Map every 1 second to update danger levels
    this.refreshTimer += delta;
    if (this.refreshTimer > 1000) {
      this.refreshTimer = 0;
      this.drawMap();
    }

    // Check for player sector update
    const player = world.with('playerControl', 'sectorId').first;
    if (player && player.sectorId !== this.playerSectorId) {
      this.playerSectorId = player.sectorId;
      this.drawMap();
    }
  }

  private refreshTimer = 0;

  private closeMap() {
    this.scene.stop();
    this.scene.resume('MainScene');
  }

  private drawMap() {
    const nodes = SECTORS.map((s) => ({
      id: s.id,
      x: s.x,
      y: s.y,
      label: s.name,
    }));

    const edges = CONNECTIONS.map((c) => ({
      from: c.from,
      to: c.to,
    }));
    // Find Player Sector
    const player = world.with('playerControl', 'sectorId').first;
    this.playerSectorId = player ? player.sectorId || null : null;

    this.graphics.clear();
    this.textGroup.clear(true, true); // Clear and destroy children

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
      // Get kills in last 5 minutes (300,000 ms)
      const kills = getSectorKills(node.id, 300000);

      // Determine Color based on Danger (Kills)
      // Safe: 0-5 (Blue/Green)
      // Risky: 5-20 (Yellow/Orange)
      // Dangerous: 20+ (Red)
      let color = 0x0088ff; // Safe (Default Blue)
      let radius = 40;

      if (kills > 20) {
        color = 0xff0000; // Dangerous (Red)
        radius = 50; // Bigger to emphasize
      } else if (kills > 5) {
        color = 0xffaa00; // Risky (Orange)
      }

      if (isPlayerHere) {
        color = 0x00ff00; // Player (Green Override)
      }

      // Circle
      this.graphics.fillStyle(color, 1);
      this.graphics.fillCircle(node.x, node.y, radius);

      // Hit Area (invisible circle for interaction)
      // Since Graphics can't easily accept input per-shape, we create a zone or check bounds on click?
      // Better: Create an interactive Zone or Shape overlay for input.
      const zone = this.add.circle(node.x, node.y, radius).setInteractive();
      // ... same logic
      zone.on('pointerdown', () => {
        this.navigateToSector(node.id);
      });
      // Need to clean this up manually if we redraw?
      // Yes. Group approach for hit areas too?
      // Or just clear before redraw.
      this.textGroup.add(zone as unknown as Phaser.GameObjects.GameObject); // Hacky way to ensure it gets destroyed on clear

      // Border
      this.graphics.lineStyle(2, 0xffffff);
      this.graphics.strokeCircle(node.x, node.y, radius);

      // Label
      const label = this.add
        .text(node.x, node.y + radius + 10, `${node.label}\nSunk(5m): ${kills}`, {
          fontSize: '14px',
          color: '#ffffff',
          align: 'center',
        })
        .setOrigin(0.5, 0);
      this.textGroup.add(label);

      if (isPlayerHere) {
        const youLabel = this.add
          .text(node.x, node.y, 'YOU', {
            fontSize: '12px',
            color: '#000000',
            fontStyle: 'bold',
          })
          .setOrigin(0.5);
        this.textGroup.add(youLabel);
      }
    }
  }

  private navigateToSector(targetId: string) {
    const player = world.with('playerControl', 'sectorId', 'autoPilot').first;
    if (!player || !player.sectorId || !player.autoPilot) return;

    const path = findPath(player.sectorId, targetId);
    if (path && path.length > 0) {
      console.log(`[Map] Course Set: ${path.join(' -> ')}`);
      player.autoPilot.pathQueue = path;
      player.autoPilot.targetX = undefined; // Clear local override
      player.autoPilot.targetY = undefined;
      player.autoPilot.state = 'ALIGNING';

      this.closeMap();
    }
  }
}
