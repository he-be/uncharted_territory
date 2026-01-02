import { world, type Entity } from '../world';
import Phaser from 'phaser';
import { ITEMS, type ItemId } from '../../data/items';

let lastContentUpdate = 0;
const CONTENT_UPDATE_INTERVAL = 200; // ms

export const overlaySystem = (scene: Phaser.Scene) => {
  const now = scene.time.now;
  const isContentUpdate = now - lastContentUpdate > CONTENT_UPDATE_INTERVAL;
  if (isContentUpdate) {
    lastContentUpdate = now;
  }

  // Get Player Sector
  const player = world.with('playerControl', 'sectorId').first;
  const currentSector = player ? player.sectorId : null;

  // Camera Bounds
  const cam = scene.cameras.main;
  const worldView = cam.worldView;
  const pad = 100;
  // Use a simple check function instead of creating a Rectangle object every frame if possible,
  // but object creation is cheap enough here compared to the rest.
  const viewRect = new Phaser.Geom.Rectangle(
    worldView.x - pad,
    worldView.y - pad,
    worldView.width + pad * 2,
    worldView.height + pad * 2
  );

  // Helper
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

  // 1. NPC Profit Overlay
  const npcEntities = world.with('transform', 'totalProfit', 'sectorId');
  for (const entity of npcEntities) {
    if (entity.station) continue;

    // Culling
    const isVisible =
      entity.sectorId === currentSector &&
      viewRect.contains(entity.transform.x, entity.transform.y);

    if (!isVisible) {
      if (entity.textOverlay) entity.textOverlay.setVisible(false);
      continue;
    }

    const text = getOrCreateText(entity, '#ffffff');
    text.setVisible(true);
    // Position Update (Every Frame)
    text.setPosition(entity.transform.x, entity.transform.y - 50);

    // Content Update (Throttled)
    if (isContentUpdate) {
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
  }

  // 2. Station Overlay
  const stationEntities = world.with('station', 'transform', 'wallet', 'inventory', 'sectorId');
  for (const station of stationEntities) {
    const isVisible =
      station.sectorId === currentSector &&
      viewRect.contains(station.transform.x, station.transform.y);

    if (!isVisible) {
      if (station.textOverlay) station.textOverlay.setVisible(false);
      continue;
    }

    if (!station.textOverlay) {
      // Init (Once)
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

    // Content Update (Throttled) - EXPENSIVE CALC
    if (isContentUpdate) {
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
  }

  // 3. Combat Graphics (HP Bars) - Keep mostly every frame for smoothness
  // But strictly cull.
  let overlayGraphics = scene.registry.get('overlayGraphics') as Phaser.GameObjects.Graphics;
  if (!overlayGraphics) {
    overlayGraphics = scene.add.graphics();
    overlayGraphics.setDepth(25);
    scene.registry.set('overlayGraphics', overlayGraphics);
  }
  overlayGraphics.clear();

  // Optim: Build map only if needed, OR just iterate combatants directly.
  // We need the map for Encounter names.
  // Rebuilding a Map(300 items) every frame might be slight overhead.
  // Let's only map entities in current sector.

  const sectorEntityMap = new Map<string, Entity>();
  const combatants = world.with('combatStats', 'transform', 'sectorId');

  for (const entity of combatants) {
    if (entity.sectorId === currentSector) {
      sectorEntityMap.set(entity.id, entity);

      // Draw Bars
      if (entity.transform && viewRect.contains(entity.transform.x, entity.transform.y)) {
        const x = entity.transform.x;
        const y = entity.transform.y;
        const stats = entity.combatStats!;
        const width = 60;
        const height = 6;
        const yOffset = -40;

        overlayGraphics.fillStyle(0x000000, 0.8);
        // Rect: x, y, w, h
        overlayGraphics.fillRect(x - width / 2, y + yOffset, width, height * 2 + 2);

        const shieldPct = stats.shields / stats.maxShields;
        overlayGraphics.fillStyle(0x00ffff, 1);
        overlayGraphics.fillRect(x - width / 2, y + yOffset, width * shieldPct, height);

        const hullPct = stats.hp / stats.maxHp;
        const color = hullPct > 0.5 ? 0x00ff00 : 0xff0000;
        overlayGraphics.fillStyle(color, 1);
        overlayGraphics.fillRect(x - width / 2, y + yOffset + height, width * hullPct, height);
      }
    }
  }

  // 4. Encounters
  const encounters = world.with('encounterZone', 'transform', 'sectorId');
  for (const encounter of encounters) {
    if (encounter.sectorId !== currentSector) {
      if (encounter.textOverlay) encounter.textOverlay.setVisible(false);
      continue;
    }

    const zone = encounter.encounterZone!;
    const isVisible = viewRect.contains(zone.center.x, zone.center.y);

    // Draw Circle (Always if in sector, as it might be large)
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

    // Visibility
    encounter.textOverlay.setVisible(isVisible);

    if (isVisible && isContentUpdate) {
      let label = 'COMBAT ENCOUNTER';
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
  }
};
