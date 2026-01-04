import Phaser from 'phaser';
import { CombatModule } from './CombatModule';
import type { ShipConfig } from './CombatStructure';
import { WeaponModule } from '../modules/WeaponModule';
import { PDModule } from '../modules/PDModule';
import { DroneBayModule } from '../modules/DroneBayModule';

export class CombatModuleManager {
  private scene: Phaser.Scene;
  private modules: Map<Phaser.GameObjects.GameObject, CombatModule[]> = new Map();

  // Dependencies passed from Scene
  private lasers: Phaser.Physics.Arcade.Group;
  private pdProjectiles: Phaser.Physics.Arcade.Group;
  private friendlies: Phaser.Physics.Arcade.Group;
  private enemies: Phaser.Physics.Arcade.Group;

  constructor(
    scene: Phaser.Scene,
    lasers: Phaser.Physics.Arcade.Group,
    pdProjectiles: Phaser.Physics.Arcade.Group,
    friendlies: Phaser.Physics.Arcade.Group,
    enemies: Phaser.Physics.Arcade.Group
  ) {
    this.scene = scene;
    this.lasers = lasers;
    this.pdProjectiles = pdProjectiles;
    this.friendlies = friendlies;
    this.enemies = enemies;
  }

  /**
   * Installs modules onto a ship based on its config.
   */
  installModules(ship: Phaser.GameObjects.GameObject, config: ShipConfig) {
    const installed: CombatModule[] = [];

    config.modules.forEach((modConfig) => {
      let mod: CombatModule | null = null;

      switch (modConfig.type) {
        case 'weapon':
          mod = new WeaponModule(this.scene, ship, modConfig, this.lasers);
          break;
        case 'pd':
          mod = new PDModule(this.scene, ship, modConfig, this.pdProjectiles, this.lasers);
          break;
        case 'drone_bay': {
          // Check faction to decide which group to spawn into
          const isFriendly =
            ship.getData('faction') === 'player' || ship.getData('faction') === 'ally';
          const targetGroup = isFriendly ? this.friendlies : this.enemies;
          mod = new DroneBayModule(this.scene, ship, modConfig, targetGroup);
          break;
        }
      }

      if (mod) {
        installed.push(mod);
      }
    });

    this.modules.set(ship, installed);

    // Auto-cleanup when ship is destroyed
    ship.on('destroy', () => {
      this.removeModules(ship);
    });
  }

  getModules(ship: Phaser.GameObjects.GameObject): CombatModule[] | undefined {
    return this.modules.get(ship);
  }

  // Specific helper for AI/Input to fire weapons
  fireWeapons(ship: Phaser.GameObjects.GameObject, time: number) {
    const mods = this.modules.get(ship);
    if (mods) {
      mods.forEach((m) => {
        if (m instanceof WeaponModule) {
          m.fire(time);
        }
      });
    }
  }

  update(time: number, delta: number) {
    this.modules.forEach((mods, ship) => {
      if (!ship.active) return;
      mods.forEach((mod) => mod.update(time, delta));
    });
  }

  private removeModules(ship: Phaser.GameObjects.GameObject) {
    if (this.modules.has(ship)) {
      const mods = this.modules.get(ship)!;
      mods.forEach((m) => m.destroy());
      this.modules.delete(ship);
    }
  }
}
