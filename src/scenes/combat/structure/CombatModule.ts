import Phaser from 'phaser';
import type { ModuleConfig } from './CombatStructure';

export abstract class CombatModule {
  protected scene: Phaser.Scene;
  protected parent: Phaser.GameObjects.GameObject; // The ship this is attached to
  protected config: ModuleConfig;

  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.GameObject, config: ModuleConfig) {
    this.scene = scene;
    this.parent = parent;
    this.config = config;
  }

  // Called every frame by the ModuleManager
  abstract update(time: number, delta: number): void;

  // Cleanup
  destroy(): void {}
}
