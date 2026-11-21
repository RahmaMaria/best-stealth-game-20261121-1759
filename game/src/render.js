// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. Vision cones are painted before the walls and cover,
// so a wall visibly cuts a cone off. Flat shapes and canvas text only — no
// images, no network — so the game renders the same everywhere.

import { FIELD, FONT, GUARD, LIVES, NOISEMAKER, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 128, line: 32, bottom: 76 };
const TILE = 80;

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const timeLabel = cachedLabel('');
  const lootLabel = cachedLabel('');
  const bestLabel = cachedLabel('BEST ');
  const finalLabel = cachedLabel('FINAL SCORE ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  /** Convert a client (mouse) point to field coordinates. */
  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const px = (clientX - rect.left) * ratio;
    const py = (clientY - rect.top) * ratio;
    return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = size + (weight || '');
    if (!fonts.has(key)) fonts.set(key, `${weight || ''} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawFloor() {
    context.fillStyle = PALETTE.floor;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (let ty = 0; ty < FIELD.height / TILE; ty += 1) {
      for (let tx = 0; tx < FIELD.width / TILE; tx += 1) {
        if ((tx + ty) % 2 === 0) {
          context.fillStyle = PALETTE.floorAlt;
          context.fillRect(tx * TILE, ty * TILE, TILE, TILE);
        }
      }
    }
    context.strokeStyle = 'rgba(255,255,255,0.03)';
    context.lineWidth = 1;
    for (let x = 0; x <= FIELD.width; x += TILE) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, FIELD.height); context.stroke();
    }
    for (let y = 0; y <= FIELD.height; y += TILE) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(FIELD.width, y); context.stroke();
    }
  }

  function drawWalls(level) {
    for (const wall of level.walls) {
      context.fillStyle = PALETTE.wall;
      context.fillRect(wall.x, wall.y, wall.w, wall.h);
      context.fillStyle = PALETTE.wallEdge;
      if (wall.h <= 26) context.fillRect(wall.x, wall.y, wall.w, 3);
      else context.fillRect(wall.x, wall.y, 3, wall.h);
    }
  }

  function drawCrates(level) {
    for (const crate of level.crates) {
      context.fillStyle = PALETTE.crate;
      context.fillRect(crate.x, crate.y, crate.w, crate.h);
      context.strokeStyle = PALETTE.crateEdge;
      context.lineWidth = 3;
      context.strokeRect(crate.x + 2, crate.y + 2, crate.w - 4, crate.h - 4);
      context.beginPath();
      context.moveTo(crate.x + 4, crate.y + 4);
      context.lineTo(crate.x + crate.w - 4, crate.y + crate.h - 4);
      context.moveTo(crate.x + crate.w - 4, crate.y + 4);
      context.lineTo(crate.x + 4, crate.y + crate.h - 4);
      context.stroke();
    }
  }

  function drawBushes(level, time) {
    for (const bush of level.bushes) {
      context.fillStyle = PALETTE.bush;
      context.beginPath(); context.arc(bush.x, bush.y, bush.r, 0, Math.PI * 2); context.fill();
      context.fillStyle = PALETTE.bushEdge;
      const wobble = Math.sin(time * 1.4 + bush.x) * 2;
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        context.beginPath();
        context.arc(bush.x + Math.cos(a) * bush.r * 0.55, bush.y + Math.sin(a) * bush.r * 0.55 + wobble * 0.3, bush.r * 0.28, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawExit(level, time) {
    const exit = level.exit;
    const pulse = 0.55 + Math.sin(time * 3) * 0.2;
    context.fillStyle = PALETTE.exitGlow;
    context.globalAlpha = pulse * 0.5;
    context.fillRect(exit.x - 10, exit.y - 10, exit.w + 20, exit.h + 20);
    context.globalAlpha = 1;
    context.fillStyle = PALETTE.exit;
    context.fillRect(exit.x, exit.y, exit.w, exit.h);
    context.strokeStyle = '#b8ffce';
    context.lineWidth = 2;
    context.strokeRect(exit.x + 3, exit.y + 3, exit.w - 6, exit.h - 6);
    text('EXIT', exit.x + exit.w / 2, exit.y + exit.h / 2 + 8, 24, '#062b16', 'center', '700');
    // A green arrow beacon above the pad so it reads from across the map.
    const bob = Math.sin(time * 3) * 4;
    context.fillStyle = PALETTE.exit;
    context.beginPath();
    context.moveTo(exit.x + exit.w / 2, exit.y - 16 + bob);
    context.lineTo(exit.x + exit.w / 2 - 10, exit.y - 30 + bob);
    context.lineTo(exit.x + exit.w / 2 + 10, exit.y - 30 + bob);
    context.closePath();
    context.fill();
  }

  function drawLoot(state, time) {
    for (const item of state.loot) {
      if (item.taken) continue;
      const bob = Math.sin(time * 2.5 + item.x) * 3;
      context.save();
      context.translate(item.x, item.y + bob);
      context.rotate(Math.PI / 4);
      context.fillStyle = PALETTE.loot;
      context.fillRect(-9, -9, 18, 18);
      context.strokeStyle = '#fff3c4';
      context.lineWidth = 2;
      context.strokeRect(-9, -9, 18, 18);
      context.restore();
    }
  }

  function drawCone(guard) {
    const color = guard.state === 'chase' ? PALETTE.coneAlarm
      : guard.state === 'suspicious' ? PALETTE.coneSuspicious : PALETTE.coneCalm;
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(guard.x, guard.y);
    context.arc(guard.x, guard.y, GUARD.viewRange, guard.angle - GUARD.viewHalfAngle, guard.angle + GUARD.viewHalfAngle);
    context.closePath();
    context.fill();
    // Bright core of the cone, so the direction reads at a glance.
    context.fillStyle = guard.state === 'chase' ? 'rgba(255,60,47,0.20)' : 'rgba(255,214,64,0.10)';
    context.beginPath();
    context.moveTo(guard.x, guard.y);
    context.arc(guard.x, guard.y, GUARD.viewRange * 0.55, guard.angle - GUARD.viewHalfAngle * 0.6, guard.angle + GUARD.viewHalfAngle * 0.6);
    context.closePath();
    context.fill();
  }

  function drawPatrolRoute(guard) {
    context.strokeStyle = 'rgba(255,93,71,0.25)';
    context.lineWidth = 2;
    context.setLineDash([2, 10]);
    context.beginPath();
    const wps = guard.waypoints;
    for (let i = 0; i < wps.length; i += 1) {
      const a = wps[i];
      const b = wps[(i + 1) % wps.length];
      context.moveTo(a[0], a[1]);
      context.lineTo(b[0], b[1]);
    }
    context.stroke();
    context.setLineDash([]);
  }

  function drawGuard(guard) {
    drawPatrolRoute(guard);
    drawCone(guard);
    const body = guard.state === 'chase' ? PALETTE.danger
      : guard.state === 'suspicious' ? PALETTE.guardSuspicious : PALETTE.guard;
    // Body: a circle with a facing wedge and a pale visor slit.
    context.fillStyle = body;
    context.beginPath(); context.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2); context.fill();
    context.beginPath();
    context.moveTo(guard.x, guard.y);
    context.arc(guard.x, guard.y, GUARD.radius + 4, guard.angle - 0.5, guard.angle + 0.5);
    context.closePath();
    context.fill();
    context.fillStyle = '#ffe9e6';
    context.beginPath(); context.arc(guard.x + Math.cos(guard.angle) * 6, guard.y + Math.sin(guard.angle) * 6, 4, 0, Math.PI * 2); context.fill();
    // "?" while suspicious, "!" while chasing — the state reads without the HUD.
    if (guard.state === 'suspicious') text('?', guard.x, guard.y - GUARD.radius - 8, 22, PALETTE.guardSuspicious, 'center', '700');
    if (guard.state === 'chase') text('!', guard.x, guard.y - GUARD.radius - 8, 26, PALETTE.danger, 'center', '700');
    // Suspicion arc over the guard while it is building.
    if (guard.suspicion > 0.05 && guard.state !== 'chase') {
      context.strokeStyle = guard.suspicion >= GUARD.suspiciousAt ? PALETTE.guardSuspicious : '#ffe08a';
      context.lineWidth = 4;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius + 8, -Math.PI / 2, -Math.PI / 2 + guard.suspicion * Math.PI * 2);
      context.stroke();
    }
  }

  function drawPlayer(state, time) {
    const p = state.player;
    if (p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0) return;
    const hidden = p.hidden;
    context.globalAlpha = hidden ? 0.55 : 1;
    const body = p.sneaking ? PALETTE.playerSneak : PALETTE.player;
    const r = p.sneaking ? 11 : 13;
    // Cloak: a triangle behind the facing direction, then the body circle.
    context.fillStyle = body;
    context.beginPath();
    const back = p.angle + Math.PI;
    context.moveTo(p.x + Math.cos(back - 0.5) * r * 1.5, p.y + Math.sin(back - 0.5) * r * 1.5);
    context.moveTo(p.x + Math.cos(back + 0.5) * r * 1.5, p.y + Math.sin(back + 0.5) * r * 1.5);
    context.lineTo(p.x + Math.cos(p.angle) * r * 1.2, p.y + Math.sin(p.angle) * r * 1.2);
    context.closePath();
    context.fill();
    context.beginPath(); context.arc(p.x, p.y, r, 0, Math.PI * 2); context.fill();
    // Hood slit: two eyes toward the facing direction.
    context.fillStyle = '#0b0e14';
    const ex = Math.cos(p.angle);
    const ey = Math.sin(p.angle);
    const px = -ey;
    const py = ex;
    context.beginPath(); context.arc(p.x + ex * 5 + px * 4, p.y + ey * 5 + py * 4, 2, 0, Math.PI * 2); context.fill();
    context.beginPath(); context.arc(p.x + ex * 5 - px * 4, p.y + ey * 5 - py * 4, 2, 0, Math.PI * 2); context.fill();
    context.globalAlpha = 1;
    if (hidden) text('HIDDEN', p.x, p.y - r - 10, 15, '#9fe8b4', 'center', '700');
  }

  function drawPings(state) {
    for (const ping of state.pings) {
      const t = ping.age / 0.9;
      context.strokeStyle = `rgba(79,195,247,${(1 - t) * 0.9})`;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(ping.x, ping.y, 8 + t * 70, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawHud(state, time) {
    // Top bar.
    context.fillStyle = 'rgba(11,14,20,0.85)';
    context.fillRect(0, 0, FIELD.width, 56);
    text(state.level.name, 20, 36, 20, PALETTE.text, 'left', '700');
    text(timeLabel(`TIME ${Math.ceil(state.timeLeft)}s`), 430, 36, 20, state.timeLeft < 30 ? PALETTE.danger : PALETTE.text, 'left');
    text(scoreLabel(state.score), 620, 36, 20, PALETTE.text, 'left');
    const lootLeft = state.loot.filter((item) => !item.taken).length;
    text(lootLabel(`INTEL ${state.loot.length - lootLeft}/${state.loot.length}`), 800, 36, 20, PALETTE.loot, 'left');
    // Lives as cyan diamonds.
    for (let i = 0; i < LIVES; i += 1) {
      const cx = 1010 + i * 26;
      context.save();
      context.translate(cx, 28);
      context.rotate(Math.PI / 4);
      context.fillStyle = i < state.lives ? PALETTE.player : '#2a3040';
      context.fillRect(-7, -7, 14, 14);
      context.restore();
    }
    // Noisemakers as small circles.
    for (let i = 0; i < NOISEMAKER.count; i += 1) {
      context.fillStyle = i < state.noisemakers ? '#9fd8ff' : '#2a3040';
      context.beginPath(); context.arc(1100 + i * 22, 28, 7, 0, Math.PI * 2); context.fill();
    }
    text('THROW', 1160, 36, 16, PALETTE.muted, 'left');

    // Detection meter, bottom centre.
    const meterW = 320;
    const meterX = (FIELD.width - meterW) / 2;
    const meterY = FIELD.height - 44;
    const s = state.suspicion;
    const label = state.alarm ? 'ALARM — RUN!' : s >= 0.45 ? 'SUSPECTED' : s > 0.02 ? 'WATCHED' : 'UNSEEN';
    const labelColor = state.alarm ? PALETTE.danger : s >= 0.45 ? PALETTE.guardSuspicious : s > 0.02 ? '#ffe08a' : PALETTE.ok;
    const blink = state.alarm && Math.floor(time * 4) % 2 === 0;
    context.fillStyle = 'rgba(11,14,20,0.85)';
    context.fillRect(meterX - 90, meterY - 8, meterW + 180, 34);
    text(label, meterX - 12, meterY + 16, 18, blink ? PALETTE.text : labelColor, 'right', '700');
    context.fillStyle = '#2a3040';
    context.fillRect(meterX, meterY, meterW, 18);
    const fill = s >= 1 ? PALETTE.danger : s >= 0.45 ? PALETTE.guardSuspicious : '#ffe08a';
    context.fillStyle = fill;
    context.fillRect(meterX, meterY, meterW * s, 18);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(meterX, meterY, meterW, 18);
    if (state.player.sneaking) text('SNEAKING — Shift', meterX + meterW + 12, meterY + 16, 16, PALETTE.muted, 'left');
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(5,7,10,0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 3;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.text, 'center', '800');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + PANEL.top + i * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.loot, 'center', '700');
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen. */
  function draw(state, screen, best, time, clearInfo) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.textBaseline = 'alphabetic';
    drawFloor();
    drawExit(state.level, time);
    drawLoot(state, time);
    for (const guard of state.guards) drawGuard(guard);
    drawWalls(state.level);
    drawCrates(state.level);
    drawBushes(state.level, time);
    drawPlayer(state, time);
    drawPings(state);

    if (screen === SCREEN_TITLE) {
      drawPanel(
        'SHADOWLINE',
        [
          'A top-down stealth game. Slip past the guards,',
          'grab the intel, and reach the green EXIT unseen.',
          'Move: WASD / Arrows    Sneak: hold Shift',
          'Throw a noisemaker: click the floor (lures guards)',
          `Best score: ${best}`,
          '',
        ],
        'Press Space or click to start',
        PALETTE.player,
      );
      return;
    }
    drawHud(state, time);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The guards will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_CAUGHT) {
      drawPanel('SPOTTED!', ['A guard caught you. The level resets.', `Lives left: ${state.lives}`], 'Press Space to try again', PALETTE.danger);
    } else if (screen === SCREEN_CLEAR) {
      const info = clearInfo || { bonus: 0, score: state.score };
      drawPanel(
        'LEVEL CLEAR',
        [`Level bonus: +${info.bonus}`, `Score: ${info.score}`, `Intel grabbed: ${state.lootTaken} total`],
        'Press Space for the next level',
        PALETTE.ok,
      );
    } else if (screen === SCREEN_WIN) {
      drawPanel(
        'GHOST — ALL LEVELS CLEAR',
        [finalLabel(state.score), bestLabel(best), `Alarms tripped: ${state.alarmsTripped}`, 'You were never seen. Almost.'],
        'Press Space to play again',
        PALETTE.ok,
      );
    } else if (screen === SCREEN_OVER) {
      drawPanel(
        'CAUGHT — GAME OVER',
        [finalLabel(state.score), bestLabel(best), 'The guards win this time.'],
        'Press Space to try again',
        PALETTE.danger,
      );
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField };
}
