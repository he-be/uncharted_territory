import { world } from '../world';

export const movementSystem = (delta: number) => {
  const movingEntities = world.with('transform', 'velocity');

  for (const entity of movingEntities) {
    entity.transform.x += entity.velocity.vx * (delta / 1000);
    entity.transform.y += entity.velocity.vy * (delta / 1000);

    if (entity.sprite) {
      entity.sprite.x = entity.transform.x;
      entity.sprite.y = entity.transform.y;
      entity.sprite.rotation = entity.transform.rotation;
    }
  }
};
