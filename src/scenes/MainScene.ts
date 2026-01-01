import Phaser from 'phaser';
import { world, type Entity } from '../ecs/world';
import { movementSystem } from '../ecs/systems/movement';
import { playerControlSystem } from '../ecs/systems/playerControl';
import { interactionSystem } from '../ecs/systems/interaction';
import { aiSystem } from '../ecs/systems/ai';
import { npcSpawnerSystem } from '../ecs/systems/npcSpawner';
import { economySystem } from '../ecs/systems/economy';
import { overlaySystem } from '../ecs/systems/overlaySystem';
import { STATION_CONFIGS, type StationType } from '../data/stations';
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
  private keyZ!: Phaser.Input.Keyboard.Key;
  private keyX!: Phaser.Input.Keyboard.Key;
  private debugText!: Phaser.GameObjects.Text;
  private playerEntity!: Entity;

  // Trail
  private trailGraphics!: Phaser.GameObjects.Graphics;
  private trailHistory: TrailPoint[] = [];
  private readonly TRAIL_DURATION = 20000;

  private isDocked = false;

  // Zoom settings
  private currentZoom = 1.0;
  private readonly MIN_ZOOM = 0.2;
  private readonly MAX_ZOOM = 1.0;
  private readonly ZOOM_SPEED = 0.05;

  constructor() {
    super('MainScene');
  }

  preload() {
    this.load.image('ship', 'assets/ship_nobg.png');
    this.load.image('station', 'assets/station_nobg.png');
    this.load.image('station_factory', 'assets/station_factory_nobg.png');
    this.load.image('station_mining', 'assets/station_mining_nobg.png');
    this.load.image('npc_trader', 'assets/npc_trader_nobg.png');
    this.load.image('npc_pirate', 'assets/npc_pirate_nobg.png');
  }

  create() {
    // 1. Grid (Expanded)
    this.add.grid(0, 0, 40000, 40000, 100, 100, 0x000000, 0, 0x00ff00, 0.2);

    // 2. Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyE = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyZ = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.keyX = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);

    // Zoom Input
    this.input.on(
      'pointerwheel',
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: unknown[],
        _deltaX: number,
        deltaY: number,
        _deltaZ: number
      ) => {
        if (deltaY > 0) this.adjustZoom(-this.ZOOM_SPEED);
        else if (deltaY < 0) this.adjustZoom(this.ZOOM_SPEED);
      }
    );

    ui.zoomInBtn.addEventListener('click', () => this.adjustZoom(this.ZOOM_SPEED));
    ui.zoomOutBtn.addEventListener('click', () => this.adjustZoom(-this.ZOOM_SPEED));

    // Trail Graphics
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

    // 4. Stations
    this.createStation('station', 800, 600, 'Alpha Station (Trading)', 'trading');
    this.createStation('station_factory', 1500, 1000, 'Beta Factory', 'factory');
    this.createStation('station_mining', -400, 800, 'Gamma Mining Outpost', 'mining');

    // Camera
    this.cameras.main.startFollow(playerSprite);
    this.cameras.main.setZoom(this.currentZoom);

    // Debug HUD
    this.debugText = this.add.text(10, 10, '', { font: '16px monospace', color: '#00ff00' });
    this.debugText.setScrollFactor(0);
    this.debugText.setDepth(100);

    // UI Events
    ui.closeTradeBtn.addEventListener('click', () => this.undock());
  }

  createStation(key: string, x: number, y: number, name: string, type: StationType) {
    const sprite = this.add.sprite(x, y, key);
    sprite.setScale(0.5);
    sprite.setDepth(1);

    const config = STATION_CONFIGS[type];

    world.add({
      id: uuidv4(),
      transform: { x, y, rotation: 0 },
      velocity: { vx: 0, vy: 0 },
      sprite: sprite,
      station: true,
      interactionRadius: 200,
      name: name,
      stationType: type,
      inventory: { ...config.initInventory },
      productionConfig: config.production,
      wallet: 10000,
      totalProfit: 0,
    });
  }

  update(time: number, delta: number) {
    const frameStart = performance.now();

    if (this.keyZ.isDown) this.adjustZoom(this.ZOOM_SPEED * 0.5);
    if (this.keyX.isDown) this.adjustZoom(-this.ZOOM_SPEED * 0.5);

    // If docked, we only skip player movement/control updates
    if (this.isDocked) {
      // Periodic UI Update (every 500ms)
      if (time - this.lastUiUpdate > 500 && this.currentStation && this.currentStation.inventory) {
        this.lastUiUpdate = time;
        // Don't re-set visible=true to avoid flickering if it resets scroll etc, checking if logic handles it.
        // ui.showTradeMenu updates content.
        ui.showTradeMenu(true, undefined, this.currentStation.inventory as Record<string, number>);
      }

      // Check for undock key
      if (Phaser.Input.Keyboard.JustDown(this.keyE)) {
        this.undock();
      }
    } else {
      // Only control player and move entities if NOT docked
      playerControlSystem(this.cursors);
    }

    // Always run these (unless paused globally)
    movementSystem(delta);

    // NPC Systems
    npcSpawnerSystem(this, delta);

    const aiStart = performance.now();
    aiSystem(delta);
    const aiTime = performance.now() - aiStart;

    // Economy System
    const ecoStart = performance.now();
    economySystem(time, delta);
    const ecoTime = performance.now() - ecoStart;

    // UI/Overlay
    const ovStart = performance.now();
    overlaySystem(this);
    const ovTime = performance.now() - ovStart;

    // Update Trail
    if (this.playerEntity.transform) {
      const lastPoint = this.trailHistory[this.trailHistory.length - 1];
      if (!lastPoint || time - lastPoint.time > 200) {
        this.trailHistory.push({
          x: this.playerEntity.transform.x,
          y: this.playerEntity.transform.y,
          time: time,
        });
      }
      this.trailHistory = this.trailHistory.filter((p) => time - p.time < this.TRAIL_DURATION);

      this.trailGraphics.clear();
      this.trailGraphics.lineStyle(4, 0xffff00, 1.0);

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

    const totalFrameTime = performance.now() - frameStart;
    if (totalFrameTime > 33) {
      console.warn(
        `Long Frame: ${totalFrameTime.toFixed(2)}ms | AI: ${aiTime.toFixed(2)} | Eco: ${ecoTime.toFixed(2)} | Ov: ${ovTime.toFixed(2)}`
      );
    }

    if (this.playerEntity.transform && this.playerEntity.velocity) {
      const { x, y } = this.playerEntity.transform;
      const { vx, vy } = this.playerEntity.velocity;
      this.debugText.setText([
        `FPS: ${this.game.loop.actualFps.toFixed(1)}`,
        `Frame: ${totalFrameTime.toFixed(2)}ms`,
        `AI: ${aiTime.toFixed(2)}ms`,
        `Eco: ${ecoTime.toFixed(2)}ms`,
        `Ov: ${ovTime.toFixed(2)}ms`,
        ``,
        `Pos: (${x.toFixed(0)}, ${y.toFixed(0)})`,
        `Vel: (${vx.toFixed(0)}, ${vy.toFixed(0)})`,
        `Zoom: ${this.currentZoom.toFixed(2)}`,
      ]);
    }
  }

  adjustZoom(delta: number) {
    this.currentZoom += delta;
    if (this.currentZoom < this.MIN_ZOOM) this.currentZoom = this.MIN_ZOOM;
    if (this.currentZoom > this.MAX_ZOOM) this.currentZoom = this.MAX_ZOOM;
    this.cameras.main.setZoom(this.currentZoom);
  }

  private currentStation: Entity | null = null;
  private lastUiUpdate = 0;

  dock(station: Entity) {
    this.isDocked = true;
    this.currentStation = station;

    if (this.playerEntity.velocity) {
      this.playerEntity.velocity.vx = 0;
      this.playerEntity.velocity.vy = 0;
    }

    ui.showDockingHint(false);
    // Pass station name and inventory to UI
    ui.showTradeMenu(
      true,
      station.name || 'Unknown Station',
      station.inventory as Record<string, number>
    );
  }

  undock() {
    this.isDocked = false;
    this.currentStation = null;
    ui.showTradeMenu(false);
  }
}
