import Phaser from 'phaser';
import { world } from '../world';

export const playerControlSystem = (cursors: Phaser.Types.Input.Keyboard.CursorKeys) => {
  const player = world.with('playerControl', 'velocity', 'transform').first;

  if (!player) return;

  const THRUST = 8; // Acceleration per frame
  const MAX_SPEED = 500;
  const ROTATION_SPEED = 3;

  if (cursors.left.isDown) {
    player.transform.rotation -= ROTATION_SPEED * 0.016;
  } else if (cursors.right.isDown) {
    player.transform.rotation += ROTATION_SPEED * 0.016;
  }

  if (cursors.up.isDown) {
    // Add velocity vector based on rotation
    player.velocity.vx += Math.cos(player.transform.rotation) * THRUST;
    player.velocity.vy += Math.sin(player.transform.rotation) * THRUST;
  }

  // Cap speed
  const speed = Math.sqrt(player.velocity.vx ** 2 + player.velocity.vy ** 2);
  if (speed > MAX_SPEED) {
    player.velocity.vx = (player.velocity.vx / speed) * MAX_SPEED;
    player.velocity.vy = (player.velocity.vy / speed) * MAX_SPEED;
  }

  // Drag / Inertia
  player.velocity.vx *= 0.98;
  player.velocity.vy *= 0.98;
};
