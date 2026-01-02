import { world, type Entity } from '../world';
import Phaser from 'phaser';
import { ITEMS, type ItemId } from '../../data/items';

export const overlaySystem = (scene: Phaser.Scene) => {
  // Get Player Sector
  const player = world.with('playerControl', 'sectorId').first;
  const currentSector = player ? player.sectorId : null;

  // 3. Combat Overlay (HP Bars & Zones)
  // Optimization: Culling using camera bounds
  const cam = scene.cameras.main;
  const worldView = cam.worldView;
  // Pad view for culling
  const pad = 100;
  const viewRect = new Phaser.Geom.Rectangle(
    worldView.x - pad,
    worldView.y - pad,
    worldView.width + pad * 2,
    worldView.height + pad * 2
  );

  // Helper: Get or Create Text
  const getOrCreateText = (entity: Entity, color: string, fontSize: string = '28px') => {
    if (!entity.textOverlay) {
      entity.textOverlay = scene.add.text(0, 0, '', {
        font: `${fontSize} monospace`,
        color: color,
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
      });
      entity.textOverlay.setOrigin(0.5, 1); // Bottom-Center
      entity.textOverlay.setDepth(20);
    }
    return entity.textOverlay;
  };

  // 1. NPC Profit Overlay (Optimized)
  const npcEntities = world.with('transform', 'totalProfit', 'sectorId');
  for (const entity of npcEntities) {
    if (entity.station) continue; // Stations handled separately

    // Culling: Sector & Camera
    if (entity.sectorId !== currentSector) {
      if (entity.textOverlay) entity.textOverlay.setVisible(false);
      continue;
    }
    if (!viewRect.contains(entity.transform.x, entity.transform.y)) {
      if (entity.textOverlay) entity.textOverlay.setVisible(false);
      continue;
    }

    const text = getOrCreateText(entity, '#ffffff');
    text.setVisible(true);
    text.setPosition(entity.transform.x, entity.transform.y - 50);

    // Update Content (Only if changed check is internal to Phaser usually, but we can do it)
    let newText = '';
    let newColor = '#ffffff';

    if (entity.faction === 'PIRATE') {
      const revenue = entity.piracy?.revenue || 0;
      newText = `PIRACY: $${revenue.toFixed(0)}`;
      newColor = '#ff4444';
    } else {
      const profit = entity.totalProfit || 0;
      const prefix = profit >= 0 ? '+$' : '-$';
      newText = `${prefix}${Math.abs(profit).toFixed(0)}`;
      if (profit > 0) newColor = '#00ff00';
      else if (profit < 0) newColor = '#ff0000';
    }

    if (text.text !== newText) text.setText(newText);
    if (text.style.color !== newColor) text.setColor(newColor);
  }

  // 2. Station Overlay (Optimized)
  const stationEntities = world.with('station', 'transform', 'wallet', 'inventory', 'sectorId');
  for (const station of stationEntities) {
    if (station.sectorId !== currentSector) {
      if (station.textOverlay) station.textOverlay.setVisible(false);
      continue;
    }
    // Stations are big, maybe lenient culling?
    if (!viewRect.contains(station.transform.x, station.transform.y)) {
      if (station.textOverlay) station.textOverlay.setVisible(false);
      continue;
    }

    if (!station.textOverlay) {
      // Custom creation for stations as they differ in origin
      station.textOverlay = scene.add.text(station.transform.x, station.transform.y + 100, '', {
        font: '24px monospace',
        color: '#cccccc',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 3,
        backgroundColor: '#00000088',
      });
      station.textOverlay.setOrigin(0.5, 0);
      station.textOverlay.setDepth(20);
    }
    station.textOverlay.setVisible(true);

    // Calc Value (Expensive loop? Should throttle?)
    // optimize later if needed.
    let inventoryValue = 0;
    if (station.inventory) {
      for (const [itemId, count] of Object.entries(station.inventory)) {
        const itemDef = ITEMS[itemId as ItemId];
        if (itemDef) inventoryValue += (count || 0) * itemDef.basePrice;
      }
    }
    const total = (station.wallet || 0) + inventoryValue;
    const msg = `Cash: $${(station.wallet || 0).toFixed(0)}\nAsset: $${inventoryValue.toFixed(0)}\nTotal: $${total.toFixed(0)}`;

    if (station.textOverlay.text !== msg) station.textOverlay.setText(msg);
  }

  // 3a. HP Bars & Graphics
  let overlayGraphics = scene.registry.get('overlayGraphics') as Phaser.GameObjects.Graphics;
  if (!overlayGraphics) {
    overlayGraphics = scene.add.graphics();
    overlayGraphics.setDepth(25);
    scene.registry.set('overlayGraphics', overlayGraphics);
  }
  overlayGraphics.clear();

  // Create lookup for names (for Encounters) - Iterate once through all relevant entities?
  // We can just find them when iterating encounters. Lookups are fast enough if cache is good.
  // But overlaySystem doesn't have the map. miniplex `world.entity(id)`? No.
  // We will build a small local map of active entities in this sector for name resolution.
  const sectorEntityMap = new Map<string, Entity>();

  const combatants = world.with('combatStats', 'transform', 'sectorId');
  for (const entity of combatants) {
    if (entity.sectorId === currentSector) {
      sectorEntityMap.set(entity.id, entity);

      if (!entity.transform) continue;
      // Cull Bars
      if (!viewRect.contains(entity.transform.x, entity.transform.y)) continue;

      const x = entity.transform.x;
      const y = entity.transform.y;
      const stats = entity.combatStats!;
      const width = 60;
      const height = 6;
      const yOffset = -40;

      // Draw Background
      overlayGraphics.fillStyle(0x000000, 0.8);
      overlayGraphics.fillRect(x - width / 2, y + yOffset, width, height * 2 + 2);

      // Draw Shields (Blue)
      const shieldPct = stats.shields / stats.maxShields;
      overlayGraphics.fillStyle(0x00ffff, 1);
      overlayGraphics.fillRect(x - width / 2, y + yOffset, width * shieldPct, height);

      // Draw Hull (Green->Red)
      const hullPct = stats.hp / stats.maxHp;
      const color = hullPct > 0.5 ? 0x00ff00 : 0xff0000;
      overlayGraphics.fillStyle(color, 1);
      overlayGraphics.fillRect(x - width / 2, y + yOffset + height, width * hullPct, height);
    }
  }

  // 3b. Encounter Zones
  const encounters = world.with('encounterZone', 'transform', 'sectorId');
  for (const encounter of encounters) {
    if (encounter.sectorId !== currentSector) {
      if (encounter.textOverlay) encounter.textOverlay.setVisible(false);
      continue;
    }

    const zone = encounter.encounterZone!;
    // Cull? Encounters are big. Check circle.
    // Simple center check with radius
    if (!viewRect.contains(zone.center.x, zone.center.y)) {
      // Approximation
      // if (encounter.textOverlay) encounter.textOverlay.setVisible(false);
      // continue;
      // Actually, if edge of circle is in view? Let's be safe and render unless far off.
    }

    // Draw Circle (Red, unfilled)
    overlayGraphics.lineStyle(2, 0xff0000, 1);
    overlayGraphics.strokeCircle(zone.center.x, zone.center.y, zone.radius);

    if (!encounter.textOverlay) {
      encounter.textOverlay = scene.add.text(zone.center.x, zone.center.y - zone.radius - 20, '', {
        font: '20px monospace',
        color: '#ff0000',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
      });
      encounter.textOverlay.setOrigin(0.5, 1);
      encounter.textOverlay.setDepth(25);
    }
    encounter.textOverlay.setVisible(true);

    // Resolve Participants
    let label = 'COMBAT ENCOUNTER'; // Fallback
    if (zone.participants && zone.participants.length >= 2) {
      const p1 = sectorEntityMap.get(zone.participants[0]);
      const p2 = sectorEntityMap.get(zone.participants[1]);
      if (p1 && p2) {
        const n1 = p1.faction || 'UNKNOWN';
        const n2 = p2.faction || 'UNKNOWN';
        label = `${n1} vs ${n2}`;
      }
    }

    if (encounter.textOverlay.text !== label) encounter.textOverlay.setText(label);
  }
};
