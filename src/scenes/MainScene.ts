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
import { analyticsSystem } from '../ecs/systems/analyticsSystem';
import { MarketSystem } from '../ecs/systems/MarketSystem';

import { ITEMS, type ItemId } from '../data/items';
import { calculatePrice } from '../utils/economyUtils';
import { ui } from '../ui/ui';
import { v4 as uuidv4 } from 'uuid';
import { SECTORS } from '../data/universe';
import { UniverseManager } from '../core/UniverseManager';
import { SystemManager } from '../core/SystemManager';

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
  private keyV!: Phaser.Input.Keyboard.Key;

  private playerEntity!: Entity;

  // Trail
  private trailGraphics!: Phaser.GameObjects.Graphics;
  private trailHistory: TrailPoint[] = [];
  private readonly TRAIL_DURATION = 20000;

  private systemManager = new SystemManager();

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
    this.load.image('station_industry', 'assets/station_industry.png');
    this.load.image('station_equipments', 'assets/station_equipments.png');
    this.load.image('station_shipyard', 'assets/station_shipyard.png');
    this.load.image('npc_trader', 'assets/npc_trader_B.png'); // Default (Empty)
    this.load.image('npc_trader_full', 'assets/npc_trader_A.png'); // Loaded
    this.load.image('npc_pirate', 'assets/npc_pirate.png');
    this.load.image('npc_fighter', 'assets/npc_fighter.png');
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
        deltaY: number
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

    ui.toggleEcoBtn.addEventListener('click', () => {
      const isHidden = ui.ecoDashboard.classList.contains('hidden');
      ui.toggleEco(isHidden); // Toggle
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
    const universeManager = new UniverseManager(this);
    universeManager.generateUniverse();

    // Camera Init
    this.cameras.main.startFollow(playerSprite);
    this.cameras.main.setZoom(this.currentZoom);
    this.cameras.main.setBounds(-500000, -500000, 3000000, 3000000); // Expanded for Sector 12 (1.6M)

    // Initial Sector Set (already done above, ensuring consistency)
    if (!this.playerEntity.sectorId) {
      this.playerEntity.sectorId = 'sector-1';
    }
  }

  // MainScene.ts update method wrapper
  update(time: number, delta: number) {
    try {
      // const frameStart = performance.now();

      if (this.keyZ.isDown) this.adjustZoom(this.ZOOM_SPEED * 0.5);
      if (this.keyX.isDown) this.adjustZoom(-this.ZOOM_SPEED * 0.5);

      if (Phaser.Input.Keyboard.JustDown(this.keyC)) {
        if (!this.scene.isActive('SectorMapScene')) {
          this.scene.launch('SectorMapScene');
        }
      }

      // ECO Dashboard Toggle (V)
      if (Phaser.Input.Keyboard.JustDown(this.keyV)) {
        const isHidden = ui.ecoDashboard.classList.contains('hidden');
        ui.toggleEco(isHidden);
      }

      // 3. Player Control
      if (this.isDocked) {
        // Periodic UI Update
        if (
          time - this.lastUiUpdate > 500 &&
          this.currentStation &&
          this.currentStation.inventory
        ) {
          this.lastUiUpdate = time;
          const tradeData = this.getTradeData(this.currentStation);
          ui.showTradeMenu(true, undefined, tradeData);
        }
        if (Phaser.Input.Keyboard.JustDown(this.keyE)) this.undock();
      } else {
        playerControlSystem(this.cursors);
      }

      // System Execution via Manager
      this.systemManager.run('Movement', movementSystem, delta);

      // AutoPilot Click (keep inline or move to system?) Keep inline for now
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
        }
      });
      // NOTE: Re-adding click handler logic here if it was lost in replacement,
      // but actually I should keep the existing click handler if possible.
      // The diff is large. I will preserve the click handler logic by copying it or using a smaller chunk.

      this.systemManager.run('NPC', npcSpawnerSystem, this, delta);
      this.systemManager.run('Combat', combatSystem, this, delta);
      this.systemManager.run('AutoPilot', autoPilotSystem, this.playerEntity, delta);
      this.systemManager.run('AI', aiSystem, delta);
      this.systemManager.run('Economy', economySystem, time, delta);
      this.systemManager.run('Market', MarketSystem.update, time);
      this.systemManager.run('Analytics', analyticsSystem, time);
      this.systemManager.run('Overlay', overlaySystem, this);

      // Trail & Interaction
      if (this.playerEntity.transform) {
        // Trail logic (condensed)
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

      const dockableStation = interactionSystem(this.playerEntity);
      if (dockableStation && Phaser.Input.Keyboard.JustDown(this.keyE)) {
        this.dock(dockableStation);
      }

      this.systemManager.run('Gate', gateSystem, this.playerEntity);
      this.systemManager.run('Render', renderSystem, this.playerEntity);

      // const totalFrameTime = performance.now() - frameStart;
    } catch (err) {
      console.error('MainScene Update Error:', err);
    }
  }

  startKeyListeners() {
    this.keyE = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyZ = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.keyX = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.keyC = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    this.keyV = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.V);
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
