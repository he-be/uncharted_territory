export type SlotType = 'front' | 'turret' | 'internal';

export interface ModuleConfig {
  id: string; // e.g. 'laser_mk1', 'pd_basic'
  type: 'weapon' | 'shield' | 'pd' | 'drone_bay'; // module type
  slot: SlotType; // Where it is attached
  offset?: { x: number; y: number }; // Visual/Physical offset from ship center
  params?: Record<string, unknown>; // Specific parameters (cooldown, damage, count etc)
}

export interface ShipConfig {
  type: 'player' | 'mother' | 'drone';
  name: string;
  hp: number;
  modules: ModuleConfig[];
}

export interface Loadout {
  modules: ModuleConfig[];
}
