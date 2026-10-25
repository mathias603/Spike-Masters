// The panel's turn control.
//
// Some hosts turn the whole presented frame when the device lies sideways
// while the web view itself stays portrait — the viewport never changes, and
// every letter on screen reads on its side, with the court running top to
// bottom. The game counters with a quarter-turn of its own: the stage and
// the HUD rotate inside the viewport and re-size to the swapped dimensions,
// so the scenes lay out and render landscape end to end — the manager's
// resize reads the stage's own size — and what the player sees upright is a
// real landscape match.
//
// The turn is chosen by hand: the small control beside the pause button (and
// on the title's corner) cycles upright → one way → the other, and one of the
// three stops sits upright on however the panel is being held. Nothing is
// remembered across sessions — a fresh one always opens upright, and one tap
// fixes the sideways case.
//
// Touches map back through toLocal: the browser reports them in viewport
// coordinates, and the inverse of the stage's own transform is all a finger
// needs — the host already mapped the physical finger into viewport
// coordinates along with its own turn.

let rotation = 0; // the applied counter-turn: 0, 90 or -90

const stage = () => document.getElementById('stage');
const hud = () => document.getElementById('hud');

function apply() {
  const s = stage();
  const h = hud();
  if (!s || !h) return;
  for (const el of [s, h]) {
    if (rotation === 0) {
      el.style.transform = '';
      el.style.transformOrigin = '';
      el.style.width = '';
      el.style.height = '';
    } else {
      // 100vh × 100vw: the viewport's dims swapped — the turned stage fills
      // the panel exactly and tracks every resize on its own.
      el.style.width = '100vh';
      el.style.height = '100vw';
      el.style.transformOrigin = '0 0';
      el.style.transform = rotation === 90
        ? 'translateX(100vw) rotate(90deg)'
        : 'translateY(100vh) rotate(-90deg)';
    }
  }
}

/// Applies the turn remembered for this session at startup.
export function initOrientation() {
  apply();
}

/// The rotate control's tap: turn the game a quarter — upright, then one
/// way, then the other. Whatever the host did to the frame, one of the three
/// stops presents the game upright.
export function cycleRotation() {
  rotation = rotation === 0 ? 90 : rotation === 90 ? -90 : 0;
  apply();
}

/// Viewport coordinates → the game's own (possibly turned) space: the
/// inverse of the stage's transform, which is all a finger needs.
export function toLocal(x, y) {
  if (rotation === 90) return { x: y, y: window.innerWidth - x };
  if (rotation === -90) return { x: window.innerHeight - y, y: x };
  return { x, y };
}

/// A drag's viewport delta → the game's space, the same turn applied.
export function toLocalDelta(dx, dy) {
  if (rotation === 90) return { x: dy, y: -dx };
  if (rotation === -90) return { x: -dy, y: dx };
  return { x: dx, y: dy };
}