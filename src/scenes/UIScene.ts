import Phaser from 'phaser';
import { world } from '../ecs/world';
import { mapSystem } from '../ecs/systems/mapSystem';

export class UIScene extends Phaser.Scene {
  private debugText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UIScene', active: true });
  }

  create() {
    // Debug Text
    this.debugText = this.add.text(10, 10, '', { font: '16px monospace', color: '#00ff00' });

    // Ensure it sits on top? Scenes are layered by launch order.
    // MainScene launches first, so UI should be on top if launched after or configured properly.
  }

  update(_time: number, _delta: number) {
    // 1. Run Mini-map System
    // We need to find the player entity to center the map (or pass to mapSystem)
    const players = world.with('playerControl', 'transform', 'sectorId');
    let playerEntity = null;
    for (const p of players) {
      playerEntity = p;
      break;
    }

    if (playerEntity) {
      mapSystem(this, playerEntity);

      // 2. Update Debug Text
      // Collect stats
      // We can access MainScene via game scene manager if needed, but world entity has most info.
      const { x, y } = playerEntity.transform!;
      const { vx, vy } = playerEntity.velocity || { vx: 0, vy: 0 };
      const fps = this.game.loop.actualFps;

      // We might want to read Zoom from MainScene?
      const mainScene = this.scene.get('MainScene') as Phaser.Scene & { currentZoom: number };
      const zoom = mainScene.currentZoom || 1;

      this.debugText.setText([
        `FPS: ${fps.toFixed(1)}`,
        `Pos: (${x.toFixed(0)}, ${y.toFixed(0)})`,
        `Vel: (${vx.toFixed(0)}, ${vy.toFixed(0)})`,
        `Zoom: ${zoom.toFixed(2)}`,
        `Sector: ${playerEntity.sectorId || 'Unknown'}`,
      ]);
    }
  }
}
