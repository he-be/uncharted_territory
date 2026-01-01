import { World } from 'miniplex';
import Phaser from 'phaser';

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
};

export const world = new World<Entity>();
