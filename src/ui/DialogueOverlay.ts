export class DialogueOverlay {
  private container: HTMLDivElement | null = null;
  private static readonly MAX_MESSAGES = 50;

  constructor() {
    this.createDOM();
  }

  private createDOM() {
    // Check if it already exists (hot reload safety)
    const existing = document.getElementById('alva-dialogue-container');
    if (existing) {
      existing.remove();
    }

    this.container = document.createElement('div');
    this.container.id = 'alva-dialogue-container';

    // Append to body directly to ensure visibility, regardless of #ui-layer state
    document.body.appendChild(this.container);
  }

  public addMessage(text: string) {
    if (!this.container) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = 'alva-message';
    msgDiv.textContent = text;

    // "Latest at top" - Prepend
    if (this.container.firstChild) {
      this.container.insertBefore(msgDiv, this.container.firstChild);
    } else {
      this.container.appendChild(msgDiv);
    }

    // Since we are prepending, the scroll position naturally stays at 0 (top)
    // showing the newest item.
    // However, if the user scrolled down to read history, we might not want to disturb them?
    // Requirement: "Latest at top, auto-scroll"
    // With prepend, the new item appears at the top. The container's scrollTop stays 0 usually.
    // Let's ensure it snaps to top if we want "force auto-scroll".
    this.container.scrollTop = 0;

    // Prune old messages
    if (this.container.children.length > DialogueOverlay.MAX_MESSAGES) {
      const last = this.container.lastChild;
      if (last) last.remove();
    }
  }

  public clear() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  public setVisible(visible: boolean) {
    if (this.container) {
      this.container.style.display = visible ? 'flex' : 'none';
    }
  }
}
