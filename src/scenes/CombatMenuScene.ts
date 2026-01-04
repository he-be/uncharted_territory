import Phaser from 'phaser';

export class CombatMenuScene extends Phaser.Scene {
  private playerDrones: number = 20;
  private enemyDrones: number = 20;
  private enemyCount: number = 1;

  constructor() {
    super({ key: 'CombatMenuScene' });
  }

  create() {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height * 0.2, 'DRONE WARFARE PROTOTYPE', {
        fontSize: '48px',
        color: '#00ff00',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.3, 'Arrow Keys: Move/Rotate | Space: Fire | Z/X: Zoom', {
        fontSize: '24px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);

    // Config Buttons (Simplified for prototype)
    this.createButton(width / 2, height * 0.5, `Player Drones: ${this.playerDrones}`, () => {
      this.playerDrones = (this.playerDrones + 10) % 60;
      if (this.playerDrones === 0) this.playerDrones = 10;
      this.scene.restart(); // Hacky redraw
    });

    this.createButton(width / 2, height * 0.6, `Enemy Drones: ${this.enemyDrones}`, () => {
      this.enemyDrones = (this.enemyDrones + 10) % 60;
      if (this.enemyDrones === 0) this.enemyDrones = 10;
      this.scene.restart();
    });

    this.createButton(
      width / 2,
      height * 0.8,
      'START BATTLE',
      () => {
        this.scene.start('CombatPrototypeScene', {
          playerDrones: this.playerDrones,
          enemyDrones: this.enemyDrones,
          enemyCount: this.enemyCount,
        });
      },
      '#ff0000'
    );
  }

  createButton(x: number, y: number, text: string, onClick: () => void, color = '#ffffff') {
    const textObj = this.add
      .text(x, y, text, {
        fontSize: '32px',
        color: color,
        backgroundColor: '#333333',
        padding: { x: 10, y: 5 },
      })
      .setInteractive()
      .setOrigin(0.5);

    textObj.on('pointerdown', onClick);
    textObj.on('pointerover', () => textObj.setStyle({ fill: '#ffff00' }));
    textObj.on('pointerout', () => textObj.setStyle({ fill: color }));
  }
}
