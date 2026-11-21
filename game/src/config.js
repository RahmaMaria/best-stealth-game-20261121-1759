// SHADOWLINE — a top-down stealth game. Every tuning number, colour and level
// layout lives here, so the rules can be read without touching the simulation.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 178,
  sneakSpeed: 96,
  /** Pixels a guard must close to before a bush stops hiding the player. */
  bushReveal: 62,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 72,
  suspiciousSpeed: 118,
  chaseSpeed: 152,
  /** How far a guard can see, in pixels. */
  viewRange: 235,
  /** Half of the vision cone's angle, in radians. */
  viewHalfAngle: 0.62,
  /** Suspicion per second at point-blank range; it scales down with distance. */
  spotRate: 1.15,
  /** Suspicion per second while the player is heard running nearby. */
  hearRate: 0.35,
  /** How close the player must be, running, to be heard. */
  hearRange: 150,
  /** Suspicion lost per second while the player is unseen and unheard. */
  decayRate: 0.22,
  /** Suspicion at which a guard leaves patrol to investigate. */
  suspiciousAt: 0.45,
  /** Suspicion at which the alarm trips and the guard gives chase. */
  alarmAt: 1.0,
  /** Seconds a chasing guard keeps hunting after losing sight. */
  chaseMemory: 2.5,
  /** Seconds a suspicious guard stares at the spot before giving up. */
  investigateTime: 2.2,
  /** Distance at which a chasing guard catches the player. */
  catchRange: 26,
};

export const NOISEMAKER = {
  /** How many the player carries per level. */
  count: 3,
  /** Guards this far from the landing point come to look. */
  lureRange: 340,
  /** Seconds between throws. */
  cooldown: 1.0,
};

export const LIVES = 3;

export const LOOT_POINTS = 150;
export const LEVEL_CLEAR_BONUS = 400;
/** Bonus points per second left on the clock when the exit is reached. */
export const TIME_BONUS_RATE = 5;
/** Seconds on the clock per level. */
export const LEVEL_TIME = 150;

/**
 * A level: walls and crates block movement and sight, bushes hide the player,
 * guards patrol between waypoints, loot is optional intel worth points, and
 * the exit is the glowing pad the player must reach unseen.
 */
export const LEVELS = [
  {
    name: 'WAREHOUSE 01 — Night Shift',
    briefing: 'Slip past the night guards. Reach the green EXIT pad.',
    spawn: { x: 90, y: 620 },
    exit: { x: 1150, y: 60, w: 84, h: 64 },
    walls: [
      { x: 0, y: 0, w: 1280, h: 18 },
      { x: 0, y: 702, w: 1280, h: 18 },
      { x: 0, y: 0, w: 18, h: 720 },
      { x: 1262, y: 0, w: 18, h: 720 },
      { x: 300, y: 120, w: 26, h: 260 },
      { x: 620, y: 340, w: 26, h: 240 },
      { x: 880, y: 100, w: 26, h: 220 },
      { x: 480, y: 480, w: 220, h: 26 },
      { x: 980, y: 420, w: 220, h: 26 },
    ],
    crates: [
      { x: 180, y: 300, w: 64, h: 64 },
      { x: 420, y: 180, w: 64, h: 64 },
      { x: 560, y: 560, w: 64, h: 64 },
      { x: 760, y: 260, w: 64, h: 64 },
      { x: 1020, y: 560, w: 64, h: 64 },
      { x: 1080, y: 220, w: 64, h: 64 },
    ],
    bushes: [
      { x: 250, y: 520, r: 46 },
      { x: 700, y: 130, r: 46 },
      { x: 950, y: 330, r: 42 },
      { x: 1120, y: 470, r: 44 },
    ],
    guards: [
      { waypoints: [[380, 420], [380, 120], [560, 120], [560, 420]], pause: 1.2 },
      { waypoints: [[760, 560], [760, 380], [960, 380], [960, 560]], pause: 1.0 },
      { waypoints: [[1080, 120], [1180, 120], [1180, 330], [1000, 330]], pause: 1.4 },
    ],
    loot: [[250, 150], [700, 620], [1150, 400]],
  },
  {
    name: 'OFFICE 02 — Open Plan',
    briefing: 'Four guards, open floor. Use the desks and plants — stay out of the light.',
    spawn: { x: 80, y: 640 },
    exit: { x: 1160, y: 50, w: 84, h: 64 },
    walls: [
      { x: 0, y: 0, w: 1280, h: 18 },
      { x: 0, y: 702, w: 1280, h: 18 },
      { x: 0, y: 0, w: 18, h: 720 },
      { x: 1262, y: 0, w: 18, h: 720 },
      { x: 220, y: 0, w: 26, h: 180 },
      { x: 220, y: 300, w: 26, h: 180 },
      { x: 560, y: 240, w: 26, h: 220 },
      { x: 560, y: 560, w: 26, h: 142 },
      { x: 860, y: 0, w: 26, h: 200 },
      { x: 860, y: 320, w: 26, h: 180 },
      { x: 1040, y: 520, w: 222, h: 26 },
    ],
    crates: [
      { x: 330, y: 120, w: 64, h: 64 },
      { x: 400, y: 420, w: 64, h: 64 },
      { x: 660, y: 120, w: 64, h: 64 },
      { x: 700, y: 480, w: 64, h: 64 },
      { x: 960, y: 240, w: 64, h: 64 },
      { x: 1120, y: 380, w: 64, h: 64 },
      { x: 140, y: 300, w: 64, h: 64 },
    ],
    bushes: [
      { x: 330, y: 560, r: 46 },
      { x: 660, y: 330, r: 44 },
      { x: 960, y: 620, r: 46 },
      { x: 1180, y: 180, r: 42 },
    ],
    guards: [
      { waypoints: [[140, 120], [420, 120], [420, 420], [140, 420]], pause: 1.0 },
      { waypoints: [[680, 640], [680, 300], [800, 300], [800, 640]], pause: 1.2 },
      { waypoints: [[980, 100], [1180, 100], [1180, 460], [980, 460]], pause: 1.0 },
      { waypoints: [[480, 620], [480, 520], [620, 520], [620, 620]], pause: 1.6 },
    ],
    loot: [[330, 620], [760, 200], [1120, 120], [120, 520]],
  },
  {
    name: 'VAULT 03 — The Long Corridor',
    briefing: 'Five guards guard the vault. Noisemaker throws are your best friend.',
    spawn: { x: 80, y: 90 },
    exit: { x: 1160, y: 600, w: 84, h: 64 },
    walls: [
      { x: 0, y: 0, w: 1280, h: 18 },
      { x: 0, y: 702, w: 1280, h: 18 },
      { x: 0, y: 0, w: 18, h: 720 },
      { x: 1262, y: 0, w: 18, h: 720 },
      { x: 200, y: 180, w: 26, h: 360 },
      { x: 200, y: 180, w: 300, h: 26 },
      { x: 500, y: 180, w: 26, h: 200 },
      { x: 760, y: 340, w: 26, h: 362 },
      { x: 760, y: 340, w: 260, h: 26 },
      { x: 1020, y: 120, w: 26, h: 220 },
      { x: 420, y: 540, w: 340, h: 26 },
    ],
    crates: [
      { x: 300, y: 300, w: 64, h: 64 },
      { x: 600, y: 120, w: 64, h: 64 },
      { x: 620, y: 460, w: 64, h: 64 },
      { x: 880, y: 480, w: 64, h: 64 },
      { x: 1120, y: 420, w: 64, h: 64 },
      { x: 120, y: 420, w: 64, h: 64 },
    ],
    bushes: [
      { x: 300, y: 620, r: 46 },
      { x: 600, y: 260, r: 44 },
      { x: 900, y: 180, r: 46 },
      { x: 1120, y: 620, r: 42 },
      { x: 130, y: 250, r: 44 },
    ],
    guards: [
      { waypoints: [[120, 620], [380, 620], [380, 300], [120, 300]], pause: 1.0 },
      { waypoints: [[620, 90], [620, 300], [900, 300], [900, 90]], pause: 1.2 },
      { waypoints: [[1080, 60], [1180, 60], [1180, 500], [1080, 500]], pause: 0.9 },
      { waypoints: [[560, 620], [700, 620], [700, 420], [560, 420]], pause: 1.4 },
      { waypoints: [[880, 620], [1000, 620], [1000, 420], [880, 420]], pause: 1.1 },
    ],
    loot: [[380, 120], [700, 200], [1160, 280], [280, 480]],
  },
];

export const PALETTE = {
  backdrop: '#0b0e14',
  floor: '#171c28',
  floorAlt: '#1b2130',
  wall: '#2e3648',
  wallEdge: '#4a5878',
  crate: '#6b5433',
  crateEdge: '#a8874f',
  bush: '#1d3a24',
  bushEdge: '#2f6b3c',
  exit: '#2fd67a',
  exitGlow: '#1d7a4a',
  player: '#4fc3f7',
  playerSneak: '#2ea8dd',
  guard: '#ff5d47',
  guardSuspicious: '#ffb02e',
  coneCalm: 'rgba(255, 214, 64, 0.16)',
  coneSuspicious: 'rgba(255, 176, 46, 0.30)',
  coneAlarm: 'rgba(255, 60, 47, 0.38)',
  loot: '#f2c94c',
  text: '#eef1f5',
  muted: '#8b93a3',
  panel: '#1d2331',
  panelEdge: '#39415a',
  danger: '#ff5d47',
  ok: '#2fd67a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'shadowline.best';
