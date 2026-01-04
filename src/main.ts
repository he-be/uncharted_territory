import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';
import { SectorMapScene } from './scenes/SectorMapScene';
import { UIScene } from './scenes/UIScene';
import { CombatMenuScene } from './scenes/CombatMenuScene';
import { CombatPrototypeScene } from './scenes/CombatPrototypeScene';
import './style.css';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  // @ts-expect-error Phaser type definition is missing 'resolution' property
  resolution: 1, // Force 1:1 pixel mapping (Fix for Retina 30fps)
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [CombatMenuScene, CombatPrototypeScene, MainScene, SectorMapScene, UIScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
  },
};

new Phaser.Game(config);
