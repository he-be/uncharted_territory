export const ui = {
  dockingHint: document.getElementById('docking-hint')!,
  tradeMenu: document.getElementById('trade-menu')!,
  stationTitle: document.getElementById('station-title')!,
  closeTradeBtn: document.getElementById('close-trade')!,
  zoomInBtn: document.getElementById('zoom-in')!,
  zoomOutBtn: document.getElementById('zoom-out')!,

  showDockingHint(show: boolean) {
    if (show) this.dockingHint.classList.remove('hidden');
    else this.dockingHint.classList.add('hidden');
  },

  showTradeMenu(show: boolean, stationName?: string) {
    if (show) {
      this.tradeMenu.classList.remove('hidden');
      if (stationName) {
        this.stationTitle.textContent = stationName;
      }
    } else {
      this.tradeMenu.classList.add('hidden');
    }
  },
};
