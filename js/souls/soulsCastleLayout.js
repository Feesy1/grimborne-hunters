// 6-Zone Non-Linear Gothic Castle Layout, Pre-Boss Bonfire Checkpoint, 5-Gargoyle Flame Gauntlet,
// Exact Wall Line-of-Sight & Doorway Steering for `Abandoned Knight Rift` (?v=20261124z87).
// Pure zero-dependency ES module (Vanilla JS, V8/Browser/Node compatible).
//
// 6-Zone Non-Linear Progression (South +Z -> North -Z, zero "narrow corridor tube"):
//   Zone 1 — Awakening Hall (`spawn_hall`):           x in [-11.0, +11.0], z in [+46.0, +68.0] (Hero Spawn (0, 60.0), 0 enemies)
//   Zone 2 — Asymmetric West Cloister / Duel Atrium (`first_duel_atrium`):
//                                                     x in [-13.5, +8.5],  z in [+26.0, +46.0] (1v1 `starter_duelist` at (0, 36.0))
//   Zone 3 — 5-Gargoyle Flame Gauntlet (`flame_gauntlet`):
//                                                     x in [-5.2, +5.2],   z in [+8.0, +26.0]  (0 enemies; forbidden mob band [7.0, 26.5])
//   Zone 4 — Multi-Wing Knights' Nave (`knights_nave` + `west_wing` + `east_alcove`):
//              * `knights_nave`: x in [-5.5, +5.5],   z in [-16.0, +8.0]
//              * `west_wing`:    x in [-12.5, -6.3],  z in [-11.0, -1.0] (via `west_arch` z in [-8.4, -3.6])
//              * `east_alcove`:  x in [+6.3, +14.0],  z in [-9.0, +1.0]  (via `east_arch` z in [-6.4, -1.6], Relic (12.4, -4.0))
//              * 4 enemies: `nave_vanguard` (-2.2, 1.5), `west_wing_guard` (-8.5, -5.8),
//                           `east_alcove_warden` ambush (8.8, -4.0), `nave_acolyte` (2.0, -11.5)
//   Zone 5 — Pre-Boss Bonfire Sanctuary (`pre_boss_sanctuary`):
//                                                     x in [-8.0, +8.0],   z in [-32.0, -16.0] (Bonfire (2.6, -24.0), Checkpoint (0, -21.5), Safe R=8.5m)
//   Zone 6 — Massive Boss Doors (`z = -32.0`) & Enlarged Boss Throne Hall (`boss_hall`):
//                                                     center (0, -47.2), R = 16.0, Hero Entry (0, -37.2), Throne (0, -57.6)

export const SOULS_BONFIRE_SAFE_RADIUS = 8.5;
export const SOULS_FLAME_GAUNTLET_Z_MIN = 8.0;
export const SOULS_FLAME_GAUNTLET_Z_MAX = 25.5;
export const SOULS_FLAME_GAUNTLET_NO_MOB_MIN_Z = 7.0;
export const SOULS_FLAME_GAUNTLET_NO_MOB_MAX_Z = 26.5;
// Upper Z bound for Zone 4 Knights' Nave mobs so they NEVER step north-into-south into the Flame Gauntlet
export const SOULS_FLAME_TRAP_NO_MOB_Z = SOULS_FLAME_GAUNTLET_NO_MOB_MIN_Z;

export const SOULS_CASTLE_CONSTANTS = Object.freeze({
  BOSS_DOOR_Z: -32.0,
  BOSS_SEAL_Z: -32.2,
  BOSS_PORTAL_HALF_W: 3.15,
  BOSS_CENTER_X: 0,
  BOSS_CENTER_Z: -47.2,
  BOSS_RADIUS: 16.0,
  BOSS_HERO_ENTRY_Z: -37.2,
  BONFIRE_SAFE_RADIUS: SOULS_BONFIRE_SAFE_RADIUS,
  FLAME_GAUNTLET_Z_MIN: SOULS_FLAME_GAUNTLET_Z_MIN,
  FLAME_GAUNTLET_Z_MAX: SOULS_FLAME_GAUNTLET_Z_MAX,
  FLAME_GAUNTLET_NO_MOB_MIN_Z: SOULS_FLAME_GAUNTLET_NO_MOB_MIN_Z,
  FLAME_GAUNTLET_NO_MOB_MAX_Z: SOULS_FLAME_GAUNTLET_NO_MOB_MAX_Z,
  FLAME_TRAP_NO_MOB_Z: SOULS_FLAME_TRAP_NO_MOB_Z,

  // Zone 1 & 2 Southern Grand Canopy Envelope (Awakening Hall + Asymmetric Duel Atrium)
  SPAWN_HALL_MIN_X: -11.0,
  SPAWN_HALL_MAX_X: 11.0,
  SPAWN_HALL_MIN_Z: 46.0,
  SPAWN_HALL_MAX_Z: 68.0,
  ATRIUM_MIN_X: -13.5,
  ATRIUM_MAX_X: 8.5,
  ATRIUM_MIN_Z: 26.0,
  ATRIUM_MAX_Z: 46.0,
  COURTYARD_MIN_X: -13.5,
  COURTYARD_MAX_X: 11.0,
  COURTYARD_MIN_Z: 26.0,
  COURTYARD_MAX_Z: 68.0,

  // Zone 3, 4 & 5 Northern Multi-Hall Nave Envelope
  GAUNTLET_HALF_W: 5.2,
  CORRIDOR_HALF_W: 5.5,
  CORRIDOR_MIN_Z: -32.0,
  CORRIDOR_MAX_Z: 26.0,
  NAVE_MIN_Z: -16.0,
  NAVE_MAX_Z: 8.0,
  SANCTUARY_HALF_W: 8.0,
  SANCTUARY_MIN_Z: -32.0,
  SANCTUARY_MAX_Z: -16.0,

  // West Side-Chapel (`west_wing`) & East Armory Alcove (`east_alcove`)
  WEST_WING_MIN_X: -12.5,
  WEST_WING_MAX_X: -6.3,
  WEST_WING_MIN_Z: -11.0,
  WEST_WING_MAX_Z: -1.0,
  WEST_ARCH_MIN_Z: -8.4,
  WEST_ARCH_MAX_Z: -3.6,

  EAST_ALCOVE_MIN_X: 6.3,
  EAST_ALCOVE_MAX_X: 14.0,
  EAST_ALCOVE_MIN_Z: -9.0,
  EAST_ALCOVE_MAX_Z: 1.0,
  EAST_ARCH_MIN_Z: -6.4,
  EAST_ARCH_MAX_Z: -1.6,

  WALL_THICKNESS: 1.2,
  INTERIOR_PIER_THICKNESS: 0.8,
  COURTYARD_WALL_HEIGHT: 8.6,
  CORRIDOR_WALL_HEIGHT: 8.4,
  INSET_WALL_HEIGHT: 10.6,
  ALCOVE_WALL_HEIGHT: 7.8,
  BOSS_WALL_HEIGHT: 12.4,
  DEFAULT_ACTOR_RADIUS: 0.55
});

// Pre-Boss Bonfire Checkpoint in Zone 5 (`pre_boss_sanctuary`) — slightly east so central sightline to Boss Doors is wide open!
export const SOULS_CASTLE_BONFIRE = Object.freeze({
  id: 'bonfire_main',
  roomId: 'pre_boss_sanctuary',
  x: 2.6,
  z: -24.0,
  colliderRadius: 1.05,
  interactRadius: 3.0,
  safeRadius: SOULS_BONFIRE_SAFE_RADIUS,
  checkpointX: 0.0,
  checkpointZ: -21.5,
  checkpointFacing: Math.PI,
  promptRestRu: '🔥 Отдохнуть у Костра (Чекпоинт • 4/4 Фляги)'
});

// Initial fresh-run Awakening Spawn in Zone 1 (`spawn_hall`)
export const SOULS_CASTLE_PLAYER_SPAWN = Object.freeze({
  roomId: 'spawn_hall',
  x: 0.0,
  z: 60.0,
  facing: Math.PI
});

export const SOULS_CASTLE_DOOR_CONFIG = Object.freeze({
  id: 'boss_twin_doors',
  x: 0,
  z: SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z,
  sealZ: SOULS_CASTLE_CONSTANTS.BOSS_SEAL_Z,
  portalHalfWidth: SOULS_CASTLE_CONSTANTS.BOSS_PORTAL_HALF_W,
  portalWidth: SOULS_CASTLE_CONSTANTS.BOSS_PORTAL_HALF_W * 2,
  portalHeight: 6.4,
  interactX: 0,
  interactZ: -30.2,
  interactRadius: 3.1,
  insideInteractMinZ: -35.2,
  insideInteractMaxZ: -31.8,
  insideInteractHalfWidth: 3.6,
  promptOpenRu: 'Открыть врата'
});

export const SOULS_CASTLE_THRONE_CONFIG = Object.freeze({
  x: 0,
  z: -57.6,
  sitZ: -56.9,
  riseZ: -55.6,
  standZ: -53.4,
  heroEntryZ: SOULS_CASTLE_CONSTANTS.BOSS_HERO_ENTRY_Z,
  footrestY: 0.50,
  lowerStepY: 0.25,
  plinthY: 0.06,
  seatY: 1.53,
  colliderHalfW: 2.35,
  colliderHalfD: 1.45
});

// Solid AABB collider covering the Obsidian Throne (`souls_throne.glb` bounds: X in [-2.55, +2.55], Z in [-59.2, -56.0])
export const SOULS_CASTLE_THRONE_COLLIDER = Object.freeze({
  id: 'obsidian_throne',
  kind: 'throne',
  shape: 'aabb',
  roomId: 'boss_hall',
  x: SOULS_CASTLE_THRONE_CONFIG.x,
  z: SOULS_CASTLE_THRONE_CONFIG.z,
  halfW: SOULS_CASTLE_THRONE_CONFIG.colliderHalfW,
  halfD: SOULS_CASTLE_THRONE_CONFIG.colliderHalfD,
  width: SOULS_CASTLE_THRONE_CONFIG.colliderHalfW * 2,
  depth: SOULS_CASTLE_THRONE_CONFIG.colliderHalfD * 2,
  radius: Math.min(SOULS_CASTLE_THRONE_CONFIG.colliderHalfW, SOULS_CASTLE_THRONE_CONFIG.colliderHalfD),
  r: Math.min(SOULS_CASTLE_THRONE_CONFIG.colliderHalfW, SOULS_CASTLE_THRONE_CONFIG.colliderHalfD)
});

// Solid AABB colliders covering the left & right protruding Boss Door stone jamb pilasters,
// stepped plinths & outer buttresses at z = BOSS_DOOR_Z (-32.0) on BOTH Boss Hall & Sanctuary sides
// (x in [-6.65, -3.05] & [+3.05, +6.65], z in [-33.35, -30.98]; leaves full 5.0m clear doorway at |x| <= 2.50 for r=0.55)
export const SOULS_CASTLE_BOSS_DOOR_JAMB_COLLIDERS = Object.freeze([
  Object.freeze({
    id: 'boss_door_jamb_west_protrusion',
    kind: 'boss_door_jamb',
    shape: 'aabb',
    roomId: 'boss_portal',
    x: -4.85,
    z: -32.165,
    halfW: 1.80,
    halfD: 1.185,
    width: 3.60,
    depth: 2.37,
    radius: 1.185,
    r: 1.185
  }),
  Object.freeze({
    id: 'boss_door_jamb_east_protrusion',
    kind: 'boss_door_jamb',
    shape: 'aabb',
    roomId: 'boss_portal',
    x: 4.85,
    z: -32.165,
    halfW: 1.80,
    halfD: 1.185,
    width: 3.60,
    depth: 2.37,
    radius: 1.185,
    r: 1.185
  })
]);

// Canonical raised stone steps & dais platforms (exact X/Z/Y bounds matching soulsArena.js & soulsCastleDoors.js)
// Ordered ascending by `y` so smooth C1 bevel transitions step cleanly from 0.0 -> 0.05/0.06 -> 0.25 -> 0.50!
export const SOULS_CASTLE_ELEVATION_PLATFORMS = Object.freeze([
  Object.freeze({
    id: 'boss_door_threshold_sill',
    roomId: 'boss_portal',
    cx: 0,
    cz: SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z,
    halfW: SOULS_CASTLE_CONSTANTS.BOSS_PORTAL_HALF_W,
    halfD: 0.94,
    y: 0.05,
    bevel: 0.14
  }),
  Object.freeze({
    id: 'throne_dais_plinth',
    roomId: 'boss_hall',
    cx: SOULS_CASTLE_THRONE_CONFIG.x,
    cz: SOULS_CASTLE_THRONE_CONFIG.z - 0.05,
    halfW: 3.74,
    halfD: 2.44,
    y: SOULS_CASTLE_THRONE_CONFIG.plinthY,
    bevel: 0.14
  }),
  Object.freeze({
    id: 'throne_dais_step_1',
    roomId: 'boss_hall',
    cx: SOULS_CASTLE_THRONE_CONFIG.x,
    cz: SOULS_CASTLE_THRONE_CONFIG.z + 2.95,
    halfW: 3.04,
    halfD: 0.54,
    y: SOULS_CASTLE_THRONE_CONFIG.lowerStepY,
    bevel: 0.14
  }),
  Object.freeze({
    id: 'throne_dais_step_2',
    roomId: 'boss_hall',
    cx: SOULS_CASTLE_THRONE_CONFIG.x,
    cz: SOULS_CASTLE_THRONE_CONFIG.z + 2.025,
    halfW: 2.39,
    halfD: 0.47,
    y: SOULS_CASTLE_THRONE_CONFIG.footrestY,
    bevel: 0.14
  }),
  Object.freeze({
    id: 'throne_dais_footrest',
    roomId: 'boss_hall',
    cx: SOULS_CASTLE_THRONE_CONFIG.x,
    cz: SOULS_CASTLE_THRONE_CONFIG.z + 1.38,
    halfW: 0.83,
    halfD: 0.22,
    y: SOULS_CASTLE_THRONE_CONFIG.footrestY,
    bevel: 0.12
  })
]);

// Canonical shattered masonry rubble blocks & fallen broken column drums across all 6 zones
// (1:1 aligned with soulsArena.js darkStoneParts rubble & fallen column geometry!)
const _ALCOVE_MID_X = (SOULS_CASTLE_CONSTANTS.EAST_ALCOVE_MIN_X + SOULS_CASTLE_CONSTANTS.EAST_ALCOVE_MAX_X) * 0.5;
const _COURTYARD_WALL_X = SOULS_CASTLE_CONSTANTS.COURTYARD_MAX_X - 1.0;
const _ATRIUM_WEST_WALL_X = SOULS_CASTLE_CONSTANTS.ATRIUM_MIN_X + 0.92;
const _ATRIUM_EAST_WALL_X = SOULS_CASTLE_CONSTANTS.ATRIUM_MAX_X - 0.90;
const _CORRIDOR_WALL_X = SOULS_CASTLE_CONSTANTS.CORRIDOR_HALF_W - 0.9;
const _HALL_RUBBLE_X = SOULS_CASTLE_CONSTANTS.BOSS_RADIUS - 2.4;

export const SOULS_CASTLE_RUBBLE = Object.freeze([
  Object.freeze({ id: 'rubble_spawn_sw', roomId: 'spawn_hall', kind: 'rubble_box', shape: 'box', x: -_COURTYARD_WALL_X, y: 0.126, z: SOULS_CASTLE_CONSTANTS.COURTYARD_MAX_Z - 1.4, w: 0.52, h: 0.28, d: 0.44, rotX: 0.08, rotY: 0.5, rotZ: -0.06, rx: 0.08, ry: 0.5, rz: -0.06, radius: 0.38, collider: true }),
  Object.freeze({ id: 'rubble_spawn_se', roomId: 'spawn_hall', kind: 'rubble_box', shape: 'box', x: _COURTYARD_WALL_X - 0.2, y: 0.117, z: SOULS_CASTLE_CONSTANTS.COURTYARD_MAX_Z - 1.2, w: 0.48, h: 0.26, d: 0.42, rotX: 0.08, rotY: -0.6, rotZ: -0.06, rx: 0.08, ry: -0.6, rz: -0.06, radius: 0.36, collider: true }),
  Object.freeze({ id: 'fallen_column_spawn_ne', roomId: 'spawn_hall', kind: 'fallen_column', shape: 'cylinder', x: 9.55, y: 0.38, z: 53.35, rTop: 0.44, rBot: 0.48, length: 1.24, radialSegs: 9, rotX: Number((Math.PI * 0.485).toFixed(5)), rotY: -0.62, rotZ: -0.08, rx: Number((Math.PI * 0.485).toFixed(5)), ry: -0.62, rz: -0.08, radius: 0.68, collider: true }),
  Object.freeze({ id: 'rubble_spawn_nw_corner', roomId: 'spawn_hall', kind: 'rubble_box', shape: 'box', x: -10.15, y: 0.13, z: 53.6, w: 0.54, h: 0.29, d: 0.44, rotX: 0.07, rotY: 0.92, rotZ: -0.05, rx: 0.07, ry: 0.92, rz: -0.05, radius: 0.38, collider: true }),
  Object.freeze({ id: 'rubble_atrium_sw', roomId: 'first_duel_atrium', kind: 'rubble_box', shape: 'box', x: _ATRIUM_WEST_WALL_X, y: 0.135, z: SOULS_CASTLE_CONSTANTS.COURTYARD_MIN_Z + 4.8, w: 0.54, h: 0.30, d: 0.42, rotX: 0.08, rotY: 0.8, rotZ: -0.06, rx: 0.08, ry: 0.8, rz: -0.06, radius: 0.38, collider: true }),
  Object.freeze({ id: 'rubble_atrium_se', roomId: 'first_duel_atrium', kind: 'rubble_box', shape: 'box', x: _ATRIUM_EAST_WALL_X, y: 0.108, z: SOULS_CASTLE_CONSTANTS.COURTYARD_MIN_Z + 5.2, w: 0.46, h: 0.24, d: 0.40, rotX: 0.08, rotY: -0.4, rotZ: -0.06, rx: 0.08, ry: -0.4, rz: -0.06, radius: 0.35, collider: true }),
  Object.freeze({ id: 'fallen_column_atrium_cloister', roomId: 'first_duel_atrium', kind: 'fallen_column', shape: 'cylinder', x: -9.85, y: 0.38, z: 30.15, rTop: 0.44, rBot: 0.48, length: 1.22, radialSegs: 9, rotX: Number((Math.PI * 0.485).toFixed(5)), rotY: 0.48, rotZ: 0.09, rx: Number((Math.PI * 0.485).toFixed(5)), ry: 0.48, rz: 0.09, radius: 0.68, collider: true }),
  Object.freeze({ id: 'rubble_gauntlet_w', roomId: 'flame_gauntlet', kind: 'rubble_box', shape: 'box', x: -_CORRIDOR_WALL_X, y: 0.117, z: 9.0, w: 0.50, h: 0.26, d: 0.40, rotX: 0.08, rotY: 0.6, rotZ: -0.06, rx: 0.08, ry: 0.6, rz: -0.06, radius: 0.36, collider: true }),
  Object.freeze({ id: 'rubble_nave_e', roomId: 'knights_nave', kind: 'rubble_box', shape: 'box', x: _CORRIDOR_WALL_X, y: 0.108, z: -9.4, w: 0.48, h: 0.24, d: 0.38, rotX: 0.08, rotY: -0.5, rotZ: -0.06, rx: 0.08, ry: -0.5, rz: -0.06, radius: 0.35, collider: true }),
  Object.freeze({ id: 'rubble_nave_ne_slab', roomId: 'knights_nave', kind: 'rubble_box', shape: 'box', x: 4.78, y: 0.115, z: 7.55, w: 0.62, h: 0.24, d: 0.46, rotX: 0.06, rotY: -0.35, rotZ: 0.05, rx: 0.06, ry: -0.35, rz: 0.05, radius: 0.38, collider: true }),
  Object.freeze({ id: 'rubble_alcove_ne', roomId: 'east_alcove', kind: 'rubble_box', shape: 'box', x: _ALCOVE_MID_X + 2.8, y: 0.117, z: SOULS_CASTLE_CONSTANTS.EAST_ALCOVE_MIN_Z + 1.2, w: 0.48, h: 0.26, d: 0.40, rotX: 0.08, rotY: 0.4, rotZ: -0.06, rx: 0.08, ry: 0.4, rz: -0.06, radius: 0.35, collider: true }),
  Object.freeze({ id: 'rubble_alcove_se', roomId: 'east_alcove', kind: 'rubble_box', shape: 'box', x: _ALCOVE_MID_X + 2.8, y: 0.108, z: SOULS_CASTLE_CONSTANTS.EAST_ALCOVE_MAX_Z - 1.2, w: 0.44, h: 0.24, d: 0.38, rotX: 0.08, rotY: -0.7, rotZ: -0.06, rx: 0.08, ry: -0.7, rz: -0.06, radius: 0.33, collider: true }),
  Object.freeze({ id: 'rubble_boss_nw', roomId: 'boss_hall', kind: 'rubble_box', shape: 'box', x: -_HALL_RUBBLE_X, y: 0.153, z: SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z - 4.2, w: 0.62, h: 0.34, d: 0.50, rotX: 0.08, rotY: 0.7, rotZ: -0.06, rx: 0.08, ry: 0.7, rz: -0.06, radius: 0.44, collider: true }),
  Object.freeze({ id: 'rubble_boss_se', roomId: 'boss_hall', kind: 'rubble_box', shape: 'box', x: _HALL_RUBBLE_X, y: 0.135, z: SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z + 4.2, w: 0.56, h: 0.30, d: 0.46, rotX: 0.08, rotY: -0.4, rotZ: -0.06, rx: 0.08, ry: -0.4, rz: -0.06, radius: 0.40, collider: true }),
  Object.freeze({ id: 'fallen_column_boss_sw', roomId: 'boss_hall', kind: 'fallen_column', shape: 'cylinder', x: -_HALL_RUBBLE_X, y: 0.42, z: SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z + 5.6, rTop: 0.48, rBot: 0.52, length: 1.38, radialSegs: 9, rotX: Number((Math.PI * 0.48).toFixed(5)), rotY: 0.55, rotZ: 0.12, rx: Number((Math.PI * 0.48).toFixed(5)), ry: 0.55, rz: 0.12, radius: 0.78, collider: true }),
  Object.freeze({ id: 'fallen_column_boss_ne', roomId: 'boss_hall', kind: 'fallen_column', shape: 'cylinder', x: _HALL_RUBBLE_X, y: 0.40, z: SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z - 5.2, rTop: 0.46, rBot: 0.50, length: 1.30, radialSegs: 9, rotX: Number((Math.PI * 0.49).toFixed(5)), rotY: -0.72, rotZ: -0.08, rx: Number((Math.PI * 0.49).toFixed(5)), ry: -0.72, rz: -0.08, radius: 0.75, collider: true })
]);

// ============================================================================
// 1. Canonical 6-Zone Non-Linear Rooms (+ Canopy Envelopes `courtyard` & `corridor`
//    for 100% seamless compatibility with `soulsCastleRoof.js` & `soulsAtmosphere.js`)
// ============================================================================
export const SOULS_CASTLE_ROOMS = Object.freeze({
  // Zone 1: Spacious Gothic Awakening Hall
  spawn_hall: Object.freeze({
    id: 'spawn_hall',
    zoneIndex: 1,
    labelRu: 'Зал Пробуждения',
    shape: 'rect',
    minX: -11.0,
    maxX: 11.0,
    minZ: 46.0,
    maxZ: 68.0,
    surface: 'stone_courtyard',
    floorY: 0,
    ceilingY: 11.8,
    isBranch: false,
    isConnector: false,
    requiresOpenDoor: false
  }),
  // Zone 2: Asymmetric Western Cloister & First Duel Atrium
  first_duel_atrium: Object.freeze({
    id: 'first_duel_atrium',
    zoneIndex: 2,
    labelRu: 'Западный Клуатр Первой Дуэли',
    shape: 'rect',
    minX: -13.5,
    maxX: 8.5,
    minZ: 26.0,
    maxZ: 46.0,
    surface: 'stone_courtyard',
    floorY: 0,
    ceilingY: 11.8,
    isBranch: false,
    isConnector: false,
    requiresOpenDoor: false
  }),
  // Zone 3: 5-Gargoyle Flame Gauntlet
  flame_gauntlet: Object.freeze({
    id: 'flame_gauntlet',
    zoneIndex: 3,
    labelRu: 'Галерея Огненной Ловушки',
    shape: 'rect',
    minX: -5.2,
    maxX: 5.2,
    minZ: 8.0,
    maxZ: 26.0,
    surface: 'stone_bridge',
    floorY: 0,
    ceilingY: 10.6,
    isBranch: false,
    isConnector: false,
    requiresOpenDoor: false
  }),
  // Zone 4: Multi-Wing Knights' Nave + West Side-Chapel + East Armory Alcove
  knights_nave: Object.freeze({
    id: 'knights_nave',
    zoneIndex: 4,
    labelRu: 'Рыцарский Неф',
    shape: 'rect',
    minX: -5.5,
    maxX: 5.5,
    minZ: -16.0,
    maxZ: 8.0,
    surface: 'stone_bridge',
    floorY: 0,
    ceilingY: 10.6,
    isBranch: false,
    isConnector: false,
    requiresOpenDoor: false
  }),
  west_arch: Object.freeze({
    id: 'west_arch',
    zoneIndex: 4,
    labelRu: 'Арка Западного Придела',
    shape: 'rect',
    minX: -6.3,
    maxX: -5.5,
    minZ: -8.4,
    maxZ: -3.6,
    surface: 'cathedral_stone',
    floorY: 0,
    ceilingY: 6.2,
    isBranch: true,
    isConnector: true,
    requiresOpenDoor: false
  }),
  west_wing: Object.freeze({
    id: 'west_wing',
    zoneIndex: 4,
    labelRu: 'Западный Придел',
    shape: 'rect',
    minX: -12.5,
    maxX: -6.3,
    minZ: -11.0,
    maxZ: -1.0,
    surface: 'cathedral_stone',
    floorY: 0,
    ceilingY: 10.2,
    isBranch: true,
    isConnector: false,
    requiresOpenDoor: false
  }),
  east_arch: Object.freeze({
    id: 'east_arch',
    zoneIndex: 4,
    labelRu: 'Арка Восточного Алькова',
    shape: 'rect',
    minX: 5.5,
    maxX: 6.3,
    minZ: -6.4,
    maxZ: -1.6,
    surface: 'stone_bridge',
    floorY: 0,
    ceilingY: 5.8,
    isBranch: true,
    isConnector: true,
    requiresOpenDoor: false
  }),
  east_alcove: Object.freeze({
    id: 'east_alcove',
    zoneIndex: 4,
    labelRu: 'Восточный Альков — Оружейная',
    shape: 'rect',
    minX: 6.3,
    maxX: 14.0,
    minZ: -9.0,
    maxZ: 1.0,
    surface: 'cathedral_stone',
    floorY: 0,
    ceilingY: 8.9,
    isBranch: true,
    isConnector: false,
    requiresOpenDoor: false
  }),
  // Zone 5: Pre-Boss Bonfire Sanctuary
  pre_boss_sanctuary: Object.freeze({
    id: 'pre_boss_sanctuary',
    zoneIndex: 5,
    labelRu: 'Святилище Костра',
    shape: 'rect',
    minX: -8.0,
    maxX: 8.0,
    minZ: -32.0,
    maxZ: -16.0,
    surface: 'stone_courtyard',
    floorY: 0,
    ceilingY: 10.6,
    isBranch: false,
    isConnector: false,
    requiresOpenDoor: false
  }),
  // Zone 6: Boss Door Portal & Enlarged Boss Throne Hall
  boss_portal: Object.freeze({
    id: 'boss_portal',
    zoneIndex: 6,
    labelRu: 'Порог Врат Босса',
    shape: 'rect',
    minX: -3.15,
    maxX: 3.15,
    minZ: -33.8,
    maxZ: -31.0,
    surface: 'cathedral_stone',
    floorY: 0,
    ceilingY: 7.65,
    isBranch: false,
    isConnector: true,
    requiresOpenDoor: true
  }),
  boss_hall: Object.freeze({
    id: 'boss_hall',
    zoneIndex: 6,
    labelRu: 'Тронный Зал Босса',
    shape: 'circle',
    cx: 0,
    cz: -47.2,
    radius: 16.0,
    maxZ: -32.2,
    surface: 'cathedral_stone',
    floorY: 0,
    ceilingY: 18.2,
    isBranch: false,
    isConnector: false,
    requiresOpenDoor: true
  }),

  // Canopy envelope aliases consumed by `soulsCastleRoof.js` & `soulsAtmosphere.js`
  // so 100% of Zones 1–5 (including West Cloister & West Wing!) sit under continuous vaulted roofs & mist!
  courtyard: Object.freeze({
    id: 'courtyard',
    labelRu: 'Южное Крыло (Зал Пробуждения и Клуатр)',
    shape: 'rect',
    minX: -13.5,
    maxX: 11.0,
    minZ: 26.0,
    maxZ: 68.0,
    surface: 'stone_courtyard',
    floorY: 0,
    ceilingY: 11.8,
    isEnvelopeAlias: true,
    isBranch: false,
    isConnector: false,
    requiresOpenDoor: false
  }),
  corridor: Object.freeze({
    id: 'corridor',
    labelRu: 'Северный Неф (Галерея, Придел и Святилище Костра)',
    shape: 'rect',
    minX: -12.5,
    maxX: 8.0,
    minZ: -32.0,
    maxZ: 26.0,
    surface: 'stone_bridge',
    floorY: 0,
    ceilingY: 10.6,
    isEnvelopeAlias: true,
    isBranch: false,
    isConnector: false,
    requiresOpenDoor: false
  })
});

export const SOULS_CASTLE_ROOM_LIST = Object.freeze(
  Object.values(SOULS_CASTLE_ROOMS).filter((r) => !r.isEnvelopeAlias)
);

// Non-overlapping architectural stone floor slabs (zero Z-fighting across all 6 zones)
export const SOULS_CASTLE_FLOOR_SLABS = Object.freeze([
  Object.freeze({ id: 'floor_spawn_hall', roomId: 'spawn_hall', shape: 'rect', cx: 0, cz: 57.3, width: 23.2, depth: 22.6, y: 0, surface: 'stone_courtyard' }),
  Object.freeze({ id: 'floor_first_duel_atrium', roomId: 'first_duel_atrium', shape: 'rect', cx: -2.5, cz: 36.0, width: 23.2, depth: 20.0, y: 0, surface: 'stone_courtyard' }),
  Object.freeze({ id: 'floor_flame_gauntlet', roomId: 'flame_gauntlet', shape: 'rect', cx: 0, cz: 17.0, width: 11.6, depth: 18.0, y: 0, surface: 'stone_bridge' }),
  Object.freeze({ id: 'floor_knights_nave', roomId: 'knights_nave', shape: 'rect', cx: 0, cz: -4.0, width: 12.2, depth: 24.0, y: 0, surface: 'stone_bridge' }),
  Object.freeze({ id: 'floor_west_wing', roomId: 'west_wing', shape: 'rect', cx: -9.5, cz: -6.0, width: 7.4, depth: 11.2, y: 0, surface: 'cathedral_stone' }),
  Object.freeze({ id: 'floor_east_alcove', roomId: 'east_alcove', shape: 'rect', cx: 10.2, cz: -4.0, width: 8.4, depth: 11.2, y: 0, surface: 'cathedral_stone' }),
  Object.freeze({ id: 'floor_pre_boss_sanctuary', roomId: 'pre_boss_sanctuary', shape: 'rect', cx: 0, cz: -24.2, width: 17.2, depth: 16.4, y: 0, surface: 'stone_courtyard' }),
  Object.freeze({ id: 'floor_boss_hall', roomId: 'boss_hall', shape: 'circle', cx: 0, cz: -47.2, radius: 16.8, y: -0.004, surface: 'cathedral_stone' })
]);

// ============================================================================
// 2. Internal Walkable Primitives (Deep-Overlap Minkowski-Safe Union)
//    Every connector extends 2.5m deeply into its two adjacent chambers (while
//    remaining 100% inside the true walkable union) so Minkowski erosion by
//    `r <= 1.25` ALWAYS overlaps seamlessly across every archway — ZERO seams!
// ============================================================================
const CASTLE_SIDE_RECTS = Object.freeze([
  Object.freeze({ id: 'spawn_hall', minX: -11.0, maxX: 11.0, minZ: 46.0, maxZ: 68.0 }),
  Object.freeze({ id: 'spawn_to_atrium', minX: -11.0, maxX: 8.5, minZ: 43.5, maxZ: 48.5 }),
  Object.freeze({ id: 'first_duel_atrium', minX: -13.5, maxX: 8.5, minZ: 26.0, maxZ: 46.0 }),
  Object.freeze({ id: 'flame_gauntlet', minX: -5.2, maxX: 5.2, minZ: 5.5, maxZ: 28.5 }),
  Object.freeze({ id: 'knights_nave', minX: -5.5, maxX: 5.5, minZ: -18.5, maxZ: 8.0 }),
  Object.freeze({ id: 'west_arch', minX: -8.8, maxX: -3.0, minZ: -8.4, maxZ: -3.6 }),
  Object.freeze({ id: 'west_wing', minX: -12.5, maxX: -6.3, minZ: -11.0, maxZ: -1.0 }),
  Object.freeze({ id: 'east_arch', minX: 3.0, maxX: 8.8, minZ: -6.4, maxZ: -1.6 }),
  Object.freeze({ id: 'east_alcove', minX: 6.3, maxX: 14.0, minZ: -9.0, maxZ: 1.0 }),
  Object.freeze({ id: 'pre_boss_sanctuary', minX: -8.0, maxX: 8.0, minZ: -32.0, maxZ: -16.0 })
]);

const BOSS_PORTAL_RECT = Object.freeze({
  id: 'boss_portal',
  minX: -3.15,
  maxX: 3.15,
  minZ: -35.2,
  maxZ: -29.6
});

const BOSS_HALL_CAPPED_DISK = Object.freeze({
  id: 'boss_hall',
  cx: SOULS_CASTLE_CONSTANTS.BOSS_CENTER_X,
  cz: SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z,
  radius: SOULS_CASTLE_CONSTANTS.BOSS_RADIUS,
  maxZ: SOULS_CASTLE_CONSTANTS.BOSS_SEAL_Z
});

function isInsideErodedRect(x, z, rect, r) {
  const minX = rect.minX + r;
  const maxX = rect.maxX - r;
  const minZ = rect.minZ + r;
  const maxZ = rect.maxZ - r;
  if (minX > maxX || minZ > maxZ) return false;
  return x >= minX && x <= maxX && z >= minZ && z <= maxZ;
}

function projectToErodedRect(x, z, rect, r, out) {
  let minX = rect.minX + r;
  let maxX = rect.maxX - r;
  let minZ = rect.minZ + r;
  let maxZ = rect.maxZ - r;
  if (minX > maxX) {
    const midX = (rect.minX + rect.maxX) * 0.5;
    minX = midX;
    maxX = midX;
  }
  if (minZ > maxZ) {
    const midZ = (rect.minZ + rect.maxZ) * 0.5;
    minZ = midZ;
    maxZ = midZ;
  }
  const px = x < minX ? minX : (x > maxX ? maxX : x);
  const pz = z < minZ ? minZ : (z > maxZ ? maxZ : z);
  const dx = x - px;
  const dz = z - pz;
  out.x = px;
  out.z = pz;
  out.distSq = dx * dx + dz * dz;
  return out;
}

function isInsideErodedCappedDisk(x, z, disk, r) {
  const effR = Math.max(0.05, disk.radius - r);
  const capZ = disk.maxZ - r;
  if (z > capZ) return false;
  const dx = x - disk.cx;
  const dz = z - disk.cz;
  return dx * dx + dz * dz <= effR * effR + 1e-9;
}

function projectToErodedCappedDisk(x, z, disk, r, out) {
  const effR = Math.max(0.05, disk.radius - r);
  const capZ = disk.maxZ - r;
  const dx = x - disk.cx;
  const dz = z - disk.cz;
  const distSq = dx * dx + dz * dz;

  if (z <= capZ && distSq <= effR * effR) {
    out.x = x;
    out.z = z;
    out.distSq = 0;
    return out;
  }

  const capDz = capZ - disk.cz;
  const capHalfXSq = effR * effR - capDz * capDz;
  const capHalfX = capHalfXSq > 0 ? Math.sqrt(capHalfXSq) : 0;

  let bestX = disk.cx + (dx < -capHalfX ? -capHalfX : (dx > capHalfX ? capHalfX : dx));
  let bestZ = capZ;
  let bestDistSq = (x - bestX) * (x - bestX) + (z - bestZ) * (z - bestZ);

  if (distSq > 1e-12) {
    const invDist = effR / Math.sqrt(distSq);
    const arcX = disk.cx + dx * invDist;
    const arcZ = disk.cz + dz * invDist;
    if (arcZ <= capZ + 1e-9) {
      const adx = x - arcX;
      const adz = z - arcZ;
      const arcDistSq = adx * adx + adz * adz;
      if (arcDistSq < bestDistSq) {
        bestX = arcX;
        bestZ = arcZ;
        bestDistSq = arcDistSq;
      }
    }
  } else {
    const cdz = z - Math.min(disk.cz, capZ);
    const cDistSq = dx * dx + cdz * cdz;
    if (cDistSq < bestDistSq) {
      bestX = disk.cx;
      bestZ = Math.min(disk.cz, capZ);
      bestDistSq = cDistSq;
    }
  }

  out.x = bestX;
  out.z = bestZ;
  out.distSq = bestDistSq;
  return out;
}

const _tmpProj = { x: 0, z: 0, distSq: 0 };

function resolveActiveDomain(z, bossDoorState, allowBossHallOpt) {
  const doorState = bossDoorState || 'closed';
  if (doorState === 'open') return 'full_open';
  if (doorState === 'sealed') {
    if (allowBossHallOpt === false) return 'castle_only';
    return 'boss_only';
  }
  if (allowBossHallOpt === true && z < SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z) {
    return 'boss_only';
  }
  return 'castle_only';
}

function isInsideDomain(x, z, r, domain) {
  if (domain === 'boss_only') {
    return isInsideErodedCappedDisk(x, z, BOSS_HALL_CAPPED_DISK, r);
  }
  for (let i = 0; i < CASTLE_SIDE_RECTS.length; i++) {
    if (isInsideErodedRect(x, z, CASTLE_SIDE_RECTS[i], r)) return true;
  }
  if (domain === 'full_open') {
    return (
      isInsideErodedRect(x, z, BOSS_PORTAL_RECT, r) ||
      isInsideErodedCappedDisk(x, z, BOSS_HALL_CAPPED_DISK, r)
    );
  }
  return false;
}

function projectToDomain(x, z, r, domain, out) {
  if (domain === 'boss_only') {
    projectToErodedCappedDisk(x, z, BOSS_HALL_CAPPED_DISK, r, _tmpProj);
    out.x = _tmpProj.x;
    out.z = _tmpProj.z;
    return out;
  }

  if (isInsideDomain(x, z, r, domain)) {
    out.x = x;
    out.z = z;
    return out;
  }

  let bestX = SOULS_CASTLE_PLAYER_SPAWN.x;
  let bestZ = SOULS_CASTLE_PLAYER_SPAWN.z;
  let bestDistSq = Infinity;

  for (let i = 0; i < CASTLE_SIDE_RECTS.length; i++) {
    projectToErodedRect(x, z, CASTLE_SIDE_RECTS[i], r, _tmpProj);
    if (_tmpProj.distSq < bestDistSq) {
      bestDistSq = _tmpProj.distSq;
      bestX = _tmpProj.x;
      bestZ = _tmpProj.z;
    }
  }

  if (domain === 'full_open') {
    projectToErodedRect(x, z, BOSS_PORTAL_RECT, r, _tmpProj);
    if (_tmpProj.distSq < bestDistSq) {
      bestDistSq = _tmpProj.distSq;
      bestX = _tmpProj.x;
      bestZ = _tmpProj.z;
    }
    projectToErodedCappedDisk(x, z, BOSS_HALL_CAPPED_DISK, r, _tmpProj);
    if (_tmpProj.distSq < bestDistSq) {
      bestDistSq = _tmpProj.distSq;
      bestX = _tmpProj.x;
      bestZ = _tmpProj.z;
    }
  }

  out.x = bestX;
  out.z = bestZ;
  return out;
}

function overlapsSingleCollider(x, z, r, c, eps = 1e-6) {
  if (!c) return false;
  if (c.halfW !== undefined && c.halfD !== undefined) {
    const dx = x - c.x;
    const dz = z - c.z;
    const hw = c.halfW;
    const hd = c.halfD;
    const clx = dx < -hw ? c.x - hw : (dx > hw ? c.x + hw : x);
    const clz = dz < -hd ? c.z - hd : (dz > hd ? c.z + hd : z);
    const ex = x - clx;
    const ez = z - clz;
    const rr = Math.max(0, r - eps);
    if (ex === 0 && ez === 0) return true;
    return ex * ex + ez * ez < rr * rr;
  }
  const cr = c.radius ?? c.r ?? 0.55;
  const minDist = Math.max(0, r + cr - eps);
  const dx = x - c.x;
  const dz = z - c.z;
  return dx * dx + dz * dz < minDist * minDist;
}

function pushOutOfSingleCollider(pos, r, c) {
  if (!c) return false;
  if (c.halfW !== undefined && c.halfD !== undefined) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const hw = c.halfW;
    const hd = c.halfD;
    const absX = dx < 0 ? -dx : dx;
    const absZ = dz < 0 ? -dz : dz;
    if (absX <= hw && absZ <= hd) {
      const penX = hw - absX;
      const penZ = hd - absZ;
      if (penX < penZ) {
        pos.x = dx < 0 ? (c.x - hw - r) : (c.x + hw + r);
      } else {
        pos.z = dz < 0 ? (c.z - hd - r) : (c.z + hd + r);
      }
      return true;
    }
    const clx = dx < -hw ? c.x - hw : (dx > hw ? c.x + hw : pos.x);
    const clz = dz < -hd ? c.z - hd : (dz > hd ? c.z + hd : pos.z);
    const ex = pos.x - clx;
    const ez = pos.z - clz;
    const dSq = ex * ex + ez * ez;
    if (dSq < r * r) {
      if (dSq > 1e-10) {
        const inv = r / Math.sqrt(dSq);
        pos.x = clx + ex * inv;
        pos.z = clz + ez * inv;
      } else if (absX - hw >= absZ - hd) {
        pos.x = dx < 0 ? (c.x - hw - r) : (c.x + hw + r);
      } else {
        pos.z = dz < 0 ? (c.z - hd - r) : (c.z + hd + r);
      }
      return true;
    }
    return false;
  }

  const cr = c.radius ?? c.r ?? 0.55;
  const minDist = r + cr;
  const dx = pos.x - c.x;
  const dz = pos.z - c.z;
  const dSq = dx * dx + dz * dz;
  if (dSq < minDist * minDist) {
    if (dSq > 1e-10) {
      const inv = minDist / Math.sqrt(dSq);
      pos.x = c.x + dx * inv;
      pos.z = c.z + dz * inv;
    } else {
      pos.z = c.z + minDist;
    }
    return true;
  }
  return false;
}

function overlapsBossDoorJambs(x, z, r) {
  for (let i = 0; i < SOULS_CASTLE_BOSS_DOOR_JAMB_COLLIDERS.length; i++) {
    if (overlapsSingleCollider(x, z, r, SOULS_CASTLE_BOSS_DOOR_JAMB_COLLIDERS[i])) {
      return true;
    }
  }
  return false;
}

let _cachedStaticColliders = null;
function getCachedStaticColliders() {
  if (!_cachedStaticColliders) {
    _cachedStaticColliders = Object.freeze(getCastleStaticColliders());
  }
  return _cachedStaticColliders;
}

function shouldSkipCollider(c, ignoreThrone, ignoreBossDoorJambs) {
  if (!c) return true;
  if (ignoreThrone && c.kind === 'throne') return true;
  if (ignoreBossDoorJambs && c.kind === 'boss_door_jamb') return true;
  return false;
}

function overlapsAnyActiveStaticCollider(x, z, r, ignoreThrone, ignoreBossDoorJambs) {
  const list = getCachedStaticColliders();
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (shouldSkipCollider(c, ignoreThrone, ignoreBossDoorJambs)) continue;
    if (overlapsSingleCollider(x, z, r, c)) return true;
  }
  return false;
}

function resolveWallColliderPinch(pos, r, domain, col, wnX, wnZ, ignoreThrone, ignoreBossDoorJambs) {
  const px = pos.x;
  const pz = pos.z;
  let bestX = px;
  let bestZ = pz;
  let bestDistSq = Infinity;
  let bestClearAll = false;

  const tryCandidate = (cx, cz) => {
    if (!isInsideDomain(cx, cz, r, domain)) return;
    if (overlapsSingleCollider(cx, cz, r, col, 1e-4)) return;
    const clearAll = !overlapsAnyActiveStaticCollider(cx, cz, r, ignoreThrone, ignoreBossDoorJambs);
    if (bestClearAll && !clearAll) return;
    const dx = cx - px;
    const dz = cz - pz;
    const dSq = dx * dx + dz * dz;
    if ((clearAll && !bestClearAll) || dSq < bestDistSq) {
      bestClearAll = clearAll;
      bestDistSq = dSq;
      bestX = cx;
      bestZ = cz;
    }
  };

  if (col.halfW !== undefined && col.halfD !== undefined) {
    const pad = r + 1e-3;
    tryCandidate(col.x - col.halfW - pad, pz);
    tryCandidate(col.x + col.halfW + pad, pz);
    tryCandidate(px, col.z - col.halfD - pad);
    tryCandidate(px, col.z + col.halfD + pad);
    tryCandidate(col.x - col.halfW - pad, col.z - col.halfD - pad);
    tryCandidate(col.x + col.halfW + pad, col.z - col.halfD - pad);
    tryCandidate(col.x - col.halfW - pad, col.z + col.halfD + pad);
    tryCandidate(col.x + col.halfW + pad, col.z + col.halfD + pad);
  } else {
    const cr = col.radius ?? col.r ?? 0.55;
    const minDist = r + cr + 1e-3;
    // Candidate 1: step directly inward away from wall past obstacle center
    tryCandidate(col.x + wnX * minDist, col.z + wnZ * minDist);
    // Candidates 2 & 3: slide cleanly along wall tangent around obstacle
    const tX = -wnZ;
    const tZ = wnX;
    const relX = px - col.x;
    const relZ = pz - col.z;
    const dNormal = relX * wnX + relZ * wnZ;
    const remSq = minDist * minDist - dNormal * dNormal;
    if (remSq > 0) {
      const rem = Math.sqrt(remSq) + 0.015;
      const baseX = col.x + wnX * dNormal;
      const baseZ = col.z + wnZ * dNormal;
      tryCandidate(baseX + tX * rem, baseZ + tZ * rem);
      tryCandidate(baseX - tX * rem, baseZ - tZ * rem);
    }
    tryCandidate(col.x + tX * minDist, col.z + tZ * minDist);
    tryCandidate(col.x - tX * minDist, col.z - tZ * minDist);
  }

  // Fallback for tight 3-way pockets (two neighboring props + corner wall): sample concentric escape ring
  if (!bestClearAll) {
    const baseR = (col.halfW !== undefined ? Math.hypot(col.halfW, col.halfD) : (col.radius ?? col.r ?? 0.55)) + r + 0.05;
    for (let ring = 0; ring < 3; ring++) {
      const rad = baseR + ring * 0.75;
      for (let k = 0; k < 12; k++) {
        const ang = (k / 12) * Math.PI * 2;
        tryCandidate(col.x + Math.cos(ang) * rad, col.z + Math.sin(ang) * rad);
      }
      if (bestClearAll) break;
    }
  }

  if (bestDistSq < Infinity) {
    pos.x = bestX;
    pos.z = bestZ;
    return true;
  }
  return false;
}

const _clampPosTmp = { x: 0, z: 0 };
const _wallProjTmp = { x: 0, z: 0 };

/**
 * Exact, zero-seam position clamping across all 6 Non-Linear Castle Zones & Boss Hall,
 * enforcing ALL architectural walls, Boss Door jamb protrusions, Obsidian Throne,
 * intact/broken pillars, rubble blocks, fallen columns, braziers, Bonfire, and shrines.
 */
export function clampCastlePosition(x, z, radius = 0.55, options = {}) {
  const opts = options || {};
  const bossDoorState = opts.bossDoorState || 'closed';
  const allowBossHallOpt = opts.allowBossHall;
  const out = opts.out || { x: 0, z: 0 };

  const r = Number.isFinite(radius) ? Math.max(0, Math.min(2.2, radius)) : 0.55;
  const safeX = Number.isFinite(x) ? x : 0;
  const safeZ = Number.isFinite(z)
    ? z
    : (bossDoorState === 'sealed' ? SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z : SOULS_CASTLE_PLAYER_SPAWN.z);

  const domain = resolveActiveDomain(safeZ, bossDoorState, allowBossHallOpt);

  projectToDomain(safeX, safeZ, r, domain, _clampPosTmp);

  if (!opts.ignoreStaticColliders) {
    const colliders = getCachedStaticColliders();
    const ignoreThrone = Boolean(opts.ignoreThrone);
    const ignoreBossDoorJambs = Boolean(opts.ignoreBossDoorJambs);

    for (let pass = 0; pass < 6; pass++) {
      let pushed = false;
      for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        if (shouldSkipCollider(c, ignoreThrone, ignoreBossDoorJambs)) continue;
        if (pushOutOfSingleCollider(_clampPosTmp, r, c)) {
          pushed = true;
        }
      }
      if (!pushed) break;

      if (!isInsideDomain(_clampPosTmp.x, _clampPosTmp.z, r, domain)) {
        const preX = _clampPosTmp.x;
        const preZ = _clampPosTmp.z;
        projectToDomain(preX, preZ, r, domain, _wallProjTmp);
        const wx = _wallProjTmp.x - preX;
        const wz = _wallProjTmp.z - preZ;
        const wLen = Math.hypot(wx, wz);
        _clampPosTmp.x = _wallProjTmp.x;
        _clampPosTmp.z = _wallProjTmp.z;

        if (wLen > 1e-6) {
          const wnX = wx / wLen;
          const wnZ = wz / wLen;
          for (let i = 0; i < colliders.length; i++) {
            const c = colliders[i];
            if (shouldSkipCollider(c, ignoreThrone, ignoreBossDoorJambs)) continue;
            if (overlapsSingleCollider(_clampPosTmp.x, _clampPosTmp.z, r, c, 1e-4)) {
              resolveWallColliderPinch(_clampPosTmp, r, domain, c, wnX, wnZ, ignoreThrone, ignoreBossDoorJambs);
            }
          }
        }
      } else if (!overlapsAnyActiveStaticCollider(_clampPosTmp.x, _clampPosTmp.z, r, ignoreThrone, ignoreBossDoorJambs)) {
        break;
      }
    }

    // Rare V-wedge fallback (e.g. wide Boss r=1.75 wedged between two neighboring props): escape cleanly to nearest valid spot
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (shouldSkipCollider(c, ignoreThrone, ignoreBossDoorJambs)) continue;
      if (overlapsSingleCollider(_clampPosTmp.x, _clampPosTmp.z, r, c, 1e-3)) {
        const cxRef = domain === 'boss_only' ? SOULS_CASTLE_CONSTANTS.BOSS_CENTER_X : 0;
        const czRef = domain === 'boss_only' ? SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z : _clampPosTmp.z;
        const dxIn = cxRef - _clampPosTmp.x;
        const dzIn = czRef - _clampPosTmp.z;
        const dIn = Math.hypot(dxIn, dzIn) || 1;
        resolveWallColliderPinch(_clampPosTmp, r, domain, c, dxIn / dIn, dzIn / dIn, ignoreThrone, ignoreBossDoorJambs);
      }
    }

    if (!isInsideDomain(_clampPosTmp.x, _clampPosTmp.z, r, domain)) {
      projectToDomain(_clampPosTmp.x, _clampPosTmp.z, r, domain, _clampPosTmp);
    }
  } else if (opts.includeBossDoorJambs) {
    for (let i = 0; i < SOULS_CASTLE_BOSS_DOOR_JAMB_COLLIDERS.length; i++) {
      pushOutOfSingleCollider(_clampPosTmp, r, SOULS_CASTLE_BOSS_DOOR_JAMB_COLLIDERS[i]);
    }
    if (!isInsideDomain(_clampPosTmp.x, _clampPosTmp.z, r, domain)) {
      projectToDomain(_clampPosTmp.x, _clampPosTmp.z, r, domain, _clampPosTmp);
    }
  }

  out.x = _clampPosTmp.x;
  out.z = _clampPosTmp.z;
  return out;
}

// Explicit alias requested by Wave 2 architecture
export const clampToCastleWalkable = clampCastlePosition;

/**
 * Checks whether (x, z) is validly inside the eroded walkable domain and clear of solid colliders.
 */
export function isInsideCastleWalkable(x, z, radius = 0.55, options = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  const opts = options || {};
  const r = Number.isFinite(radius) ? Math.max(0, Math.min(2.2, radius)) : 0.55;
  const domain = resolveActiveDomain(z, opts.bossDoorState || 'closed', opts.allowBossHall);
  if (!isInsideDomain(x, z, r, domain)) return false;
  if (!opts.ignoreStaticColliders) {
    if (overlapsAnyActiveStaticCollider(x, z, r, Boolean(opts.ignoreThrone), Boolean(opts.ignoreBossDoorJambs))) {
      return false;
    }
  }
  return true;
}

/**
 * Returns the exact smooth physical stone floor / step / dais elevation (in meters) at world (x, z).
 * Matches `SOULS_CASTLE_ELEVATION_PLATFORMS` (flat floor = 0.0, Boss Door sill = 0.05,
 * Throne dais plinth = 0.06, lower dais step = 0.25, upper dais step / footrest = 0.50).
 */
export function getCastleFloorHeight(x = 0, z = 0) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
  if (z > -30.5) return 0;
  let h = 0;
  for (let i = 0; i < SOULS_CASTLE_ELEVATION_PLATFORMS.length; i++) {
    const p = SOULS_CASTLE_ELEVATION_PLATFORMS[i];
    if (p.y <= h) continue;
    const ex = Math.abs(x - p.cx) - p.halfW;
    const ez = Math.abs(z - p.cz) - p.halfD;
    const ox = ex > 0 ? ex : 0;
    const oz = ez > 0 ? ez : 0;
    if (ox === 0 && oz === 0) {
      h = p.y;
    } else {
      const bevel = p.bevel || 0.14;
      if (ox < bevel && oz < bevel) {
        const d = Math.hypot(ox, oz);
        if (d < bevel) {
          const u = 1 - d / bevel;
          const s = u * u * (3 - 2 * u);
          h += (p.y - h) * s;
        }
      }
    }
  }
  return h;
}

/**
 * Returns true if (x, z) is inside the Pre-Boss Bonfire Safe Zone (R = 8.5m around (2.6, -24.0)).
 */
export function isInBonfireSafeZone(x, z, extraMargin = 0) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  const r = SOULS_BONFIRE_SAFE_RADIUS + (Number.isFinite(extraMargin) ? extraMargin : 0);
  const dx = x - SOULS_CASTLE_BONFIRE.x;
  const dz = z - SOULS_CASTLE_BONFIRE.z;
  return dx * dx + dz * dz <= r * r;
}

/**
 * Returns true if the player can press [E] at the Pre-Boss Bonfire (`(2.6, -24.0)`, R = 3.0m)
 * to save the checkpoint `(0, -21.5)` and restore 100% HP + all Estus Flasks.
 */
export function canRestAtBonfire(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  const dx = x - SOULS_CASTLE_BONFIRE.x;
  const dz = z - SOULS_CASTLE_BONFIRE.z;
  return dx * dx + dz * dz <= SOULS_CASTLE_BONFIRE.interactRadius * SOULS_CASTLE_BONFIRE.interactRadius;
}

export function getBonfireCheckpointSpawn() {
  return {
    x: SOULS_CASTLE_BONFIRE.checkpointX,
    z: SOULS_CASTLE_BONFIRE.checkpointZ,
    facing: SOULS_CASTLE_BONFIRE.checkpointFacing
  };
}

/**
 * Returns true if `z` falls inside the forbidden Flame Gauntlet mob band `[7.0, 26.5]`.
 */
export function isInsideFlameGauntletNoMobZone(z, margin = 0) {
  if (!Number.isFinite(z)) return false;
  const m = Number.isFinite(margin) ? margin : 0;
  return z >= SOULS_FLAME_GAUNTLET_NO_MOB_MIN_Z - m && z <= SOULS_FLAME_GAUNTLET_NO_MOB_MAX_Z + m;
}

/**
 * Returns the canonical room id at world coordinates (x, z), or null if outside walls.
 */
export function getCastleRoomAt(x = 0, z = 0) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  if (x >= -11.0 && x <= 11.0 && z >= 46.0 && z <= 68.0) return 'spawn_hall';
  if (x >= -13.5 && x <= 8.5 && z >= 26.0 && z < 46.0) return 'first_duel_atrium';
  if (x >= -5.2 && x <= 5.2 && z >= 8.0 && z < 26.0) return 'flame_gauntlet';
  if (x >= -5.5 && x <= 5.5 && z >= -16.0 && z < 8.0) return 'knights_nave';
  if (x >= -6.3 && x < -5.5 && z >= -8.4 && z <= -3.6) return 'west_arch';
  if (x >= -12.5 && x < -6.3 && z >= -11.0 && z <= -1.0) return 'west_wing';
  if (x > 5.5 && x <= 6.3 && z >= -6.4 && z <= -1.6) return 'east_arch';
  if (x > 6.3 && x <= 14.0 && z >= -9.0 && z <= 1.0) return 'east_alcove';
  if (x >= -8.0 && x <= 8.0 && z >= -32.0 && z < -16.0) return 'pre_boss_sanctuary';
  if (z < -32.0) {
    if (z >= -33.8 && Math.abs(x) <= 3.15) return 'boss_portal';
    const dx = x - SOULS_CASTLE_CONSTANTS.BOSS_CENTER_X;
    const dz = z - SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z;
    if (dx * dx + dz * dz <= SOULS_CASTLE_CONSTANTS.BOSS_RADIUS * SOULS_CASTLE_CONSTANTS.BOSS_RADIUS) {
      return 'boss_hall';
    }
  }
  return null;
}

/**
 * Exact Spring-Arm Camera Collision Resolver against all 6-Zone Castle Walls,
 * Archway Piers, Vaulted Ceilings, and Sealed/Closed Boss Doors (`z = -32.0 / -32.2`).
 */
const _camOriginTmp = { x: 0, z: 0 };

function getCeilingHeightForRoom(roomId) {
  switch (roomId) {
    case 'spawn_hall':
    case 'first_duel_atrium':
    case 'courtyard':
      return 10.8;
    case 'flame_gauntlet':
    case 'knights_nave':
    case 'pre_boss_sanctuary':
    case 'corridor':
      return 9.6;
    case 'west_arch':
    case 'east_arch':
      return 5.4;
    case 'west_wing':
      return 9.2;
    case 'east_alcove':
      return 8.1;
    case 'boss_portal':
      return 7.1;
    case 'boss_hall':
      return 16.8;
    default:
      return 9.4;
  }
}

export function clampCastleCameraPosition(
  targetX,
  targetY,
  targetZ,
  camX,
  camY,
  camZ,
  doorState = 'closed',
  options = {}
) {
  const opts = options || {};
  const pad = Number.isFinite(opts.pad) ? Math.max(0.15, Math.min(1.2, opts.pad)) : 0.48;
  const minY = Number.isFinite(opts.minY) ? opts.minY : 0.65;
  const stepSize = Number.isFinite(opts.step) ? Math.max(0.1, opts.step) : 0.22;
  const out = opts.out || { x: 0, y: 0, z: 0, hitWall: false, fraction: 1 };

  const st = doorState || 'closed';
  const tx = Number.isFinite(targetX) ? targetX : 0;
  const ty = Number.isFinite(targetY) ? targetY : 1.5;
  const tz = Number.isFinite(targetZ)
    ? targetZ
    : (st === 'sealed' ? SOULS_CASTLE_CONSTANTS.BOSS_HERO_ENTRY_Z : SOULS_CASTLE_PLAYER_SPAWN.z);
  const cx = Number.isFinite(camX) ? camX : tx;
  const cy = Number.isFinite(camY) ? camY : ty + 3.5;
  const cz = Number.isFinite(camZ) ? camZ : tz + 6.0;

  let domain;
  if (st === 'open') {
    domain = 'full_open';
  } else if (st === 'sealed' || tz < SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z) {
    domain = 'boss_only';
  } else {
    domain = 'castle_only';
  }

  let ox = tx;
  let oz = tz;
  const isCamInside = (px, pz) => isInsideDomain(px, pz, pad, domain) && !overlapsBossDoorJambs(px, pz, pad);
  if (!isCamInside(ox, oz)) {
    const clampOpts = {
      bossDoorState: domain === 'boss_only' ? 'sealed' : (domain === 'full_open' ? 'open' : 'closed'),
      allowBossHall: domain === 'boss_only',
      ignoreStaticColliders: true,
      includeBossDoorJambs: true,
      out: _camOriginTmp
    };
    clampCastlePosition(ox, oz, pad, clampOpts);
    ox = _camOriginTmp.x;
    oz = _camOriginTmp.z;
  }

  const dx = cx - ox;
  const dy = cy - ty;
  const dz = cz - oz;
  const horizLen = Math.hypot(dx, dz);

  let hitFraction = 1.0;
  let hitWall = false;

  if (horizLen > 1e-5) {
    const steps = Math.max(1, Math.min(160, Math.ceil(horizLen / stepSize)));
    let prevT = 0.0;
    let blockedT = -1.0;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const px = ox + dx * t;
      const pz = oz + dz * t;
      if (!isCamInside(px, pz)) {
        blockedT = t;
        break;
      }
      prevT = t;
    }

    if (blockedT >= 0) {
      hitWall = true;
      let lo = prevT;
      let hi = blockedT;
      for (let iter = 0; iter < 8; iter++) {
        const mid = (lo + hi) * 0.5;
        if (isCamInside(ox + dx * mid, oz + dz * mid)) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
      hitFraction = lo;
    }
  }

  const resX = ox + dx * hitFraction;
  const resZ = oz + dz * hitFraction;
  const room = getCastleRoomAt(resX, resZ) || (domain === 'boss_only' ? 'boss_hall' : 'knights_nave');
  const maxCeilY = getCeilingHeightForRoom(room);
  const rawY = ty + dy * hitFraction;
  const resY = rawY < minY ? minY : (rawY > maxCeilY ? maxCeilY : rawY);

  out.x = resX;
  out.y = resY;
  out.z = resZ;
  out.hitWall = hitWall || rawY !== resY;
  out.fraction = hitFraction;
  return out;
}

/**
 * Returns audio-compatible stone surface type for `soulsEnvAudio.js` & `audio.js`:
 *   - `'stone_courtyard'` (Awakening Hall, Duel Atrium & Pre-Boss Bonfire Sanctuary)
 *   - `'stone_bridge'`    (Flame Gauntlet & Knights' Nave)
 *   - `'cathedral_stone'` (West Wing, East Armory Alcove & Boss Throne Cathedral)
 */
export function getCastleSurfaceType(x = 0, z = 0) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 'stone_courtyard';
  if (z < SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z) return 'cathedral_stone';
  if (x >= SOULS_CASTLE_CONSTANTS.EAST_ALCOVE_MIN_X && z >= -9.0 && z <= 1.0) return 'cathedral_stone';
  if (x <= SOULS_CASTLE_CONSTANTS.WEST_WING_MAX_X && z >= -11.0 && z <= -1.0) return 'cathedral_stone';
  if (z >= 26.0 || z < -16.0) return 'stone_courtyard';
  return 'stone_bridge';
}

/**
 * Returns true if the player at (x, z) is standing in front of the Boss Doors and can press [E]:
 *   - Outside Sanctuary side when `bossDoorState === 'closed'`
 *   - Inside Boss Hall side when `bossDoorState === 'sealed'` (unless `options?.allowReopenFromInside === false`)
 */
export function canInteractWithBossDoor(x, z, bossDoorState = 'closed', options = null) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  if (bossDoorState === 'closed') {
    if (z < SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z - 0.1) return false;
    const dx = x - SOULS_CASTLE_DOOR_CONFIG.interactX;
    const dz = z - SOULS_CASTLE_DOOR_CONFIG.interactZ;
    return dx * dx + dz * dz <= SOULS_CASTLE_DOOR_CONFIG.interactRadius * SOULS_CASTLE_DOOR_CONFIG.interactRadius;
  }
  if (bossDoorState === 'sealed' && options?.allowReopenFromInside !== false) {
    return (
      z >= SOULS_CASTLE_DOOR_CONFIG.insideInteractMinZ &&
      z <= SOULS_CASTLE_DOOR_CONFIG.insideInteractMaxZ &&
      Math.abs(x - SOULS_CASTLE_DOOR_CONFIG.interactX) <= SOULS_CASTLE_DOOR_CONFIG.insideInteractHalfWidth
    );
  }
  return false;
}

// ============================================================================
// 3. Watertight Architectural Wall Segments Across All 6 Non-Linear Zones
// ============================================================================
function makeAxisWall({ id, role, roomId, axis, x1, z1, x2, z2, thickness, height, normalX, normalZ, fullHeight = true }) {
  const isX = axis === 'x';
  const length = isX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  const cx = (x1 + x2) * 0.5 - normalX * (thickness * 0.5);
  const cz = (z1 + z2) * 0.5 - normalZ * (thickness * 0.5);
  return Object.freeze({
    id,
    role,
    roomId,
    axis,
    x: Number(cx.toFixed(4)),
    z: Number(cz.toFixed(4)),
    length: Number(length.toFixed(4)),
    thickness,
    height,
    angleY: isX ? 0 : Math.PI * 0.5,
    x1,
    z1,
    x2,
    z2,
    normalX,
    normalZ,
    fullHeight
  });
}

function buildBossCathedralWallSegments() {
  const segs = [];
  const cx = SOULS_CASTLE_CONSTANTS.BOSS_CENTER_X;
  const cz = SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z;
  const innerR = SOULS_CASTLE_CONSTANTS.BOSS_RADIUS;
  const thickness = 1.5;
  const height = SOULS_CASTLE_CONSTANTS.BOSS_WALL_HEIGHT;
  const count = 16;

  const doorHalfAng = Math.asin(SOULS_CASTLE_CONSTANTS.BOSS_PORTAL_HALF_W / innerR);
  const startAng = Math.PI * 0.5 + doorHalfAng;
  const endAng = Math.PI * 2.5 - doorHalfAng;
  const stepAng = (endAng - startAng) / count;
  const vertexR = innerR / Math.cos(stepAng * 0.5);
  const midR = innerR + thickness * 0.5;

  for (let i = 0; i < count; i++) {
    const a0 = startAng + i * stepAng;
    const a1 = a0 + stepAng;
    const am = (a0 + a1) * 0.5;
    const x1 = cx + Math.cos(a0) * vertexR;
    const z1 = cz + Math.sin(a0) * vertexR;
    const x2 = cx + Math.cos(a1) * vertexR;
    const z2 = cz + Math.sin(a1) * vertexR;
    const chordLen = Math.hypot(x2 - x1, z2 - z1) + 0.4;
    const mx = cx + Math.cos(am) * midR;
    const mz = cz + Math.sin(am) * midR;
    const nx = -Math.cos(am);
    const nz = -Math.sin(am);
    const angleY = -Math.atan2(z2 - z1, x2 - x1);

    segs.push(
      Object.freeze({
        id: `boss_hall_wall_${i + 1}`,
        role: 'boss_cathedral',
        roomId: 'boss_hall',
        axis: 'angled',
        x: Number(mx.toFixed(4)),
        z: Number(mz.toFixed(4)),
        length: Number(chordLen.toFixed(4)),
        thickness,
        height,
        angleY: Number(angleY.toFixed(5)),
        x1: Number(x1.toFixed(4)),
        z1: Number(z1.toFixed(4)),
        x2: Number(x2.toFixed(4)),
        z2: Number(z2.toFixed(4)),
        normalX: Number(nx.toFixed(4)),
        normalZ: Number(nz.toFixed(4)),
        fullHeight: true
      })
    );
  }
  return segs;
}

export const SOULS_CASTLE_WALL_SEGMENTS = Object.freeze([
  // --- Zone 1: Awakening Hall (`spawn_hall`, x in [-11, 11], z in [46, 68]) ---
  makeAxisWall({ id: 'courtyard_south', role: 'perimeter', roomId: 'spawn_hall', axis: 'x', x1: -12.2, z1: 68.0, x2: 12.2, z2: 68.0, thickness: 1.2, height: 10.6, normalX: 0, normalZ: -1 }),
  makeAxisWall({ id: 'spawn_west', role: 'perimeter', roomId: 'spawn_hall', axis: 'z', x1: -11.0, z1: 46.0, x2: -11.0, z2: 68.0, thickness: 1.2, height: 10.6, normalX: 1, normalZ: 0 }),
  makeAxisWall({ id: 'spawn_east', role: 'perimeter', roomId: 'spawn_hall', axis: 'z', x1: 11.0, z1: 44.8, x2: 11.0, z2: 68.0, thickness: 1.2, height: 9.2, normalX: -1, normalZ: 0 }),
  makeAxisWall({ id: 'spawn_north_east_step', role: 'perimeter', roomId: 'spawn_hall', axis: 'x', x1: 8.5, z1: 46.0, x2: 12.2, z2: 46.0, thickness: 1.2, height: 10.6, normalX: 0, normalZ: 1 }),

  // --- Zone 2: Asymmetric West Cloister / Duel Atrium (`first_duel_atrium`, x in [-13.5, +8.5], z in [26, 46]) ---
  makeAxisWall({ id: 'atrium_south_west_step', role: 'perimeter', roomId: 'first_duel_atrium', axis: 'x', x1: -14.7, z1: 46.0, x2: -11.0, z2: 46.0, thickness: 1.2, height: 10.6, normalX: 0, normalZ: -1 }),
  makeAxisWall({ id: 'courtyard_west', role: 'perimeter', roomId: 'first_duel_atrium', axis: 'z', x1: -13.5, z1: 24.8, x2: -13.5, z2: 47.2, thickness: 1.2, height: 8.8, normalX: 1, normalZ: 0 }),
  makeAxisWall({ id: 'courtyard_east', role: 'perimeter', roomId: 'first_duel_atrium', axis: 'z', x1: 8.5, z1: 24.8, x2: 8.5, z2: 46.0, thickness: 1.2, height: 10.6, normalX: -1, normalZ: 0 }),
  makeAxisWall({ id: 'atrium_north_west', role: 'perimeter', roomId: 'first_duel_atrium', axis: 'x', x1: -14.7, z1: 26.0, x2: -5.2, z2: 26.0, thickness: 1.2, height: 10.6, normalX: 0, normalZ: 1 }),
  makeAxisWall({ id: 'atrium_north_east', role: 'perimeter', roomId: 'first_duel_atrium', axis: 'x', x1: 5.2, z1: 26.0, x2: 9.7, z2: 26.0, thickness: 1.2, height: 10.6, normalX: 0, normalZ: 1 }),

  // --- Zone 3: 5-Gargoyle Flame Gauntlet (`flame_gauntlet`, x in [-5.2, +5.2], z in [8, 26]) ---
  makeAxisWall({ id: 'gauntlet_west', role: 'perimeter', roomId: 'flame_gauntlet', axis: 'z', x1: -5.2, z1: 8.0, x2: -5.2, z2: 26.0, thickness: 1.2, height: 10.4, normalX: 1, normalZ: 0 }),
  makeAxisWall({ id: 'gauntlet_east', role: 'perimeter', roomId: 'flame_gauntlet', axis: 'z', x1: 5.2, z1: 8.0, x2: 5.2, z2: 26.0, thickness: 1.2, height: 10.4, normalX: -1, normalZ: 0 }),

  // --- Zone 4: Knights' Nave (`knights_nave`, x in [-5.5, +5.5], z in [-16, 8]) ---
  makeAxisWall({ id: 'nave_west_south', role: 'perimeter', roomId: 'knights_nave', axis: 'z', x1: -5.5, z1: -1.0, x2: -5.5, z2: 8.6, thickness: 1.2, height: 10.4, normalX: 1, normalZ: 0 }),
  makeAxisWall({ id: 'west_arch_pier_south', role: 'interior_pier', roomId: 'west_arch', axis: 'z', x1: -5.5, z1: -3.6, x2: -5.5, z2: -1.0, thickness: 0.8, height: 10.4, normalX: 1, normalZ: 0 }),
  makeAxisWall({ id: 'west_arch_pier_north', role: 'interior_pier', roomId: 'west_arch', axis: 'z', x1: -5.5, z1: -11.0, x2: -5.5, z2: -8.4, thickness: 0.8, height: 10.4, normalX: 1, normalZ: 0 }),
  makeAxisWall({ id: 'nave_west_north', role: 'perimeter', roomId: 'knights_nave', axis: 'z', x1: -5.5, z1: -16.0, x2: -5.5, z2: -11.0, thickness: 1.2, height: 10.4, normalX: 1, normalZ: 0 }),

  makeAxisWall({ id: 'nave_east_south', role: 'perimeter', roomId: 'knights_nave', axis: 'z', x1: 5.5, z1: 1.0, x2: 5.5, z2: 8.6, thickness: 1.2, height: 10.4, normalX: -1, normalZ: 0 }),
  makeAxisWall({ id: 'east_arch_pier_south', role: 'interior_pier', roomId: 'east_arch', axis: 'z', x1: 5.5, z1: -1.6, x2: 5.5, z2: 1.0, thickness: 0.8, height: 10.4, normalX: -1, normalZ: 0 }),
  makeAxisWall({ id: 'east_arch_pier_north', role: 'interior_pier', roomId: 'east_arch', axis: 'z', x1: 5.5, z1: -9.0, x2: 5.5, z2: -6.4, thickness: 0.8, height: 10.4, normalX: -1, normalZ: 0 }),
  makeAxisWall({ id: 'nave_east_north', role: 'perimeter', roomId: 'knights_nave', axis: 'z', x1: 5.5, z1: -16.0, x2: 5.5, z2: -9.0, thickness: 1.2, height: 10.4, normalX: -1, normalZ: 0 }),

  // --- Zone 4a: West Side-Chapel (`west_wing`, x in [-12.5, -6.3], z in [-11, -1]) ---
  makeAxisWall({ id: 'west_wing_south', role: 'perimeter', roomId: 'west_wing', axis: 'x', x1: -13.7, z1: -1.0, x2: -5.5, z2: -1.0, thickness: 1.2, height: 10.2, normalX: 0, normalZ: -1 }),
  makeAxisWall({ id: 'west_wing_west', role: 'perimeter', roomId: 'west_wing', axis: 'z', x1: -12.5, z1: -12.2, x2: -12.5, z2: 0.2, thickness: 1.2, height: 8.8, normalX: 1, normalZ: 0 }),
  makeAxisWall({ id: 'west_wing_north', role: 'perimeter', roomId: 'west_wing', axis: 'x', x1: -13.7, z1: -11.0, x2: -5.5, z2: -11.0, thickness: 1.2, height: 10.2, normalX: 0, normalZ: 1 }),

  // --- Zone 4b: East Armory Alcove (`east_alcove`, x in [6.3, 14.0], z in [-9, 1]) ---
  makeAxisWall({ id: 'east_alcove_south', role: 'perimeter', roomId: 'east_alcove', axis: 'x', x1: 5.5, z1: 1.0, x2: 15.2, z2: 1.0, thickness: 1.2, height: 7.8, normalX: 0, normalZ: -1 }),
  makeAxisWall({ id: 'east_alcove_east', role: 'perimeter', roomId: 'east_alcove', axis: 'z', x1: 14.0, z1: -10.2, x2: 14.0, z2: 2.2, thickness: 1.2, height: 7.8, normalX: -1, normalZ: 0 }),
  makeAxisWall({ id: 'east_alcove_north', role: 'perimeter', roomId: 'east_alcove', axis: 'x', x1: 5.5, z1: -9.0, x2: 15.2, z2: -9.0, thickness: 1.2, height: 7.8, normalX: 0, normalZ: 1 }),

  // --- Zone 5: Pre-Boss Bonfire Sanctuary (`pre_boss_sanctuary`, x in [-8, +8], z in [-32, -16]) ---
  makeAxisWall({ id: 'sanctuary_south_west', role: 'perimeter', roomId: 'pre_boss_sanctuary', axis: 'x', x1: -9.2, z1: -16.0, x2: -5.5, z2: -16.0, thickness: 1.2, height: 10.4, normalX: 0, normalZ: -1 }),
  makeAxisWall({ id: 'sanctuary_south_east', role: 'perimeter', roomId: 'pre_boss_sanctuary', axis: 'x', x1: 5.5, z1: -16.0, x2: 9.2, z2: -16.0, thickness: 1.2, height: 10.4, normalX: 0, normalZ: -1 }),
  makeAxisWall({ id: 'sanctuary_west', role: 'perimeter', roomId: 'pre_boss_sanctuary', axis: 'z', x1: -8.0, z1: -32.7, x2: -8.0, z2: -14.8, thickness: 1.2, height: 10.4, normalX: 1, normalZ: 0 }),
  makeAxisWall({ id: 'sanctuary_east', role: 'perimeter', roomId: 'pre_boss_sanctuary', axis: 'z', x1: 8.0, z1: -32.7, x2: 8.0, z2: -14.8, thickness: 1.2, height: 8.8, normalX: -1, normalZ: 0 }),

  // --- Zone 6: Boss Door Stone Jambs (joining Sanctuary ±8.0 to Boss Door pivots ±3.15 at z=-32.0) ---
  Object.freeze({
    id: 'boss_door_jamb_west',
    role: 'jamb',
    roomId: 'boss_portal',
    axis: 'x',
    x: -6.175,
    z: -32.0,
    length: 6.05,
    thickness: 1.4,
    height: 10.6,
    angleY: 0,
    x1: -9.2,
    z1: -31.3,
    x2: -3.15,
    z2: -31.3,
    normalX: 0,
    normalZ: 1,
    fullHeight: true
  }),
  Object.freeze({
    id: 'boss_door_jamb_east',
    role: 'jamb',
    roomId: 'boss_portal',
    axis: 'x',
    x: 6.175,
    z: -32.0,
    length: 6.05,
    thickness: 1.4,
    height: 10.6,
    angleY: 0,
    x1: 3.15,
    z1: -31.3,
    x2: 9.2,
    z2: -31.3,
    normalX: 0,
    normalZ: 1,
    fullHeight: true
  }),

  // --- Zone 6: Boss Throne Cathedral Circular Curtain Wall (16 watertight segments, center (0, -47.2), R=16.0) ---
  ...buildBossCathedralWallSegments()
]);

export const SOULS_CASTLE_WALLS = SOULS_CASTLE_WALL_SEGMENTS;

// ============================================================================
// 4. Gothic Archways & Portal Openings Across All 6 Zones
// ============================================================================
export const SOULS_CASTLE_ARCHES = Object.freeze([
  Object.freeze({
    id: 'spawn_to_atrium_arch',
    roomId: 'spawn_hall',
    connects: Object.freeze(['spawn_hall', 'first_duel_atrium']),
    x: -1.25,
    z: 46.0,
    axis: 'x',
    spanWidth: 19.5,
    halfSpan: 9.75,
    springY: 5.8,
    apexY: 9.4,
    depth: 1.2,
    cameraFade: true
  }),
  Object.freeze({
    id: 'grand_gauntlet_south_arch',
    roomId: 'first_duel_atrium',
    connects: Object.freeze(['first_duel_atrium', 'flame_gauntlet']),
    x: 0,
    z: 25.6,
    axis: 'x',
    spanWidth: 10.4,
    halfSpan: 5.2,
    springY: 5.0,
    apexY: 7.9,
    depth: 1.2,
    cameraFade: true
  }),
  Object.freeze({
    id: 'gauntlet_to_nave_arch',
    roomId: 'flame_gauntlet',
    connects: Object.freeze(['flame_gauntlet', 'knights_nave']),
    x: 0,
    z: 8.0,
    axis: 'x',
    spanWidth: 10.4,
    halfSpan: 5.2,
    springY: 5.0,
    apexY: 7.9,
    depth: 1.1,
    cameraFade: true
  }),
  Object.freeze({
    id: 'west_wing_arch',
    roomId: 'west_arch',
    connects: Object.freeze(['knights_nave', 'west_wing']),
    x: -5.9,
    z: -6.0,
    axis: 'z',
    spanWidth: 4.8,
    halfSpan: 2.4,
    springY: 3.7,
    apexY: 6.0,
    depth: 0.92,
    cameraFade: true
  }),
  Object.freeze({
    id: 'east_alcove_arch',
    roomId: 'east_arch',
    connects: Object.freeze(['knights_nave', 'east_alcove']),
    x: 5.9,
    z: -4.0,
    axis: 'z',
    spanWidth: 4.8,
    halfSpan: 2.4,
    springY: 3.6,
    apexY: 5.8,
    depth: 0.92,
    cameraFade: true
  }),
  Object.freeze({
    id: 'sanctuary_entry_arch',
    roomId: 'pre_boss_sanctuary',
    connects: Object.freeze(['knights_nave', 'pre_boss_sanctuary']),
    x: 0,
    z: -16.0,
    axis: 'x',
    spanWidth: 11.0,
    halfSpan: 5.5,
    springY: 5.0,
    apexY: 8.0,
    depth: 1.2,
    cameraFade: true
  }),
  Object.freeze({
    id: 'boss_door_portal',
    roomId: 'boss_portal',
    connects: Object.freeze(['pre_boss_sanctuary', 'boss_hall']),
    x: 0,
    z: -32.0,
    axis: 'x',
    spanWidth: 6.3,
    halfSpan: 3.15,
    springY: 4.75,
    apexY: 7.65,
    depth: 1.48,
    cameraFade: false
  })
]);

// ============================================================================
// 5. Structural Gothic Pillars, Floor Braziers (with Solid Colliders!),
//    Wall-Mounted Lantern Sconces, Candle Clusters & Castle Banners
// ============================================================================
export const SOULS_CASTLE_PILLARS = Object.freeze([
  // Zone 1: Spacious Awakening Hall colonnade (15.6m wide clear central nave!)
  Object.freeze({ id: 'pillar_spawn_sw', roomId: 'spawn_hall', x: -7.8, z: 62.0, height: 8.2, broken: false, collider: true, radius: 0.85 }),
  Object.freeze({ id: 'pillar_spawn_se', roomId: 'spawn_hall', x: 7.8, z: 62.0, height: 8.2, broken: false, collider: true, radius: 0.85 }),
  Object.freeze({ id: 'pillar_spawn_nw', roomId: 'spawn_hall', x: -7.8, z: 52.0, height: 8.2, broken: false, collider: true, radius: 0.85 }),
  Object.freeze({ id: 'pillar_spawn_ne', roomId: 'spawn_hall', x: 7.8, z: 52.0, height: 6.8, broken: true, collider: true, radius: 0.85 }),

  // Zone 2: Asymmetric Western Cloister colonnade separating the West Arcade from Duel Atrium
  Object.freeze({ id: 'pillar_atrium_cloister_s', roomId: 'first_duel_atrium', x: -8.8, z: 40.5, height: 8.0, broken: false, collider: true, radius: 0.85 }),
  Object.freeze({ id: 'pillar_atrium_cloister_n', roomId: 'first_duel_atrium', x: -8.8, z: 31.5, height: 6.5, broken: true, collider: true, radius: 0.85 }),
  Object.freeze({ id: 'pillar_atrium_east', roomId: 'first_duel_atrium', x: 6.4, z: 36.0, height: 8.0, broken: false, collider: true, radius: 0.85 }),

  // Zone 4: Knights' Nave asymmetric flanking columns (architectural richness + physical arrow cover!)
  Object.freeze({ id: 'pillar_nave_se', roomId: 'knights_nave', x: 2.35, z: 0.4, height: 8.0, broken: false, collider: true, radius: 0.82 }),
  Object.freeze({ id: 'pillar_nave_nw', roomId: 'knights_nave', x: -2.35, z: -9.2, height: 6.6, broken: true, collider: true, radius: 0.82 }),

  // Zone 5: Pre-Boss Sanctuary flanking columns
  Object.freeze({ id: 'pillar_sanctuary_w', roomId: 'pre_boss_sanctuary', x: -6.0, z: -24.0, height: 8.0, broken: false, collider: true, radius: 0.85 }),
  Object.freeze({ id: 'pillar_sanctuary_e', roomId: 'pre_boss_sanctuary', x: 6.2, z: -28.2, height: 8.0, broken: false, collider: true, radius: 0.85 }),

  // Zone 6: Boss Cathedral outer colonnade (R ~ 12.8m around (0, -47.2), leaving ~23.6m open duel floor!)
  Object.freeze({ id: 'pillar_boss_nw', roomId: 'boss_hall', x: -7.8, z: -57.4, height: 10.8, broken: false, collider: true, radius: 0.92 }),
  Object.freeze({ id: 'pillar_boss_ne', roomId: 'boss_hall', x: 7.8, z: -57.4, height: 10.8, broken: false, collider: true, radius: 0.92 }),
  Object.freeze({ id: 'pillar_boss_w', roomId: 'boss_hall', x: -12.8, z: -47.2, height: 10.2, broken: false, collider: true, radius: 0.92 }),
  Object.freeze({ id: 'pillar_boss_e', roomId: 'boss_hall', x: 12.8, z: -47.2, height: 7.0, broken: true, collider: true, radius: 0.92 }),
  Object.freeze({ id: 'pillar_boss_sw', roomId: 'boss_hall', x: -10.2, z: -39.2, height: 9.8, broken: false, collider: true, radius: 0.92 }),
  Object.freeze({ id: 'pillar_boss_se', roomId: 'boss_hall', x: 10.2, z: -39.2, height: 9.8, broken: false, collider: true, radius: 0.92 })
]);

export const SOULS_CASTLE_BRAZIERS = Object.freeze([
  // Zone 1: Awakening Hall hero framing
  Object.freeze({ id: 'brazier_spawn_w', roomId: 'spawn_hall', x: -4.8, z: 63.8, scale: 1.0, radius: 0.56 }),
  Object.freeze({ id: 'brazier_spawn_e', roomId: 'spawn_hall', x: 4.8, z: 63.8, scale: 1.0, radius: 0.56 }),

  // Zone 2: First Duel Atrium & Gauntlet entry framing
  Object.freeze({ id: 'brazier_gauntlet_entry_w', roomId: 'first_duel_atrium', x: -6.4, z: 27.4, scale: 1.05, radius: 0.59 }),
  Object.freeze({ id: 'brazier_gauntlet_entry_e', roomId: 'first_duel_atrium', x: 6.4, z: 27.4, scale: 1.05, radius: 0.59 }),

  // Zone 4: West Side-Chapel & East Armory Relic Shrine
  Object.freeze({ id: 'brazier_west_wing', roomId: 'west_wing', x: -11.0, z: -6.0, scale: 0.96, radius: 0.54 }),
  Object.freeze({ id: 'brazier_alcove_n', roomId: 'east_alcove', x: 12.4, z: -6.9, scale: 0.92, radius: 0.52 }),
  Object.freeze({ id: 'brazier_alcove_s', roomId: 'east_alcove', x: 12.4, z: -1.1, scale: 0.92, radius: 0.52 }),

  // Zone 5: Pre-Boss Sanctuary flanking Boss Doors (clear of Boss Gatehouse protruding stone jambs at z = -30.98!)
  Object.freeze({ id: 'brazier_boss_door_w', roomId: 'pre_boss_sanctuary', x: -4.55, z: -29.35, scale: 1.08, radius: 0.60 }),
  Object.freeze({ id: 'brazier_boss_door_e', roomId: 'pre_boss_sanctuary', x: 4.55, z: -29.35, scale: 1.08, radius: 0.60 }),

  // Zone 6: Boss Throne Hall ceremonial braziers
  Object.freeze({ id: 'brazier_boss_entry_w', roomId: 'boss_hall', x: -8.2, z: -36.4, scale: 1.1, radius: 0.62 }),
  Object.freeze({ id: 'brazier_boss_entry_e', roomId: 'boss_hall', x: 8.2, z: -36.4, scale: 1.1, radius: 0.62 }),
  Object.freeze({ id: 'brazier_throne_w', roomId: 'boss_hall', x: -9.6, z: -54.4, scale: 1.15, radius: 0.64 }),
  Object.freeze({ id: 'brazier_throne_e', roomId: 'boss_hall', x: 9.6, z: -54.4, scale: 1.15, radius: 0.64 })
]);

function buildBossWallLanterns() {
  const lanterns = [];
  const anglesDeg = [-145, -108, -72, -36, 36, 72, 108, 145];
  const r = SOULS_CASTLE_CONSTANTS.BOSS_RADIUS - 0.16;
  for (let i = 0; i < anglesDeg.length; i++) {
    const rad = (anglesDeg[i] * Math.PI) / 180;
    const x = Math.sin(rad) * r;
    const z = SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z - Math.cos(rad) * r;
    lanterns.push(
      Object.freeze({
        id: `lantern_boss_${i + 1}`,
        roomId: 'boss_hall',
        x: Number(x.toFixed(3)),
        y: 3.8,
        z: Number(z.toFixed(3)),
        normalX: Number((-Math.sin(rad)).toFixed(4)),
        normalZ: Number(Math.cos(rad).toFixed(4)),
        color: 0xff8c3a,
        intensity: 2.4,
        distance: 15.0
      })
    );
  }
  return lanterns;
}

export const SOULS_CASTLE_WALL_LANTERNS = Object.freeze([
  // Zone 1: Awakening Hall
  Object.freeze({ id: 'lantern_spawn_w1', roomId: 'spawn_hall', x: -10.85, y: 3.4, z: 63.0, normalX: 1, normalZ: 0, color: 0xff9240, intensity: 2.1, distance: 13.0 }),
  Object.freeze({ id: 'lantern_spawn_w2', roomId: 'spawn_hall', x: -10.85, y: 3.4, z: 51.0, normalX: 1, normalZ: 0, color: 0xff9240, intensity: 2.1, distance: 13.0 }),
  Object.freeze({ id: 'lantern_spawn_e1', roomId: 'spawn_hall', x: 10.85, y: 3.4, z: 63.0, normalX: -1, normalZ: 0, color: 0xff9240, intensity: 2.1, distance: 13.0 }),
  Object.freeze({ id: 'lantern_spawn_e2', roomId: 'spawn_hall', x: 10.85, y: 3.4, z: 51.0, normalX: -1, normalZ: 0, color: 0xff9240, intensity: 2.1, distance: 13.0 }),
  Object.freeze({ id: 'lantern_spawn_s1', roomId: 'spawn_hall', x: -5.2, y: 3.4, z: 67.85, normalX: 0, normalZ: -1, color: 0xff9240, intensity: 1.9, distance: 12.0 }),
  Object.freeze({ id: 'lantern_spawn_s2', roomId: 'spawn_hall', x: 5.2, y: 3.4, z: 67.85, normalX: 0, normalZ: -1, color: 0xff9240, intensity: 1.9, distance: 12.0 }),

  // Zone 2: Asymmetric West Cloister / Duel Atrium
  Object.freeze({ id: 'lantern_atrium_w1', roomId: 'first_duel_atrium', x: -13.35, y: 3.3, z: 41.0, normalX: 1, normalZ: 0, color: 0xff9240, intensity: 2.1, distance: 13.0 }),
  Object.freeze({ id: 'lantern_atrium_w2', roomId: 'first_duel_atrium', x: -13.35, y: 3.3, z: 31.0, normalX: 1, normalZ: 0, color: 0xff9240, intensity: 2.1, distance: 13.0 }),
  Object.freeze({ id: 'lantern_atrium_e1', roomId: 'first_duel_atrium', x: 8.35, y: 3.3, z: 41.0, normalX: -1, normalZ: 0, color: 0xff9240, intensity: 2.1, distance: 13.0 }),
  Object.freeze({ id: 'lantern_atrium_e2', roomId: 'first_duel_atrium', x: 8.35, y: 3.3, z: 31.0, normalX: -1, normalZ: 0, color: 0xff9240, intensity: 2.1, distance: 13.0 }),

  // Zone 3: Flame Gauntlet (spaced cleanly between gargoyles at z=22.5, 19.0, 15.2, 11.2)
  Object.freeze({ id: 'lantern_gauntlet_w1', roomId: 'flame_gauntlet', x: -5.05, y: 3.35, z: 24.4, normalX: 1, normalZ: 0, color: 0xff8a34, intensity: 2.1, distance: 11.5 }),
  Object.freeze({ id: 'lantern_gauntlet_e1', roomId: 'flame_gauntlet', x: 5.05, y: 3.35, z: 17.1, normalX: -1, normalZ: 0, color: 0xff8a34, intensity: 2.1, distance: 11.5 }),
  Object.freeze({ id: 'lantern_gauntlet_w2', roomId: 'flame_gauntlet', x: -5.05, y: 3.35, z: 9.4, normalX: 1, normalZ: 0, color: 0xff8a34, intensity: 2.1, distance: 11.5 }),

  // Zone 4: Knights' Nave, West Wing & East Alcove
  Object.freeze({ id: 'lantern_nave_w1', roomId: 'knights_nave', x: -5.35, y: 3.25, z: 3.5, normalX: 1, normalZ: 0, color: 0xff8a34, intensity: 2.2, distance: 12.0 }),
  Object.freeze({ id: 'lantern_nave_e1', roomId: 'knights_nave', x: 5.35, y: 3.25, z: 4.5, normalX: -1, normalZ: 0, color: 0xff8a34, intensity: 2.2, distance: 12.0 }),
  Object.freeze({ id: 'lantern_nave_e2', roomId: 'knights_nave', x: 5.35, y: 3.25, z: -12.5, normalX: -1, normalZ: 0, color: 0xff8a34, intensity: 2.2, distance: 12.0 }),
  Object.freeze({ id: 'lantern_west_wing', roomId: 'west_wing', x: -9.4, y: 3.1, z: -10.85, normalX: 0, normalZ: 1, color: 0xff9c40, intensity: 2.2, distance: 11.5 }),
  Object.freeze({ id: 'lantern_alcove_n', roomId: 'east_alcove', x: 10.2, y: 3.0, z: -8.85, normalX: 0, normalZ: 1, color: 0xffa042, intensity: 2.3, distance: 11.0 }),
  Object.freeze({ id: 'lantern_alcove_s', roomId: 'east_alcove', x: 10.2, y: 3.0, z: 0.85, normalX: 0, normalZ: -1, color: 0xffa042, intensity: 2.3, distance: 11.0 }),

  // Zone 5: Pre-Boss Bonfire Sanctuary
  Object.freeze({ id: 'lantern_sanctuary_w1', roomId: 'pre_boss_sanctuary', x: -7.85, y: 3.3, z: -20.5, normalX: 1, normalZ: 0, color: 0xff9442, intensity: 2.2, distance: 13.0 }),
  Object.freeze({ id: 'lantern_sanctuary_w2', roomId: 'pre_boss_sanctuary', x: -7.85, y: 3.3, z: -28.0, normalX: 1, normalZ: 0, color: 0xff9442, intensity: 2.2, distance: 13.0 }),
  Object.freeze({ id: 'lantern_sanctuary_e1', roomId: 'pre_boss_sanctuary', x: 7.85, y: 3.3, z: -20.5, normalX: -1, normalZ: 0, color: 0xff9442, intensity: 2.2, distance: 13.0 }),

  // Zone 6: Boss Hall Cathedral sconces (8)
  ...buildBossWallLanterns()
]);

export const SOULS_CASTLE_SCONCES = SOULS_CASTLE_WALL_LANTERNS;

export const SOULS_CASTLE_CANDLE_CLUSTERS = Object.freeze([
  // Zone 1: Founder Sarcophagus votive candles in Awakening Hall
  Object.freeze({ id: 'candles_spawn_founder_w', roomId: 'spawn_hall', x: -1.48, y: 0, z: 66.82, count: 4, radius: 0.34 }),
  Object.freeze({ id: 'candles_spawn_founder_e', roomId: 'spawn_hall', x: 1.48, y: 0, z: 66.82, count: 4, radius: 0.34 }),
  // Zone 2: Elevated Skull Reliquary Niche votive candles (unbreakable inside high stone niches!)
  Object.freeze({ id: 'candles_niche_atrium_w', roomId: 'first_duel_atrium', x: -13.12, y: 1.18, z: 36.0, count: 4, scale: 0.82, radius: 0.28, breakable: false }),
  Object.freeze({ id: 'candles_niche_atrium_sw', roomId: 'first_duel_atrium', x: -12.25, y: 1.18, z: 45.62, count: 3, scale: 0.80, radius: 0.26, breakable: false }),
  Object.freeze({ id: 'candles_niche_atrium_e1', roomId: 'first_duel_atrium', x: 8.12, y: 1.18, z: 33.4, count: 4, scale: 0.82, radius: 0.28, breakable: false }),
  Object.freeze({ id: 'candles_niche_atrium_e2', roomId: 'first_duel_atrium', x: 8.12, y: 1.18, z: 38.6, count: 3, scale: 0.80, radius: 0.26, breakable: false }),
  // Zone 4: Knights' Nave & West Side-Chapel Saint Shrines
  Object.freeze({ id: 'candles_nave_shrine_es', roomId: 'knights_nave', x: 4.55, y: 0, z: 2.75, count: 3, radius: 0.30 }),
  Object.freeze({ id: 'candles_chapel_shrine_nw', roomId: 'west_wing', x: -11.42, y: 0, z: -8.6, count: 4, radius: 0.32 }),
  Object.freeze({ id: 'candles_chapel_shrine_sw', roomId: 'west_wing', x: -11.42, y: 0, z: -3.4, count: 4, radius: 0.32 }),
  // East Armory Relic Shrine `(12.4, -4.0)`
  Object.freeze({ id: 'candles_shrine_n', roomId: 'east_alcove', x: 11.6, y: 0, z: -5.25, count: 5, radius: 0.4 }),
  Object.freeze({ id: 'candles_shrine_s', roomId: 'east_alcove', x: 11.6, y: 0, z: -2.75, count: 5, radius: 0.4 }),
  // Zone 5: Pre-Boss Bonfire Sanctuary candle clusters around `(2.6, -24.0)` & Kneeling Watcher
  Object.freeze({ id: 'candles_bonfire_w', roomId: 'pre_boss_sanctuary', x: 1.0, y: 0, z: -23.0, count: 5, radius: 0.42 }),
  Object.freeze({ id: 'candles_bonfire_e', roomId: 'pre_boss_sanctuary', x: 4.2, y: 0, z: -23.3, count: 4, radius: 0.38 }),
  Object.freeze({ id: 'candles_bonfire_n', roomId: 'pre_boss_sanctuary', x: 2.2, y: 0, z: -25.6, count: 4, radius: 0.35 }),
  Object.freeze({ id: 'candles_sanctuary_watcher', roomId: 'pre_boss_sanctuary', x: -5.45, y: 0, z: -27.1, count: 4, radius: 0.32 }),
  // Boss Door jambs `(z = -32.0)`
  Object.freeze({ id: 'candles_door_w', roomId: 'pre_boss_sanctuary', x: -3.35, y: 0, z: -30.25, count: 4, radius: 0.36 }),
  Object.freeze({ id: 'candles_door_e', roomId: 'pre_boss_sanctuary', x: 3.35, y: 0, z: -30.25, count: 4, radius: 0.36 }),
  // Obsidian Throne steps `(z = -55.6)`
  Object.freeze({ id: 'candles_throne_w', roomId: 'boss_hall', x: -3.2, y: 0.25, z: -55.6, count: 6, radius: 0.46 }),
  Object.freeze({ id: 'candles_throne_e', roomId: 'boss_hall', x: 3.2, y: 0.25, z: -55.6, count: 6, radius: 0.46 })
]);

export const SOULS_CASTLE_BANNERS = Object.freeze([
  // Zone 1: Awakening Hall royal banners
  Object.freeze({ id: 'banner_spawn_w', roomId: 'spawn_hall', x: -10.88, y: 5.2, z: 57.0, normalX: 1, normalZ: 0, width: 1.3, height: 3.4 }),
  Object.freeze({ id: 'banner_spawn_e', roomId: 'spawn_hall', x: 10.88, y: 5.2, z: 57.0, normalX: -1, normalZ: 0, width: 1.3, height: 3.4 }),
  Object.freeze({ id: 'banner_spawn_s_w', roomId: 'spawn_hall', x: -7.6, y: 5.3, z: 67.86, normalX: 0, normalZ: -1, width: 1.28, height: 3.35 }),
  Object.freeze({ id: 'banner_spawn_s_e', roomId: 'spawn_hall', x: 7.6, y: 5.3, z: 67.86, normalX: 0, normalZ: -1, width: 1.28, height: 3.35 }),
  // Zone 2: Duel Atrium & West Cloister tattered heraldic banners
  Object.freeze({ id: 'banner_atrium_w_south', roomId: 'first_duel_atrium', x: -13.38, y: 5.1, z: 43.5, normalX: 1, normalZ: 0, width: 1.25, height: 3.3 }),
  Object.freeze({ id: 'banner_atrium_w_north', roomId: 'first_duel_atrium', x: -13.38, y: 5.1, z: 28.5, normalX: 1, normalZ: 0, width: 1.25, height: 3.3 }),
  Object.freeze({ id: 'banner_atrium_e_mid', roomId: 'first_duel_atrium', x: 8.38, y: 5.1, z: 36.0, normalX: -1, normalZ: 0, width: 1.25, height: 3.3 }),
  Object.freeze({ id: 'banner_atrium_nw', roomId: 'first_duel_atrium', x: -9.5, y: 5.0, z: 26.12, normalX: 0, normalZ: 1, width: 1.25, height: 3.2 }),
  Object.freeze({ id: 'banner_atrium_ne', roomId: 'first_duel_atrium', x: 6.8, y: 5.0, z: 26.12, normalX: 0, normalZ: 1, width: 1.25, height: 3.2 }),
  // Zone 4: Knights' Nave, West Side-Chapel & East Armory Alcove
  Object.freeze({ id: 'banner_nave_w', roomId: 'knights_nave', x: -5.38, y: 4.8, z: -13.4, normalX: 1, normalZ: 0, width: 1.15, height: 3.0 }),
  Object.freeze({ id: 'banner_nave_e', roomId: 'knights_nave', x: 5.38, y: 4.8, z: -10.8, normalX: -1, normalZ: 0, width: 1.15, height: 3.0 }),
  Object.freeze({ id: 'banner_west_wing', roomId: 'west_wing', x: -12.38, y: 4.6, z: -6.0, normalX: 1, normalZ: 0, width: 1.2, height: 3.1 }),
  Object.freeze({ id: 'banner_alcove_n', roomId: 'east_alcove', x: 13.88, y: 4.5, z: -6.2, normalX: -1, normalZ: 0, width: 1.1, height: 2.9 }),
  Object.freeze({ id: 'banner_alcove_s', roomId: 'east_alcove', x: 13.88, y: 4.5, z: -1.8, normalX: -1, normalZ: 0, width: 1.1, height: 2.9 }),
  // Zone 5: Pre-Boss Sanctuary tattered ceremonial tapestries flanking the great Boss Gate (`z = -31.18` proud of stone jambs!) & outer walls
  Object.freeze({ id: 'banner_sanctuary_w', roomId: 'pre_boss_sanctuary', x: -6.25, y: 5.05, z: -31.18, normalX: 0, normalZ: 1, width: 1.52, height: 3.95 }),
  Object.freeze({ id: 'banner_sanctuary_e', roomId: 'pre_boss_sanctuary', x: 6.25, y: 5.05, z: -31.18, normalX: 0, normalZ: 1, width: 1.52, height: 3.95 }),
  Object.freeze({ id: 'banner_sanctuary_side_w', roomId: 'pre_boss_sanctuary', x: -7.86, y: 5.1, z: -24.2, normalX: 1, normalZ: 0, width: 1.32, height: 3.45 }),
  Object.freeze({ id: 'banner_sanctuary_side_e', roomId: 'pre_boss_sanctuary', x: 7.86, y: 5.1, z: -24.2, normalX: -1, normalZ: 0, width: 1.32, height: 3.45 }),
  // Zone 6: Boss Hall Cathedral
  Object.freeze({ id: 'banner_boss_nw', roomId: 'boss_hall', x: -4.8, y: 6.2, z: -61.8, normalX: 0.3, normalZ: 0.95, width: 1.65, height: 4.4 }),
  Object.freeze({ id: 'banner_boss_ne', roomId: 'boss_hall', x: 4.8, y: 6.2, z: -61.8, normalX: -0.3, normalZ: 0.95, width: 1.65, height: 4.4 })
]);

// ============================================================================
// 5b. Ribbed Gothic Vaulted Ceilings, Wrought-Iron Chandeliers,
//     Clerestory God-Ray Light Shafts & East Alcove Armory Decor
// ============================================================================
export const SOULS_CASTLE_VAULTS = Object.freeze([
  // Southern Grand Wing (`courtyard` envelope z in [26, 68], x in [-13.5, +11.0]) — 6 ribbed groin bays
  Object.freeze({ id: 'vault_south_1', roomId: 'courtyard', zoneId: 'spawn_hall', kind: 'ribbed_groin', cx: -1.25, cz: 64.5, spanX: 24.5, spanZ: 7.0, springY: 7.6, apexY: 11.8, ribThick: 0.44, hasOculus: true, oculusRadius: 2.4, oculusX: 0, oculusZ: 60.0, cameraFade: true }),
  Object.freeze({ id: 'vault_south_2', roomId: 'courtyard', zoneId: 'spawn_hall', kind: 'ribbed_groin', cx: -1.25, cz: 57.5, spanX: 24.5, spanZ: 7.0, springY: 7.6, apexY: 11.8, ribThick: 0.44, hasOculus: false, cameraFade: true }),
  Object.freeze({ id: 'vault_south_3', roomId: 'courtyard', zoneId: 'spawn_hall', kind: 'ribbed_groin', cx: -1.25, cz: 50.5, spanX: 24.5, spanZ: 7.0, springY: 7.6, apexY: 11.8, ribThick: 0.44, hasOculus: false, cameraFade: true }),
  Object.freeze({ id: 'vault_south_4', roomId: 'courtyard', zoneId: 'first_duel_atrium', kind: 'ribbed_groin', cx: -1.25, cz: 43.5, spanX: 24.5, spanZ: 7.0, springY: 7.6, apexY: 11.8, ribThick: 0.44, hasOculus: false, cameraFade: true }),
  Object.freeze({ id: 'vault_south_5', roomId: 'courtyard', zoneId: 'first_duel_atrium', kind: 'ribbed_groin', cx: -1.25, cz: 36.5, spanX: 24.5, spanZ: 7.0, springY: 7.6, apexY: 11.8, ribThick: 0.44, hasOculus: false, cameraFade: true }),
  Object.freeze({ id: 'vault_south_6', roomId: 'courtyard', zoneId: 'first_duel_atrium', kind: 'ribbed_groin', cx: -1.25, cz: 29.5, spanX: 24.5, spanZ: 7.0, springY: 7.6, apexY: 11.8, ribThick: 0.44, hasOculus: false, cameraFade: true }),

  // Northern Multi-Hall Wing (`corridor` envelope z in [-32, 26], x in [-12.5, +8.0]) — 9 ribbed groin bays
  Object.freeze({ id: 'vault_north_1', roomId: 'corridor', zoneId: 'flame_gauntlet', kind: 'ribbed_groin', cx: -2.25, cz: 22.8, spanX: 20.5, spanZ: 6.4, springY: 6.8, apexY: 10.6, ribThick: 0.40, hasOculus: false, cameraFade: true }),
  Object.freeze({ id: 'vault_north_2', roomId: 'corridor', zoneId: 'flame_gauntlet', kind: 'ribbed_groin', cx: -2.25, cz: 16.4, spanX: 20.5, spanZ: 6.4, springY: 6.8, apexY: 10.6, ribThick: 0.40, hasOculus: false, cameraFade: true }),
  Object.freeze({ id: 'vault_north_3', roomId: 'corridor', zoneId: 'flame_gauntlet', kind: 'ribbed_groin', cx: -2.25, cz: 10.0, spanX: 20.5, spanZ: 6.4, springY: 6.8, apexY: 10.6, ribThick: 0.40, hasOculus: false, cameraFade: true }),
  Object.freeze({ id: 'vault_north_4', roomId: 'corridor', zoneId: 'knights_nave', kind: 'ribbed_groin', cx: -2.25, cz: 3.5, spanX: 20.5, spanZ: 6.5, springY: 6.8, apexY: 10.6, ribThick: 0.40, hasOculus: false, cameraFade: true }),
  Object.freeze({ id: 'vault_north_5', roomId: 'corridor', zoneId: 'knights_nave', kind: 'ribbed_groin', cx: -2.25, cz: -3.0, spanX: 20.5, spanZ: 6.5, springY: 6.8, apexY: 10.6, ribThick: 0.40, hasOculus: false, cameraFade: true }),
  Object.freeze({ id: 'vault_north_6', roomId: 'corridor', zoneId: 'knights_nave', kind: 'ribbed_groin', cx: -2.25, cz: -9.5, spanX: 20.5, spanZ: 6.5, springY: 6.8, apexY: 10.6, ribThick: 0.40, hasOculus: false, cameraFade: true }),
  Object.freeze({ id: 'vault_north_7', roomId: 'corridor', zoneId: 'knights_nave', kind: 'ribbed_groin', cx: -2.25, cz: -16.0, spanX: 20.5, spanZ: 6.4, springY: 6.8, apexY: 10.6, ribThick: 0.40, hasOculus: false, cameraFade: true }),
  Object.freeze({ id: 'vault_north_8', roomId: 'corridor', zoneId: 'pre_boss_sanctuary', kind: 'ribbed_groin', cx: -2.25, cz: -22.4, spanX: 20.5, spanZ: 6.4, springY: 6.8, apexY: 10.6, ribThick: 0.40, hasOculus: false, cameraFade: true }),
  Object.freeze({ id: 'vault_north_9', roomId: 'corridor', zoneId: 'pre_boss_sanctuary', kind: 'ribbed_groin', cx: -2.25, cz: -28.8, spanX: 20.5, spanZ: 6.4, springY: 6.8, apexY: 10.6, ribThick: 0.40, hasOculus: false, cameraFade: true }),

  // East Armory Alcove (`east_alcove`) — cross-ribbed gothic chapel vault
  Object.freeze({
    id: 'vault_east_alcove',
    roomId: 'east_alcove',
    zoneId: 'east_alcove',
    kind: 'ribbed_groin',
    cx: 10.15,
    cz: -4.0,
    spanX: 7.7,
    spanZ: 10.0,
    springY: 5.8,
    apexY: 8.9,
    ribThick: 0.34,
    hasOculus: false,
    cameraFade: true
  }),

  // Boss Throne Cathedral (center (0, -47.2), R=16.0) — monumental 16-ribbed radial dome vault
  Object.freeze({
    id: 'vault_boss_cathedral',
    roomId: 'boss_hall',
    zoneId: 'boss_hall',
    kind: 'radial_cathedral_dome',
    cx: SOULS_CASTLE_CONSTANTS.BOSS_CENTER_X,
    cz: SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z,
    radius: 16.2,
    springY: 10.8,
    apexY: 18.2,
    ribCount: 16,
    ribThick: 0.5,
    hasOculus: true,
    oculusRadius: 4.0,
    oculusX: SOULS_CASTLE_CONSTANTS.BOSS_CENTER_X,
    oculusZ: SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z,
    cameraFade: false
  })
]);

export const SOULS_CASTLE_CHANDELIERS = Object.freeze([
  Object.freeze({ id: 'chandelier_spawn_hall', roomId: 'courtyard', zoneId: 'spawn_hall', x: 0, z: 57.0, hangFromY: 11.8, ringY: 7.3, chainLength: 4.5, ringRadius: 2.1, tierCount: 2, candleCount: 12, lightColor: 0xffa04a, lightIntensity: 2.4, lightDistance: 16.0, swayAmp: 0.014, swaySpeed: 0.62, swayPhase: 0.0, cameraFade: true }),
  Object.freeze({ id: 'chandelier_duel_atrium', roomId: 'courtyard', zoneId: 'first_duel_atrium', x: -1.5, z: 36.0, hangFromY: 11.8, ringY: 7.2, chainLength: 4.6, ringRadius: 2.0, tierCount: 2, candleCount: 12, lightColor: 0xff9a44, lightIntensity: 2.3, lightDistance: 15.5, swayAmp: 0.014, swaySpeed: 0.66, swayPhase: 1.1, cameraFade: true }),
  Object.freeze({ id: 'chandelier_gauntlet', roomId: 'corridor', zoneId: 'flame_gauntlet', x: 0, z: 16.8, hangFromY: 10.6, ringY: 6.5, chainLength: 4.1, ringRadius: 1.45, tierCount: 1, candleCount: 8, lightColor: 0xff943e, lightIntensity: 2.0, lightDistance: 13.0, swayAmp: 0.015, swaySpeed: 0.7, swayPhase: 2.2, cameraFade: true }),
  Object.freeze({ id: 'chandelier_knights_nave', roomId: 'corridor', zoneId: 'knights_nave', x: 0, z: -4.5, hangFromY: 10.6, ringY: 6.5, chainLength: 4.1, ringRadius: 1.65, tierCount: 1, candleCount: 10, lightColor: 0xff943e, lightIntensity: 2.1, lightDistance: 14.0, swayAmp: 0.015, swaySpeed: 0.68, swayPhase: 3.1, cameraFade: true }),
  Object.freeze({ id: 'chandelier_east_alcove', roomId: 'east_alcove', zoneId: 'east_alcove', x: 10.1, z: -4.0, hangFromY: 8.9, ringY: 5.5, chainLength: 3.4, ringRadius: 1.25, tierCount: 1, candleCount: 8, lightColor: 0xffaa4c, lightIntensity: 2.2, lightDistance: 11.5, swayAmp: 0.012, swaySpeed: 0.74, swayPhase: 4.0, cameraFade: true }),
  Object.freeze({ id: 'chandelier_sanctuary', roomId: 'corridor', zoneId: 'pre_boss_sanctuary', x: 0, z: -24.0, hangFromY: 10.6, ringY: 6.6, chainLength: 4.0, ringRadius: 1.85, tierCount: 2, candleCount: 12, lightColor: 0xff9c46, lightIntensity: 2.3, lightDistance: 15.0, swayAmp: 0.013, swaySpeed: 0.64, swayPhase: 4.8, cameraFade: true }),
  Object.freeze({ id: 'chandelier_boss_center', roomId: 'boss_hall', zoneId: 'boss_hall', x: 0, z: -47.2, hangFromY: 18.2, ringY: 10.4, chainLength: 7.8, ringRadius: 3.5, tierCount: 2, candleCount: 18, lightColor: 0xff963c, lightIntensity: 3.1, lightDistance: 24.0, swayAmp: 0.01, swaySpeed: 0.48, swayPhase: 0.6, cameraFade: false }),
  Object.freeze({ id: 'chandelier_boss_throne', roomId: 'boss_hall', zoneId: 'boss_hall', x: 0, z: -54.6, hangFromY: 15.6, ringY: 9.4, chainLength: 6.2, ringRadius: 2.0, tierCount: 1, candleCount: 10, lightColor: 0xff8a32, lightIntensity: 2.5, lightDistance: 17.5, swayAmp: 0.011, swaySpeed: 0.54, swayPhase: 5.2, cameraFade: false })
]);

function makeClerestoryShaft({
  id,
  roomId,
  windowX,
  windowY,
  windowZ,
  windowWidth,
  windowHeight,
  normalX,
  normalZ,
  targetX,
  targetZ,
  topRadius,
  bottomRadius,
  color,
  opacity,
  priority
}) {
  const targetY = 0.02;
  const dx = targetX - windowX;
  const dy = targetY - windowY;
  const dz = targetZ - windowZ;
  const length = Math.hypot(dx, dy, dz);
  const invLen = length > 1e-6 ? 1 / length : 1;
  return Object.freeze({
    id,
    roomId,
    windowX,
    windowY,
    windowZ,
    windowWidth,
    windowHeight,
    normalX,
    normalZ,
    targetX,
    targetY,
    targetZ,
    dirX: Number((dx * invLen).toFixed(5)),
    dirY: Number((dy * invLen).toFixed(5)),
    dirZ: Number((dz * invLen).toFixed(5)),
    length: Number(length.toFixed(4)),
    topRadius,
    bottomRadius,
    color,
    opacity,
    priority
  });
}

export const SOULS_CASTLE_CLERESTORY_SHAFTS = Object.freeze([
  makeClerestoryShaft({ id: 'shaft_spawn_oculus', roomId: 'spawn_hall', windowX: -10.4, windowY: 8.4, windowZ: 58.5, windowWidth: 1.7, windowHeight: 3.2, normalX: 1, normalZ: 0, targetX: 0.0, targetZ: 59.5, topRadius: 1.0, bottomRadius: 2.8, color: 0xa7c2ef, opacity: 0.14, priority: 1 }),
  makeClerestoryShaft({ id: 'shaft_atrium_cloister', roomId: 'first_duel_atrium', windowX: -13.1, windowY: 7.4, windowZ: 36.5, windowWidth: 1.5, windowHeight: 3.0, normalX: 1, normalZ: 0, targetX: -2.2, targetZ: 35.8, topRadius: 0.85, bottomRadius: 2.5, color: 0x9cb9e8, opacity: 0.13, priority: 1 }),
  makeClerestoryShaft({ id: 'shaft_gauntlet_mid', roomId: 'flame_gauntlet', windowX: -5.05, windowY: 7.2, windowZ: 17.2, windowWidth: 1.25, windowHeight: 2.7, normalX: 1, normalZ: 0, targetX: 1.2, targetZ: 15.8, topRadius: 0.7, bottomRadius: 2.0, color: 0x9cb9e8, opacity: 0.12, priority: 2 }),
  makeClerestoryShaft({ id: 'shaft_west_wing', roomId: 'west_wing', windowX: -12.3, windowY: 7.0, windowZ: -6.0, windowWidth: 1.3, windowHeight: 2.6, normalX: 1, normalZ: 0, targetX: -8.2, targetZ: -5.8, topRadius: 0.7, bottomRadius: 2.0, color: 0x9cb9e8, opacity: 0.13, priority: 2 }),
  makeClerestoryShaft({ id: 'shaft_east_alcove_shrine', roomId: 'east_alcove', windowX: 13.85, windowY: 6.1, windowZ: -4.0, windowWidth: 1.25, windowHeight: 2.5, normalX: -1, normalZ: 0, targetX: 10.6, targetZ: -4.0, topRadius: 0.65, bottomRadius: 1.85, color: 0xe6b87d, opacity: 0.15, priority: 1 }),
  makeClerestoryShaft({ id: 'shaft_sanctuary_bonfire', roomId: 'pre_boss_sanctuary', windowX: -7.8, windowY: 7.6, windowZ: -25.0, windowWidth: 1.5, windowHeight: 3.0, normalX: 1, normalZ: 0, targetX: 0.4, targetZ: -29.8, topRadius: 0.8, bottomRadius: 2.4, color: 0xaec8f2, opacity: 0.14, priority: 1 }),
  makeClerestoryShaft({ id: 'shaft_boss_arena_west', roomId: 'boss_hall', windowX: -15.2, windowY: 10.2, windowZ: -44.0, windowWidth: 2.1, windowHeight: 4.5, normalX: 0.98, normalZ: -0.2, targetX: -2.0, targetZ: -46.8, topRadius: 1.25, bottomRadius: 3.8, color: 0xa4c0ee, opacity: 0.14, priority: 1 }),
  makeClerestoryShaft({ id: 'shaft_boss_throne', roomId: 'boss_hall', windowX: -6.5, windowY: 10.8, windowZ: -60.8, windowWidth: 2.2, windowHeight: 4.6, normalX: 0.43, normalZ: 0.9, targetX: 0.0, targetZ: -56.4, topRadius: 1.2, bottomRadius: 3.4, color: 0xb6ccf5, opacity: 0.16, priority: 1 })
]);

export const SOULS_CASTLE_GOD_RAYS = SOULS_CASTLE_CLERESTORY_SHAFTS;

// Environmental Storytelling & Armory Decor across ALL 5 Pre-Boss Zones (`z` from +68 to -31.2; 0 inside Boss Arena!)
export const SOULS_CASTLE_STORY_DECOR = Object.freeze([
  // --- Zone 1: Awakening Hall (`spawn_hall`: sarcophagi/tomb effigies, broken portcullis/chains, Vigilant Knight statues, fallen shields) ---
  Object.freeze({ id: 'sarcophagus_spawn_founder', roomId: 'spawn_hall', kind: 'stone_sarcophagus', style: 'founder_effigy', x: 0.0, y: 0, z: 67.05, facing: Math.PI, width: 2.36, depth: 1.12, collider: true, radius: 0.56 }),
  Object.freeze({ id: 'sarcophagus_spawn_w', roomId: 'spawn_hall', kind: 'stone_sarcophagus', style: 'knight_effigy', x: -10.18, y: 0, z: 57.0, facing: Math.PI * 0.5, width: 2.28, depth: 1.06, collider: true, radius: 0.53 }),
  Object.freeze({ id: 'sarcophagus_spawn_e', roomId: 'spawn_hall', kind: 'stone_sarcophagus', style: 'cracked_tomb', x: 10.18, y: 0, z: 57.0, facing: -Math.PI * 0.5, width: 2.28, depth: 1.06, collider: true, radius: 0.53 }),
  Object.freeze({ id: 'sarcophagus_spawn_nw', roomId: 'spawn_hall', kind: 'stone_sarcophagus', style: 'knight_effigy', x: -10.18, y: 0, z: 48.4, facing: Math.PI * 0.5, width: 2.20, depth: 1.04, collider: true, radius: 0.52 }),
  Object.freeze({ id: 'statue_spawn_sw', roomId: 'spawn_hall', kind: 'knight_statue', style: 'vigilant_sentinel', x: -2.85, y: 0, z: 67.12, facing: Math.PI, scale: 1.04, collider: true, radius: 0.62 }),
  Object.freeze({ id: 'statue_spawn_se', roomId: 'spawn_hall', kind: 'knight_statue', style: 'vigilant_sentinel', x: 2.85, y: 0, z: 67.12, facing: Math.PI, scale: 1.04, collider: true, radius: 0.62 }),
  Object.freeze({ id: 'statue_spawn_e_south', roomId: 'spawn_hall', kind: 'knight_statue', style: 'weathered_guardian', x: 10.22, y: 0, z: 64.9, facing: -Math.PI * 0.5, scale: 1.0, collider: true, radius: 0.60 }),
  Object.freeze({ id: 'statue_spawn_ne_step', roomId: 'spawn_hall', kind: 'knight_statue', style: 'weathered_guardian', x: 9.85, y: 0, z: 47.05, facing: 0.35, scale: 1.02, collider: true, radius: 0.60 }),
  Object.freeze({ id: 'portcullis_spawn_arch', roomId: 'spawn_hall', kind: 'broken_portcullis', x: -1.25, y: 0, z: 46.0, spanWidth: 19.5, springY: 5.8, apexY: 9.4, minCenterSpikeY: 5.05, collider: false }),
  Object.freeze({ id: 'fallen_shields_spawn_ne', roomId: 'spawn_hall', kind: 'fallen_shield_cluster', x: 8.95, y: 0, z: 51.4, facing: -0.9, collider: false }),
  Object.freeze({ id: 'fallen_shields_spawn_sw', roomId: 'spawn_hall', kind: 'fallen_shield_cluster', x: -8.95, y: 0, z: 62.8, facing: 0.75, collider: false }),
  Object.freeze({ id: 'wall_shield_spawn_founder', roomId: 'spawn_hall', kind: 'wall_shield', crest: 'relic_sun_shield', crossedSwords: true, x: 0.0, y: 4.15, z: 67.88, normalX: 0, normalZ: -1, scale: 1.32, collider: false }),

  // --- Zone 2: Asymmetric West Cloister / Duel Atrium (`first_duel_atrium`: weapon racks, armor stands, skull reliquary niches, shields, portcullis) ---
  Object.freeze({ id: 'atrium_weapon_rack_w1', roomId: 'first_duel_atrium', kind: 'weapon_rack', style: 'greatswords_halberds', x: -12.82, y: 0, z: 43.5, facing: Math.PI * 0.5, width: 1.85, height: 1.85, depth: 0.65, collider: true, radius: 0.36 }),
  Object.freeze({ id: 'atrium_weapon_rack_w2', roomId: 'first_duel_atrium', kind: 'weapon_rack', style: 'halberds_shields', x: -12.82, y: 0, z: 33.6, facing: Math.PI * 0.5, width: 1.85, height: 1.85, depth: 0.65, collider: true, radius: 0.36 }),
  Object.freeze({ id: 'atrium_weapon_rack_nw', roomId: 'first_duel_atrium', kind: 'weapon_rack', style: 'longswords_spears', x: -11.3, y: 0, z: 26.68, facing: 0, width: 1.80, height: 1.85, depth: 0.65, collider: true, radius: 0.36 }),
  Object.freeze({ id: 'atrium_weapon_rack_e1', roomId: 'first_duel_atrium', kind: 'weapon_rack', style: 'halberds_shields', x: 7.82, y: 0, z: 43.4, facing: -Math.PI * 0.5, width: 1.80, height: 1.85, depth: 0.65, collider: true, radius: 0.36 }),
  Object.freeze({ id: 'atrium_armor_stand_w1', roomId: 'first_duel_atrium', kind: 'armor_stand', style: 'ashen_plate', x: -12.75, y: 0, z: 38.6, facing: Math.PI * 0.45, collider: true, radius: 0.48 }),
  Object.freeze({ id: 'atrium_armor_stand_w2', roomId: 'first_duel_atrium', kind: 'armor_stand', style: 'battle_scarred', x: -12.75, y: 0, z: 28.4, facing: Math.PI * 0.35, collider: true, radius: 0.48 }),
  Object.freeze({ id: 'atrium_armor_stand_e1', roomId: 'first_duel_atrium', kind: 'armor_stand', style: 'battle_scarred', x: 7.75, y: 0, z: 28.8, facing: -Math.PI * 0.60, collider: true, radius: 0.48 }),
  Object.freeze({ id: 'niche_atrium_w_main', roomId: 'first_duel_atrium', kind: 'reliquary_niche', x: -13.42, y: 0, z: 36.0, normalX: 1, normalZ: 0, scale: 1.05, collider: false }),
  Object.freeze({ id: 'niche_atrium_sw_step', roomId: 'first_duel_atrium', kind: 'reliquary_niche', x: -12.25, y: 0, z: 45.92, normalX: 0, normalZ: -1, scale: 1.0, collider: false }),
  Object.freeze({ id: 'niche_atrium_e_south', roomId: 'first_duel_atrium', kind: 'reliquary_niche', x: 8.42, y: 0, z: 38.6, normalX: -1, normalZ: 0, scale: 1.0, collider: false }),
  Object.freeze({ id: 'niche_atrium_e_north', roomId: 'first_duel_atrium', kind: 'reliquary_niche', x: 8.42, y: 0, z: 33.4, normalX: -1, normalZ: 0, scale: 1.0, collider: false }),
  Object.freeze({ id: 'atrium_shield_w1', roomId: 'first_duel_atrium', kind: 'wall_shield', crest: 'ashen_crown', crossedSwords: true, x: -13.42, y: 3.1, z: 43.5, normalX: 1, normalZ: 0, scale: 1.02, collider: false }),
  Object.freeze({ id: 'atrium_shield_w2', roomId: 'first_duel_atrium', kind: 'wall_shield', crest: 'iron_cross', crossedSwords: true, x: -13.42, y: 3.1, z: 33.6, normalX: 1, normalZ: 0, scale: 1.0, collider: false }),
  Object.freeze({ id: 'atrium_shield_e1', roomId: 'first_duel_atrium', kind: 'wall_shield', crest: 'ashen_crown', crossedSwords: true, x: 8.42, y: 3.1, z: 43.4, normalX: -1, normalZ: 0, scale: 1.02, collider: false }),
  Object.freeze({ id: 'portcullis_gauntlet_arch', roomId: 'first_duel_atrium', kind: 'broken_portcullis', x: 0.0, y: 0, z: 25.6, spanWidth: 10.4, springY: 5.0, apexY: 7.9, minCenterSpikeY: 4.65, collider: false }),

  // --- Zone 3: 5-Gargoyle Flame Gauntlet (`flame_gauntlet`: swaying overhead prisoner cages + safe-recess charred skeletal remains) ---
  Object.freeze({ id: 'cage_gauntlet_1', roomId: 'flame_gauntlet', kind: 'hanging_cage', x: 3.12, y: 0, z: 24.3, dropLen: 5.25, hasSkeleton: true, phase: 0.2, collider: false }),
  Object.freeze({ id: 'cage_gauntlet_2', roomId: 'flame_gauntlet', kind: 'hanging_cage', x: -3.12, y: 0, z: 21.0, dropLen: 5.00, hasSkeleton: true, phase: 1.5, collider: false }),
  Object.freeze({ id: 'cage_gauntlet_3', roomId: 'flame_gauntlet', kind: 'hanging_cage', x: 3.18, y: 0, z: 17.8, dropLen: 4.85, hasSkeleton: false, phase: 2.8, collider: false }),
  Object.freeze({ id: 'cage_gauntlet_4', roomId: 'flame_gauntlet', kind: 'hanging_cage', x: -3.18, y: 0, z: 16.4, dropLen: 5.15, hasSkeleton: true, phase: 3.9, collider: false }),
  Object.freeze({ id: 'cage_gauntlet_5', roomId: 'flame_gauntlet', kind: 'hanging_cage', x: -3.10, y: 0, z: 13.3, dropLen: 5.30, hasSkeleton: true, phase: 5.1, collider: false }),
  Object.freeze({ id: 'cage_gauntlet_6', roomId: 'flame_gauntlet', kind: 'hanging_cage', x: 3.10, y: 0, z: 9.6, dropLen: 5.05, hasSkeleton: true, phase: 0.9, collider: false }),
  Object.freeze({ id: 'remains_gauntlet_1', roomId: 'flame_gauntlet', kind: 'charred_remains', pose: 'seated_knight', x: 4.78, y: 0, z: 24.5, facing: -Math.PI * 0.5, collider: false }),
  Object.freeze({ id: 'remains_gauntlet_2', roomId: 'flame_gauntlet', kind: 'charred_remains', pose: 'crawling_husk', x: -4.78, y: 0, z: 20.8, facing: Math.PI * 0.45, collider: false }),
  Object.freeze({ id: 'remains_gauntlet_3', roomId: 'flame_gauntlet', kind: 'charred_remains', pose: 'shield_pile', x: -4.78, y: 0, z: 17.1, facing: Math.PI * 0.55, collider: false }),
  Object.freeze({ id: 'remains_gauntlet_4', roomId: 'flame_gauntlet', kind: 'charred_remains', pose: 'seated_knight', x: 4.78, y: 0, z: 13.2, facing: -Math.PI * 0.5, collider: false }),
  Object.freeze({ id: 'remains_gauntlet_5', roomId: 'flame_gauntlet', kind: 'charred_remains', pose: 'crawling_husk', x: -4.78, y: 0, z: 13.3, facing: Math.PI * 0.5, collider: false }),
  Object.freeze({ id: 'remains_gauntlet_6', roomId: 'flame_gauntlet', kind: 'charred_remains', pose: 'shield_pile', x: 4.78, y: 0, z: 9.4, facing: -Math.PI * 0.55, collider: false }),

  // --- Zone 4: Knights' Nave & West Side-Chapel (`knights_nave` + `west_wing`: side-wall pews, Gothic shrines, hanging censers, fallen slabs) ---
  Object.freeze({ id: 'pew_nave_ws1', roomId: 'knights_nave', kind: 'cathedral_pew', style: 'intact', x: -4.84, y: 0, z: 6.1, facing: Math.PI * 0.5, width: 2.00, depth: 0.64, collider: true, radius: 0.32 }),
  Object.freeze({ id: 'pew_nave_ws2', roomId: 'knights_nave', kind: 'cathedral_pew', style: 'shattered', x: -4.84, y: 0, z: 1.4, facing: Math.PI * 0.5, width: 1.90, depth: 0.64, collider: true, radius: 0.32 }),
  Object.freeze({ id: 'pew_nave_es1', roomId: 'knights_nave', kind: 'cathedral_pew', style: 'shattered', x: 4.84, y: 0, z: 6.2, facing: -Math.PI * 0.5, width: 2.00, depth: 0.64, collider: true, radius: 0.32 }),
  Object.freeze({ id: 'pew_nave_wn1', roomId: 'knights_nave', kind: 'cathedral_pew', style: 'shattered', x: -4.84, y: 0, z: -14.4, facing: Math.PI * 0.5, width: 1.90, depth: 0.64, collider: true, radius: 0.32 }),
  Object.freeze({ id: 'pew_nave_en1', roomId: 'knights_nave', kind: 'cathedral_pew', style: 'intact', x: 4.84, y: 0, z: -14.4, facing: -Math.PI * 0.5, width: 1.95, depth: 0.64, collider: true, radius: 0.32 }),
  Object.freeze({ id: 'pew_chapel_s', roomId: 'west_wing', kind: 'cathedral_pew', style: 'intact', x: -9.4, y: 0, z: -1.64, facing: Math.PI, width: 2.00, depth: 0.64, collider: true, radius: 0.32 }),
  Object.freeze({ id: 'pew_chapel_n', roomId: 'west_wing', kind: 'cathedral_pew', style: 'shattered', x: -7.6, y: 0, z: -10.36, facing: 0, width: 1.85, depth: 0.64, collider: true, radius: 0.32 }),
  Object.freeze({ id: 'shrine_nave_es', roomId: 'knights_nave', kind: 'gothic_wall_shrine', x: 5.04, y: 0, z: 2.75, facing: -Math.PI * 0.5, collider: true, radius: 0.48 }),
  Object.freeze({ id: 'shrine_nave_wn', roomId: 'knights_nave', kind: 'gothic_wall_shrine', x: -5.04, y: 0, z: -11.8, facing: Math.PI * 0.5, collider: true, radius: 0.48 }),
  Object.freeze({ id: 'shrine_chapel_nw', roomId: 'west_wing', kind: 'gothic_wall_shrine', x: -12.02, y: 0, z: -8.6, facing: Math.PI * 0.5, collider: true, radius: 0.48 }),
  Object.freeze({ id: 'shrine_chapel_sw', roomId: 'west_wing', kind: 'gothic_wall_shrine', x: -12.02, y: 0, z: -3.4, facing: Math.PI * 0.5, collider: true, radius: 0.48 }),
  Object.freeze({ id: 'censer_nave_1', roomId: 'knights_nave', kind: 'hanging_censer', x: -2.85, y: 0, z: 4.4, dropLen: 5.15, phase: 0.4, collider: false }),
  Object.freeze({ id: 'censer_nave_2', roomId: 'knights_nave', kind: 'hanging_censer', x: 2.85, y: 0, z: 4.4, dropLen: 5.05, phase: 1.9, collider: false }),
  Object.freeze({ id: 'censer_nave_3', roomId: 'knights_nave', kind: 'hanging_censer', x: -2.95, y: 0, z: -1.8, dropLen: 5.20, phase: 3.1, collider: false }),
  Object.freeze({ id: 'censer_nave_4', roomId: 'knights_nave', kind: 'hanging_censer', x: -2.85, y: 0, z: -12.4, dropLen: 5.15, phase: 4.4, collider: false }),
  Object.freeze({ id: 'censer_nave_5', roomId: 'knights_nave', kind: 'hanging_censer', x: 2.85, y: 0, z: -12.4, dropLen: 5.05, phase: 5.6, collider: false }),
  Object.freeze({ id: 'censer_west_chapel', roomId: 'west_wing', kind: 'hanging_censer', x: -9.2, y: 0, z: -6.0, dropLen: 4.85, phase: 2.3, collider: false }),
  Object.freeze({ id: 'slab_nave_pillar_nw', roomId: 'knights_nave', kind: 'fallen_masonry_slab', x: -2.35, y: 0, z: -9.2, facing: 0.42, collider: false }),
  Object.freeze({ id: 'slab_nave_ws_corner', roomId: 'knights_nave', kind: 'fallen_masonry_slab', x: -4.88, y: 0, z: 7.55, facing: 0.32, collider: false }),
  Object.freeze({ id: 'slab_chapel_nw_corner', roomId: 'west_wing', kind: 'fallen_masonry_slab', x: -11.75, y: 0, z: -10.2, facing: 0.85, collider: false }),

  // --- Zone 5: Pre-Boss Bonfire Sanctuary (`pre_boss_sanctuary`: kneeling armored watchers, pilgrim stone benches, leaning greatswords) ---
  Object.freeze({ id: 'kneeling_knight_sanctuary_ne', roomId: 'pre_boss_sanctuary', kind: 'kneeling_knight', x: 6.55, y: 0, z: -27.8, facing: Math.PI + 0.22, collider: true, radius: 0.56 }),
  Object.freeze({ id: 'kneeling_knight_sanctuary_sw', roomId: 'pre_boss_sanctuary', kind: 'kneeling_knight', x: -6.55, y: 0, z: -18.6, facing: Math.PI - 0.14, collider: true, radius: 0.56 }),
  Object.freeze({ id: 'kneeling_knight_sanctuary_se', roomId: 'pre_boss_sanctuary', kind: 'kneeling_knight', x: 6.55, y: 0, z: -18.6, facing: Math.PI + 0.14, collider: true, radius: 0.56 }),
  Object.freeze({ id: 'bench_sanctuary_w', roomId: 'pre_boss_sanctuary', kind: 'pilgrim_bench', x: -7.30, y: 0, z: -21.8, facing: Math.PI * 0.5, width: 1.92, depth: 0.64, collider: true, radius: 0.32 }),
  Object.freeze({ id: 'bench_sanctuary_e', roomId: 'pre_boss_sanctuary', kind: 'pilgrim_bench', x: 7.30, y: 0, z: -24.0, facing: -Math.PI * 0.5, width: 1.92, depth: 0.64, collider: true, radius: 0.32 }),
  Object.freeze({ id: 'resting_arms_sanctuary_w', roomId: 'pre_boss_sanctuary', kind: 'leaning_greatsword', style: 'greatsword_shield', x: -7.52, y: 0, z: -25.8, facing: Math.PI * 0.5, collider: false }),
  Object.freeze({ id: 'resting_arms_sanctuary_e', roomId: 'pre_boss_sanctuary', kind: 'leaning_greatsword', style: 'pilgrim_staff_sword', x: 7.52, y: 0, z: -26.2, facing: -Math.PI * 0.5, collider: false }),
  Object.freeze({ id: 'resting_arms_sanctuary_sw', roomId: 'pre_boss_sanctuary', kind: 'leaning_greatsword', style: 'greatsword_shield', x: -7.15, y: 0, z: -16.52, facing: 0, collider: false }),
  Object.freeze({ id: 'resting_arms_sanctuary_se', roomId: 'pre_boss_sanctuary', kind: 'leaning_greatsword', style: 'halberd_urn', x: 7.15, y: 0, z: -16.52, facing: 0, collider: false })
]);

export const SOULS_CASTLE_ALCOVE_DECOR = Object.freeze([
  // East Armory Alcove (`x in [6.3, 14.0], z in [-9.0, +1.0]`, centered at `z = -4.0`)
  Object.freeze({ id: 'alcove_weapon_rack_nw', roomId: 'east_alcove', kind: 'weapon_rack', style: 'greatswords_halberds', x: 9.8, y: 0, z: -8.35, facing: 0, width: 1.8, height: 1.85, depth: 0.65, collider: true, radius: 0.62 }),
  Object.freeze({ id: 'alcove_weapon_rack_sw', roomId: 'east_alcove', kind: 'weapon_rack', style: 'longswords_spears', x: 9.8, y: 0, z: 0.35, facing: Math.PI, width: 1.8, height: 1.85, depth: 0.65, collider: true, radius: 0.62 }),
  Object.freeze({ id: 'alcove_armor_stand_n', roomId: 'east_alcove', kind: 'armor_stand', style: 'ashen_plate', x: 7.0, y: 0, z: -8.15, facing: Math.PI * 0.25, collider: true, radius: 0.48 }),
  Object.freeze({ id: 'alcove_armor_stand_s', roomId: 'east_alcove', kind: 'armor_stand', style: 'ashen_plate', x: 7.0, y: 0, z: 0.15, facing: Math.PI * 0.75, collider: true, radius: 0.48 }),
  Object.freeze({ id: 'alcove_shield_n1', roomId: 'east_alcove', kind: 'wall_shield', crest: 'ashen_crown', crossedSwords: true, x: 8.2, y: 2.85, z: -8.92, normalX: 0, normalZ: 1, scale: 1.0, collider: false }),
  Object.freeze({ id: 'alcove_shield_n2', roomId: 'east_alcove', kind: 'wall_shield', crest: 'iron_cross', crossedSwords: false, x: 11.4, y: 2.85, z: -8.92, normalX: 0, normalZ: 1, scale: 0.95, collider: false }),
  Object.freeze({ id: 'alcove_shield_s1', roomId: 'east_alcove', kind: 'wall_shield', crest: 'ashen_crown', crossedSwords: true, x: 8.2, y: 2.85, z: 0.92, normalX: 0, normalZ: -1, scale: 1.0, collider: false }),
  Object.freeze({ id: 'alcove_shield_s2', roomId: 'east_alcove', kind: 'wall_shield', crest: 'iron_cross', crossedSwords: false, x: 11.4, y: 2.85, z: 0.92, normalX: 0, normalZ: -1, scale: 0.95, collider: false }),
  Object.freeze({ id: 'alcove_shield_shrine_crest', roomId: 'east_alcove', kind: 'wall_shield', crest: 'relic_sun_shield', crossedSwords: true, x: 13.92, y: 3.65, z: -4.0, normalX: -1, normalZ: 0, scale: 1.28, collider: false }),
  // All Zone 1–5 Pre-Boss Environmental Storytelling Props
  ...SOULS_CASTLE_STORY_DECOR
]);

// ============================================================================
// 5c. 5-Gargoyle Flame Gauntlet (`z in [8, 26]`) & East Alcove Flank Ambush
// ============================================================================
export const SOULS_CASTLE_FLAME_TRAPS = Object.freeze([
  Object.freeze({
    id: 'flame_trap_1_south_west',
    roomId: 'flame_gauntlet',
    side: 'west',
    x: -5.12,
    y: 1.18,
    z: 22.5,
    dirX: 1,
    dirZ: 0,
    phaseOffset: 0.0,
    telegraphSec: 0.75,
    jetSec: 1.45,
    cycleSec: 4.8,
    jetLength: 10.1,
    jetHalfWidth: 1.05,
    wallImpactX: 5.12,
    isTwinPincer: false,
    damagePerTick: 18,
    tickIntervalSec: 0.35
  }),
  Object.freeze({
    id: 'flame_trap_2_mid_east',
    roomId: 'flame_gauntlet',
    side: 'east',
    x: 5.12,
    y: 1.18,
    z: 19.0,
    dirX: -1,
    dirZ: 0,
    // Fires +0.85s after Trap 1 -> smooth South-to-North cascading wave!
    phaseOffset: 3.95,
    telegraphSec: 0.75,
    jetSec: 1.45,
    cycleSec: 4.8,
    jetLength: 10.1,
    jetHalfWidth: 1.05,
    wallImpactX: -5.12,
    isTwinPincer: false,
    damagePerTick: 18,
    tickIntervalSec: 0.35
  }),
  Object.freeze({
    id: 'flame_trap_3_pincer_west',
    roomId: 'flame_gauntlet',
    side: 'west',
    x: -5.12,
    y: 1.18,
    z: 15.2,
    dirX: 1,
    dirZ: 0,
    // Twin Pincer Clamp at z = 15.2 (+1.75s wave delay, 2.60s full open window!)
    phaseOffset: 3.05,
    telegraphSec: 0.75,
    jetSec: 1.45,
    cycleSec: 4.8,
    jetLength: 5.5,
    jetHalfWidth: 1.1,
    wallImpactX: 0.0,
    isTwinPincer: true,
    damagePerTick: 18,
    tickIntervalSec: 0.35
  }),
  Object.freeze({
    id: 'flame_trap_4_pincer_east',
    roomId: 'flame_gauntlet',
    side: 'east',
    x: 5.12,
    y: 1.18,
    z: 15.2,
    dirX: -1,
    dirZ: 0,
    phaseOffset: 3.05,
    telegraphSec: 0.75,
    jetSec: 1.45,
    cycleSec: 4.8,
    jetLength: 5.5,
    jetHalfWidth: 1.1,
    wallImpactX: 0.0,
    isTwinPincer: true,
    damagePerTick: 18,
    tickIntervalSec: 0.35
  }),
  Object.freeze({
    id: 'flame_trap_5_north_east',
    roomId: 'flame_gauntlet',
    side: 'east',
    x: 5.12,
    y: 1.18,
    z: 11.2,
    dirX: -1,
    dirZ: 0,
    // Final north wave (+2.65s after Trap 1)
    phaseOffset: 2.15,
    telegraphSec: 0.75,
    jetSec: 1.45,
    cycleSec: 4.8,
    jetLength: 10.1,
    jetHalfWidth: 1.08,
    wallImpactX: -5.12,
    isTwinPincer: false,
    damagePerTick: 18,
    tickIntervalSec: 0.35
  })
]);

export function evaluateFlameTrapState(trap, elapsedSec = 0) {
  const cycle = trap.cycleSec || 4.8;
  const tele = trap.telegraphSec || 0.75;
  const jet = trap.jetSec || 1.45;
  const t = (((Number(elapsedSec) || 0) + (trap.phaseOffset || 0)) % cycle + cycle) % cycle;

  if (t < tele) {
    const p = t / tele;
    return { phase: 'telegraph', phase01: p, intensity: 0.25 + 0.75 * p, activeHitbox: null };
  }
  if (t < tele + jet) {
    const p = (t - tele) / jet;
    const ramp = p < 0.12 ? (p / 0.12) : (p > 0.85 ? ((1 - p) / 0.15) : 1.0);
    const curLen = trap.jetLength * (0.35 + 0.65 * Math.min(1, p / 0.14));
    const endX = trap.x + trap.dirX * curLen;
    const minX = Math.min(trap.x, endX);
    const maxX = Math.max(trap.x, endX);
    return {
      phase: 'jet',
      phase01: p,
      intensity: Math.max(0, Math.min(1, ramp)),
      activeHitbox: {
        id: trap.id,
        minX,
        maxX,
        minZ: trap.z - trap.jetHalfWidth,
        maxZ: trap.z + trap.jetHalfWidth,
        damagePerTick: trap.damagePerTick,
        tickIntervalSec: trap.tickIntervalSec
      }
    };
  }
  const idleDur = Math.max(0.01, cycle - tele - jet);
  return {
    phase: 'idle',
    phase01: (t - tele - jet) / idleDur,
    intensity: 0,
    activeHitbox: null
  };
}

export const SOULS_CASTLE_AMBUSHES = Object.freeze([
  Object.freeze({
    id: 'east_alcove_flank_ambush',
    encounterId: 'east_alcove_warden',
    baitEncounterId: 'nave_acolyte',
    roomId: 'east_alcove',
    // Triggers when player steps toward the East Archway line for the Shrine (x >= 2.2, z in [-6.6, -1.4])
    // OR blindly sprints past the East Archway along the right flank (rushTriggerBox) without checking!
    triggerBox: Object.freeze({
      minX: 2.2,
      maxX: 6.8,
      minZ: -6.6,
      maxZ: -1.4
    }),
    rushTriggerBox: Object.freeze({
      minX: 0.4,
      maxX: 5.5,
      minZ: -9.6,
      maxZ: -6.6
    }),
    waitPos: Object.freeze({ x: 8.8, z: -4.0, facing: -Math.PI * 0.5 }),
    exitArchPos: Object.freeze({ x: 4.5, z: -4.0 }),
    sprintTargetPos: Object.freeze({ x: 1.6, z: -4.0 }),
    sprintSpeedMult: 1.24,
    warCryToastRu: '⚔️ ЗАСАДА ИЗ ОРУЖЕЙНОЙ!'
  })
]);

export function checkCastleAmbushTrigger(x, z, triggeredIds = null) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  for (let i = 0; i < SOULS_CASTLE_AMBUSHES.length; i++) {
    const amb = SOULS_CASTLE_AMBUSHES[i];
    if (triggeredIds) {
      const done = typeof triggeredIds.has === 'function'
        ? triggeredIds.has(amb.id)
        : Boolean(triggeredIds[amb.id]);
      if (done) continue;
    }
    const b = amb.triggerBox;
    if (b && x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
      return amb;
    }
    const rb = amb.rushTriggerBox;
    if (rb && x >= rb.minX && x <= rb.maxX && z >= rb.minZ && z <= rb.maxZ) {
      return amb;
    }
  }
  return null;
}

// ============================================================================
// 6. Relic Shrines & Handcrafted Non-Linear 5-Enemy Roster
// ============================================================================
export const SOULS_CASTLE_RELICS = Object.freeze([
  Object.freeze({
    id: 'east_estus_shrine',
    roomId: 'east_alcove',
    x: 12.4,
    z: -4.0,
    facing: -Math.PI * 0.5,
    colliderRadius: 0.85,
    interactRadius: 2.35,
    rewardType: 'estus_charge',
    estusBonus: 1,
    damageBonusPct: 0,
    titleRu: 'Алтарь Пепельной Фляги',
    promptRu: 'Забрать Реликвию (+1 Фляга Эстуса)',
    claimedToastRu: 'РЕЛИКВИЯ ПОЛУЧЕНА • +1 Фляга Эстуса (5/5)!',
    glowColor: 0xf59e0b
  })
]);

export const SOULS_CASTLE_ENCOUNTERS = Object.freeze([
  // Zone 2: Fair 1v1 First Duel in Asymmetric West Cloister Atrium (~24m walk from spawn!)
  Object.freeze({
    id: 'starter_duelist',
    type: 'iron_knight',
    roomId: 'first_duel_atrium',
    x: 0.0,
    z: 36.0,
    facing: 0,
    patrolMinZ: 28.5,
    patrolMaxZ: 42.5,
    nameRu: 'Полый Страж Клуатра',
    hp: 260,
    damage: 26,
    speed: 2.45,
    xp: 45,
    gold: 35,
    scale: 1.18,
    soulsRole: 'duelist',
    staggerMax: 145,
    flatDef: 20,
    physNegation: 0.12,
    aggroRange: 9.5,
    isOptional: false,
    isAmbushGuard: false
  }),

  // Zone 4 (Enemy 1/4): Knights' Nave Vanguard north of the Flame Gauntlet (`z < 7.0`)
  Object.freeze({
    id: 'nave_vanguard',
    type: 'cursed_footman',
    roomId: 'knights_nave',
    x: -1.6,
    z: 2.6,
    facing: 0,
    patrolMinZ: -0.4,
    patrolMaxZ: 5.4,
    nameRu: 'Щитоносец Нефа',
    hp: 230,
    damage: 24,
    speed: 2.4,
    xp: 45,
    gold: 35,
    scale: 1.12,
    soulsRole: 'guard',
    staggerMax: 130,
    flatDef: 14,
    physNegation: 0.08,
    aggroRange: 8.8,
    isOptional: false,
    isAmbushGuard: false
  }),

  // Zone 4 (Enemy 2/4): Western Side-Chapel Knight (`west_wing` — reacts ONLY when player enters western archway line!)
  Object.freeze({
    id: 'west_wing_guard',
    type: 'iron_knight',
    roomId: 'west_wing',
    x: -9.2,
    z: -6.0,
    facing: Math.PI * 0.5,
    patrolMinZ: -9.2,
    patrolMaxZ: -2.8,
    nameRu: 'Рыцарь Западного Придела',
    hp: 255,
    damage: 27,
    speed: 2.45,
    xp: 55,
    gold: 45,
    scale: 1.16,
    soulsRole: 'duelist',
    staggerMax: 145,
    flatDef: 20,
    physNegation: 0.12,
    aggroRange: 7.0,
    aggroBounds: Object.freeze({ maxX: -3.4, minZ: -10.6, maxZ: -1.4 }),
    isOptional: true,
    isAmbushGuard: false
  }),

  // Zone 4 (Enemy 3/4): Eastern Armory Alcove Warden (`east_alcove`, guards Relic Shrine & punishes blind flank rushes!)
  Object.freeze({
    id: 'east_alcove_warden',
    type: 'iron_knight',
    roomId: 'east_alcove',
    x: 8.8,
    z: -4.0,
    facing: -Math.PI * 0.5,
    patrolMinZ: -7.4,
    patrolMaxZ: -0.6,
    nameRu: 'Страж Оружейной',
    hp: 255,
    damage: 27,
    speed: 2.5,
    xp: 60,
    gold: 50,
    scale: 1.16,
    soulsRole: 'duelist',
    staggerMax: 145,
    flatDef: 20,
    physNegation: 0.12,
    aggroRange: 6.8,
    isOptional: true,
    isAmbushGuard: true,
    ambushId: 'east_alcove_flank_ambush',
    ambushTriggerBounds: Object.freeze({ minX: 2.2, maxX: 6.8, minZ: -6.6, maxZ: -1.4 }),
    guardsRelicId: 'east_estus_shrine'
  }),

  // Zone 4 (Enemy 4/4): Northern Nave Ash Acolyte holding the northern half of Knights' Nave (`z = -12.4`)
  Object.freeze({
    id: 'nave_acolyte',
    type: 'bone_archer',
    roomId: 'knights_nave',
    x: 1.85,
    z: -12.4,
    facing: 0,
    patrolMinZ: -14.8,
    patrolMaxZ: -10.2,
    nameRu: 'Пепельный Стрелок',
    hp: 165,
    damage: 20,
    speed: 2.15,
    xp: 40,
    gold: 30,
    scale: 1.08,
    soulsRole: 'archer',
    staggerMax: 95,
    flatDef: 10,
    physNegation: 0.02,
    aggroRange: 9.8,
    isOptional: false,
    isAmbushGuard: false
  })
]);

// ============================================================================
// 7. Exact 2D Analytical Wall/Pillar/Door Line-of-Sight & Doorway Steering
//    Prevents lock-on and mob aggro through solid castle walls, archway piers,
//    columns, and closed Boss Doors, and routes mobs cleanly through archways!
// ============================================================================
const LOS_AXIS_WALL_BOXES = Object.freeze(
  SOULS_CASTLE_WALL_SEGMENTS.filter((w) => w.axis === 'x' || w.axis === 'z').map((w) => {
    const halfX = w.axis === 'x' ? w.length * 0.5 : w.thickness * 0.5;
    const halfZ = w.axis === 'z' ? w.length * 0.5 : w.thickness * 0.5;
    return Object.freeze({
      id: w.id,
      minX: w.x - halfX,
      maxX: w.x + halfX,
      minZ: w.z - halfZ,
      maxZ: w.z + halfZ
    });
  })
);

function segmentIntersectsAABB(x1, z1, x2, z2, box) {
  let t0 = 0.0;
  let t1 = 1.0;
  const dx = x2 - x1;
  const dz = z2 - z1;

  // Unrolled Liang-Barsky slab clip: 0 heap allocations per call!
  if (Math.abs(dx) < 1e-9) {
    if (x1 < box.minX || x1 > box.maxX) return false;
  } else {
    const invDx = 1.0 / dx;
    let ta = (box.minX - x1) * invDx;
    let tb = (box.maxX - x1) * invDx;
    if (ta > tb) {
      const tmp = ta;
      ta = tb;
      tb = tmp;
    }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return false;
  }

  if (Math.abs(dz) < 1e-9) {
    if (z1 < box.minZ || z1 > box.maxZ) return false;
  } else {
    const invDz = 1.0 / dz;
    let ta = (box.minZ - z1) * invDz;
    let tb = (box.maxZ - z1) * invDz;
    if (ta > tb) {
      const tmp = ta;
      ta = tb;
      tb = tmp;
    }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return false;
  }

  return t0 <= t1;
}

function segmentIntersectsCircleInterior(x1, z1, x2, z2, cx, cz, r) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-9) return false;
  // Clamp to interior (0.04..0.96) so an actor brushing a pillar plinth never self-occludes
  const t = Math.max(0.04, Math.min(0.96, ((cx - x1) * dx + (cz - z1) * dz) / lenSq));
  const px = x1 + dx * t;
  const pz = z1 + dz * t;
  const ex = cx - px;
  const ez = cz - pz;
  return ex * ex + ez * ez < r * r;
}

/**
 * Exact 2D analytical Line-of-Sight check against ALL solid stone castle walls,
 * interior archway piers, gothic stone columns, and closed/sealed Boss Doors.
 *
 * @param {number} x1
 * @param {number} z1
 * @param {number} x2
 * @param {number} z2
 * @param {{ bossDoorState?: 'closed'|'opening'|'open'|'sealed', ignorePillars?: boolean }} [opts]
 * @returns {boolean}
 */
export function hasCastleWallLineOfSight(x1, z1, x2, z2, opts = {}) {
  if (!Number.isFinite(x1) || !Number.isFinite(z1) || !Number.isFinite(x2) || !Number.isFinite(z2)) {
    return false;
  }
  const dx = x2 - x1;
  const dz = z2 - z1;
  if (dx * dx + dz * dz < 1e-6) return true;

  const doorState = opts?.bossDoorState || 'closed';
  const doorZ = SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z;

  // 1. Boss Door barrier at z = -32.0
  if ((z1 < doorZ && z2 > doorZ) || (z1 > doorZ && z2 < doorZ)) {
    if (doorState !== 'open') return false;
    const tDoor = (doorZ - z1) / dz;
    const xDoor = x1 + dx * tDoor;
    if (Math.abs(xDoor) > SOULS_CASTLE_CONSTANTS.BOSS_PORTAL_HALF_W - 0.15) {
      return false;
    }
  }

  // 2. All axis-aligned perimeter walls, steps, jambs & archway piers
  for (let i = 0; i < LOS_AXIS_WALL_BOXES.length; i++) {
    if (segmentIntersectsAABB(x1, z1, x2, z2, LOS_AXIS_WALL_BOXES[i])) {
      return false;
    }
  }

  // 3. Boss Cathedral circular outer curtain wall check for segments entering z < -32.2
  if (z1 < -32.2 || z2 < -32.2) {
    const rSq = (SOULS_CASTLE_CONSTANTS.BOSS_RADIUS + 0.05) * (SOULS_CASTLE_CONSTANTS.BOSS_RADIUS + 0.05);
    for (let s = 1; s <= 7; s++) {
      const t = s * 0.125;
      const sx = x1 + dx * t;
      const sz = z1 + dz * t;
      if (sz < -33.8) {
        const bx = sx - SOULS_CASTLE_CONSTANTS.BOSS_CENTER_X;
        const bz = sz - SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z;
        if (bx * bx + bz * bz > rSq) return false;
      }
    }
  }

  // 4. Stone column shaft occlusion (unless caller passes ignorePillars: true)
  if (!opts?.ignorePillars) {
    for (let i = 0; i < SOULS_CASTLE_PILLARS.length; i++) {
      const p = SOULS_CASTLE_PILLARS[i];
      if (!p.collider) continue;
      // Use stone shaft radius (~0.66m) rather than wide base plinth so glancing shots feel fair
      if (segmentIntersectsCircleInterior(x1, z1, x2, z2, p.x, p.z, p.radius * 0.76)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Computes a wall-safe intermediate doorway waypoint when a mob and target are
 * separated by an archway pier (East Armory Alcove, West Side-Chapel, or Atrium/Sanctuary steps),
 * guaranteeing mobs NEVER run blindly into stone walls!
 *
 * @param {number} fromX
 * @param {number} fromZ
 * @param {number} toX
 * @param {number} toZ
 * @returns {{ x: number, z: number, viaDoorway: boolean, doorwayId: string|null }}
 */
export function getCastleDoorwaySteerTarget(fromX, fromZ, toX, toZ) {
  if (!Number.isFinite(fromX) || !Number.isFinite(fromZ) || !Number.isFinite(toX) || !Number.isFinite(toZ)) {
    return { x: Number(toX) || 0, z: Number(toZ) || 0, viaDoorway: false, doorwayId: null };
  }

  // 1. East Armory Alcove (`x > 5.6`) <-> Knights' Nave (`x <= 5.6`), archway centered at `z = -4.0`
  const fromEast = fromX > 5.6 && fromZ >= -9.5 && fromZ <= 1.5;
  const toEast = toX > 5.6 && toZ >= -9.5 && toZ <= 1.5;
  if (fromEast && !toEast) {
    if (fromX > 6.5 && Math.abs(fromZ - (-4.0)) > 1.65) {
      return { x: 7.0, z: -4.0, viaDoorway: true, doorwayId: 'east_arch' };
    }
    return { x: 4.5, z: -4.0, viaDoorway: true, doorwayId: 'east_arch' };
  }
  if (!fromEast && toEast) {
    if (fromX < 4.4 || Math.abs(fromZ - (-4.0)) > 1.65) {
      return { x: 4.5, z: -4.0, viaDoorway: true, doorwayId: 'east_arch' };
    }
    if (fromX <= 5.6) {
      return { x: 7.0, z: -4.0, viaDoorway: true, doorwayId: 'east_arch' };
    }
  }

  // 2. West Side-Chapel (`x < -5.6`) <-> Knights' Nave (`x >= -5.6`), archway centered at `z = -6.0`
  const fromWest = fromX < -5.6 && fromZ >= -11.5 && fromZ <= -0.5;
  const toWest = toX < -5.6 && toZ >= -11.5 && toZ <= -0.5;
  if (fromWest && !toWest) {
    if (fromX < -6.5 && Math.abs(fromZ - (-6.0)) > 1.65) {
      return { x: -7.0, z: -6.0, viaDoorway: true, doorwayId: 'west_arch' };
    }
    return { x: -4.5, z: -6.0, viaDoorway: true, doorwayId: 'west_arch' };
  }
  if (!fromWest && toWest) {
    if (fromX > -4.4 || Math.abs(fromZ - (-6.0)) > 1.65) {
      return { x: -4.5, z: -6.0, viaDoorway: true, doorwayId: 'west_arch' };
    }
    if (fromX >= -5.6) {
      return { x: -7.0, z: -6.0, viaDoorway: true, doorwayId: 'west_arch' };
    }
  }

  // 3. West Cloister Atrium (`z > 26.0, |x| > 4.4`) <-> Flame Gauntlet (`z <= 26.0`)
  if (fromZ > 26.0 && toZ <= 26.0 && Math.abs(fromX) > 4.4) {
    return { x: Math.max(-3.8, Math.min(3.8, fromX)), z: 27.0, viaDoorway: true, doorwayId: 'grand_gauntlet_south_arch' };
  }

  // 4. Pre-Boss Sanctuary (`z < -16.0, |x| > 4.6`) <-> Knights' Nave (`z >= -16.0`)
  if (fromZ < -16.0 && toZ >= -16.0 && Math.abs(fromX) > 4.6) {
    return { x: Math.max(-4.2, Math.min(4.2, fromX)), z: -17.0, viaDoorway: true, doorwayId: 'sanctuary_entry_arch' };
  }

  return { x: toX, z: toZ, viaDoorway: false, doorwayId: null };
}

/**
 * Finds the nearest unclaimed Relic Shrine within interaction distance of (x, z).
 */
export function findInteractableRelic(x, z, claimedIds = null) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  let best = null;
  let bestDistSq = Infinity;
  for (let i = 0; i < SOULS_CASTLE_RELICS.length; i++) {
    const relic = SOULS_CASTLE_RELICS[i];
    if (claimedIds) {
      const isClaimed = typeof claimedIds.has === 'function'
        ? claimedIds.has(relic.id)
        : Boolean(claimedIds[relic.id]);
      if (isClaimed) continue;
    }
    const dx = x - relic.x;
    const dz = z - relic.z;
    const dSq = dx * dx + dz * dz;
    const maxSq = relic.interactRadius * relic.interactRadius;
    if (dSq <= maxSq && dSq < bestDistSq) {
      bestDistSq = dSq;
      best = relic;
    }
  }
  return best;
}

/**
 * Returns ALL solid static obstacle colliders across all 6 zones:
 * Pre-Boss Bonfire + 13 Floor Braziers + ALL 15 Gothic Pillars (intact & broken)
 * + Relic Shrine + 4 Alcove Armory props (weapon racks as AABBs, armor stands as circles)
 * + ALL 10 shattered masonry rubble chunks + 2 fallen broken column drums (`SOULS_CASTLE_RUBBLE`)
 * + Obsidian Throne AABB (`kind: 'throne'`) + Left/Right Boss Door jamb wall protrusions (`kind: 'boss_door_jamb'`).
 */
export function getCastleStaticColliders(options = null) {
  const ignoreThrone = Boolean(options?.ignoreThrone);
  const ignoreBossDoorJambs = Boolean(options?.ignoreBossDoorJambs);
  const cols = [
    {
      id: SOULS_CASTLE_BONFIRE.id,
      kind: 'bonfire',
      shape: 'circle',
      x: SOULS_CASTLE_BONFIRE.x,
      z: SOULS_CASTLE_BONFIRE.z,
      radius: SOULS_CASTLE_BONFIRE.colliderRadius,
      r: SOULS_CASTLE_BONFIRE.colliderRadius
    }
  ];
  for (let i = 0; i < SOULS_CASTLE_BRAZIERS.length; i++) {
    const b = SOULS_CASTLE_BRAZIERS[i];
    cols.push({ id: b.id, kind: 'brazier', shape: 'circle', x: b.x, z: b.z, radius: b.radius, r: b.radius });
  }
  for (let i = 0; i < SOULS_CASTLE_PILLARS.length; i++) {
    const p = SOULS_CASTLE_PILLARS[i];
    if (p.collider !== false) {
      cols.push({
        id: p.id,
        kind: 'pillar',
        shape: 'circle',
        broken: Boolean(p.broken),
        x: p.x,
        z: p.z,
        radius: p.radius,
        r: p.radius
      });
    }
  }
  for (let i = 0; i < SOULS_CASTLE_RELICS.length; i++) {
    const rel = SOULS_CASTLE_RELICS[i];
    cols.push({
      id: rel.id,
      kind: 'relic_shrine',
      shape: 'circle',
      x: rel.x,
      z: rel.z,
      radius: rel.colliderRadius,
      r: rel.colliderRadius
    });
  }
  for (let i = 0; i < SOULS_CASTLE_ALCOVE_DECOR.length; i++) {
    const d = SOULS_CASTLE_ALCOVE_DECOR[i];
    if (!d.collider) continue;
    const isRectProp =
      d.shape === 'aabb' ||
      ((d.kind === 'weapon_rack' ||
        d.kind === 'stone_sarcophagus' ||
        d.kind === 'cathedral_pew' ||
        d.kind === 'pilgrim_bench') &&
        Number.isFinite(d.width) &&
        Number.isFinite(d.depth));
    if (isRectProp) {
      const yaw = Number.isFinite(d.facing) ? d.facing : (Number.isFinite(d.rotY) ? d.rotY : 0);
      const swapped = Math.abs(Math.sin(yaw)) > 0.7071;
      const localHalfX = d.width * 0.5;
      const localHalfZ = (d.kind === 'weapon_rack' ? Math.max(d.depth, 0.72) : d.depth) * 0.5;
      const halfW = Number((Number.isFinite(d.halfW) ? d.halfW : (swapped ? localHalfZ : localHalfX)).toFixed(3));
      const halfD = Number((Number.isFinite(d.halfD) ? d.halfD : (swapped ? localHalfX : localHalfZ)).toFixed(3));
      const inscribedR = Math.min(halfW, halfD);
      cols.push({
        id: d.id,
        kind: d.kind,
        roomId: d.roomId,
        shape: 'aabb',
        x: d.x,
        z: d.z,
        halfW,
        halfD,
        width: Number((halfW * 2).toFixed(3)),
        depth: Number((halfD * 2).toFixed(3)),
        radius: inscribedR,
        r: inscribedR
      });
    } else {
      cols.push({
        id: d.id,
        kind: d.kind,
        roomId: d.roomId,
        shape: 'circle',
        x: d.x,
        z: d.z,
        radius: d.radius,
        r: d.radius
      });
    }
  }
  for (let i = 0; i < SOULS_CASTLE_RUBBLE.length; i++) {
    const rb = SOULS_CASTLE_RUBBLE[i];
    if (rb.collider === false) continue;
    cols.push({
      id: rb.id,
      kind: rb.kind,
      shape: 'circle',
      x: rb.x,
      z: rb.z,
      radius: rb.radius,
      r: rb.radius
    });
  }
  if (!ignoreThrone) {
    cols.push({ ...SOULS_CASTLE_THRONE_COLLIDER });
  }
  if (!ignoreBossDoorJambs) {
    for (let i = 0; i < SOULS_CASTLE_BOSS_DOOR_JAMB_COLLIDERS.length; i++) {
      cols.push({ ...SOULS_CASTLE_BOSS_DOOR_JAMB_COLLIDERS[i] });
    }
  }
  return cols;
}

export const SOULS_CASTLE_CONTACT_SHADOWS = Object.freeze(
  getCastleStaticColliders()
    .filter((c) => c.kind !== 'boss_door_jamb')
    .map((c) =>
      Object.freeze({
        id: `ao_${c.id}`,
        x: c.x,
        z: c.z,
        radius: Number(((c.radius ?? c.r ?? 0.55) * 1.55).toFixed(3))
      })
    )
);

const _resolveColTmp = { x: 0, z: 0 };

/**
 * Resolves solid circular & AABB push-out against all castle static colliders.
 */
export function resolveCastleStaticColliders(x, z, radius = 0.55, colliders = null, iterations = 2, options = null) {
  const list = colliders || getCachedStaticColliders();
  _resolveColTmp.x = Number.isFinite(x) ? x : 0;
  _resolveColTmp.z = Number.isFinite(z) ? z : SOULS_CASTLE_PLAYER_SPAWN.z;
  const r = Number.isFinite(radius) ? Math.max(0, radius) : 0.55;
  const ignoreThrone = Boolean(options?.ignoreThrone);
  const ignoreBossDoorJambs = Boolean(options?.ignoreBossDoorJambs);

  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (shouldSkipCollider(c, ignoreThrone, ignoreBossDoorJambs)) continue;
      if (pushOutOfSingleCollider(_resolveColTmp, r, c)) {
        moved = true;
      }
    }
    if (!moved) break;
  }
  return { x: _resolveColTmp.x, z: _resolveColTmp.z };
}
