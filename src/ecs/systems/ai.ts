import { world } from '../world';
import { calculatePrice } from '../../utils/economyUtils';
import { STATION_CONFIGS, type StationType } from '../../data/stations';
import type { ItemId } from '../../data/items';

const ARRIVAL_RADIUS = 50;

export const aiSystem = (_delta: number) => {
  const aiEntities = world.with(
    'transform',
    'velocity',
    'aiState',
    'speedStats',
    'wallet',
    'totalProfit'
  ); // Ensure wallet/profit exist
  const stations = world.with('station', 'transform', 'stationType', 'inventory');

  for (const entity of aiEntities) {
    // ----------------------------------------------------
    // STATE: PLANNING
    // Calculate best route (Profit/Time) and Commit
    // ----------------------------------------------------
    if (entity.aiState === 'PLANNING') {
      const possibleRoutes: Array<{
        buyStationId: string;
        sellStationId: string;
        itemId: ItemId;
        score: number;
        expectedProfit: number;
      }> = [];

      const stationList = Array.from(stations);

      // 1. Identify all Producers
      for (const producer of stationList) {
        const pConfig = STATION_CONFIGS[producer.stationType as StationType];
        if (!pConfig.production?.produces) continue;

        for (const production of pConfig.production.produces) {
          const itemId = production.itemId;
          // Check stock at producer
          const stock = producer.inventory?.[itemId] || 0;
          if (stock <= 0) continue;

          const buyPrice = calculatePrice(producer, itemId);

          // 2. Identify Consumers for this Item
          for (const consumer of stationList) {
            if (producer === consumer) continue;

            // Check if consumer consumes this item
            const cConfig = STATION_CONFIGS[consumer.stationType as StationType];
            const consumes = cConfig.production?.consumes?.some((c) => c.itemId === itemId);

            if (consumes) {
              const sellPrice = calculatePrice(consumer, itemId);
              const profitPerUnit = sellPrice - buyPrice;

              if (profitPerUnit > 0) {
                // 3. Score the Route
                // Distance: Ship -> Producer -> Consumer
                const distToProducer = Phaser.Math.Distance.Between(
                  entity.transform.x,
                  entity.transform.y,
                  producer.transform.x,
                  producer.transform.y
                );
                const distToConsumer = Phaser.Math.Distance.Between(
                  producer.transform.x,
                  producer.transform.y,
                  consumer.transform.x,
                  consumer.transform.y
                );
                const totalDist = distToProducer + distToConsumer;
                const time = totalDist / entity.speedStats.maxSpeed; // approximate time

                const cargoCapacity = 10; // Fixed for now
                const totalProfit = profitPerUnit * cargoCapacity;

                // Score = Profit / Time
                const score = totalProfit / (time + 1); // Avoid div by zero

                possibleRoutes.push({
                  buyStationId: producer.id,
                  sellStationId: consumer.id,
                  itemId: itemId,
                  score: score,
                  expectedProfit: totalProfit,
                });
              }
            }
          }
        }
      }

      // 4. Decision (Weighted Random)
      if (possibleRoutes.length > 0) {
        // Sort by score desc
        possibleRoutes.sort((a, b) => b.score - a.score);

        // Pick top 3 or all if less
        const candidates = possibleRoutes.slice(0, 3);

        // Simple random among top candidates to avoid deadlock
        const chosenRoute = candidates[Math.floor(Math.random() * candidates.length)];

        // Commit
        entity.tradeRoute = {
          buyStationId: chosenRoute.buyStationId,
          sellStationId: chosenRoute.sellStationId,
          itemId: chosenRoute.itemId,
          state: 'MOVING_TO_BUY',
        };
        entity.aiState = 'EXECUTING_TRADE';
      } else {
        // No profitable routes? Wait? Or wander?
        // For now, simple wait (could implement WANDER state)
      }
    }

    // ----------------------------------------------------
    // STATE: EXECUTING_TRADE
    // Follow the committed plan
    // ----------------------------------------------------
    if (entity.aiState === 'EXECUTING_TRADE' && entity.tradeRoute) {
      const route = entity.tradeRoute;

      // Targets
      let targetId = '';
      if (route.state === 'MOVING_TO_BUY' || route.state === 'BUYING') {
        targetId = route.buyStationId;
      } else {
        targetId = route.sellStationId;
      }

      const targetStation = world.where((e) => e.id === targetId).first;

      // Safely check targetStation existence AND its transform
      if (!targetStation || !targetStation.transform) {
        // Station gone? Abort.
        entity.aiState = 'PLANNING';
        entity.tradeRoute = undefined;
        continue;
      }

      const targetX = targetStation.transform.x;
      const targetY = targetStation.transform.y;

      // Movement Logic
      const dx = targetX - entity.transform.x;
      const dy = targetY - entity.transform.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Steer
      const angle = Math.atan2(dy, dx);
      entity.transform.rotation = angle;
      entity.velocity.vx = Math.cos(angle) * entity.speedStats.maxSpeed;
      entity.velocity.vy = Math.sin(angle) * entity.speedStats.maxSpeed;

      // Arrival Logic
      if (dist < ARRIVAL_RADIUS) {
        entity.velocity.vx = 0;
        entity.velocity.vy = 0;

        // Handle Sub-States
        if (route.state === 'MOVING_TO_BUY') {
          // Attempt Buy
          const buyPrice = calculatePrice(targetStation, route.itemId);
          const amount = 10;
          const cost = buyPrice * amount;

          // Check Wallet & Stock
          if (
            (entity.wallet || 0) >= cost &&
            (targetStation.inventory?.[route.itemId] || 0) >= amount
          ) {
            // Transaction
            entity.wallet! -= cost;
            targetStation.inventory![route.itemId]! -= amount;

            // Station Revenue (NEW)
            if (targetStation.wallet === undefined) targetStation.wallet = 0;
            targetStation.wallet += cost;

            if (!entity.cargo) entity.cargo = {};
            if (!entity.cargo[route.itemId]) entity.cargo[route.itemId] = 0;
            entity.cargo[route.itemId]! += amount;

            // Visual Feedback (Loss/Cost)
            if (entity.totalProfit === undefined) entity.totalProfit = 0;
            entity.totalProfit -= cost;

            // Next Step
            route.state = 'MOVING_TO_SELL';
          } else {
            // Failed to buy (Too expensive now? Stock gone?)
            // Abort
            entity.aiState = 'PLANNING';
            entity.tradeRoute = undefined;
          }
        } else if (route.state === 'MOVING_TO_SELL') {
          // Attempt Sell
          const sellPrice = calculatePrice(targetStation, route.itemId);
          const amount = entity.cargo?.[route.itemId] || 0;
          const revenue = sellPrice * amount;

          if (amount > 0) {
            // Transaction
            entity.wallet! += revenue;

            // Station Cost (NEW)
            if (targetStation.wallet === undefined) targetStation.wallet = 0;
            targetStation.wallet -= revenue;

            if (!targetStation.inventory![route.itemId]) targetStation.inventory![route.itemId] = 0;
            targetStation.inventory![route.itemId]! += amount;

            entity.cargo![route.itemId] = 0;

            // Visual Feedback (Profit)
            if (entity.totalProfit === undefined) entity.totalProfit = 0;
            entity.totalProfit += revenue;
          }

          // Done
          entity.aiState = 'PLANNING';
        }
      }
    }
  }
};
