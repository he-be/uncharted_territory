import { world } from '../world';
import Phaser from 'phaser';
import { ITEMS, type ItemId } from '../../data/items';

export const overlaySystem = (scene: Phaser.Scene) => {
  // 1. NPC Profit Overlay
  const npcEntities = world.with('transform', 'totalProfit');
  for (const entity of npcEntities) {
    if (entity.station) continue; // Skip stations for this loop

    // Create Text if missing
    if (!entity.textOverlay) {
      entity.textOverlay = scene.add.text(entity.transform.x, entity.transform.y - 60, '$0', {
        font: '28px monospace',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      });
      entity.textOverlay.setOrigin(0.5, 1);
      entity.textOverlay.setDepth(20);
    }

    // Update Position
    entity.textOverlay.setPosition(entity.transform.x, entity.transform.y - 50);

    // Update Content
    const profit = entity.totalProfit || 0;
    const prefix = profit >= 0 ? '+$' : '-$';
    const absProfit = Math.abs(profit).toFixed(0);

    entity.textOverlay.setText(`${prefix}${absProfit}`);

    if (profit > 0) entity.textOverlay.setColor('#00ff00');
    else if (profit < 0) entity.textOverlay.setColor('#ff0000');
    else entity.textOverlay.setColor('#ffffff');
  }

  // 2. Station Economy Overlay
  const stationEntities = world.with('station', 'transform', 'wallet', 'inventory');
  for (const station of stationEntities) {
    if (!station.textOverlay) {
      station.textOverlay = scene.add.text(
        station.transform.x,
        station.transform.y + 100, // Below station with more offset
        '',
        {
          font: '24px monospace',
          color: '#cccccc',
          align: 'center',
          stroke: '#000000',
          strokeThickness: 3,
          backgroundColor: '#00000088',
        }
      );
      station.textOverlay.setOrigin(0.5, 0);
      station.textOverlay.setDepth(20);
    }

    // Calculate Inventory Value
    let inventoryValue = 0;
    if (station.inventory) {
      for (const [itemId, count] of Object.entries(station.inventory)) {
        const itemDef = ITEMS[itemId as ItemId];
        if (itemDef) {
          inventoryValue += (count || 0) * itemDef.basePrice;
        }
      }
    }

    const wallet = station.wallet || 0;
    const total = wallet + inventoryValue;

    station.textOverlay.setText(
      `Cash: $${wallet.toFixed(0)}\nAsset: $${inventoryValue.toFixed(0)}\nTotal: $${total.toFixed(0)}`
    );
  }
};
