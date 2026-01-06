import Phaser from 'phaser';
import { TextStyles } from '../ui/FontConfig';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    // Force hide persistent UI overlays
    const avatarUI = document.getElementById('avatar-ui');
    if (avatarUI) avatarUI.classList.remove('visible');

    const resultOverlay = document.getElementById('result-overlay');
    if (resultOverlay) resultOverlay.style.display = 'none';

    const { width, height } = this.scale;

    // Background (Optional: Stars or just black)
    this.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0);

    // Title
    this.add
      .text(width / 2, height * 0.2, 'UNCHARTED TERRITORY\nPROTOTYPES', {
        ...TextStyles.uiHeader,
        fontSize: '48px',
        align: 'center',
        color: '#00ffff',
      })
      .setOrigin(0.5);

    // Button: Combat Mini-game
    this.createButton(width / 2, height * 0.5, 'Combat Mini-game', () => {
      this.scene.start('CombatMenuScene');
    });

    // Button: Conversation Demo
    this.createButton(width / 2, height * 0.65, 'ALVA Conversation Demo', () => {
      this.scene.start('ConversationScene');
    });

    // Footer
    this.add
      .text(width / 2, height * 0.95, 'v0.2.0 - Prototype Build', TextStyles.termSmall)
      .setOrigin(0.5)
      .setAlpha(0.5);
  }

  private createButton(x: number, y: number, text: string, onClick: () => void) {
    const btn = this.add
      .text(x, y, text, {
        ...TextStyles.uiButton,
        backgroundColor: '#222222',
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    btn.on('pointerdown', onClick);
    btn.on('pointerover', () => btn.setStyle({ fill: '#ffff00', backgroundColor: '#444444' }));
    btn.on('pointerout', () =>
      btn.setStyle({ fill: TextStyles.uiButton.color, backgroundColor: '#222222' })
    );
  }
}
