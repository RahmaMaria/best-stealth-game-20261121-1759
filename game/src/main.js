// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between seven screens: title, play,
// paused, caught, level clear, win and game over.
//
// ?seed=N fixes the run. ?shot=start|play|alert|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.

import { BEST_KEY, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_ALARM, EVENT_CAUGHT, EVENT_CLEAR, EVENT_LOOT, EVENT_TIMEOUT, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import {
  SCREEN_CAUGHT, SCREEN_CLEAR, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY,
  SCREEN_TITLE, SCREEN_WIN, createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** Seconds the SPOTTED panel shows before the level restarts on its own. */
const CAUGHT_WAIT = 1.8;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, 0, scene.clearInfo);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let elapsed = 0;
  let caughtTimer = 0;
  let clearInfo = null;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.resetRun();
    accumulator = 0;
    clearInfo = null;
    screen = SCREEN_PLAY;
    announce(`Playing ${world.state.level.name}. ${LIVES} lives. Reach the exit unseen.`);
  }

  function levelCleared(bonus) {
    clearInfo = { bonus, score: world.state.score };
    screen = SCREEN_CLEAR;
    announce(`Level clear. Score ${world.state.score}.`);
  }

  function gameWon() {
    screen = SCREEN_WIN;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Ghost. All levels clear. Final score ${world.state.score}.`);
  }

  function gameOver() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function caught(reason) {
    if (world.state.lives <= 0) {
      gameOver();
      return;
    }
    screen = SCREEN_CAUGHT;
    caughtTimer = 0;
    announce(reason);
  }

  function handleActions() {
    const actions = input.takeActions();
    const click = input.takeClick();
    if (actions & ACTION_RESTART && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED)) {
      world.restartLevel();
      screen = SCREEN_PLAY;
      announce('Level restarted.');
      return;
    }
    if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_OVER) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_WIN) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_CLEAR) {
      if (world.nextLevel()) {
        clearInfo = null;
        screen = SCREEN_PLAY;
        announce(`Playing ${world.state.level.name}.`);
      } else gameWon();
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_CAUGHT) {
      world.restartLevel();
      screen = SCREEN_PLAY;
      announce('Playing.');
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    // A click during play throws a noisemaker where the player pointed.
    if (click && screen === SCREEN_PLAY) {
      const field = renderer.toField(click.x, click.y);
      const before = world.state.noisemakers;
      world.throwNoisemaker(field.x, field.y);
      if (world.state.noisemakers < before) announce('Noisemaker thrown. A guard comes to look.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, false, null, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const prevScore = world.state.score;
    const events = world.step(STEP, input.move(), input.sneaking(), null, false);
    if (events & EVENT_ALARM) announce('Alarm! A guard is chasing you!');
    else if (events & EVENT_LOOT) announce(`Intel grabbed. Score ${world.state.score}.`);
    if (events & EVENT_CAUGHT) {
      caught('Spotted! A guard caught you.');
    } else if (events & EVENT_TIMEOUT) {
      world.state.lives -= 1;
      caught('Time ran out.');
    } else if (events & EVENT_WIN) {
      gameWon();
    } else if (events & EVENT_CLEAR) {
      levelCleared(world.state.score - prevScore);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    elapsed += dt;
    handleActions();
    if (screen === SCREEN_CAUGHT) {
      caughtTimer += dt;
      if (caughtTimer >= CAUGHT_WAIT) {
        world.restartLevel();
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      accumulator += dt;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, elapsed, clearInfo);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Shadowline. A stealth game. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
