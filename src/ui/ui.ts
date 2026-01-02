export interface TradeItem {
  id: string;
  name: string;
  count: number;
  price: number;
  basePrice: number;
}

export const ui = {
  dockingHint: document.getElementById('docking-hint')!,
  tradeMenu: document.getElementById('trade-menu')!,
  stationTitle: document.getElementById('station-title')!,
  closeTradeBtn: document.getElementById('close-trade')!,
  zoomInBtn: document.getElementById('zoom-in')!,
  zoomOutBtn: document.getElementById('zoom-out')!,
  toggleMapBtn: document.getElementById('toggle-map')!,
  toggleEcoBtn: document.getElementById('toggle-eco')!,
  toggleStatsBtn: document.getElementById('toggle-stats')!,
  ecoDashboard: document.getElementById('eco-dashboard')!,
  statsDashboard: document.getElementById('stats-dashboard')!,
  statsContent: document.getElementById('stats-content')!,
  ecoChart: document.getElementById('eco-chart') as HTMLCanvasElement,

  toggleStats(show: boolean) {
    if (show) this.statsDashboard.classList.remove('hidden');
    else this.statsDashboard.classList.add('hidden');
  },

  toggleEco(show: boolean) {
    if (show) this.ecoDashboard.classList.remove('hidden');
    else this.ecoDashboard.classList.add('hidden');
  },

  showDockingHint(show: boolean) {
    if (show) this.dockingHint.classList.remove('hidden');
    else this.dockingHint.classList.add('hidden');
  },

  showTradeMenu(
    show: boolean,
    stationName?: string,
    inventory?: Record<string, number> | TradeItem[]
  ) {
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
        // inventory can be Record<string, number> OR detailed array.
        // Let's assume we update call sites to pass the detailed array.
        // But for safety/transition, check type.

        let listHtml = '<div style="margin-top:10px;"><h3>Station Market</h3>';

        if (Array.isArray(inventory)) {
          // Detailed view
          listHtml += `
            <table style="width:100%; border-collapse: collapse; font-size: 14px;">
              <thead>
                <tr style="text-align:left; border-bottom: 1px solid #555;">
                  <th style="padding:4px;">Item</th>
                  <th style="padding:4px; text-align:right;">Qty</th>
                  <th style="padding:4px; text-align:right;">Price</th>
                  <th style="padding:4px; text-align:right;">Base</th>
                </tr>
              </thead>
              <tbody>
           `;

          for (const item of inventory) {
            const priceClass =
              item.price > item.basePrice
                ? '#ffaa00'
                : item.price < item.basePrice
                  ? '#00ffaa'
                  : '#ffffff';

            listHtml += `
               <tr style="border-bottom: 1px solid #333;">
                 <td style="padding:4px;">${item.name}</td>
                 <td style="padding:4px; text-align:right;">${item.count.toFixed(0)}</td>
                 <td style="padding:4px; text-align:right; color:${priceClass};">$${item.price.toFixed(0)}</td>
                 <td style="padding:4px; text-align:right; color:#888;">$${item.basePrice.toFixed(0)}</td>
               </tr>
             `;
          }
          listHtml += '</tbody></table>';
        } else {
          // Legacy/Fallback view
          listHtml += '<ul style="list-style:none; padding:0;">';
          for (const [item, count] of Object.entries(inventory)) {
            listHtml += `<li style="margin-bottom:4px; border-bottom:1px solid #333; padding:4px; display:flex; justify-content:space-between;">
                    <span>${item.toUpperCase()}</span>
                    <span>${(count as number).toFixed(0)}</span>
                </li>`;
          }
          listHtml += '</ul>';
        }

        listHtml += '</div>';
        container.innerHTML = listHtml;
      }
    } else {
      this.tradeMenu.classList.add('hidden');
    }
  },
};
