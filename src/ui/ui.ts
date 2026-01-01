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

  showTradeMenu(show: boolean, stationName?: string, inventory?: Record<string, number>) {
    if (show) {
      this.tradeMenu.classList.remove('hidden');
      if (stationName) {
        this.stationTitle.textContent = stationName;
      }

      const contentDiv = document.getElementById('trade-content');
      // If we don't have a dedicated content div yet (basic setup), creating one or using existing logic.
      // Based on previous reads, the HTML might be simple. Let's look for or create a container.

      let container = contentDiv;
      if (!container) {
        // If not found, try to append to existing structure of tradeMenu if it's safe?
        // The tradeMenu likely just has a h2 and a button.
        // Let's create a dynamic one.
        container = document.createElement('div');
        container.id = 'trade-content';
        // Insert after title
        this.stationTitle.insertAdjacentElement('afterend', container);
      }

      if (inventory && container) {
        let listHtml =
          '<div style="margin-top:10px;"><h3>Station Inventory</h3><ul style="list-style:none; padding:0;">';
        for (const [item, count] of Object.entries(inventory)) {
          listHtml += `<li style="margin-bottom:4px; border-bottom:1px solid #333; padding:4px; display:flex; justify-content:space-between;">
                  <span>${item.toUpperCase()}</span>
                  <span>${count.toFixed(0)}</span>
              </li>`;
        }
        listHtml += '</ul></div>';
        container.innerHTML = listHtml;
      }
    } else {
      this.tradeMenu.classList.add('hidden');
    }
  },
};
