// The game's rules and state, with no drawing and no browser in it: the player,
// the patrolling guards and their vision cones, cover that blocks sight, bushes
// that hide, loot, the exit, suspicion and the alarm. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react without
// the world knowing about screens or sound.

import {
  FIELD, GUARD, LEVELS, LEVEL_CLEAR_BONUS, LEVEL_TIME, LIVES,
  LOOT_POINTS, NOISEMAKER, PLAYER, TIME_BONUS_RATE,
} from './config.js';

export const EVENT_LOOT = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_CLEAR = 4;
export const EVENT_WIN = 8;
export const EVENT_TIMEOUT = 16;
export const EVENT_ALARM = 32;

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** True when the segment (x1,y1)-(x2,y2) touches the rectangle. Slab method. */
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (dx === 0) {
    if (x1 < rect.x || x1 > rect.x + rect.w) return false;
  } else {
    let t1 = (rect.x - x1) / dx;
    let t2 = (rect.x + rect.w - x1) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (dy === 0) {
    if (y1 < rect.y || y1 > rect.y + rect.h) return false;
  } else {
    let t1 = (rect.y - y1) / dy;
    let t2 = (rect.y + rect.h - y1) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

/** True when a circle of `radius` at (x, y) overlaps the rectangle. */
function circleHitsRect(x, y, radius, rect) {
  const cx = clamp(x, rect.x, rect.x + rect.w);
  const cy = clamp(y, rect.y, rect.y + rect.h);
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) < radius * radius;
}

function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function createWorld() {
  const state = {
    levelIndex: 0,
    level: LEVELS[0],
    player: { x: 0, y: 0, angle: -Math.PI / 2, sneaking: false, invulnerable: 0, hidden: false },
    guards: [],
    loot: [],
    score: 0,
    lives: LIVES,
    timeLeft: LEVEL_TIME,
    noisemakers: NOISEMAKER.count,
    throwCooldown: 0,
    /** Expanding rings the renderer draws where a noisemaker landed. */
    pings: [],
    /** Highest suspicion among the guards, for the HUD meter. */
    suspicion: 0,
    /** True while any guard is chasing. */
    alarm: false,
    /** True while any guard currently sees the player. */
    seen: false,
    alarmsTripped: 0,
    lootTaken: 0,
  };

  function solidAt(x, y, radius) {
    for (const wall of state.level.walls) if (circleHitsRect(x, y, radius, wall)) return true;
    for (const crate of state.level.crates) if (circleHitsRect(x, y, radius, crate)) return true;
    return false;
  }

  function blockedSight(x1, y1, x2, y2) {
    for (const wall of state.level.walls) if (segmentHitsRect(x1, y1, x2, y2, wall)) return true;
    for (const crate of state.level.crates) if (segmentHitsRect(x1, y1, x2, y2, crate)) return true;
    return false;
  }

  /** Slide a circle along the level's solids, one axis at a time. */
  function moveBody(body, dx, dy, radius) {
    const nx = body.x + dx;
    if (!solidAt(nx, body.y, radius)) body.x = nx;
    const ny = body.y + dy;
    if (!solidAt(body.x, ny, radius)) body.y = ny;
    body.x = clamp(body.x, radius, FIELD.width - radius);
    body.y = clamp(body.y, radius, FIELD.height - radius);
  }

  function playerInBush() {
    for (const bush of state.level.bushes) {
      if (distance(state.player.x, state.player.y, bush.x, bush.y) < bush.r - 4) return true;
    }
    return false;
  }

  /** Can this guard see the player right now? */
  function guardSees(guard) {
    const p = state.player;
    const d = distance(guard.x, guard.y, p.x, p.y);
    if (d > GUARD.viewRange) return false;
    const toPlayer = Math.atan2(p.y - guard.y, p.x - guard.x);
    if (Math.abs(angleDiff(toPlayer, guard.angle)) > GUARD.viewHalfAngle) return false;
    if (p.hidden && d > PLAYER.bushReveal) return false;
    return !blockedSight(guard.x, guard.y, p.x, p.y);
  }

  function loadLevel(index) {
    state.levelIndex = index;
    state.level = LEVELS[index];
    state.player.x = state.level.spawn.x;
    state.player.y = state.level.spawn.y;
    state.player.angle = -Math.PI / 2;
    state.player.invulnerable = 0;
    state.player.hidden = false;
    state.guards = state.level.guards.map((def) => {
      const first = def.waypoints[0];
      return {
        x: first[0], y: first[1],
        angle: Math.atan2(def.waypoints[1][1] - first[1], def.waypoints[1][0] - first[0]),
        waypoints: def.waypoints,
        wp: 1,
        pause: def.pause,
        pauseTimer: 0,
        scanPhase: 0,
        state: 'patrol',
        suspicion: 0,
        lastSeen: null,
        memory: 0,
        investigateTimer: 0,
        seesPlayer: false,
      };
    });
    state.loot = state.level.loot.map(([x, y]) => ({ x, y, taken: false }));
    state.timeLeft = LEVEL_TIME;
    state.noisemakers = NOISEMAKER.count;
    state.throwCooldown = 0;
    state.pings = [];
    state.suspicion = 0;
    state.alarm = false;
    state.seen = false;
  }

  function resetRun() {
    state.score = 0;
    state.lives = LIVES;
    state.alarmsTripped = 0;
    state.lootTaken = 0;
    loadLevel(0);
  }

  function restartLevel() {
    loadLevel(state.levelIndex);
  }

  function throwNoisemaker(x, y) {
    if (state.noisemakers <= 0 || state.throwCooldown > 0) return false;
    state.noisemakers -= 1;
    state.throwCooldown = NOISEMAKER.cooldown;
    state.pings.push({ x, y, age: 0 });
    for (const guard of state.guards) {
      if (guard.state === 'chase') continue;
      if (distance(guard.x, guard.y, x, y) > NOISEMAKER.lureRange) continue;
      guard.state = 'suspicious';
      guard.suspicion = Math.max(guard.suspicion, GUARD.suspiciousAt);
      guard.lastSeen = { x, y };
      guard.investigateTimer = 0;
    }
    return true;
  }

  function stepGuard(guard, dt, harmless) {
    const p = state.player;
    const sees = !harmless && guardSees(guard);
    guard.seesPlayer = sees;

    if (sees) {
      guard.lastSeen = { x: p.x, y: p.y };
      const d = distance(guard.x, guard.y, p.x, p.y);
      const closeness = 1 - (d / GUARD.viewRange) * 0.6;
      guard.suspicion += GUARD.spotRate * closeness * (p.sneaking ? 0.6 : 1) * dt;
      if (guard.state === 'chase') guard.memory = GUARD.chaseMemory;
    } else if (!harmless && !p.sneaking && p.moving) {
      // Running is loud: a nearby guard grows suspicious even without seeing.
      const d = distance(guard.x, guard.y, p.x, p.y);
      if (d < GUARD.hearRange) guard.suspicion += GUARD.hearRate * dt;
      else guard.suspicion = Math.max(0, guard.suspicion - GUARD.decayRate * dt);
    } else {
      guard.suspicion = Math.max(0, guard.suspicion - GUARD.decayRate * dt);
    }
    guard.suspicion = clamp(guard.suspicion, 0, 1);

    let alarmNow = false;
    if (!harmless && guard.suspicion >= GUARD.alarmAt && guard.state !== 'chase') {
      guard.state = 'chase';
      guard.memory = GUARD.chaseMemory;
      alarmNow = true;
    } else if (guard.suspicion >= GUARD.suspiciousAt && guard.state === 'patrol') {
      guard.state = 'suspicious';
      guard.investigateTimer = 0;
    }

    const speed = guard.state === 'chase'
      ? GUARD.chaseSpeed
      : guard.state === 'suspicious' ? GUARD.suspiciousSpeed : GUARD.patrolSpeed;

    let target = null;
    if (guard.state === 'chase') {
      target = sees ? { x: p.x, y: p.y } : guard.lastSeen;
      if (!target) {
        // No trail to follow: fall back to patrolling.
        guard.state = 'patrol';
        return alarmNow;
      }
      guard.memory -= dt;
      if (guard.memory <= 0 && guard.lastSeen) {
        guard.state = 'suspicious';
        guard.investigateTimer = 0;
      }
    } else if (guard.state === 'suspicious') {
      target = guard.lastSeen;
      if (target && distance(guard.x, guard.y, target.x, target.y) < 12) {
        guard.investigateTimer += dt;
        guard.scanPhase += dt * 1.6;
        guard.angle += Math.sin(guard.scanPhase) * 0.9 * dt;
        if (guard.investigateTimer > GUARD.investigateTime && guard.suspicion < GUARD.suspiciousAt) {
          guard.state = 'patrol';
          guard.lastSeen = null;
        }
        return alarmNow;
      }
    } else {
      const wp = guard.waypoints[guard.wp];
      if (distance(guard.x, guard.y, wp[0], wp[1]) < 10) {
        guard.pauseTimer += dt;
        guard.scanPhase += dt * 1.4;
        guard.angle += Math.sin(guard.scanPhase) * 0.7 * dt;
        if (guard.pauseTimer >= guard.pause) {
          guard.pauseTimer = 0;
          guard.wp = (guard.wp + 1) % guard.waypoints.length;
        }
        return alarmNow;
      }
      target = { x: wp[0], y: wp[1] };
    }

    if (target) {
      const dx = target.x - guard.x;
      const dy = target.y - guard.y;
      const d = Math.hypot(dx, dy);
      if (d > 1) {
        const want = Math.atan2(dy, dx);
        let turn = angleDiff(want, guard.angle);
        const maxTurn = 4.5 * dt;
        guard.angle += clamp(turn, -maxTurn, maxTurn);
        const stepLen = Math.min(speed * dt, d);
        moveBody(guard, Math.cos(guard.angle) * stepLen, Math.sin(guard.angle) * stepLen, GUARD.radius);
      }
    }
    return alarmNow;
  }

  /**
   * One fixed step. `move` is {x, y} (each -1..1), `sneak` holds Shift,
   * `throwAt` is a field point or null. With `harmless` set (the title
   * screen's backdrop) guards patrol but nothing is seen, scored or lost.
   */
  function step(dt, move, sneak, throwAt, harmless) {
    let events = 0;
    const p = state.player;
    if (p.invulnerable > 0) p.invulnerable = Math.max(0, p.invulnerable - dt);
    if (state.throwCooldown > 0) state.throwCooldown = Math.max(0, state.throwCooldown - dt);
    for (const ping of state.pings) ping.age += dt;
    state.pings = state.pings.filter((ping) => ping.age < 0.9);

    if (!harmless) {
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        return EVENT_TIMEOUT;
      }
    }

    if (throwAt && !harmless) throwNoisemaker(throwAt.x, throwAt.y);

    const speed = sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    const len = Math.hypot(move.x, move.y);
    if (len > 0.01) {
      const nx = (move.x / len) * speed * dt;
      const ny = (move.y / len) * speed * dt;
      moveBody(p, nx, ny, PLAYER.radius);
      p.angle = Math.atan2(move.y, move.x);
    }
    p.moving = len > 0.01;
    p.sneaking = sneak && len > 0.01;
    p.hidden = playerInBush();

    let alarmNow = false;
    for (const guard of state.guards) {
      if (stepGuard(guard, dt, harmless)) alarmNow = true;
    }
    if (alarmNow) {
      state.alarmsTripped += 1;
      events |= EVENT_ALARM;
    }
    state.alarm = state.guards.some((g) => g.state === 'chase');
    state.seen = state.guards.some((g) => g.seesPlayer);
    state.suspicion = state.guards.reduce((max, g) => Math.max(max, g.suspicion), 0);

    if (harmless) return events;

    // Caught: a chasing guard closed in. The brief invulnerability stops the
    // same catch from costing a life on every step while the guard stands there.
    for (const guard of state.guards) {
      if (guard.state === 'chase' && p.invulnerable === 0 &&
          distance(guard.x, guard.y, p.x, p.y) < GUARD.catchRange) {
        state.lives -= 1;
        p.invulnerable = 2;
        events |= EVENT_CAUGHT;
        return events;
      }
    }

    // Loot: step onto an intel chip.
    for (const item of state.loot) {
      if (!item.taken && distance(p.x, p.y, item.x, item.y) < PLAYER.radius + 16) {
        item.taken = true;
        state.score += LOOT_POINTS;
        state.lootTaken += 1;
        events |= EVENT_LOOT;
      }
    }

    // Exit: reach the pad unseen enough to slip out.
    const exit = state.level.exit;
    if (p.x > exit.x && p.x < exit.x + exit.w && p.y > exit.y && p.y < exit.y + exit.h) {
      const bonus = LEVEL_CLEAR_BONUS + Math.round(state.timeLeft) * TIME_BONUS_RATE;
      state.score += bonus;
      if (state.levelIndex + 1 >= LEVELS.length) events |= EVENT_WIN;
      else events |= EVENT_CLEAR;
    }
    return events;
  }

  /** Move on to the next level after a clear; false when there is none. */
  function nextLevel() {
    if (state.levelIndex + 1 >= LEVELS.length) return false;
    loadLevel(state.levelIndex + 1);
    return true;
  }

  resetRun();
  return { state, step, resetRun, restartLevel, nextLevel, loadLevel, throwNoisemaker };
}
