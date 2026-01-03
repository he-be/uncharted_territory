import { world } from '../world';
import { ITEMS, type ItemId } from '../../data/items';
import { ui } from '../../ui/ui';

const HISTORY_SIZE = 300; // 5 minutes (for graph)
const PRODUCTION_HISTORY_SIZE = 300; // 5 minutes (seconds resolution)
const UPDATE_INTERVAL = 500; // ms for graph update
const RENDER_INTERVAL = 1000; // ms for stats table update

// Graph History
let lastUpdate = 0;
const statHistory: {
  time: number;
  stationVal: number;
  traderCount: number;
  pirateCount: number;
  hunterCount: number;
}[] = [];

// Production History (Circular Buffer of 1s buckets)
const productionBuckets: Record<ItemId, number>[] = new Array(PRODUCTION_HISTORY_SIZE)
  .fill(0)
  .map(() => ({}) as Record<ItemId, number>);
let currentBucketIndex = 0;
let lastProductionTick = 0;

// Benchmark / Trade Analytics
interface TradeAttempt {
  itemId: ItemId;
  success: boolean;
  amount: number;
  timestamp: number;
}
let tradeHistory: TradeAttempt[] = [];
let isBenchmarking = false;
let benchmarkStartTime = 0;

export const startBenchmark = (time: number) => {
  isBenchmarking = true;
  benchmarkStartTime = time;
  tradeHistory = [];
  console.log(`[Analytics] Benchmark STARTED at ${time}`);
};

export const stopBenchmark = (time: number) => {
  isBenchmarking = false;
  const duration = (time - benchmarkStartTime) / 1000;
  console.log(`[Analytics] Benchmark STOPPED. Duration: ${duration.toFixed(1)}s`);
  reportBenchmark();
};

const reportBenchmark = () => {
  const stats: Record<
    string,
    { attempts: number; successes: number; failures: number; volume: number }
  > = {};

  for (const t of tradeHistory) {
    if (!stats[t.itemId]) stats[t.itemId] = { attempts: 0, successes: 0, failures: 0, volume: 0 };
    stats[t.itemId].attempts++;
    if (t.success) {
      stats[t.itemId].successes++;
      stats[t.itemId].volume += t.amount;
    } else {
      stats[t.itemId].failures++;
    }
  }

  console.table(stats);

  // Also log specific failure rates
  console.log('--- Trade Failure Analysis ---');
  for (const [id, s] of Object.entries(stats)) {
    const rate = ((s.failures / s.attempts) * 100).toFixed(1);
    console.log(`${id}: ${rate}% Failure Rate (${s.failures}/${s.attempts})`);
  }
};

// API to record production
export const recordProduction = (itemId: ItemId, amount: number) => {
  const bucket = productionBuckets[currentBucketIndex];
  bucket[itemId] = (bucket[itemId] || 0) + amount;
};

// API to record trade
export const recordTradeAttempt = (itemId: ItemId, success: boolean, amount: number) => {
  if (!isBenchmarking) return;
  // We strictly use Date.now() or pass time? Since this is called from AI, simplicity suggests strictly pushing.
  // However, aiSystem doesn't have easy access to absolute time without passing it down.
  // using Date.now() for relative ordering is fine.
  tradeHistory.push({
    itemId,
    success,
    amount,
    timestamp: Date.now(),
  });
};

let lastRender = 0;

export const analyticsSystem = (time: number) => {
  // 0. Update Production Buckets (Time based)
  // Simple approach: each call check if second changed.
  const nowSec = Math.floor(time / 1000);
  const lastSec = Math.floor(lastProductionTick / 1000);

  if (nowSec > lastSec) {
    const diff = nowSec - lastSec;
    // Advance buckets
    for (let i = 0; i < diff; i++) {
      currentBucketIndex = (currentBucketIndex + 1) % PRODUCTION_HISTORY_SIZE;
      // Reset new bucket
      productionBuckets[currentBucketIndex] = {} as Record<ItemId, number>;
    }
    lastProductionTick = time;
  }
  if (lastProductionTick === 0) lastProductionTick = time;

  // 1. Data Collection (Graph)
  if (time - lastUpdate > UPDATE_INTERVAL) {
    lastUpdate = time;

    let totalStationVal = 0;

    // Stations
    for (const station of world.with('station', 'wallet', 'inventory')) {
      totalStationVal += station.wallet || 0;
      if (station.inventory) {
        for (const [id, count] of Object.entries(station.inventory)) {
          const item = ITEMS[id as ItemId];
          if (item && count > 0) {
            totalStationVal += count * item.basePrice;
          }
        }
      }
    }

    // Ships
    let traderCount = 0;
    let pirateCount = 0;
    let hunterCount = 0;

    for (const ship of world.with('faction')) {
      if (ship.faction === 'TRADER') {
        traderCount++;
      } else if (ship.faction === 'PIRATE') {
        pirateCount++;
      } else if (ship.faction === 'BOUNTY_HUNTER') {
        hunterCount++;
      }
    }

    statHistory.push({
      time,
      stationVal: totalStationVal,
      traderCount,
      pirateCount,
      hunterCount,
    });

    if (statHistory.length > HISTORY_SIZE) {
      statHistory.shift();
    }
  }

  // 2. Rendering

  // A. Graph Render
  if (!ui.ecoDashboard.classList.contains('hidden')) {
    renderGraph();
  }

  // B. Stats Table Render
  if (!ui.statsDashboard.classList.contains('hidden')) {
    if (time - lastRender > RENDER_INTERVAL) {
      lastRender = time;
      renderStatsTable();
    }
  }
};

const renderStatsTable = () => {
  // Calculate Averages
  // Helper to sum last N buckets
  const sumBuckets = (seconds: number): Record<ItemId, number> => {
    const totals: Record<string, number> = {};
    for (let i = 0; i < seconds; i++) {
      // circular back access
      let idx = currentBucketIndex - i;
      if (idx < 0) idx += PRODUCTION_HISTORY_SIZE;

      const bucket = productionBuckets[idx];
      for (const [id, val] of Object.entries(bucket)) {
        totals[id] = (totals[id] || 0) + val;
      }
    }
    return totals;
  };

  const sum15 = sumBuckets(15);
  const sum60 = sumBuckets(60);
  const sum300 = sumBuckets(300);

  let html = `
    <table style="width:100%; text-align:left; border-collapse:collapse; font-family:monospace;">
        <thead>
            <tr style="border-bottom:1px solid #555; color:#aaa;">
                <th style="padding:4px;">Item</th>
                <th style="padding:4px; text-align:right;">15s Avg</th>
                <th style="padding:4px; text-align:right;">1m Avg</th>
                <th style="padding:4px; text-align:right;">5m Avg</th>
            </tr>
        </thead>
        <tbody>
    `;

  // Sorted items?
  const allItems = Object.keys(ITEMS) as ItemId[];

  for (const id of allItems) {
    // Filter out if no production? Or show zeros? Show all for comprehensive view.
    const name = ITEMS[id].name;

    // Rates per minute? Or per second?
    // "Average value". Let's show as "Units/min"
    const r15 = (sum15[id] || 0) * (60 / 15);
    const r60 = sum60[id] || 0; // already 60s
    const r300 = (sum300[id] || 0) / 5; // 300s -> per min

    // Dynamic color if producing?
    const activeColor = r15 > 0 ? '#00ff00' : '#888';

    html += `
            <tr style="border-bottom:1px solid #333;">
                <td style="padding:4px; color:${activeColor}">${name}</td>
                <td style="padding:4px; text-align:right;">${r15.toFixed(1)}/m</td>
                <td style="padding:4px; text-align:right;">${r60.toFixed(1)}/m</td>
                <td style="padding:4px; text-align:right;">${r300.toFixed(1)}/m</td>
            </tr>
        `;
  }

  html += `</tbody></table>`;

  // Add total value stats?

  ui.statsContent.innerHTML = html;
};

const renderGraph = () => {
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
  // Helper: MinMax
  const getMinMax = (props: ('stationVal' | 'traderCount' | 'pirateCount' | 'hunterCount')[]) => {
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
    }
    return { min, max };
  };

  // --- Subplot 1: Stations (Top Half) ---
  const stRange = getMinMax(['stationVal']);
  const stMargin = (stRange.max - stRange.min) * 0.05;
  stRange.min -= stMargin;
  stRange.max += stMargin;

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

  // --- Subplot 2: Global Fleet Counts (Bottom Half) ---
  const shRange = getMinMax(['traderCount', 'pirateCount', 'hunterCount']);
  // Ensure we see at least 0-10 or so
  if (shRange.max < 10) shRange.max = 10;

  const shMargin = (shRange.max - shRange.min) * 0.1;
  shRange.min = 0; // Counts imply 0 base usually looks better
  shRange.max += shMargin;

  const mapYShip = (val: number) => {
    const pct = (val - shRange.min) / (shRange.max - shRange.min);
    return h - padding - pct * (halfH - 2 * padding);
  };

  // Draw Traders (Cyan)
  ctx.strokeStyle = '#00ffff';
  ctx.beginPath();
  started = false;
  for (let i = 0; i < statHistory.length; i++) {
    const x = mapX(i);
    const y = mapYShip(statHistory[i].traderCount);
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
    const y = mapYShip(statHistory[i].pirateCount);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // Draw Bounty Hunters (Orange)
  ctx.strokeStyle = '#ffaa00';
  ctx.beginPath();
  started = false;
  for (let i = 0; i < statHistory.length; i++) {
    const x = mapX(i);
    const y = mapYShip(statHistory[i].hunterCount);
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
  ctx.fillText(`Count Max: ${Math.floor(shRange.max)}`, 5, halfH + padding + 10);
  ctx.fillText(`0`, 5, h - 5);

  // Legend
  const lx = w - 100;
  const ly = halfH + padding + 10;
  ctx.fillStyle = '#00ffff';
  ctx.fillText('Trader', lx, ly);
  ctx.fillStyle = '#ff4444';
  ctx.fillText('Pirate', lx, ly + 12);
  ctx.fillStyle = '#ffaa00';
  ctx.fillText('Hunter', lx, ly + 24);
};
