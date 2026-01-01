# Performance Guidelines

## Recent Issues & Resolutions

### 1. AI Logic Latency (Stuttering)

- **Symptom**: Periodic frame drops (stutter) with >100ms frame times.
- **Cause**: O(N) entity lookup (`world.where`) inside the AI loop (O(M) ships). This resulted in effectively O(N\*M) complexity every frame.
- **Fix**: Implemented a **Station Cache** (`Map<string, Entity>`) to reduce lookup time from O(N) to O(1).
- **Optimization**: Added **Throttling** to the `PLANNING` phase allowing only 1 ship to calculate routes per frame.

### 2. High-DPI Rendering (Low FPS on Chrome)

- **Symptom**: Constant 30fps on Chrome vs 60fps on Safari (macOS).
- **Cause**: Chrome defaults to rendering at native Retina resolution (Device Pixel Ratio 2.0+), quadrupling the GPU fill rate requirement.
- **Fix**: Set `resolution: 1` in specific Phaser configuration to force 1:1 pixel mapping.

---

## Best Practices for Development

### A. ECS & Systems

1.  **Avoid `world.where` in Loops**: Never iterate over entities and perform a search inside that loop.
    - **Bad**: `for (entity of entities) { target = world.where(...).first }`
    - **Good**: Pre-cache targets in a `Map` or `Dictionary` at the start of the system or initialization.
2.  **Throttle Heavy logic**: Expensive operations like Pathfinding or complex Route Planning should not run for every entity every frame.
    - Use a "Budget" (e.g., 2ms per frame) or "Count" (e.g., 1 entity per frame).

### B. Rendering

1.  **Text Updates**: `text.setText()` is expensive (texture re-upload). Only call it when values _actually_ change.
2.  **Resolution**: Be aware of High-DPI devices. For pixel art or performance-heavy games, force `resolution: 1`.

### C. Profiling Strategy

1.  **Instrument First**: Don't guess. Add `performance.now()` logging around systems.
2.  **Granular Drill-down**: If a system is slow, break it down: Setup -> Loop -> Logic -> Cleanup.
3.  **Automated Testing**: Use unit tests to verify algorithms scale linearly (Stress Tests).
