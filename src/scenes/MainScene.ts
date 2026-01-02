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
import { autoPilotSystem } from '../ecs/systems/autoPilot';
import { combatSystem } from '../ecs/systems/combatSystem';
import { STATION_CONFIGS, type StationType } from '../data/stations';
import { ITEMS, type ItemId } from '../data/items';
import { calculatePrice } from '../utils/economyUtils';
import { ui } from '../ui/ui';
import { v4 as uuidv4 } from 'uuid';
import { SECTORS, CONNECTIONS, getSectorWorldPosition } from '../data/universe';

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
    this.load.image('ship', 'assets/player_ship.png');
    this.load.image('station', 'assets/station_trade.png');
    this.load.image('station_factory', 'assets/station_factory.png');
    this.load.image('station_mining', 'assets/station_mining.png');
    this.load.image('npc_trader', 'assets/npc_trader_B.png'); // Default (Empty)
    this.load.image('npc_trader_full', 'assets/npc_trader_A.png'); // Loaded
    this.load.image('npc_pirate', 'assets/npc_pirate.png');
    this.load.image('gate', 'assets/gate.png');
    this.load.image('asteroid', 'assets/asteroid.png');
    this.load.image('kraken', 'assets/kraken.png');
    this.load.image('projectile_laser', 'assets/projectile_laser.png');
    this.load.image('effect_shield', 'assets/effect_shield.png');
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
    playerSprite.setScale(0.15);
    playerSprite.setDepth(10);

    // Player starts in Sector 1
    const startSector = SECTORS.find((s) => s.id === 'sector-1');
    const startX = startSector ? startSector.x * 1000 : 400;
    const startY = startSector ? startSector.y * 1000 : 300;

    this.playerEntity = {
      id: uuidv4(),
      transform: { x: startX, y: startY, rotation: 0 },
      velocity: { vx: 0, vy: 0 },
      sprite: playerSprite,
      playerControl: true,
      sectorId: 'sector-1', // Initial sector assignment
      autoPilot: { state: 'IDLE' },
    };
    world.add(this.playerEntity);

    // 4. Universe Generation
    this.generateUniverse();

    // Camera Init
    this.cameras.main.startFollow(playerSprite);
    this.cameras.main.setZoom(this.currentZoom);
    this.cameras.main.setBounds(-500000, -500000, 2000000, 2000000); // Expand camera bounds for Vast Universe

    // Debug HUD
    this.debugText = this.add.text(10, 10, '', { font: '16px monospace', color: '#00ff00' });
    this.debugText.setScrollFactor(0);
    this.debugText.setDepth(100);

    // Initial Sector Set (already done above, ensuring consistency)
    if (!this.playerEntity.sectorId) {
      this.playerEntity.sectorId = 'sector-1';
    }
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
    sprite.setScale(0.25);
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
    // Gate Sprite
    const sprite = this.add.sprite(x, y, 'gate');
    sprite.setScale(0.2); // 1/4 of previous 0.8
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

  // MainScene.ts update method wrapper
  update(time: number, delta: number) {
    try {
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
        if (
          time - this.lastUiUpdate > 500 &&
          this.currentStation &&
          this.currentStation.inventory
        ) {
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

      // AutoPilot Click
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        // Ignore clicks on UI (if feasible, otherwise just check coordinates/depth)
        // Convert screen to world
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

        if (this.playerEntity.autoPilot) {
          this.playerEntity.autoPilot.targetX = worldPoint.x;
          this.playerEntity.autoPilot.targetY = worldPoint.y;
          this.playerEntity.autoPilot.pathQueue = []; // specific click clears route
          this.playerEntity.autoPilot.state = 'ALIGNING';
          console.log(
            `[AutoPilot] Set target to ${worldPoint.x.toFixed(0)}, ${worldPoint.y.toFixed(0)}`
          );

          // Check if clicked an entity? (e.g. gate)
          // Ideally we raycast, but simple proximity for now:
          // const entities = world.with('transform', 'interactionRadius'); // Broad phase
          // (omitted for brevity, simple coord move is enough for now)
        }
      });

      // NPC Systems
      npcSpawnerSystem(this, delta);
      combatSystem(this, delta);

      // AutoPilot
      autoPilotSystem(this.playerEntity, delta);

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
      // Phase 4: Gate & Render Systems
      gateSystem(this.playerEntity);
      // mapSystem moved to UIScene
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
    } catch (err) {
      console.error('MainScene Update Error:', err);
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

  generateUniverse() {
    // 1. Generate Stations per Sector
    SECTORS.forEach((sector) => {
      const pos = getSectorWorldPosition(sector);
      const sectorCX = pos.x;
      const sectorCY = pos.y;

      // Define mix based on sector type
      let stationMix: StationType[] = [];

      switch (sector.type) {
        case 'core':
          // Core: Heavy Trade, some Industry
          stationMix = ['trading', 'trading', 'factory'];
          break;
        case 'industrial':
          // Industrial: Factories
          stationMix = ['factory', 'factory', 'mining'];
          break;
        case 'mining':
          // Mining: Mining
          stationMix = ['mining', 'mining', 'mining'];
          break;
        case 'frontier':
          // Frontier: Sparse, mixed
          stationMix = ['mining', 'trading'];
          break;
        case 'pirate':
          // Pirate: Hideouts (using mining visual for now or trading)
          stationMix = ['trading', 'mining'];
          break;
        default:
          stationMix = ['trading'];
      }

      stationMix.forEach((type, index) => {
        // Spread stations out but keep within sector bounds (inner ring compared to gates)
        const radius = 2000;
        const angle = (Math.PI * 2 * index) / stationMix.length; // Even distribution

        const x = sectorCX + Math.cos(angle) * radius + (Math.random() - 0.5) * 500;
        const y = sectorCY + Math.sin(angle) * radius + (Math.random() - 0.5) * 500;

        this.createStation(
          this.getStationSpriteKey(type),
          x,
          y,
          `${sector.name} ${type.charAt(0).toUpperCase() + type.slice(1)} ${index + 1}`,
          type,
          sector.id
        );
      });
    });

    // 2. Generate Gates (Distribution Strategy: One per Direction)
    // Pass 1: Collect all connections per sector
    const sectorConnections = new Map<
      string,
      Array<{
        targetSectorId: string;
        gateId: string;
        targetGateId: string;
        dx: number;
        dy: number;
      }>
    >();

    CONNECTIONS.forEach((conn) => {
      const sA = SECTORS.find((s) => s.id === conn.from);
      const sB = SECTORS.find((s) => s.id === conn.to);
      if (!sA || !sB) return;

      const gidA = `gate-${conn.from}-${conn.to}`;
      const gidB = `gate-${conn.to}-${conn.from}`;

      if (!sectorConnections.has(conn.from)) sectorConnections.set(conn.from, []);
      if (!sectorConnections.has(conn.to)) sectorConnections.set(conn.to, []);

      sectorConnections.get(conn.from)!.push({
        targetSectorId: conn.to,
        gateId: gidA,
        targetGateId: gidB,
        dx: sB.x - sA.x,
        dy: sB.y - sA.y,
      });

      sectorConnections.get(conn.to)!.push({
        targetSectorId: conn.from,
        gateId: gidB,
        targetGateId: gidA,
        dx: sA.x - sB.x,
        dy: sA.y - sB.y,
      });
    });

    // Pass 2: Assign Slots
    const SECTOR_SIZE = 5000;

    sectorConnections.forEach((conns, sectorId) => {
      const sector = SECTORS.find((s) => s.id === sectorId);
      if (!sector) return;
      const center = getSectorWorldPosition(sector);

      // Slots
      const slots: Record<string, (typeof conns)[0] | null> = {
        N: null,
        S: null,
        E: null,
        W: null,
      };

      const getNaturalDir = (dx: number, dy: number) => {
        if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'E' : 'W';
        return dy > 0 ? 'S' : 'N';
      };

      // Helper to find next free slot
      const assignSlot = (conn: (typeof conns)[0]) => {
        const natural = getNaturalDir(conn.dx, conn.dy);

        // Try natural first
        if (!slots[natural]) {
          slots[natural] = conn;
          return;
        }

        // Try neighbors (Standard Clockwise: N -> E -> S -> W)
        // Map dirs to indices: E=0, S=1, W=2, N=3
        const dirMap: Record<string, number> = { E: 0, S: 1, W: 2, N: 3 };
        const revMap = ['E', 'S', 'W', 'N'];

        const currentIdx = dirMap[natural];

        // Check offsets: 1 (CW 90), 3 (CCW 90), 2 (Opposite)
        const offsets = [1, 3, 2];

        for (const off of offsets) {
          const tryIdx = (currentIdx + off) % 4;
          const tryDir = revMap[tryIdx];
          if (!slots[tryDir]) {
            slots[tryDir] = conn;
            return;
          }
        }
        console.warn(`Sector ${sector.name} overloaded! >4 gates?`);
      };

      // Assign
      conns.forEach((c) => assignSlot(c));

      // Create
      Object.entries(slots).forEach(([dir, req]) => {
        if (!req) return;

        let gx = center.x;
        let gy = center.y;

        if (dir === 'E') gx += SECTOR_SIZE;
        if (dir === 'W') gx -= SECTOR_SIZE;
        if (dir === 'S') gy += SECTOR_SIZE;
        if (dir === 'N') gy -= SECTOR_SIZE;

        this.createGate(gx, gy, sectorId, req.targetSectorId, req.targetGateId, req.gateId);
      });
    });
  }

  getStationTypeForSector(sectorType: string): StationType {
    switch (sectorType) {
      case 'mining':
        return 'mining';
      case 'industrial':
        return 'factory';
      case 'core':
        return Math.random() > 0.5 ? 'trading' : 'factory';
      case 'pirate':
        return Math.random() > 0.5 ? 'mining' : 'trading'; // Black markets?
      default:
        return 'trading';
    }
  }

  getStationSpriteKey(type: StationType): string {
    switch (type) {
      case 'mining':
        return 'station_mining';
      case 'factory':
        return 'station_factory';
      default:
        return 'station';
    }
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
