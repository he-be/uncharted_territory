import { world } from '../ecs/world';
import { v4 as uuidv4 } from 'uuid';
import { SECTORS, CONNECTIONS, getSectorWorldPosition } from '../data/universe';
import { STATION_CONFIGS, type StationType } from '../data/stations';
import Phaser from 'phaser';

export class UniverseManager {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public generateUniverse() {
    this.generateStations();
    this.generateGates();
  }

  private generateStations() {
    SECTORS.forEach((sector) => {
      const pos = getSectorWorldPosition(sector);
      const sectorCX = pos.x;
      const sectorCY = pos.y;

      let stationMix: StationType[] = [];

      switch (sector.type) {
        case 'core':
          stationMix = ['shipyard', 'trading', 'factory_electronics', 'factory_engine'];
          break;
        case 'industrial':
          stationMix = ['factory_steel', 'factory_fuel', 'factory_sensors', 'mining_ore'];
          break;
        case 'mining':
          stationMix = ['mining_ore', 'mining_gas', 'mining_crystal'];
          break;
        case 'frontier':
          stationMix = ['trading', 'mining_gas'];
          break;
        default:
          stationMix = ['trading'];
      }

      stationMix.forEach((type, index) => {
        const radius = 2500;
        const angle = (Math.PI * 2 * index) / stationMix.length;

        const x = sectorCX + Math.cos(angle) * radius + (Math.random() - 0.5) * 500;
        const y = sectorCY + Math.sin(angle) * radius + (Math.random() - 0.5) * 500;

        this.createStation(
          this.getStationSpriteKey(type),
          x,
          y,
          `${sector.name} ${this.getStationNameSuffix(type)} ${index + 1}`,
          type,
          sector.id
        );
      });
    });
  }

  private generateGates() {
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

      const assignSlot = (conn: (typeof conns)[0]) => {
        const natural = getNaturalDir(conn.dx, conn.dy);

        if (!slots[natural]) {
          slots[natural] = conn;
          return;
        }

        const dirMap: Record<string, number> = { E: 0, S: 1, W: 2, N: 3 };
        const revMap = ['E', 'S', 'W', 'N'];
        const currentIdx = dirMap[natural];
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

      conns.forEach((c) => assignSlot(c));

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

  private createStation(
    key: string,
    x: number,
    y: number,
    name: string,
    type: StationType,
    sectorId: string
  ) {
    const sprite = this.scene.add.sprite(x, y, key);
    sprite.setScale(0.25);
    sprite.setDepth(1);

    const config = STATION_CONFIGS[type];
    if (config.color) {
      sprite.setTint(config.color);
    }

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

  private createGate(
    x: number,
    y: number,
    sectorId: string,
    targetSectorId: string,
    targetGateId: string,
    myId: string
  ) {
    const sprite = this.scene.add.sprite(x, y, 'gate');
    sprite.setScale(0.2);
    sprite.setDepth(1);

    world.add({
      id: myId,
      transform: { x, y, rotation: 0 },
      sprite: sprite,
      interactionRadius: 100,
      name: `Gate to ${targetSectorId}`,
      sectorId: sectorId,
      gate: {
        destinationSectorId: targetSectorId,
        destinationGateId: targetGateId,
      },
    });
  }

  private getStationSpriteKey(type: StationType): string {
    if (type.startsWith('mining')) return 'station_mining';
    if (type === 'shipyard') return 'station_shipyard';
    if (type === 'factory_steel' || type === 'factory_fuel') return 'station_industry';
    if (type === 'factory_engine' || type === 'factory_sensors') return 'station_equipments';
    if (type === 'factory_electronics') return 'station_factory';
    return 'station';
  }

  private getStationNameSuffix(type: StationType): string {
    const displayMap: Record<string, string> = {
      trading: 'Outpost',
      mining_ore: 'Iron Mine',
      mining_gas: 'Gas Collector',
      mining_crystal: 'Crystal Siphon',
      factory_steel: 'Steelworks',
      factory_fuel: 'Refinery',
      factory_electronics: 'Chip Plant',
      factory_engine: 'Engine Fact.',
      factory_sensors: 'Sensor Lab',
      shipyard: 'Shipyard',
    };
    return displayMap[type] || 'Station';
  }
}
