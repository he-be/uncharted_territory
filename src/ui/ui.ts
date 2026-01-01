export const ui = {
  dockingHint: document.getElementById('docking-hint')!,
  tradeMenu: document.getElementById('trade-menu')!,
  closeTradeBtn: document.getElementById('close-trade')!,

  showDockingHint(show: boolean) {
    if (show) this.dockingHint.classList.remove('hidden');
    else this.dockingHint.classList.add('hidden');
  },

  showTradeMenu(show: boolean) {
    if (show) this.tradeMenu.classList.remove('hidden');
    else this.tradeMenu.classList.add('hidden');
  },
};
