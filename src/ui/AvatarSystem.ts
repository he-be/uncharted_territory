export type AvatarEmotion = 'normal' | 'worried' | 'angry';

export class AvatarSystem {
  private container!: HTMLElement;
  private output!: HTMLElement;
  private avatarImg!: HTMLImageElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private talkingInterval: any = null;
  private isMouthOpen: boolean = false;

  // Emotion State
  private currentEmotion: AvatarEmotion = 'normal';

  private readonly ASSETS: Record<AvatarEmotion, { idle: string; talk: string }> = {
    normal: { idle: '/assets/ui/c_alva_no_1.png', talk: '/assets/ui/c_alva_no_2.png' },
    worried: { idle: '/assets/ui/c_alva_no_3.png', talk: '/assets/ui/c_alva_no_4.png' },
    angry: { idle: '/assets/ui/c_alva_no_5.png', talk: '/assets/ui/c_alva_no_6.png' },
  };

  private readonly NAME = 'A.L.V.A.';

  private beepBuffer: AudioBuffer | null = null;
  private audioCtx: AudioContext | null = null;
  private scene: Phaser.Scene | null = null;

  constructor(scene?: Phaser.Scene) {
    if (scene) {
      this.scene = scene;
      console.log('[AvatarSystem] Initialized with Phaser Scene');
    } else {
      console.warn('[AvatarSystem] No scene provided. Fallback mode.');
      this.initAudio();
    }

    if (this.scene) {
      if (this.scene.sound && this.scene.sound instanceof Phaser.Sound.WebAudioSoundManager) {
        this.audioCtx = this.scene.sound.context;
        this.generateBeepBuffer();
        // Register to Phaser Cache
        if (this.beepBuffer && !this.scene.cache.audio.exists('alva_beep')) {
          this.scene.cache.audio.add('alva_beep', this.beepBuffer);
          // console.log('[AvatarSystem] Registered beep to Phaser Cache');
        }
      }
    } else if (this.audioCtx) {
      this.generateBeepBuffer();
    }

    this.createDOM();
    this.preloadImages();

    // Legacy fallback listeners only if no scene
    if (!this.scene) {
      const resumeHandler = () => {
        this.resumeAudio();
      };
      document.addEventListener('click', resumeHandler);
      document.addEventListener('keydown', resumeHandler);
    } else {
      // Auto-cleanup on scene shutdown
      this.scene.events.on('shutdown', () => {
        this.hide();
        this.stopTalking();
      });
    }
  }

  private generateBeepBuffer() {
    if (!this.audioCtx) return;

    // Create a 50ms buffer
    const duration = 0.05;
    const sampleRate = this.audioCtx.sampleRate;
    const frames = sampleRate * duration;
    const buffer = this.audioCtx.createBuffer(1, frames, sampleRate);
    const data = buffer.getChannelData(0);

    // Fill with square wave + decay
    for (let i = 0; i < frames; i++) {
      const t = i / sampleRate;
      // Frequency 800Hz
      const freq = 800;
      const val = Math.sign(Math.sin(2 * Math.PI * freq * t));

      // Linear decay for volume
      const volume = 0.5 * (1 - i / frames); // 0.5 Max Volume
      data[i] = val * volume;
    }

    this.beepBuffer = buffer;
  }

  private initAudio() {
    if (this.audioCtx) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const WinAudio = window.AudioContext || (window as any).webkitAudioContext;
    if (WinAudio) {
      try {
        this.audioCtx = new WinAudio();
        this.generateBeepBuffer();
      } catch (e) {
        console.error('[AvatarSystem] Init failed:', e);
      }
    }
  }

  private resumeAudio() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  private preloadImages() {
    Object.values(this.ASSETS).forEach((set) => {
      const img1 = new Image();
      img1.src = set.idle;
      const img2 = new Image();
      img2.src = set.talk;
    });
  }

  private playBeep() {
    // 1. Phaser Native Way (Best Stability)
    if (this.scene) {
      try {
        // Check if sound exists in cache, if not try to re-add
        if (!this.scene.cache.audio.exists('alva_beep') && this.beepBuffer) {
          this.scene.cache.audio.add('alva_beep', this.beepBuffer);
        }

        // Play using Phaser Sound Manager
        this.scene.sound.play('alva_beep', { volume: 0.5 });
        return;
      } catch (e) {
        console.warn('[AvatarSystem] Phaser play failed, fallback:', e);
      }
    }

    // 2. Fallback Raw Context Way
    if (!this.audioCtx) {
      this.initAudio();
    }

    if (this.audioCtx && !this.beepBuffer) {
      this.generateBeepBuffer();
    }

    if (!this.audioCtx || !this.beepBuffer) return;

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    try {
      const source = this.audioCtx.createBufferSource();
      source.buffer = this.beepBuffer;
      source.connect(this.audioCtx.destination);
      source.start();
    } catch (e) {
      // console.error('[AvatarSystem] PlayBeep error:', e);
    }
  }

  public log(text: string, type: 'system' | 'user' | 'ai' = 'system') {
    this.show();
    const line = document.createElement('div');
    line.className = `line ${type}`;
    if (type === 'ai') {
      line.innerHTML = `<span class="ai-prompt">${this.NAME}&gt;</span> ${text}`;
    } else if (type === 'user') {
      line.innerHTML = `<span class="user-prompt">USER&gt;</span> ${text}`;
    } else {
      line.textContent = `> ${text}`;
    }
    this.output.appendChild(line);
    this.output.scrollTop = this.output.scrollHeight;
  }

  // ... createDOM, show, hide, clear, speak, startTalking, stopTalking ...
  // (Wait, replace_file_content replaces the specific range. I need to be careful not to delete methods)
  // The previous implementation had `constructor` then `log` then `createDOM`.
  // My TargetContent should capture the constructor and playBeep logic?
  // Using simple replace for methods.

  // I will replace the constructor to add generateBeepBuffer call.
  // And add the generateBeepBuffer method.
  // And replace playBeep.

  // Actually, I can just replace the whole class properties/constructor area and playBeep.

  // Let's do properties + constructor + generateBeepBuffer first.

  private createDOM() {
    if (document.getElementById('avatar-ui')) {
      this.container = document.getElementById('avatar-ui') as HTMLElement;
      this.output = this.container.querySelector('#avatar-output') as HTMLElement;
      this.avatarImg = this.container.querySelector('#avatar-img') as HTMLImageElement;
      return;
    }

    const html = `
      <div class="avatar-area">
        <img id="avatar-img" src="${this.ASSETS.normal.idle}" alt="${this.NAME}">
        <div class="avatar-label">${this.NAME}</div>
      </div>
      <div class="chat-area">
        <div class="output" id="avatar-output">
          <div class="line system">&gt; SYSTEM: ${this.NAME} Online</div>
        </div>
      </div>
    `;

    this.container = document.createElement('div');
    this.container.id = 'avatar-ui';
    this.container.innerHTML = html;
    document.body.appendChild(this.container);

    this.output = this.container.querySelector('#avatar-output') as HTMLElement;
    this.avatarImg = this.container.querySelector('#avatar-img') as HTMLImageElement;
  }

  public show() {
    this.container.classList.add('visible');
  }

  public hide() {
    this.container.classList.remove('visible');
    this.stopTalking();
  }

  public clear() {
    if (this.output) {
      this.output.innerHTML = `<div class="line system">&gt; SYSTEM: ${this.NAME} Online</div>`;
    }
  }

  public async speak(text: string) {
    console.log('[AvatarSystem] speak() called:', text);
    this.show();
    const line = document.createElement('div');
    line.className = 'line ai';
    line.innerHTML = `<span class="ai-prompt">${this.NAME}&gt;</span> <span class="ai-text"></span>`;
    this.output.appendChild(line);

    const textSpan = line.querySelector('.ai-text') as HTMLElement;

    this.startTalking();
    await this.typeWriter(textSpan, text);
    this.stopTalking();

    this.output.scrollTop = this.output.scrollHeight;
  }

  public setEmotion(emotion: AvatarEmotion) {
    this.currentEmotion = emotion;
    if (!this.talkingInterval && this.avatarImg) {
      this.avatarImg.src = this.ASSETS[this.currentEmotion].idle;
    }
  }

  private startTalking() {
    if (this.talkingInterval) return;
    this.isMouthOpen = false;
    this.talkingInterval = setInterval(() => {
      this.isMouthOpen = !this.isMouthOpen;
      const set = this.ASSETS[this.currentEmotion];
      this.avatarImg.src = this.isMouthOpen ? set.talk : set.idle;
    }, 150);
  }

  private stopTalking() {
    if (this.talkingInterval) {
      clearInterval(this.talkingInterval);
      this.talkingInterval = null;
    }
    if (this.avatarImg) {
      this.avatarImg.src = this.ASSETS[this.currentEmotion].idle;
    }
  }

  private typeWriter(element: HTMLElement, text: string): Promise<void> {
    return new Promise((resolve) => {
      let i = 0;
      const speed = 30; // ms per char

      // Use Phaser Timer if available for better stability in background (pauseOnBlur: false)
      if (this.scene) {
        const timer = this.scene.time.addEvent({
          delay: speed,
          loop: true,
          callback: () => {
            if (i < text.length) {
              const char = text.charAt(i);
              element.textContent += char;

              if (char !== ' ' && char !== '\n') {
                this.playBeep();
              }

              i++;
              this.output.scrollTop = this.output.scrollHeight;
            } else {
              timer.remove();
              resolve();
            }
          },
        });
      } else {
        // Fallback for no-scene context
        const tick = () => {
          if (i < text.length) {
            const char = text.charAt(i);
            element.textContent += char;

            if (char !== ' ' && char !== '\n') {
              this.playBeep();
            }

            i++;
            this.output.scrollTop = this.output.scrollHeight;
            setTimeout(tick, speed);
          } else {
            resolve();
          }
        };
        tick();
      }
    });
  }
}
