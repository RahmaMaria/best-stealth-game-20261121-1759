// The screenshot scenes behind ?shot=start|play|alert|end. Each one plays the
// real rules forward from a fresh world for a fixed stretch, steered by a simple
// autopilot (follow waypoints toward the exit, flee when a guard's cone finds
// the player, sneak while suspicion is high), so the frame is what a real game
// looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { EVENT_CLEAR, EVENT_WIN } from './world.js';
import { SCREEN_CLEAR, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

/** Waypoints threading level 1 from its spawn to its exit, through the cover. */
const ROUTE_LEVEL_1 = [
  [250, 520], [380, 450], [560, 300], [760, 260], [950, 330], [1080, 220], [1190, 95],
];

const START_SECONDS = 5;
const PLAY_SECONDS = 16;
const CLEAR_LIMIT_SECONDS = 180;

/** A seeing guard's position, or null when no guard sees the player. */
function seeingGuard(state) {
  for (const guard of state.guards) if (guard.seesPlayer) return guard;
  return null;
}

/**
 * Steer the player: flee a guard that has eyes on them, sneak toward the next
 * waypoint while suspicion is warm, otherwise walk the route. Returns the move
 * vector and whether to sneak.
 */
function autopilot(state, route, routeIndex) {
  const player = state.player;
  const threat = seeingGuard(state);
  if (threat) {
    const dx = player.x - threat.x;
    const dy = player.y - threat.y;
    const len = Math.hypot(dx, dy) || 1;
    return { move: { x: dx / len, y: dy / len }, sneak: false, routeIndex };
  }
  const target = route[Math.min(routeIndex, route.length - 1)];
  const dx = target[0] - player.x;
  const dy = target[1] - player.y;
  const len = Math.hypot(dx, dy);
  if (len < 24) return { move: { x: 0, y: 0 }, sneak: false, routeIndex: routeIndex + 1 };
  return {
    move: { x: dx / len, y: dy / len },
    sneak: state.suspicion > 0.3,
    routeIndex,
  };
}

function runSteps(world, seconds, drive) {
  const steps = Math.floor(seconds / STEP);
  let events = 0;
  for (let i = 0; i < steps; i += 1) {
    const input = drive ? drive(world.state) : { move: { x: 0, y: 0 }, sneak: false };
    events = world.step(STEP, input.move, input.sneak, null, false);
    if (events & (EVENT_CLEAR | EVENT_WIN)) return { events, done: true };
  }
  return { events, done: false };
}

/**
 * Set `world` to the named scene and return the screen to draw over it, the
 * best score to show, and the level-clear bonus when the scene ends a level.
 */
export function stageShot(name, world) {
  world.resetRun();
  if (name !== 'play' && name !== 'alert' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { x: 0, y: 0 }, false, null, true);
    }
    return { screen: SCREEN_TITLE, best: 0, clearInfo: null };
  }

  if (name === 'play') {
    let routeIndex = 0;
    runSteps(world, PLAY_SECONDS, (state) => {
      const out = autopilot(state, ROUTE_LEVEL_1, routeIndex);
      routeIndex = out.routeIndex;
      return out;
    });
    return { screen: SCREEN_PLAY, best: world.state.score, clearInfo: null };
  }

  if (name === 'alert') {
    // Stand the player in front of the first guard, inside its cone, and let
    // the suspicion build until the alarm trips and the chase begins.
    const guard = world.state.guards[0];
    world.state.player.x = guard.x + Math.cos(guard.angle) * 150;
    world.state.player.y = guard.y + Math.sin(guard.angle) * 150;
    let chased = false;
    for (let i = 0; i < 6 / STEP; i += 1) {
      world.step(STEP, { x: 0, y: 0 }, false, null, false);
      if (world.state.alarm) {
        chased = true;
        break;
      }
    }
    // A few more steps so the guard closes in, red cone and "!" showing —
    // but stop before it reaches the player, so the frame is a chase, not a catch.
    if (chased) {
      for (let i = 0; i < 0.7 / STEP; i += 1) {
        world.step(STEP, { x: 0, y: 0 }, false, null, false);
        const g = world.state.guards[0];
        const d = Math.hypot(g.x - world.state.player.x, g.y - world.state.player.y);
        if (d < 45 || world.state.lives < 3) break;
      }
    }
    const over = world.state.lives === 0;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score, clearInfo: null };
  }

  // end: play level 1 to the exit with the autopilot, for the LEVEL CLEAR panel.
  let routeIndex = 0;
  const before = world.state.score;
  const result = runSteps(world, CLEAR_LIMIT_SECONDS, (state) => {
    const out = autopilot(state, ROUTE_LEVEL_1, routeIndex);
    routeIndex = out.routeIndex;
    return out;
  });
  if (result.done && (result.events & EVENT_CLEAR)) {
    return {
      screen: SCREEN_CLEAR,
      best: world.state.score,
      clearInfo: { bonus: world.state.score - before, score: world.state.score },
    };
  }
  if (result.done && (result.events & EVENT_WIN)) {
    return { screen: SCREEN_WIN, best: world.state.score, clearInfo: null };
  }
  return { screen: SCREEN_PLAY, best: world.state.score, clearInfo: null };
}
