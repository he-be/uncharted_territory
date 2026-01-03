import { world, type Entity } from '../world';
import Phaser from 'phaser';
import { calculatePrice } from '../../utils/economyUtils';
import { findPath } from '../../utils/pathfinding';
import { MarketSystem } from './MarketSystem';
import { recordTradeAttempt } from './analyticsSystem';

const ARRIVAL_RADIUS = 50;
// const JUMP_TIME_PENALTY = 5000; // Unused

// Key: StationID, Value: Entity
const stationCache = new Map<string, Entity>();
// Key: SectorID, Value: List of Gates in that sector
const gateCache = new Map<string, Entity[]>();

export const aiSystem = () => {
  const aiEntities = world.with(
    'transform',
    'velocity',
    'aiState',
    'speedStats',
    'wallet',
    'totalProfit',
    'wallet',
    'totalProfit',
    'sectorId',
    'cargoCapacity'
  );
  const stations = world.with('station', 'transform', 'stationType', 'inventory', 'sectorId');
  const gates = world.with('gate', 'transform', 'sectorId');

  // Update Station Cache
  if (stationCache.size !== stations.size) {
    stationCache.clear();
    for (const s of stations) {
      stationCache.set(s.id, s);
    }
  }

  // Update Gate Cache
  if (gateCache.size === 0) {
    for (const g of gates) {
      if (!g.sectorId) continue;
      const list = gateCache.get(g.sectorId) || [];
      list.push(g);
      gateCache.set(g.sectorId, list);
    }
  }

  // Optimization: Throttle Planning - one entity per frame? Or one batch?
  // For now, simple flag to limit planning to ONE entity per frame to spread load
  let processedPlanning = false;

  // let tExec = 0;

  for (const entity of aiEntities) {
    if (!entity.speedStats) continue;
    // If in combat, skip AI movement (Lock-in)
    if (entity.combatEncounter) continue;

    // Pirates use combatSystem for logic, not this trade AI. Bounty Hunters also skip trade.
    if (entity.faction === 'PIRATE' || entity.faction === 'BOUNTY_HUNTER') continue;

    const maxSpeed = entity.speedStats.maxSpeed;

    // ----------------------------------------------------
    // PLAN
    // ----------------------------------------------------
    if (entity.aiState === 'PLANNING') {
      if (processedPlanning) continue;

      const route = MarketSystem.getBestRoute();
      if (route) {
        entity.tradeRoute = {
          buyStationId: route.buyStationId,
          sellStationId: route.sellStationId,
          itemId: route.itemId,
          state: 'MOVING_TO_BUY',
        };
        entity.aiState = 'EXECUTING_TRADE';
        processedPlanning = true;
      }
    }

    // ----------------------------------------------------
    // EXECUTE
    // ----------------------------------------------------
    if (entity.aiState === 'EXECUTING_TRADE' && entity.tradeRoute) {
      // const tEStart = performance.now();
      const route = entity.tradeRoute;

      let targetId = '';
      if (route.state === 'MOVING_TO_BUY' || route.state === 'BUYING') {
        targetId = route.buyStationId;
      } else if (route.state === 'MOVING_TO_SELL' || route.state === 'SELLING') {
        targetId = route.sellStationId;
      }

      // --- Multi-Sector Logic ---
      let targetEntity = stationCache.get(targetId);

      // If target is in different sector, override target to GATE
      // If target is in different sector, find path and head to NEXT Gate
      if (targetEntity && targetEntity.sectorId !== entity.sectorId) {
        const path = findPath(entity.sectorId || '', targetEntity.sectorId || '');

        if (path && path.length > 0) {
          // path[0] is next sector
          const nextSector = path[0];

          const sectorGates = gateCache.get(entity.sectorId || '');
          const validGate = sectorGates?.find((g) => g.gate?.destinationSectorId === nextSector);

          if (validGate) {
            targetId = validGate.id; // Override target ID for lookup
            targetEntity = validGate;
          }
        }
      }

      if (!targetEntity || !targetEntity.transform) {
        // Fail gracefully
        entity.aiState = 'PLANNING';
        entity.tradeRoute = undefined;
        // tExec is handled above or unused
        continue;
      }

      const targetX = targetEntity.transform.x;
      const targetY = targetEntity.transform.y;

      const dx = targetX - entity.transform.x;
      const dy = targetY - entity.transform.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const angle = Math.atan2(dy, dx);
      entity.transform.rotation = angle;
      entity.velocity.vx = Math.cos(angle) * maxSpeed;
      entity.velocity.vy = Math.sin(angle) * maxSpeed;

      // Arrival Logic
      if (dist < ARRIVAL_RADIUS) {
        entity.velocity.vx = 0;
        entity.velocity.vy = 0;

        // Handle Gate Jump
        if (targetEntity.gate) {
          // JUMP!
          const destSector = targetEntity.gate.destinationSectorId;
          const destGateId = targetEntity.gate.destinationGateId;

          entity.sectorId = destSector;

          // Find Destination Gate
          let destGateEntity: Entity | null = null;
          const potentialGates = gateCache.get(destSector);
          if (potentialGates) {
            destGateEntity = potentialGates.find((g) => g.id === destGateId) || null;
          }

          if (destGateEntity && destGateEntity.transform) {
            entity.transform.x = destGateEntity.transform.x + 100;
            entity.transform.y = destGateEntity.transform.y + 100;
          } else {
            // Fallback if not found (shouldn't happen with correct config)
            entity.transform.x = 50000;
            entity.transform.y = 0;
          }

          continue;
        }

        // Handle Trade
        if (route.state === 'MOVING_TO_BUY') {
          // ... (Trade Logic) ...
          const buyPrice = calculatePrice(targetEntity, route.itemId);
          const maxCargo = entity.cargoCapacity || 10;
          const available = targetEntity.inventory?.[route.itemId] || 0;

          // Buy as much as possible up to limit
          const amount = Math.min(available, maxCargo);
          const cost = buyPrice * amount;

          if ((entity.wallet || 0) >= cost && amount > 0) {
            entity.wallet! -= cost;
            targetEntity.inventory![route.itemId]! -= amount;
            if (targetEntity.wallet === undefined) targetEntity.wallet = 0;
            targetEntity.wallet += cost;

            if (!entity.cargo) entity.cargo = {};
            if (!entity.cargo[route.itemId]) entity.cargo[route.itemId] = 0;
            entity.cargo[route.itemId]! += amount;
            if (entity.totalProfit === undefined) entity.totalProfit = 0;
            entity.totalProfit -= cost;
            route.state = 'MOVING_TO_SELL';
            // Visual Update: Loaded
            if (entity.sprite && 'setTexture' in entity.sprite) {
              (entity.sprite as Phaser.GameObjects.Sprite).setTexture('npc_trader_full');
            }
            // Report Success
            recordTradeAttempt(route.itemId, true, amount);
          } else {
            // Report Failure (Arrived but empty or too expensive)
            recordTradeAttempt(route.itemId, false, 0);

            entity.aiState = 'PLANNING';
            entity.tradeRoute = undefined;
          }
        } else if (route.state === 'MOVING_TO_SELL') {
          const sellPrice = calculatePrice(targetEntity, route.itemId);
          const amount = entity.cargo?.[route.itemId] || 0;
          const revenue = sellPrice * amount;

          if (amount > 0) {
            entity.wallet! += revenue;
            if (targetEntity.wallet === undefined) targetEntity.wallet = 0;
            targetEntity.wallet -= revenue;
            if (!targetEntity.inventory![route.itemId]) targetEntity.inventory![route.itemId] = 0;
            targetEntity.inventory![route.itemId]! += amount;
            entity.cargo![route.itemId] = 0;

            // Visual Update: Empty
            if (entity.sprite && 'setTexture' in entity.sprite) {
              (entity.sprite as Phaser.GameObjects.Sprite).setTexture('npc_trader');
            }
            if (entity.totalProfit === undefined) entity.totalProfit = 0;
            entity.totalProfit += revenue;
          }
          entity.aiState = 'PLANNING';
        }
      }
    }
  }
};
