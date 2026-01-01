import Phaser from 'phaser';
import { world, type Entity } from '../world';
import { ui } from '../../ui/ui';

export const interactionSystem = (playerEntity: Entity): Entity | null => {
  const stations = world.with('station', 'interactionRadius', 'transform');
  let dockableStation: Entity | null = null;

  for (const station of stations) {
    if (!playerEntity.transform || !station.transform) continue;

    const dist = Phaser.Math.Distance.Between(
      playerEntity.transform.x,
      playerEntity.transform.y,
      station.transform.x,
      station.transform.y
    );

    if (dist < station.interactionRadius!) {
      dockableStation = station;
    }
  }

  ui.showDockingHint(!!dockableStation);
  return dockableStation;
};
