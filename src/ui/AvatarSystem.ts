export class AvatarSystem {
  private container!: HTMLElement;
  private output!: HTMLElement;
  private avatarImg!: HTMLImageElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private talkingInterval: any = null;
  private isMouthOpen: boolean = false;

  // Update paths to correspond to public assets
  private readonly IDLE_IMG = '/assets/c_alva_idle.png';
  private readonly TALK_IMG = '/assets/c_alva_talk.png';
  private readonly NAME = 'A.L.V.A.';

  private audioCtx: AudioContext | null = null;
  private beepBuffer: AudioBuffer | null = null;

  constructor() {
    this.createDOM();
    this.preloadImages();
    // Init audio context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const WinAudio = window.AudioContext || (window as any).webkitAudioContext;
    if (WinAudio) {
      this.audioCtx = new WinAudio();
      this.generateBeepBuffer();
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
      // Frequency 600Hz
      const freq = 600;
      const val = Math.sign(Math.sin(2 * Math.PI * freq * t));

      // Linear decay for volume
      const volume = 0.05 * (1 - i / frames);
      data[i] = val * volume;
    }

    this.beepBuffer = buffer;
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
        <img id="avatar-img" src="${this.IDLE_IMG}" alt="${this.NAME}">
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

  private startTalking() {
    if (this.talkingInterval) return;
    this.isMouthOpen = false;
    this.talkingInterval = setInterval(() => {
      this.isMouthOpen = !this.isMouthOpen;
      this.avatarImg.src = this.isMouthOpen ? this.TALK_IMG : this.IDLE_IMG;
    }, 150);
  }

  private stopTalking() {
    if (this.talkingInterval) {
      clearInterval(this.talkingInterval);
      this.talkingInterval = null;
    }
    if (this.avatarImg) {
      this.avatarImg.src = this.IDLE_IMG;
    }
  }

  private playBeep() {
    if (!this.audioCtx || !this.beepBuffer) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    try {
      const source = this.audioCtx.createBufferSource();
      source.buffer = this.beepBuffer;
      source.connect(this.audioCtx.destination);
      source.start();
    } catch {
      // Ignore audio errors
    }
  }

  private typeWriter(element: HTMLElement, text: string): Promise<void> {
    return new Promise((resolve) => {
      let i = 0;
      const speed = 30; // ms per char

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
    });
  }
}
