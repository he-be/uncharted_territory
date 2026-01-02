import { world } from '../world';
import { ITEMS, type ItemId } from '../../data/items';
import { ui } from '../../ui/ui';

const HISTORY_SIZE = 300;
const UPDATE_INTERVAL = 500; // ms

let lastUpdate = 0;
const statHistory: {
  time: number;
  stationVal: number;
  traderVal: number;
  pirateVal: number;
}[] = [];

export const analyticsSystem = (time: number) => {
  // 1. Data Collection (Throttled)
  if (time - lastUpdate > UPDATE_INTERVAL) {
    lastUpdate = time;

    let totalStationVal = 0;
    let totalTraderVal = 0;
    let totalPirateVal = 0;

    // Stations: Wallet + Inventory
    for (const station of world.with('station', 'wallet', 'inventory')) {
      totalStationVal += station.wallet || 0;
      // Inventory Value
      if (station.inventory) {
        for (const [id, count] of Object.entries(station.inventory)) {
          const item = ITEMS[id as ItemId];
          if (item && count > 0) {
            totalStationVal += count * item.basePrice;
          }
        }
      }
    }

    // Traders: Total Profit (Simulating wealth) + Cargo value?
    // Let's just track accumulated profit for now as a proxy for their success.
    // Or we could track their 'simulated' wallet if we had one.
    // Current entity model: 'totalProfit' is the main metric.
    for (const trader of world.with('totalProfit', 'faction')) {
      if (trader.faction === 'TRADER') {
        totalTraderVal += trader.totalProfit || 0;
      } else if (trader.faction === 'PIRATE') {
        // Pirates use 'piracy.revenue' usually, but let's check
        // Pirate wealth is stored in 'piracy.revenue'
        if (trader.piracy) {
          totalPirateVal += trader.piracy.revenue || 0;
        }
      }
    }

    statHistory.push({
      time,
      stationVal: totalStationVal,
      traderVal: totalTraderVal,
      pirateVal: totalPirateVal,
    });

    if (statHistory.length > HISTORY_SIZE) {
      statHistory.shift();
    }
  }

  // 2. Rendering (Only if visible)
  if (ui.ecoDashboard.classList.contains('hidden')) return;

  const canvas = ui.ecoChart;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const halfH = h / 2;
  const padding = 20;

  // Clear
  ctx.clearRect(0, 0, w, h);

  if (statHistory.length < 2) return;

  const mapX = (i: number) => (i / (HISTORY_SIZE - 1)) * w;

  // Helper: MinMax
  const getMinMax = (props: ('stationVal' | 'traderVal' | 'pirateVal')[]) => {
    let min = Infinity;
    let max = -Infinity;
    for (const pt of statHistory) {
      for (const p of props) {
        const v = pt[p];
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (min === Infinity) {
      min = 0;
      max = 100;
    }
    if (min === max) {
      min -= 10;
      max += 10;
    } // Prevent div by zero
    return { min, max };
  };

  // --- Subplot 1: Stations (Top Half) ---
  // Range
  const stRange = getMinMax(['stationVal']);
  // Add margin (5%)
  const stMargin = (stRange.max - stRange.min) * 0.05;
  stRange.min -= stMargin;
  stRange.max += stMargin;

  // MapY: val -> 0..halfH
  // but canvas Y is 0 at top. we want max at top (+padding), min at bottom (-padding)
  // topLimit = padding
  // bottomLimit = halfH - padding
  const mapYStation = (val: number) => {
    const pct = (val - stRange.min) / (stRange.max - stRange.min);
    return halfH - padding - pct * (halfH - 2 * padding);
  };

  // Separator
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, halfH);
  ctx.lineTo(w, halfH);
  ctx.stroke();

  // Draw Stations (Green)
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < statHistory.length; i++) {
    const x = mapX(i);
    const y = mapYStation(statHistory[i].stationVal);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // Labels Top
  ctx.fillStyle = '#00ff00';
  ctx.font = '10px monospace';
  ctx.fillText(`${Math.floor(stRange.max).toLocaleString()}`, 5, padding);
  ctx.fillText(`${Math.floor(stRange.min).toLocaleString()}`, 5, halfH - 5);

  // --- Subplot 2: Traders & Pirates (Bottom Half) ---
  const shRange = getMinMax(['traderVal', 'pirateVal']);
  // Add margin
  const shMargin = (shRange.max - shRange.min) * 0.05;
  shRange.min -= shMargin;
  shRange.max += shMargin;

  // Top of bottom plot = halfH
  // bottom of bottom plot = h
  // MapY
  const mapYShip = (val: number) => {
    const pct = (val - shRange.min) / (shRange.max - shRange.min);
    // bottom limit: h - padding
    // top limit: halfH + padding
    // range height: (h - padding) - (halfH + padding) = halfH - 2*padding
    return h - padding - pct * (halfH - 2 * padding);
  };

  // Draw Traders (Cyan)
  ctx.strokeStyle = '#00ffff';
  ctx.beginPath();
  started = false;
  for (let i = 0; i < statHistory.length; i++) {
    const x = mapX(i);
    const y = mapYShip(statHistory[i].traderVal);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // Draw Pirates (Red)
  ctx.strokeStyle = '#ff4444';
  ctx.beginPath();
  started = false;
  for (let i = 0; i < statHistory.length; i++) {
    const x = mapX(i);
    const y = mapYShip(statHistory[i].pirateVal);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // Labels Bottom
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${Math.floor(shRange.max).toLocaleString()}`, 5, halfH + padding + 10);
  ctx.fillText(`${Math.floor(shRange.min).toLocaleString()}`, 5, h - 5);

  // Zero line if visible
  if (shRange.min < 0 && shRange.max > 0) {
    const y0 = mapYShip(0);
    ctx.strokeStyle = '#666';
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(w, y0);
    ctx.stroke();
    ctx.setLineDash([]);
  }
};
