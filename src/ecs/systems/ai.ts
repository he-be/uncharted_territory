import { world, type Entity } from '../world';
import { STATION_CONFIGS } from '../../data/stations';
import type { ItemId } from '../../data/items';
import type { StationType } from '../../data/stations';

const ARRIVAL_RADIUS = 50;

// Helper: Check if station needs a specific item
const doesStationNeed = (stationEntity: Entity, itemId: ItemId): boolean => {
  // 1. Is it an input for production?
  const config = STATION_CONFIGS[stationEntity.stationType as StationType];
  if (config?.production?.consumes) {
    return config.production.consumes.some((input) => input.itemId === itemId);
  }
  return false;
};

// Helper: Check if station produces a specific item (and has stock)
const doesStationProduce = (stationEntity: Entity, itemId?: ItemId): boolean => {
  const config = STATION_CONFIGS[stationEntity.stationType as StationType];
  if (config?.production?.produces) {
    if (itemId) {
      const stock = stationEntity.inventory?.[itemId] || 0;
      return config.production.produces.some((output) => output.itemId === itemId) && stock > 0;
    } else {
      // Check if it produces ANYTHING and has stock of it
      return config.production.produces.some(
        (output) => (stationEntity.inventory?.[output.itemId] || 0) > 0
      );
    }
  }
  return false;
};

export const aiSystem = (_delta: number) => {
  const aiEntities = world.with('transform', 'velocity', 'aiState', 'speedStats');
  const stations = world.with('station', 'transform', 'stationType', 'inventory');

  for (const entity of aiEntities) {
    // ----------------------------------------------------
    // 1. STATE MANAGEMENT
    // ----------------------------------------------------

    // IDLE: Decide what to do
    if (entity.aiState === 'IDLE') {
      // DECISION LOGIC:
      // 1. Do we have cargo? -> Sell it.
      // 2. Are we empty? -> Find something to Buy.

      const cargo = entity.cargo || {};
      const cargoItems = Object.keys(cargo) as ItemId[];
      const hasCargo = cargoItems.some((item) => (cargo[item] || 0) > 0);

      if (hasCargo) {
        // STRATEGY: SELL
        // Find a station that needs what we have
        const itemToSell = cargoItems.find((item) => (cargo[item] || 0) > 0)!;

        // Find consumer
        let targetStation = null;
        for (const s of stations) {
          if (doesStationNeed(s, itemToSell)) {
            targetStation = s;
            break;
          }
        }

        if (targetStation) {
          entity.aiState = 'TRADING_SELL';
          entity.target = { x: targetStation.transform.x, y: targetStation.transform.y };
          entity.targetStationId = targetStation.id;
        } else {
          // No buyer found? Wander randomly (or stay IDLE)
          entity.aiState = 'IDLE';
        }
      } else {
        // STRATEGY: BUY
        // Find a station that has something we can sell somewhere else
        // Improved Logic: Find a valid Route (Producer -> Consumer)

        // For now, iterate stations, find one with Stock.

        const producers = Array.from(stations).filter((s) => doesStationProduce(s));

        if (producers.length > 0) {
          const randomProducer = producers[Math.floor(Math.random() * producers.length)];
          entity.aiState = 'TRADING_BUY';
          entity.target = { x: randomProducer.transform.x, y: randomProducer.transform.y };
          entity.targetStationId = randomProducer.id;
        }
      }
    }

    // ----------------------------------------------------
    // 2. MOVEMENT (Common for all moving states)
    // ----------------------------------------------------
    if (['MOVING', 'TRADING_BUY', 'TRADING_SELL'].includes(entity.aiState!)) {
      if (entity.target) {
        const dx = entity.target.x - entity.transform.x;
        const dy = entity.target.y - entity.transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < ARRIVAL_RADIUS) {
          // ARRIVED!
          entity.velocity.vx = 0;
          entity.velocity.vy = 0;

          // Handle State Completions
          if (entity.aiState === 'TRADING_BUY') {
            // Action: BUY
            if (entity.targetStationId) {
              const station = world.where((e) => e.id === entity.targetStationId).first;
              if (station && station.productionConfig && station.productionConfig.produces) {
                // Buying Logic: Pick a random item they produce that HAS STOCK.
                const producedItems = station.productionConfig.produces;
                const availableItems = producedItems.filter(
                  (p) => (station.inventory?.[p.itemId] || 0) > 0
                );

                if (availableItems.length > 0) {
                  const selectedProduct =
                    availableItems[Math.floor(Math.random() * availableItems.length)];
                  const outputItem = selectedProduct.itemId;
                  const amount = 10;

                  // Decrease Station Inventory (Check stock first)
                  const currentStock = station.inventory?.[outputItem] || 0;
                  const actualAmount = Math.min(amount, currentStock);

                  if (actualAmount > 0) {
                    station.inventory![outputItem]! -= actualAmount;

                    // Add to Ship Cargo
                    if (!entity.cargo) entity.cargo = {};
                    if (!entity.cargo[outputItem]) entity.cargo[outputItem] = 0;
                    entity.cargo[outputItem]! += actualAmount;
                  }
                }
              }
            }
            // Done buying, switch to IDLE to decide next step (which will be SELL)
            entity.aiState = 'IDLE';
          } else if (entity.aiState === 'TRADING_SELL') {
            // Action: SELL
            // Logic: Dump everything valid.
            if (entity.targetStationId) {
              const station = world.where((e) => e.id === entity.targetStationId).first;
              if (station && entity.cargo) {
                // Sell everything this station "Needs"
                for (const item of Object.keys(entity.cargo)) {
                  const itemId = item as ItemId;
                  if (doesStationNeed(station, itemId)) {
                    const amount = entity.cargo[itemId] || 0;
                    if (amount > 0) {
                      // Transfer
                      entity.cargo[itemId] = 0;
                      // Add to station inventory
                      if (!station.inventory![itemId]) station.inventory![itemId] = 0;
                      station.inventory![itemId]! += amount;
                    }
                  }
                }
              }
            }
            entity.aiState = 'IDLE';
          } else {
            // Normal Move
            entity.aiState = 'IDLE';
          }
        } else {
          // Move
          const angle = Math.atan2(dy, dx);
          entity.transform.rotation = angle;
          const speed = entity.speedStats.maxSpeed;
          entity.velocity.vx = Math.cos(angle) * speed;
          entity.velocity.vy = Math.sin(angle) * speed;
        }
      }
    }
  }
};
