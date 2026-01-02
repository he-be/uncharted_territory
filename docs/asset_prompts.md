# Asset Generation Prompts (Step 1-4)

This document lists the assets required for the game up to Phase 4 (including Enemies and Multi-Sector features) and their corresponding AI generation prompts.

**General Rules for Generation:**

- **Background**: Strictly black (`#000000`). Do NOT try to generate transparent backgrounds.
- **Style**: Top-down 2D Sci-Fi, Vector art style, Clean lines, High contrast.
- **Perspective**: Top-down view (flat).

---

## 1. Ships

### Player Ship

- **File**: `ship.png`
- **Usage**: The player's main vessel.
- **Prompt**:
  > Top-down view of a sci-fi spaceship made of junk, heroic design, industrial black and orange color scheme, single engine thruster at the back, wing-like structures, vector art style, flat 2D, black background.

### NPC Trader

- **File**: `npc_trader.png`
- **Usage**: Civilian trading vessels.
- **Prompt**:
  > Top-down view of sci-fi cargo spaceship, industrial design, yellow and grey warning stripes, large cargo containers attached, slow and heavy look, vector art style, flat 2D, black background.

### NPC Pirate

- **File**: `npc_pirate.png`
- **Usage**: Hostile enemy ships.
- **Prompt**:
  > Top-down view of an aggressive sci-fi small fighter spaceship, jagged edges, red and black paint, asymmetry, weapon mounts visible, menacing look, vector art style, flat 2D, black background.

---

## 2. Stations

### Trading Station (Hub)

- **File**: `station.png`
- **Usage**: General trading hub / Consumer market.
- **Prompt**:
  > Top-down view of a large circular space station, rotating ring habitat, multiple docking ports, civilian markings, clean white and blue lights, sci-fi city in space feel, vector art style, flat 2D, black background -ar 1:1

### Mining Station

- **File**: `station_mining.png`
- **Usage**: Ore production facility.
- **Prompt**:
  > Top-down view of an industrial space station, rough utilitarian design, attached to a large asteroid, mining lasers and drills visible, dusty orange and grey colors, vector art style, flat 2D, black background -ar 1:1

### Factory Station

- **File**: `station_factory.png`
- **Usage**: Goods production facility.
- **Prompt**:
  > Top-down view of a high-tech manufacturing space station, rectangular modules, glowing green production lines, solar panels, metallic and clean look, vector art style, flat 2D, black background -ar 1:1

---

## 3. Environment & Objects

### Jump Gate

- **File**: `gate.png`
- **Usage**: Teleportation portal between sectors.
- **Prompt**:
  > Top-down view of a massive sci-fi jump gate, circular structure with energy emitters, glowing blue vortex in the center, ancient metallic frame, mysterious technology, vector art style, flat 2D, black background -ar 1:1.

### Space Kraken (Boss/Event)

- **File**: `kraken.png`
- **Usage**: Large biological threat.
- **Prompt**:
  > Top-down view of a giant space kraken, biological cosmic horror, glowing bio-luminescent patterns, tentacles, dark purple and neon blue colors, threatening scale, vector art style, flat 2D, black background -ar 1:1

### Asteroid

- **File**: `asteroid.png`
- **Usage**: Obstacles / Decoration.
- **Prompt**:
  > Top-down view of a rocky asteroid, cratered surface, irregular shape, grey and brown tones, realistic lighting from one side, vector art style, flat 2D, black background -ar 1:1.

### Nebula Backgrounds

- **File**: `bg_nebula_a.png`, `bg_nebula_b.png`
- **Usage**: Sector backgrounds (tiled or parallax).
- **Prompt**:
  > Beautiful deep space nebula background, vibrant colors (purple and teal), distant stars, cosmic dust, high resolution, seamless pattern texture, digital art, black background -ar 1:1.

---

## 4. UI Icons / Effects

### Laser/Projectile

- **File**: `projectile_laser.png`
- **Usage**: Ship weapon fire.
- **Prompt**:
  > Top-down view of a single bright laser beam bolt, glowing red energy, tapered tail, simple shape for game sprite, black background -ar 1:1.

### Shield Effect

- **File**: `effect_shield.png`
- **Usage**: Hit impact on shield.
- **Prompt**:
  > Circular energy shield ripple effect, simple shape for game sprite, semi-transparent blue glowing hexagon pattern, impact point visualization, sci-fi energy barrier, black background -ar 1:1.
