export class ResultOverlay {
  private container: HTMLDivElement;

  constructor() {
    const existing = document.getElementById('result-overlay');
    if (existing) {
      this.container = existing as HTMLDivElement;
    } else {
      this.container = document.createElement('div');
      this.container.id = 'result-overlay';
      this.container.style.display = 'none';
      document.body.appendChild(this.container);
    }
  }

  public show(stats: { time: number; enemiesDefeated: number }, onReturn: () => void) {
    console.log('[ResultOverlay] Showing Result Screen', stats);
    this.container.innerHTML = `
            <div class="result-content">
                <h1>MISSION ACCOMPLISHED</h1>
                <div class="stats">
                    <p>Combat Time: ${Math.floor(stats.time)}s</p>
                    <p>Targets Neutralized: ${stats.enemiesDefeated}</p>
                </div>
                <button id="btn-return">RETURN TO BASE</button>
            </div>
        `;

    this.container.style.display = 'flex';

    const btn = document.getElementById('btn-return');
    if (btn) {
      btn.addEventListener('click', () => {
        onReturn();
      });
    }
  }

  public hide() {
    this.container.style.display = 'none';
  }
}
