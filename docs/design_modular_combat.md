# Design: Modular Combat System

## 1. Overview

The goal is to transition from a hardcoded combat system to a modular one where ships (Player & Enemy) are containers for independent `Modules`.
This allows for:

- **Customization**: Player can equip different weapons/defenses before battle.
- **Variety**: Enemies can have distinct loadouts.
- **Maintainability**: Fire control logic is isolated per module.

## 2. Core Architecture

### 2.1. `Ship` Interface

Instead of `CombatPrototypeScene` managing strict behavior, entities will be wrapped or have data structured as:

```typescript
interface ShipConfig {
  type: 'player' | 'mother' | 'drone';
  hp: number;
  modules: ModuleConfig[];
}

interface ModuleConfig {
  type: 'weapon' | 'shield' | 'pd' | 'drone_bay';
  id: string; // e.g., 'laser_mk1', 'pd_basic'
  slot: string; // e.g., 'front', 'turret_1'
  params?: any; // Overrides
}
```

### 2.2. `CombatModule` Base Class

Abstract base class for all attachments.

```typescript
abstract class CombatModule {
  protected parent: Phaser.Physics.Arcade.Image;
  protected scene: Phaser.Scene;

  // Lifecycle
  update(time: number, delta: number);

  // Core actions
  fire();
  // etc.
}
```

### 2.3. Specific Modules

1.  **WeaponModule**: Handles cooldown, projectile spawning (`fireLaser`), targeting (optional for turrets).
2.  **PDModule**: The logic currently in `CombatPD.ts`, but attached to a specific ship.
3.  **DroneBayModule**: Handles spawning and replacing drones (`spawnDrone`).

## 3. Scene Changes (`CombatPrototypeScene`)

- **Remove**:
  - `fireLaser()` (Move to `WeaponModule`)
  - `spawnDrone()` (Move to `DroneBayModule`)
  - `pdSystem` (Replaced by `PDModule` instances on the ship)
- **Add**:
  - `ModuleManager`: A system to update all active modules on all active ships.
  - `Loadout`: Passed via `init(data)` from the Menu.

## 4. UI Changes (`CombatMenuScene`)

- **Loadout Selection**:
  - Simple cycle buttons for "Primary Weapon" (Laser / Plasma / Railgun?)
  - Cycle buttons for "Defense" (Shield / PD / None)
  - Cycle buttons for "Special" (Drone Bay / Missiles)
- **Data Passing**:
  - Assemble a `CombatConfig` object to pass to the game scene.

## 5. Implementation Steps

1.  **Define Interfaces**: Create `src/combat/core/` for types.
2.  **Create Module Classes**: Implement `WeaponModule`, `PDModule`.
3.  **Refactor Player**: Attach modules to player based on config.
4.  **Refactor UI**: Add selectors in `CombatMenuScene`.
5.  **Verify**: Test different loadouts.
