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
  wallet?: number;
  totalProfit?: number;

  // AI / NPC Components
  aiState?: 'PLANNING' | 'EXECUTING_TRADE';
  tradeRoute?: {
    buyStationId: string;
    sellStationId: string;
    itemId: ItemId;
    state: 'MOVING_TO_BUY' | 'BUYING' | 'MOVING_TO_SELL' | 'SELLING';
  };

  target?: { x: number; y: number };
  targetStationId?: string; // Legacy/Fallback?
  speedStats?: { maxSpeed: number; acceleration: number };

  // Visuals
  textOverlay?: Phaser.GameObjects.Text;
};

export const world = new World<Entity>();
