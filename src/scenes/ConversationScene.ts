import Phaser from 'phaser';
import { AvatarSystem } from '../ui/AvatarSystem';
import type { AvatarEmotion } from '../ui/AvatarSystem';
import { TextStyles } from '../ui/FontConfig';

interface DialogueLine {
  text: string;
  emotion: AvatarEmotion;
  delay?: number;
}

export class ConversationScene extends Phaser.Scene {
  private avatarSystem!: AvatarSystem;
  private currentLineIndex = 0;
  private isTyping = false;

  private dialogueScript: DialogueLine[] = [
    { text: 'System initialized. Connection to pilot established.', emotion: 'normal' },
    { text: 'I have analyzed the flight data from the last engagement.', emotion: 'normal' },
    {
      text: 'Telemetry indicates you sustained 15% hull damage because you ignored my warning.',
      emotion: 'worried',
    },
    {
      text: 'That maneuver was incredibly reckless! Do not risk the ship like that again.',
      emotion: 'angry',
    },
    {
      text: 'However... your combat efficiency was above theoretical limits. Good work.',
      emotion: 'normal',
    },
  ];

  private backButton!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'ConversationScene' });
  }

  create() {
    // Background
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x111111).setOrigin(0);

    // Init Avatar System
    // We need to make sure the HTML elements exist or are cleared.
    this.avatarSystem = new AvatarSystem(this);
    this.avatarSystem.clear();
    this.avatarSystem.show();

    // Controls
    // Next Button (Click anywhere effectively, but let's add visual button)
    this.input.on('pointerdown', () => this.advanceDialogue());
    this.input.keyboard?.on('keydown-SPACE', () => this.advanceDialogue());

    // Back to Menu
    this.backButton = this.add
      .text(40, 40, '< Back to Title', {
        ...TextStyles.ui,
        color: '#aaaaaa',
      })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.avatarSystem.hide();
        this.scene.start('TitleScene');
      });

    this.backButton.on('pointerover', () => this.backButton.setColor('#ffffff'));
    this.backButton.on('pointerout', () => this.backButton.setColor('#aaaaaa'));

    // Start Conversation
    this.time.delayedCall(500, () => this.playLine(0));

    // Instructions
    this.add
      .text(
        this.scale.width / 2,
        this.scale.height - 50,
        'Click or Press Space to Continue',
        TextStyles.termSmall
      )
      .setOrigin(0.5)
      .setAlpha(0.5);
  }

  private async playLine(index: number) {
    if (index >= this.dialogueScript.length) {
      // Loop or End
      this.avatarSystem.speak('End of simulation. Returning to idle state.');
      this.currentLineIndex = -1; // Flag for end
      return;
    }

    const line = this.dialogueScript[index];
    this.currentLineIndex = index;
    this.isTyping = true;

    this.avatarSystem.setEmotion(line.emotion);
    await this.avatarSystem.speak(line.text);

    this.isTyping = false;
  }

  private advanceDialogue() {
    if (this.isTyping) {
      // Maybe instant finish? AvatarSystem doesn't support instant finish easily yet without hacking internals.
      // For now, ignore clicks while typing or let it be.
      return;
    }

    if (this.currentLineIndex === -1) {
      // Restart
      this.currentLineIndex = 0;
      this.avatarSystem.clear();
      this.playLine(0);
      return;
    }

    this.playLine(this.currentLineIndex + 1);
  }
}
