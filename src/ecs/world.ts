import { World } from 'miniplex';
import Phaser from 'phaser';
import type { ItemId } from '../data/items';
import type { StationType, ProductionRule } from '../data/stations';

export type Entity = {
  id: string; // UUID
  transform?: {
    x: number;
    y: number;
    rotation: number;
  };
  velocity?: {
    vx: number;
    vy: number;
  };
  sprite?: Phaser.GameObjects.Sprite | Phaser.GameObjects.Shape;
  playerControl?: boolean;

  station?: boolean;
  interactionRadius?: number;
  name?: string; // Station Name

  // Economy Components
  stationType?: StationType;
  inventory?: Partial<Record<ItemId, number>>;
  productionConfig?: ProductionRule;
  lastProductionTick?: number;

  // NPC Economy
  cargo?: Partial<Record<ItemId, number>>;

  // AI / NPC Components
  aiState?: 'IDLE' | 'MOVING' | 'DOCKING' | 'TRADING_BUY' | 'TRADING_SELL';
  target?: { x: number; y: number };
  targetStationId?: string; // ID of the station
  speedStats?: { maxSpeed: number; acceleration: number };
};

export const world = new World<Entity>();
