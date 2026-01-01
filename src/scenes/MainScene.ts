import Phaser from 'phaser';
import { world, type Entity } from '../ecs/world';
import { movementSystem } from '../ecs/systems/movement';
import { playerControlSystem } from '../ecs/systems/playerControl';
import { interactionSystem } from '../ecs/systems/interaction';
import { ui } from '../ui/ui';
import { v4 as uuidv4 } from 'uuid';

type TrailPoint = {
  x: number;
  y: number;
  time: number;
};

export class MainScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyE!: Phaser.Input.Keyboard.Key;
  private debugText!: Phaser.GameObjects.Text;
  private playerEntity!: Entity;

  // Trail
  private trailGraphics!: Phaser.GameObjects.Graphics;
  private trailHistory: TrailPoint[] = [];
  private readonly TRAIL_DURATION = 20000; // ms (10x longer)

  private isDocked = false;

  constructor() {
    super('MainScene');
  }

  preload() {
    this.load.image('ship', 'assets/ship_nobg.png');
    this.load.image('station', 'assets/station_nobg.png');
  }

  create() {
    // 1. Grid
    this.add.grid(0, 0, 4000, 4000, 100, 100, 0x000000, 0, 0x00ff00, 0.2);

    // 2. Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyE = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // Trail Graphics (Init before player so it's under?)
    // Actually, user asked for z-index control. Trail should surely be under the ship.
    this.trailGraphics = this.add.graphics();
    this.trailGraphics.setDepth(5);

    // 3. Player
    const playerSprite = this.add.sprite(400, 300, 'ship');
    playerSprite.setScale(0.1);
    playerSprite.setDepth(10);

    this.playerEntity = {
      id: uuidv4(),
      transform: { x: 400, y: 300, rotation: 0 },
      velocity: { vx: 0, vy: 0 },
      sprite: playerSprite,
      playerControl: true,
    };
    world.add(this.playerEntity);

    // 4. Station
    const stationSprite = this.add.sprite(800, 600, 'station');
    stationSprite.setScale(0.5);
    stationSprite.setDepth(1);

    world.add({
      id: uuidv4(),
      transform: { x: 800, y: 600, rotation: 0 },
      velocity: { vx: 0, vy: 0 },
      sprite: stationSprite,
      station: true,
      interactionRadius: 200,
    });

    // Camera
    this.cameras.main.startFollow(playerSprite);

    // Debug HUD
    this.debugText = this.add.text(10, 10, '', { font: '16px monospace', color: '#00ff00' });
    this.debugText.setScrollFactor(0);
    this.debugText.setDepth(100);

    // UI Events
    ui.closeTradeBtn.addEventListener('click', () => this.undock());
  }

  update(time: number, delta: number) {
    if (this.isDocked) {
      if (Phaser.Input.Keyboard.JustDown(this.keyE)) {
        this.undock();
      }
      return;
    }

    playerControlSystem(this.cursors);
    movementSystem(delta);

    // Update Trail
    if (this.playerEntity.transform) {
      // Optimization: Throttle updates to ~5 times per second (rougher segments)
      const lastPoint = this.trailHistory[this.trailHistory.length - 1];
      if (!lastPoint || time - lastPoint.time > 200) {
        this.trailHistory.push({
          x: this.playerEntity.transform.x,
          y: this.playerEntity.transform.y,
          time: time,
        });
      }

      // Prune old points
      this.trailHistory = this.trailHistory.filter((p) => time - p.time < this.TRAIL_DURATION);

      // Draw
      this.trailGraphics.clear();
      this.trailGraphics.lineStyle(4, 0xffff00, 1.0); // Solid Yellow, 4px

      if (this.trailHistory.length > 1) {
        this.trailGraphics.beginPath();
        this.trailGraphics.moveTo(this.trailHistory[0].x, this.trailHistory[0].y);
        for (let i = 1; i < this.trailHistory.length; i++) {
          this.trailGraphics.lineTo(this.trailHistory[i].x, this.trailHistory[i].y);
        }
        this.trailGraphics.strokePath();
      }
    }

    // Interaction Check
    const dockableStation = interactionSystem(this.playerEntity);

    if (dockableStation && Phaser.Input.Keyboard.JustDown(this.keyE)) {
      this.dock(dockableStation);
    }

    // Debug Text
    if (this.playerEntity.transform && this.playerEntity.velocity) {
      const { x, y } = this.playerEntity.transform;
      const { vx, vy } = this.playerEntity.velocity;
      this.debugText.setText([
        `Pos: (${x.toFixed(1)}, ${y.toFixed(1)})`,
        `Vel: (${vx.toFixed(1)}, ${vy.toFixed(1)})`,
      ]);
    }
  }

  dock(_station: Entity) {
    this.isDocked = true;

    // Stop ship
    if (this.playerEntity.velocity) {
      this.playerEntity.velocity.vx = 0;
      this.playerEntity.velocity.vy = 0;
    }

    ui.showDockingHint(false);
    ui.showTradeMenu(true);
  }

  undock() {
    this.isDocked = false;
    ui.showTradeMenu(false);
  }
}
