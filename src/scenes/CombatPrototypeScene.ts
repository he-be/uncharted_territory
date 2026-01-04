import Phaser from 'phaser';

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

  private enemies!: Phaser.Physics.Arcade.Group;
  private friendlies!: Phaser.Physics.Arcade.Group;
  private lasers!: Phaser.Physics.Arcade.Group;

  private config: CombatConfig = { playerDrones: 5, enemyDrones: 5, enemyCount: 1 };

  // --- Constants ---
  private readonly SCALE_SHIP = 0.05;
  private readonly SCALE_DRONE = 0.015;
  private readonly SCALE_LASER = 0.01;

  private readonly SPEED_PLAYER_MAX = 200;
  private readonly SPEED_PLAYER_ACCEL = 200;
  private readonly SPEED_PLAYER_ROTATION = 150;

  private readonly SPEED_DRONE_MAX = 150;
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
    console.log('[CombatPrototypeScene] Created (V2 Clean Ver)');

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

    // 3. Create Player (Immediately init Data)
    this.player = this.physics.add.image(2000, 3500, 'player_ship');
    this.player.setScale(this.SCALE_SHIP);
    this.player.setDepth(10);
    this.player.setDrag(100);
    this.player.setAngularDrag(100);
    this.player.setMaxVelocity(this.SPEED_PLAYER_MAX);
    this.player.setCollideWorldBounds(true);

    // IMPORTANT: Init HP immediately
    this.player.setData('name', 'Player');
    this.player.setData('hp', 100);
    this.player.setData('maxHp', 100);

    // Fix: Start facing UP
    this.player.setRotation(-Math.PI / 2);

    this.cameras.main.startFollow(this.player);

    // 4. Setup Input
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.zoomKeys = {
        z: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
        x: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X),
      };
      this.fireKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    // 5. Spawn Enemies
    this.spawnEntities();

    // 6. Setup Collisions (Robust Handler)
    this.physics.add.overlap(this.lasers, this.enemies, this.handleLaserHit, this.checkOwner, this);
    this.physics.add.overlap(this.lasers, this.player, this.handleLaserHit, this.checkOwner, this);
    // Note: Friendly Fire disabled for now

    // 7. UI & Minimap
    this.createUI();
    this.createMinimap();
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

  private createMinimap() {
    const size = 320; // Increased by 60% (from 200)
    const margin = 20;
    const x = this.scale.width - size - margin;
    const y = this.scale.height - size - margin;

    // Zoom 0.08 covers 320/0.08 = 4000 world units (Perfect fit)
    const minimap = this.cameras.add(x, y, size, size).setZoom(0.08).setName('minimap');
    minimap.setBackgroundColor(0x000000);
    minimap.scrollX = 2000; // Center of world
    minimap.scrollY = 2000;
    minimap.ignore([this.hpText, this.statusText]);

    // Add a border for the minimap
    const graphics = this.add.graphics().setScrollFactor(0).setDepth(101);
    graphics.lineStyle(2, 0x00ff00);
    graphics.strokeRect(x, y, size, size);
  }

  private spawnEntities() {
    // Enemy Mothership
    const mx = 2000 + (Math.random() - 0.5) * 500;
    const my = 1000 + (Math.random() - 0.5) * 500;
    const mother = this.enemies.create(mx, my, 'npc_pirate');
    mother.setScale(this.SCALE_SHIP);
    mother.setTint(0xff0000);
    mother.setDepth(5);
    // Boss: Reduced Drag, allow movement but slow
    mother.setDrag(200);
    mother.setAngularDrag(100);
    mother.setMaxVelocity(30); // Very slow boss movement

    mother.setData('type', 'mother');
    mother.setData('name', 'Enemy Mothership');
    mother.setData('hp', 1000);
    mother.setData('maxHp', 1000);

    // Fix: Start facing DOWN
    mother.setRotation(Math.PI / 2);

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
    drone.setMaxVelocity(this.SPEED_DRONE_MAX);

    drone.setData('name', isFriendly ? 'Ally Drone' : 'Enemy Drone');
    drone.setData('hp', 30);
    drone.setData('target', null);
    drone.setData('lastFired', 0);
  }

  update(time: number) {
    // ... (Controls logic needs slight adjustment for UP-facing default?)
    // Phaser velocityFromRotation uses the object's rotation.
    // If we rotate the sprite, 'up' key adding acceleration in 'rotation' direction works if 'rotation' is correct.
    // HOWEVER, standard Phaser sprites face Right (0).
    // If we just set rotation to -90, 'VelocityFromRotation' will apply force UP.
    // So controls logic:
    // UP key -> Accelerate in facing direction. OK.
    // DOWN key -> Decelerate. OK.
    // LEFT key -> Rotate Counter-Clockwise. OK.
    // RIGHT key -> Rotate Clockwise. OK.
    // So existing control logic is actually fine as long as initial state is correct.

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

    if (Phaser.Input.Keyboard.JustDown(this.fireKey)) {
      this.fireLaser(this.player);
    }

    // --- Camera Zoom ---
    if (this.zoomKeys.z.isDown) {
      this.cameras.main.setZoom(Math.min(2, this.cameras.main.zoom + 0.01));
    } else if (this.zoomKeys.x.isDown) {
      this.cameras.main.setZoom(Math.max(0.1, this.cameras.main.zoom - 0.01));
    }

    // --- AI Updates ---
    // Restore Mothership Behavior
    // We handle mothership distinctly or just treat it as a heavy drone?
    // Let's modify updateAI to handle it.

    this.updateAI(this.friendlies, this.enemies.getChildren(), time);
    // Enemies target Player + Friendlies
    const allEnemies: Phaser.GameObjects.GameObject[] = [
      this.player,
      ...this.friendlies.getChildren(),
    ].filter((e) => e.active);
    this.updateAI(this.enemies, allEnemies, time);

    // --- Cleanup ---
    this.lasers.getChildren().forEach((l: Phaser.GameObjects.GameObject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const laser = l as any;
      if (laser.active) {
        // Out of bounds check
        if (laser.x < 0 || laser.x > 4000 || laser.y < 0 || laser.y > 4000) {
          laser.destroy();
        }
      }
    });

    // Update Minimap Position (optional, or keep static full view)
    // If map is static full view no update needed.
  }

  private updateAI(
    group: Phaser.Physics.Arcade.Group,
    validTargets: Phaser.GameObjects.GameObject[],
    time: number
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    group.getChildren().forEach((entity: any) => {
      if (!entity.active) return;

      const isMother = entity.getData('type') === 'mother';

      // 1. Acquire Target
      let target = entity.getData('target');
      if (!target || !target.active) {
        target = this.findNearestTarget(entity, validTargets);
        entity.setData('target', target);
      }

      // 2. Engage
      if (target && target.active) {
        const dist = Phaser.Math.Distance.Between(entity.x, entity.y, target.x, target.y);
        const angle = Phaser.Math.Angle.Between(entity.x, entity.y, target.x, target.y);

        // Mothership turns slowly
        if (isMother) {
          // Simple gradual turn
          // entity.rotation = Phaser.Math.Angle.RotateTo(entity.rotation, angle, 0.01);
          // For physics consistency, let's just snap rotation for now or use angular velocity?
          // Let's just set rotation to face target for accuracy
          entity.setRotation(angle);
        } else {
          entity.setRotation(angle);
        }

        if (isMother) {
          // Mothership Logic:
          // Stay distant. If too close, maybe back up? Or just sit there?
          // "Restore behavior" -> user likely wants it to move/engage.
          // Let's make it slowly move towards optimal range (800)
          if (dist > 800) {
            this.physics.velocityFromRotation(angle, 30, entity.body.acceleration);
          } else if (dist < 400) {
            this.physics.velocityFromRotation(angle, -10, entity.body.acceleration);
          } else {
            entity.setAcceleration(0);
          }
        } else {
          // Drone Logic (Orbit 200-400)
          if (dist > 400) {
            this.physics.velocityFromRotation(
              angle,
              this.SPEED_DRONE_MAX,
              entity.body.acceleration
            );
          } else if (dist < 200) {
            this.physics.velocityFromRotation(
              angle,
              -this.SPEED_DRONE_MAX * 0.5,
              entity.body.acceleration
            );
          } else {
            entity.setAcceleration(0);
          }
        }

        // Fire
        const range = isMother ? 1000 : 600;
        if (dist < range) {
          const lastFired = entity.getData('lastFired') || 0;
          // Mothership fires faster? Or same? Let's say slightly faster 800ms
          const cooldown = isMother ? 800 : 1000;

          if (time > lastFired + cooldown) {
            if (Math.random() < 0.5) {
              this.fireLaser(entity);
              entity.setData('lastFired', time);
            }
          }
        }
      } else {
        entity.setAcceleration(0); // Idle
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private findNearestTarget(source: any, targets: any[]): any {
    let nearest = null;
    let minD = 99999;
    for (const t of targets) {
      if (!t.active) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const target = t as any;
      const d = Phaser.Math.Distance.Between(source.x, source.y, target.x, target.y);
      if (d < minD) {
        minD = d;
        nearest = t;
      }
    }
    return nearest;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fireLaser(source: any) {
    if (!source.active) return;

    // Spawn Offset: 60px ahead to avoid self-collision
    const offset = new Phaser.Math.Vector2().setToPolar(source.rotation, 60);
    const spawnX = source.x + offset.x;
    const spawnY = source.y + offset.y;

    const laser = this.lasers.create(spawnX, spawnY, 'projectile_laser');
    if (!laser) return; // Pool empty

    laser.setScale(this.SCALE_LASER);
    laser.setRotation(source.rotation);
    laser.setTint(0xffff00);

    // Metadata for owner check
    laser.setData('owner', source);

    // Velocity
    this.physics.velocityFromRotation(source.rotation, this.SPEED_LASER, laser.body.velocity);
    // Add source velocity for momentum conservation? Optional. Let's keep it simple for now.
    // laser.body.velocity.x += source.body.velocity.x;
    // laser.body.velocity.y += source.body.velocity.y;

    // Safety: Disable body for 50ms to strictly prevent spawn overlap
    laser.body.enable = false;
    this.time.delayedCall(50, () => {
      if (laser.active) laser.body.enable = true;
    });

    // Life: 2 sec
    this.time.delayedCall(2000, () => {
      if (laser.active) laser.destroy();
    });
  }

  // --- Collision Callbacks ---

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private checkOwner(obj1: any, obj2: any): boolean {
    // Robustly determine which is laser
    const isL1 = obj1.texture.key === 'projectile_laser';
    const isL2 = obj2.texture.key === 'projectile_laser';

    if (isL1 && isL2) return false; // Laser vs Laser collision ignored (usually)
    if (!isL1 && !isL2) return true; // Entity vs Entity collision (allowed)

    const laser = isL1 ? obj1 : obj2;
    const target = isL1 ? obj2 : obj1;
    const owner = laser.getData('owner');

    // 1. Self Collision Check
    if (owner === target) return false;

    // 2. Friendly Fire Check (Optional)
    // If owner is Friendly and Target is Friendly/Player -> False
    // Leaving explicitly disabled for simplicity in this prototype phase
    // ...

    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleLaserHit(obj1: any, obj2: any) {
    const isL1 = obj1.texture.key === 'projectile_laser';
    const laser = isL1 ? obj1 : obj2;
    const target = isL1 ? obj2 : obj1;

    if (laser.active) laser.destroy();
    if (target.active) {
      this.takeDamage(target, 5); // Standard Damage 5
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

    // UI Update if Player
    if (entity === this.player) {
      console.log(`[Player] HP: ${hp} (-${amount})`);
      this.hpText.setText(`HP: ${Math.max(0, hp)}`);
      this.cameras.main.shake(100, 0.005);
    }

    // Death Check
    if (hp <= 0) {
      console.log(`[Combat] ${name} Destroyed.`);
      entity.destroy();
    } else {
      // Flash Effect
      entity.setTint(0xffffff);
      this.time.delayedCall(50, () => {
        if (!entity.active) return;
        // Restore Tint based on faction
        if (entity === this.player) entity.clearTint();
        else if (entity.getData('type') === 'mother')
          entity.setTint(0xff0000); // Keep Red
        else {
          const isFriendly = this.friendlies.contains(entity);
          entity.setTint(isFriendly ? 0x00ff00 : 0xff0000);
        }
      });
    }
  }
}
