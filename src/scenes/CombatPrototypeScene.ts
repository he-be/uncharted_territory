import Phaser from 'phaser';
import { CombatAI } from './combat/CombatAI';
import { CombatMinimap } from './combat/CombatMinimap';
import { CombatModuleManager } from './combat/structure/ModuleManager';
import type { ModuleConfig } from './combat/structure/CombatStructure';

interface CombatConfig {
  playerModules: ModuleConfig[];
  playerDrones: number; // For legacy or fallback
  enemyDrones: number;
  enemyCount: number;
}

export class CombatPrototypeScene extends Phaser.Scene {
  // --- Properties ---
  private player!: Phaser.Physics.Arcade.Image;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private zoomKeys!: { z: Phaser.Input.Keyboard.Key; x: Phaser.Input.Keyboard.Key };
  private fireKey!: Phaser.Input.Keyboard.Key;

  private hpText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  private enemies!: Phaser.Physics.Arcade.Group;
  private friendlies!: Phaser.Physics.Arcade.Group;
  private lasers!: Phaser.Physics.Arcade.Group;
  private pdProjectiles!: Phaser.Physics.Arcade.Group;

  // Modules
  private aiSystem!: CombatAI;
  private moduleManager!: CombatModuleManager; // New Manager
  private minimapSystem!: CombatMinimap;

  // Default config if not passed
  private config: CombatConfig = {
    playerModules: [],
    playerDrones: 0,
    enemyDrones: 5,
    enemyCount: 1,
  };

  // --- Constants ---
  private readonly SCALE_SHIP = 0.05;
  // private readonly SCALE_LASER = 0.01; // Now managed by WeaponModule

  private readonly SPEED_PLAYER_MAX = 200;
  private readonly SPEED_PLAYER_ACCEL = 200;
  private readonly SPEED_PLAYER_ROTATION = 150;

  constructor() {
    super({ key: 'CombatPrototypeScene' });
  }

  init(data: Partial<CombatConfig>) {
    // Merge config
    if (data) {
      this.config = { ...this.config, ...data };
    }

    // Fallback: If no modules passed, equip default
    if (!this.config.playerModules || this.config.playerModules.length === 0) {
      this.config.playerModules = [
        { id: 'default_laser', type: 'weapon', slot: 'front', params: { cooldown: 500 } },
      ];
    }
  }

  preload() {
    this.load.image('player_ship', 'assets/player_ship.png');
    this.load.image('npc_pirate', 'assets/npc_pirate.png');
    this.load.image('npc_fighter', 'assets/drone_fighter_A.png');
    this.load.image('projectile_laser', 'assets/projectile_laser.png');
  }

  create() {
    console.log('[CombatPrototypeScene] Created (Modular)');

    // Generate PD texture if missing (Yellow Bar)
    if (!this.textures.exists('projectile_pd')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xffff00, 1);
      g.fillRect(0, 0, 2, 16);
      g.generateTexture('projectile_pd', 2, 16);
    }

    // 1. Setup World
    this.physics.world.setBounds(0, 0, 4000, 4000);
    this.add.tileSprite(0, 0, 4000, 4000, 'bg_stars').setOrigin(0).setAlpha(0.2);

    // 2. Setup Groups
    this.enemies = this.physics.add.group({ enable: true, runChildUpdate: true });
    this.friendlies = this.physics.add.group({ enable: true, runChildUpdate: true });
    this.lasers = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 100,
      runChildUpdate: true,
    });
    this.pdProjectiles = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 50,
      runChildUpdate: true,
    });

    // 3. Init Modules
    this.aiSystem = new CombatAI(this, this.lasers);
    this.minimapSystem = new CombatMinimap(this);

    // Module Manager
    this.moduleManager = new CombatModuleManager(
      this,
      this.lasers,
      this.pdProjectiles,
      this.friendlies,
      this.enemies
    );

    // 4. Create Player
    this.player = this.physics.add.image(2000, 3500, 'player_ship');
    this.player.setScale(this.SCALE_SHIP);
    this.player.setDepth(10);
    this.player.setDrag(100);
    this.player.setAngularDrag(100);
    this.player.setMaxVelocity(this.SPEED_PLAYER_MAX);
    this.player.setCollideWorldBounds(true);

    this.player.setData('name', 'Player');
    this.player.setData('faction', 'player');
    this.player.setData('hp', 100);
    this.player.setData('maxHp', 100);
    this.player.setRotation(-Math.PI / 2);

    this.cameras.main.startFollow(this.player);
    this.minimapSystem.createSymbol(this.player, 'player');

    // 4b. Install Player Modules
    this.moduleManager.installModules(this.player, {
      type: 'player',
      name: 'Player Ship',
      hp: 100,
      modules: this.config.playerModules,
    });

    // 5. Setup Input
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.zoomKeys = {
        z: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
        x: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X),
      };
      this.fireKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    // 6. Spawn Enemies
    this.spawnEntities();

    // Listener for Drone Bay spawns
    this.events.on('spawn_drone', (drone: Phaser.GameObjects.GameObject, isFriendly: boolean) => {
      this.minimapSystem.createSymbol(drone, isFriendly ? 'ally' : 'enemy');
      this.cameras.getCamera('minimap')?.ignore(drone);
    });

    // 7. Setup Collisions

    // Ship Collisions (Push/Bounce, No Damage)
    this.physics.add.collider(this.player, this.enemies);
    this.physics.add.collider(this.player, this.friendlies);
    this.physics.add.collider(this.enemies, this.friendlies);
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.collider(this.friendlies, this.friendlies);

    this.physics.add.overlap(this.lasers, this.enemies, this.handleLaserHit, this.checkOwner, this);
    this.physics.add.overlap(this.lasers, this.player, this.handleLaserHit, this.checkOwner, this);
    this.physics.add.overlap(
      this.lasers,
      this.friendlies,
      this.handleLaserHit,
      this.checkOwner,
      this
    );

    // PD Intercept Global Collision
    this.physics.add.overlap(
      this.pdProjectiles,
      this.lasers,
      (pd, laser) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = pd as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const l = laser as any;

        // Verify Hostility
        const pdOwner = p.getData('owner');
        const laserOwner = l.getData('owner');

        let areHostile = true;

        if (pdOwner && laserOwner) {
          const f1 = pdOwner.getData('faction');
          const f2 = laserOwner.getData('faction');
          if (f1 && f2) {
            const isAmicable =
              (f1 === 'player' || f1 === 'ally') && (f2 === 'player' || f2 === 'ally');
            const isBothEnemy = f1 === 'enemy' && f2 === 'enemy';
            if (isAmicable || isBothEnemy) areHostile = false;
          }
        }

        // If hostile, destroy both (Intercept success)
        if (areHostile) {
          if (p.active) p.destroy();
          if (l.active) l.destroy();
        }
      },
      undefined,
      this
    );

    // 8. UI & Minimap
    this.createUI();
    this.minimapSystem.create([
      this.hpText,
      this.statusText,
      this.player,
      this.enemies,
      this.friendlies,
      this.lasers,
      this.pdProjectiles,
    ]);
  }

  private createUI() {
    this.hpText = this.add
      .text(10, 10, 'HP: 100', { fontSize: '32px', color: '#00ff00' })
      .setScrollFactor(0)
      .setDepth(100);
    this.statusText = this.add
      .text(10, 50, 'System: Normal', { fontSize: '16px', color: '#ffffff' })
      .setScrollFactor(0)
      .setDepth(100);
  }

  private spawnEntities() {
    // Enemy Mothership
    const mx = 2000 + (Math.random() - 0.5) * 500;
    const my = 1000 + (Math.random() - 0.5) * 500;
    const mother = this.enemies.create(mx, my, 'npc_pirate');
    mother.setScale(this.SCALE_SHIP);
    mother.setTint(0xff0000);
    mother.setDepth(5);
    mother.setDrag(200);
    mother.setAngularDrag(100);
    mother.setMaxVelocity(30);

    mother.setData('type', 'mother');
    mother.setData('faction', 'enemy');
    mother.setData('name', 'Enemy Mothership');
    mother.setData('hp', 1000);
    mother.setData('maxHp', 1000);
    mother.setRotation(Math.PI / 2);

    this.minimapSystem.createSymbol(mother, 'mother');
    this.cameras.getCamera('minimap')?.ignore(mother);

    // Install Mother Modules (Standard Loadout)
    this.moduleManager.installModules(mother, {
      type: 'mother',
      name: 'Enemy Mothership',
      hp: 1000,
      modules: [
        { id: 'boss_laser', type: 'weapon', slot: 'turret', params: { cooldown: 800 } },
        {
          id: 'drone_bay_enemy',
          type: 'drone_bay',
          slot: 'internal',
          params: { count: this.config.enemyDrones },
        },
      ],
    });
  }

  update(time: number, delta: number) {
    if (!this.player.active) {
      this.statusText.setText('System: CRITICAL FAILURE (Player Destroyed)');
      return;
    }

    // --- Player Controls ---
    if (this.cursors.up.isDown) {
      this.physics.velocityFromRotation(
        this.player.rotation,
        this.SPEED_PLAYER_ACCEL,
        (this.player.body as Phaser.Physics.Arcade.Body).acceleration
      );
    } else if (this.cursors.down.isDown) {
      this.physics.velocityFromRotation(
        this.player.rotation,
        -this.SPEED_PLAYER_ACCEL * 0.5,
        (this.player.body as Phaser.Physics.Arcade.Body).acceleration
      );
    } else {
      this.player.setAcceleration(0);
    }

    if (this.cursors.left.isDown) {
      this.player.setAngularVelocity(-this.SPEED_PLAYER_ROTATION);
    } else if (this.cursors.right.isDown) {
      this.player.setAngularVelocity(this.SPEED_PLAYER_ROTATION);
    } else {
      this.player.setAngularVelocity(0);
    }

    // Fire Control delegated to ModuleManager
    if (this.fireKey.isDown) {
      this.moduleManager.fireWeapons(this.player, time);
    }

    // --- Camera Zoom ---
    if (this.zoomKeys.z.isDown) {
      this.cameras.main.setZoom(Math.min(2, this.cameras.main.zoom + 0.01));
    } else if (this.zoomKeys.x.isDown) {
      this.cameras.main.setZoom(Math.max(0.1, this.cameras.main.zoom - 0.01));
    }

    // --- System Updates ---
    this.aiSystem.update(time, this.friendlies, this.enemies, this.player);
    this.moduleManager.update(time, delta); // Modules update (PD, DroneBays, Coolowns)

    // Sync Minimap
    this.minimapSystem.update([
      ...this.friendlies.getChildren(),
      ...this.enemies.getChildren(),
      this.player,
    ]);

    // --- Cleanup ---
    this.lasers.getChildren().forEach((l: Phaser.GameObjects.GameObject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const laser = l as any;
      if (laser.active) {
        if (laser.x < 0 || laser.x > 4000 || laser.y < 0 || laser.y > 4000) {
          laser.destroy();
        }
      }
    });
  }

  // --- Collision Callbacks ---

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private checkOwner(obj1: any, obj2: any): boolean {
    const isL1 = obj1.texture.key === 'projectile_laser';
    const isL2 = obj2.texture.key === 'projectile_laser';

    if (isL1 && isL2) return false;
    if (!isL1 && !isL2) return true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const laser = (isL1 ? obj1 : obj2) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const target = (isL1 ? obj2 : obj1) as any;

    const owner = laser.getData('owner');

    if (owner === target) return false;

    // Use Faction Data if available
    const ownerFaction = owner && owner.getData ? owner.getData('faction') : null;
    const targetFaction = target && target.getData ? target.getData('faction') : null;

    if (ownerFaction && targetFaction) {
      // Player and Ally are same faction "side"?
      // Let's simplify: 'player' and 'ally' are friends. 'enemy' is enemy.
      const isOwnerFriendly = ownerFaction === 'player' || ownerFaction === 'ally';
      const isTargetFriendly = targetFaction === 'player' || targetFaction === 'ally';
      return isOwnerFriendly !== isTargetFriendly;
    }

    // Fallback to group check
    const isOwnerPlayerSide = owner === this.player || this.friendlies.contains(owner);
    const isTargetPlayerSide = target === this.player || this.friendlies.contains(target);

    return isOwnerPlayerSide !== isTargetPlayerSide;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleLaserHit(obj1: any, obj2: any) {
    const isL1 = obj1.texture.key === 'projectile_laser';
    const laser = isL1 ? obj1 : obj2;
    const target = isL1 ? obj2 : obj1;

    if (laser.active) laser.destroy();
    if (target.active) {
      this.takeDamage(target, 5);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private takeDamage(entity: any, amount: number) {
    let hp = entity.getData('hp');
    // const name = entity.getData('name') || 'Unknown Entity';

    if (hp === undefined) {
      hp = 10;
    }

    hp -= amount;
    entity.setData('hp', hp);

    if (entity === this.player) {
      this.hpText.setText(`HP: ${Math.max(0, hp)}`);
      this.cameras.main.shake(100, 0.005);
    }

    if (hp <= 0) {
      // If entity has modules, module manager will auto-cleanup via 'destroy' event on entity
      // But we should verify.
      entity.destroy();
    } else {
      entity.setTint(0xffffff);
      this.time.delayedCall(50, () => {
        if (!entity.active) return;
        // Restore Tint
        const faction = entity.getData('faction');
        const type = entity.getData('type');

        if (faction === 'player') {
          if (type === 'drone') entity.setTint(0x00ff00);
          else entity.clearTint();
        } else if (faction === 'enemy') entity.setTint(0xff0000);
        else if (faction === 'ally') entity.setTint(0x00ff00);
      });
    }
  }
}
