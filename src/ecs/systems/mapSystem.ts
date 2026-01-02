import Phaser from 'phaser';
import { world } from '../world';

const MAP_SIZE = 200;
const MAP_MARGIN = 20;

export const mapSystem = (scene: Phaser.Scene, player: { sectorId?: string }) => {
  if (!player.sectorId) return;

  // Get or Create Graphics
  let graphics = scene.children.getByName('minimap') as Phaser.GameObjects.Graphics;
  if (!graphics) {
    graphics = scene.add.graphics();
    graphics.setName('minimap');
    // Scroll Factor 0 is default behavior for UI Scene, but good to be explicit if mixed
    graphics.setScrollFactor(0);
  }

  graphics.clear();

  // Screen Dimensions
  const viewport = scene.scale.getViewPort();
  const mapX = viewport.width - MAP_SIZE - MAP_MARGIN;
  const mapY = viewport.height - MAP_SIZE - MAP_MARGIN;

  // 1. Calculate Bounds of all entities in sector
  const entities = world.with('transform', 'sectorId');
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  const sectorEntities = [];

  for (const entity of entities) {
    if (entity.sectorId !== player.sectorId) continue;
    if (!entity.transform) continue;

    sectorEntities.push(entity);
    const { x, y } = entity.transform;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  // Default bounds if empty or only player (avoid infinite scale)
  if (minX === Infinity) {
    minX = -1000;
    maxX = 1000;
    minY = -1000;
    maxY = 1000;
  }
  // Ensure minimum size to prevent ultra-zoom on single point
  if (maxX - minX < 2000) {
    const cx = (minX + maxX) / 2;
    minX = cx - 1000;
    maxX = cx + 1000;
  }
  if (maxY - minY < 2000) {
    const cy = (minY + maxY) / 2;
    minY = cy - 1000;
    maxY = cy + 1000;
  }

  const contentW = maxX - minX;
  const contentH = maxY - minY;

  // Scale to fit MAP_SIZE
  const scaleX = MAP_SIZE / contentW;
  const scaleY = MAP_SIZE / contentH;
  const scale = Math.min(scaleX, scaleY);

  // Center logic: Center of the map view corresponds to Center of the Bounds
  const boundsCX = (minX + maxX) / 2;
  const boundsCY = (minY + maxY) / 2;

  // Map Center on Screen
  const mapCX = mapX + MAP_SIZE / 2;
  const mapCY = mapY + MAP_SIZE / 2;

  const toMap = (wx: number, wy: number) => {
    const dx = wx - boundsCX;
    const dy = wy - boundsCY;
    return {
      x: mapCX + dx * scale,
      y: mapCY + dy * scale,
    };
  };

  // Background
  graphics.fillStyle(0x000000, 0.5);
  graphics.fillRect(mapX, mapY, MAP_SIZE, MAP_SIZE);

  // Border
  graphics.lineStyle(2, 0xffffff, 1);
  graphics.strokeRect(mapX, mapY, MAP_SIZE, MAP_SIZE);

  // Draw Entities
  for (const entity of sectorEntities) {
    if (!entity.transform) continue;
    const pos = toMap(entity.transform.x, entity.transform.y);

    // Clip (optional, but autoscaling should keep them inside mostly)
    // ...

    if (entity.playerControl) {
      // Player: Green Arrow/Dot
      graphics.fillStyle(0x00ff00, 1);
      graphics.fillCircle(pos.x, pos.y, 4);
    } else if (entity.station) {
      // Station: Varied Colors
      let color = 0x0088ff; // Default Blue
      const type = entity.stationType as string;
      if (type === 'shipyard')
        color = 0xffffff; // White
      else if (type && type.startsWith('mining')) {
        if (type.includes('gas'))
          color = 0x00ff00; // Green
        else if (type.includes('crystal'))
          color = 0xd000ff; // Purple
        else color = 0x888888; // Grey/White for Ore
      } else if (type && type.startsWith('factory')) {
        if (type.includes('fuel'))
          color = 0xffa500; // Orange
        else if (type.includes('electronics'))
          color = 0x00ffff; // Cyan
        else if (type.includes('engine'))
          color = 0xff4444; // Red
        else if (type.includes('sensors'))
          color = 0x44ff44; // Light Green
        else color = 0xffff00; // Yellow default
      }

      graphics.fillStyle(color, 1);
      graphics.fillRect(pos.x - 4, pos.y - 4, 8, 8);
    } else if (entity.gate) {
      // Gate: Purple Circle
      graphics.lineStyle(2, 0xff00ff, 1);
      graphics.strokeCircle(pos.x, pos.y, 4);
    } else if (entity.aiState) {
      // NPC: Faction Colors
      let color = 0xaaaaaa; // Default Grey
      if (entity.faction === 'TRADER') color = 0x00ff00; // Green (Friendly/Neutral)
      if (entity.faction === 'PIRATE') color = 0xff0000; // Red (Hostile)
      if (entity.faction === 'BOUNTY_HUNTER') color = 0xffaa00; // Orange

      graphics.fillStyle(color, 1);
      graphics.fillCircle(pos.x, pos.y, 3);
    }
  }
};
