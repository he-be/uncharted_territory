import Phaser from 'phaser';
import { world, type Entity } from '../ecs/world';
import { movementSystem } from '../ecs/systems/movement';
import { playerControlSystem } from '../ecs/systems/playerControl';
import { interactionSystem } from '../ecs/systems/interaction';
import { aiSystem } from '../ecs/systems/ai';
import { npcSpawnerSystem } from '../ecs/systems/npcSpawner';
import { economySystem } from '../ecs/systems/economy';
import { overlaySystem } from '../ecs/systems/overlaySystem';
import { renderSystem } from '../ecs/systems/renderSystem';
import { gateSystem } from '../ecs/systems/gateSystem';
import { STATION_CONFIGS, type StationType } from '../data/stations';
import { ITEMS, type ItemId } from '../data/items';
import { calculatePrice } from '../utils/economyUtils';
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
  private keyC!: Phaser.Input.Keyboard.Key;
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
    this.startKeyListeners();

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
    ui.toggleMapBtn.addEventListener('click', () => {
      if (this.scene.isActive('SectorMapScene')) {
        this.scene.stop('SectorMapScene');
        this.scene.resume(); // Ensure main scene is resumed if it was paused
      } else {
        this.scene.launch('SectorMapScene');
      }
    });

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

    // 4. Stations & Sectors
    const SECTOR_A = 'sector-a';
    const SECTOR_B = 'sector-b';

    // Sector A: Production (Near 0,0)
    this.createStation('station_mining', -400, 800, 'Gamma Mining (Sec A)', 'mining', SECTOR_A);
    this.createStation('station_factory', 1500, 1000, 'Beta Factory (Sec A)', 'factory', SECTOR_A);
    // Gate A at (4000, 0)
    // Destination Gate ID: gate-b-entry
    this.createGate(4000, 0, SECTOR_A, SECTOR_B, 'gate-b-entry', 'gate-a-exit');

    // Sector B: Consumption market (Far away)
    // Offset: 50,000
    const OFFSET_B_X = 50000;
    const OFFSET_B_Y = 0;

    this.createStation(
      'station',
      OFFSET_B_X + 800,
      OFFSET_B_Y + 600,
      'Alpha Trading (Sec B)',
      'trading',
      SECTOR_B
    );

    // Gate B (Leads back to A)
    // ID: gate-b-entry
    // Destination: gate-a-exit
    this.createGate(
      OFFSET_B_X - 2000,
      OFFSET_B_Y,
      SECTOR_B,
      SECTOR_A,
      'gate-a-exit',
      'gate-b-entry'
    );

    // Camera Init
    this.cameras.main.startFollow(playerSprite);
    this.cameras.main.setZoom(this.currentZoom);
    this.cameras.main.setBounds(-100000, -100000, 200000, 200000); // Expand camera bounds

    // Debug HUD
    this.debugText = this.add.text(10, 10, '', { font: '16px monospace', color: '#00ff00' });
    this.debugText.setScrollFactor(0);
    this.debugText.setDepth(100);

    // Player starts in A
    this.playerEntity.sectorId = SECTOR_A;
  }

  createStation(
    key: string,
    x: number,
    y: number,
    name: string,
    type: StationType,
    sectorId: string
  ) {
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
      sectorId: sectorId,
    });
  }

  createGate(
    x: number,
    y: number,
    sectorId: string,
    targetSectorId: string,
    targetGateId: string,
    myId: string
  ) {
    // Re-use station sprite but tinted blue for now, or use shape
    const sprite = this.add.circle(x, y, 50, 0x00ffff, 0.5); // Larger, transparent
    sprite.setDepth(1);

    world.add({
      id: myId,
      transform: { x, y, rotation: 0 },
      sprite: sprite,
      interactionRadius: 100, // Trigger radius
      name: `Gate to ${targetSectorId}`,
      sectorId: sectorId,
      gate: {
        destinationSectorId: targetSectorId,
        destinationGateId: targetGateId,
      },
    });
  }

  update(time: number, delta: number) {
    const frameStart = performance.now();

    if (this.keyZ.isDown) this.adjustZoom(this.ZOOM_SPEED * 0.5);
    if (this.keyX.isDown) this.adjustZoom(-this.ZOOM_SPEED * 0.5);

    if (Phaser.Input.Keyboard.JustDown(this.keyC)) {
      if (!this.scene.isActive('SectorMapScene')) {
        this.scene.launch('SectorMapScene');
      }
    }

    // If docked, we only skip player movement/control updates
    if (this.isDocked) {
      // Periodic UI Update (every 500ms)
      if (time - this.lastUiUpdate > 500 && this.currentStation && this.currentStation.inventory) {
        this.lastUiUpdate = time;
        // Don't re-set visible=true to avoid flickering if it resets scroll etc, checking if logic handles it.
        // ui.showTradeMenu updates content.
        const tradeData = this.getTradeData(this.currentStation);
        ui.showTradeMenu(true, undefined, tradeData);
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

    // Phase 4: Gate & Render Systems
    gateSystem(this.playerEntity);
    renderSystem(this.playerEntity);

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

  startKeyListeners() {
    this.keyE = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyZ = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.keyX = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.keyC = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C);
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
    const tradeData = this.getTradeData(station);
    ui.showTradeMenu(true, station.name || 'Unknown Station', tradeData);
  }

  undock() {
    this.isDocked = false;
    this.currentStation = null;
    ui.showTradeMenu(false);
  }

  getTradeData(station: Entity) {
    if (!station.inventory) return [];

    const data = [];
    for (const [key, count] of Object.entries(station.inventory)) {
      const itemId = key as ItemId;
      const itemDef = ITEMS[itemId];
      if (!itemDef) continue;

      const price = calculatePrice(station, itemId);

      data.push({
        id: itemId,
        name: itemDef.name,
        count: count,
        price: price,
        basePrice: itemDef.basePrice,
      });
    }
    // Sort by Name? Or predefined order?
    return data;
  }
}
