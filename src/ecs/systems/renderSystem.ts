import { world } from '../world';
import type { Entity } from '../world';

export const renderSystem = (player: Entity) => {
  const currentSector = player.sectorId;
  if (!currentSector) return;

  const entities = world.with('sprite', 'sectorId');

  for (const entity of entities) {
    const visible = entity.sectorId === currentSector;

    // Toggle Sprite Visibility
    if (entity.sprite) {
      entity.sprite.setVisible(visible);
    }

    // Toggle Overlay Visibility
    // Note: textOverlay is not in the query but is on the entity type
    if (entity.textOverlay) {
      entity.textOverlay.setVisible(visible);
    }
  }
};
