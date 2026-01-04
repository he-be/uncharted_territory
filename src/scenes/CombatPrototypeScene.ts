import Phaser from 'phaser';
import { CombatAI } from './combat/CombatAI';
import { CombatPD } from './combat/CombatPD';
import { CombatMinimap } from './combat/CombatMinimap';

interface CombatConfig {
  playerDrones: number;
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
  // private debugText!: Phaser.GameObjects.Text; // Removed unused

  private enemies!: Phaser.Physics.Arcade.Group;
  private friendlies!: Phaser.Physics.Arcade.Group;
  private lasers!: Phaser.Physics.Arcade.Group;
  private pdProjectiles!: Phaser.Physics.Arcade.Group;

  // Modules
  private aiSystem!: CombatAI;
  private pdSystem!: CombatPD;
  private minimapSystem!: CombatMinimap;

  private config: CombatConfig = { playerDrones: 5, enemyDrones: 5, enemyCount: 1 };

  // --- Constants ---
  private readonly SCALE_SHIP = 0.05;
  private readonly SCALE_DRONE = 0.015;
  private readonly SCALE_LASER = 0.01;

  private readonly SPEED_PLAYER_MAX = 200;
  private readonly SPEED_PLAYER_ACCEL = 200;
  private readonly SPEED_PLAYER_ROTATION = 150;
  private readonly SPEED_LASER = 400;

  constructor() {
    super({ key: 'CombatPrototypeScene' });
  }

  init(data: Partial<CombatConfig>) {
    if (data && data.playerDrones !== undefined) {
      this.config = { ...this.config, ...data };
    }
  }

  preload() {
    this.load.image('player_ship', 'assets/player_ship.png');
    this.load.image('npc_pirate', 'assets/npc_pirate.png');
    this.load.image('npc_fighter', 'assets/npc_fighter.png');
    this.load.image('projectile_laser', 'assets/projectile_laser.png');
  }

  create() {
    console.log('[CombatPrototypeScene] Created (Refactored)');

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
    this.pdSystem = new CombatPD(this, this.pdProjectiles, this.lasers);
    this.minimapSystem = new CombatMinimap(this);

    // 4. Create Player
    this.player = this.physics.add.image(2000, 3500, 'player_ship');
    this.player.setScale(this.SCALE_SHIP);
    this.player.setDepth(10);
    this.player.setDrag(100);
    this.player.setAngularDrag(100);
    this.player.setMaxVelocity(this.SPEED_PLAYER_MAX);
    this.player.setCollideWorldBounds(true);

    this.player.setData('name', 'Player');
    this.player.setData('hp', 100);
    this.player.setData('maxHp', 100);
    this.player.setRotation(-Math.PI / 2);

    this.cameras.main.startFollow(this.player);

    this.minimapSystem.createSymbol(this.player, 'player');

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

    // 7. Setup Collisions
    this.physics.add.overlap(this.lasers, this.enemies, this.handleLaserHit, this.checkOwner, this);
    this.physics.add.overlap(this.lasers, this.player, this.handleLaserHit, this.checkOwner, this);
    this.physics.add.overlap(
      this.lasers,
      this.friendlies,
      this.handleLaserHit,
      this.checkOwner,
      this
    );
    // PD Collision Delegate
    this.physics.add.overlap(
      this.pdProjectiles,
      this.lasers,
      this.pdSystem.handleIntercept.bind(this.pdSystem), // Bind context!
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
    mother.setData('name', 'Enemy Mothership');
    mother.setData('hp', 1000);
    mother.setData('maxHp', 1000);
    mother.setRotation(Math.PI / 2);

    this.minimapSystem.createSymbol(mother, 'mother');
    this.cameras.getCamera('minimap')?.ignore(mother);

    // Enemy Drones
    for (let i = 0; i < this.config.enemyDrones; i++) {
      this.spawnDrone(mx, my, false);
    }

    // Friendly Drones
    for (let i = 0; i < this.config.playerDrones; i++) {
      this.spawnDrone(this.player.x, this.player.y, true);
    }
  }

  private spawnDrone(x: number, y: number, isFriendly: boolean) {
    const group = isFriendly ? this.friendlies : this.enemies;
    const drone = group.create(
      x + (Math.random() - 0.5) * 200,
      y + (Math.random() - 0.5) * 200,
      'npc_fighter'
    );

    drone.setScale(this.SCALE_DRONE);
    drone.setDepth(5);
    drone.setTint(isFriendly ? 0x00ff00 : 0xff0000);
    drone.setDrag(50);
    // Use MAX speed from Scene or pass constant? Scene property access is cleaner
    drone.setMaxVelocity(150); // Hardcoded SPEED_DRONE_MAX for simplicity

    drone.setData('name', isFriendly ? 'Ally Drone' : 'Enemy Drone');
    drone.setData('hp', 30);
    drone.setData('target', null);
    drone.setData('lastFired', 0);

    // Strafing Init
    drone.setData('strafeDir', Math.random() < 0.5 ? 1 : -1);
    drone.setData('nextStrafeTime', 0);

    this.minimapSystem.createSymbol(drone, isFriendly ? 'ally' : 'enemy');
    this.cameras.getCamera('minimap')?.ignore(drone);
  }

  update(time: number) {
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

    if (this.fireKey.isDown) {
      const lastFired = this.player.getData('lastFired') || 0;
      if (time > lastFired + 150) {
        // Manual Fire Logic (keep here or move to module?)
        // For player, keeping generic fireLaser here is fine for now
        // But AI module needs access.
        // Let's rely on standard fireLaser below.
        this.fireLaser(this.player);
        this.player.setData('lastFired', time);
      }
    }

    // --- Camera Zoom ---
    if (this.zoomKeys.z.isDown) {
      this.cameras.main.setZoom(Math.min(2, this.cameras.main.zoom + 0.01));
    } else if (this.zoomKeys.x.isDown) {
      this.cameras.main.setZoom(Math.max(0.1, this.cameras.main.zoom - 0.01));
    }

    // --- Module Updates ---
    this.aiSystem.update(time, this.friendlies, this.enemies, this.player);
    this.pdSystem.update(time, this.player, this.friendlies);

    // Use minimap system to sync
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

    // PD cleanup handled in module
  }

  // Exposed for AI Module usage if needed, or kept private here?
  // AI Module has its own 'fireLaser' impl for now to avoid dependency loops.
  // Ideally we share a helper.
  private fireLaser(source: Phaser.Physics.Arcade.Image) {
    if (!source.active) return;

    const offset = new Phaser.Math.Vector2().setToPolar(source.rotation, 60);
    const spawnX = source.x + offset.x;
    const spawnY = source.y + offset.y;

    const laser = this.lasers.create(spawnX, spawnY, 'projectile_laser');
    if (!laser) return;

    laser.setScale(this.SCALE_LASER);
    laser.setRotation(source.rotation);
    laser.setTint(0xffff00);

    laser.setData('owner', source);

    this.cameras.getCamera('minimap')?.ignore(laser);

    this.physics.velocityFromRotation(source.rotation, this.SPEED_LASER, laser.body.velocity);

    laser.body.enable = false;
    this.time.delayedCall(50, () => {
      if (laser.active) laser.body.enable = true;
    });

    this.time.delayedCall(2000, () => {
      if (laser.active) laser.destroy();
    });
  }

  // --- Collision Callbacks ---

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private checkOwner(obj1: any, obj2: any): boolean {
    const isL1 = obj1.texture.key === 'projectile_laser';
    const isL2 = obj2.texture.key === 'projectile_laser';

    if (isL1 && isL2) return false;
    if (!isL1 && !isL2) return true;

    const laser = isL1 ? obj1 : obj2;
    const target = isL1 ? obj2 : obj1;
    const owner = laser.getData('owner');

    if (owner === target) return false;

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
    const name = entity.getData('name') || 'Unknown Entity';

    if (hp === undefined) {
      console.warn(`[Combat] ${name} took damage but has undefined HP! Fixing...`);
      hp = 10;
    }

    hp -= amount;
    entity.setData('hp', hp);

    if (entity === this.player) {
      console.log(`[Player] HP: ${hp} (-${amount})`);
      this.hpText.setText(`HP: ${Math.max(0, hp)}`);
      this.cameras.main.shake(100, 0.005);
    }

    if (hp <= 0) {
      console.log(`[Combat] ${name} Destroyed.`);
      entity.destroy();
    } else {
      entity.setTint(0xffffff);
      this.time.delayedCall(50, () => {
        if (!entity.active) return;
        if (entity === this.player) entity.clearTint();
        else if (entity.getData('type') === 'mother') entity.setTint(0xff0000);
        else {
          const isFriendly = this.friendlies.contains(entity);
          entity.setTint(isFriendly ? 0x00ff00 : 0xff0000);
        }
      });
    }
  }
}
