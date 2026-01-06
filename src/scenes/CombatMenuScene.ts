import Phaser from 'phaser';
import type { ModuleConfig } from './combat/structure/CombatStructure';
import { FontConfig } from '../ui/FontConfig';

interface WeaponOption {
  name: string;
  id: string;
  type: 'weapon';
  cooldown: number;
}
interface DefenseOption {
  name: string;
  id: string;
  type: 'none' | 'pd';
  range?: number;
  cooldown?: number;
}
interface SupportOption {
  name: string;
  id: string;
  type: 'none' | 'drone_bay';
  count?: number;
}

export class CombatMenuScene extends Phaser.Scene {
  // Loadout State
  private primaryWeaponIdx = 0;
  private defenseIdx = 0;
  private supportIdx = 0;

  private primaryOptions: WeaponOption[] = [
    { name: 'Standard Laser', id: 'laser_mk1', type: 'weapon', cooldown: 100 },
    { name: 'Rapid Pulse', id: 'laser_rapid', type: 'weapon', cooldown: 20 },
    { name: 'Heavy Beam', id: 'laser_heavy', type: 'weapon', cooldown: 200 },
  ];

  private defenseOptions: DefenseOption[] = [
    { name: 'None', id: 'none', type: 'none' },
    { name: 'Point Defense (Basic)', id: 'pd_basic', type: 'pd', range: 500, cooldown: 20 },
    { name: 'Point Defense (Adv)', id: 'pd_adv', type: 'pd', range: 600, cooldown: 10 },
  ];

  private supportOptions: SupportOption[] = [
    { name: 'None', id: 'none', type: 'none' },
    { name: 'Drone Bay (25)', id: 'drone_bay_25', type: 'drone_bay', count: 25 },
    { name: 'Drone Bay (50)', id: 'drone_bay_50', type: 'drone_bay', count: 50 },
  ];

  constructor() {
    super({ key: 'CombatMenuScene' });
  }

  preload() {
    this.load.audio('bgm_briefing', 'assets/audio/mission_briefing_2.mp3');
  }

  create() {
    // Play BGM
    if (!this.sound.get('bgm_briefing')) {
      this.sound.play('bgm_briefing', { loop: true, volume: 0.5 });
    } else if (!this.sound.get('bgm_briefing').isPlaying) {
      this.sound.play('bgm_briefing', { loop: true, volume: 0.5 });
    }

    const { width, height } = this.scale;

    // Force hide HTML UI layer defined in index.html
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) {
      uiLayer.style.display = 'none';
    }

    this.add
      .text(width / 2, height * 0.1, 'SHIP LOADOUT', {
        fontFamily: FontConfig.familyUI,
        fontSize: '48px',
        color: '#00ff00',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // Status text for Audio Check
    this.add
      .text(width / 2, height * 0.95, 'Audio Check: BGM Playing...', {
        fontFamily: FontConfig.familyUI,
        fontSize: '16px',
        color: '#00ffff',
      })
      .setOrigin(0.5);

    // Primary Weapon Selector
    this.createSelector(
      width / 2,
      height * 0.3,
      'Primary Weapon',
      () => this.primaryOptions[this.primaryWeaponIdx].name,
      () => {
        this.primaryWeaponIdx = (this.primaryWeaponIdx + 1) % this.primaryOptions.length;
        this.scene.restart();
      }
    );

    // Defense Selector
    this.createSelector(
      width / 2,
      height * 0.45,
      'Defense System',
      () => this.defenseOptions[this.defenseIdx].name,
      () => {
        this.defenseIdx = (this.defenseIdx + 1) % this.defenseOptions.length;
        this.scene.restart();
      }
    );

    // Support Selector
    this.createSelector(
      width / 2,
      height * 0.6,
      'Support Module',
      () => this.supportOptions[this.supportIdx].name,
      () => {
        this.supportIdx = (this.supportIdx + 1) % this.supportOptions.length;
        this.scene.restart();
      }
    );

    // Start Button
    this.createButton(
      width / 2,
      height * 0.85,
      'ENGAGE SYSTEMS',
      () => {
        // Do NOT stop BGM to keep AudioContext active
        // this.sound.stopAll();

        const modules: ModuleConfig[] = this.buildLoadout();
        this.scene.start('CombatPrototypeScene', {
          playerModules: modules,
          enemyDrones: 20, // Keep simple for enemy for now, or randomize later
          enemyCount: 1,
        });
      },
      '#ff0000'
    );

    // Back Button
    this.createButton(
      width / 2,
      height * 0.92,
      '< BACK',
      () => {
        this.scene.start('TitleScene');
      },
      '#aaaaaa'
    );
  }

  private buildLoadout(): ModuleConfig[] {
    const modules: ModuleConfig[] = [];

    // Weapon
    const wpn = this.primaryOptions[this.primaryWeaponIdx];
    modules.push({
      id: wpn.id,
      type: 'weapon',
      slot: 'front',
      offset: { x: 0, y: 0 },
      params: { cooldown: wpn.cooldown },
    });

    // Defense
    const def = this.defenseOptions[this.defenseIdx];
    if (def.type !== 'none') {
      // Equip 2 PDs for coverage? Or just 1? Let's say 1 for now.
      modules.push({
        id: def.id,
        type: 'pd',
        slot: 'turret',
        offset: { x: 0, y: 0 },
        params: { range: def.range, cooldown: def.cooldown },
      });
    }

    // Support
    const sup = this.supportOptions[this.supportIdx];
    if (sup.type !== 'none') {
      modules.push({
        id: sup.id,
        type: 'drone_bay',
        slot: 'internal',
        params: { count: sup.count },
      });
    }

    return modules;
  }

  private createSelector(
    x: number,
    y: number,
    label: string,
    getValue: () => string,
    onNext: () => void
  ) {
    this.add
      .text(x, y - 25, label, {
        fontFamily: FontConfig.familyUI,
        fontSize: '20px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);

    const valueText = this.add
      .text(x, y + 10, `< ${getValue()} >`, {
        fontFamily: FontConfig.familyUI,
        fontSize: '32px',
        color: '#ffffff',
        backgroundColor: '#333333',
        padding: { x: 10, y: 5 },
      })
      .setInteractive()
      .setOrigin(0.5);

    valueText.on('pointerdown', onNext);
    valueText.on('pointerover', () => valueText.setStyle({ fill: '#ffff00' }));
    valueText.on('pointerout', () => valueText.setStyle({ fill: '#ffffff' }));
  }

  private createButton(x: number, y: number, text: string, onClick: () => void, color = '#ffffff') {
    const textObj = this.add
      .text(x, y, text, {
        fontFamily: FontConfig.familyUI,
        fontSize: '32px',
        color: color,
        backgroundColor: '#333333',
        padding: { x: 20, y: 10 },
      })
      .setInteractive()
      .setOrigin(0.5);

    textObj.on('pointerdown', onClick);
    textObj.on('pointerover', () => textObj.setStyle({ fill: '#ffff00' }));
    textObj.on('pointerout', () => textObj.setStyle({ fill: color }));
  }
}
