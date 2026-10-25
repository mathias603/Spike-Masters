// Player settings that survive sessions: sound effects, haptics, the camera
// kick, the broadcast camera view and which angle the slow-motion replays
// cut to. Stored in localStorage like the roster
// picks live at module
// scope, so a toggle made today is still made next launch. Every consumer
// reads through the small getters so the switch logic lives in one place.

const KEY = 'beachvolley.settings.v1';

const DEFAULTS = {
  sfx: true, haptics: true, shake: true, broadcast: false, replayNetCam: false
};

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) {
    // Private browsing or blocked storage: run on the defaults.
  }
  return { ...DEFAULTS };
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    // Nothing to do — the choice just won't outlive this session.
  }
}

export function getSettings() {
  return state;
}

export function soundOn() {
  return !!state.sfx;
}

export function hapticsOn() {
  return !!state.haptics;
}

export function shakeOn() {
  return !!state.shake;
}

export function broadcastCamera() {
  return !!state.broadcast;
}

export function replayNetCam() {
  return !!state.replayNetCam;
}

export function setSetting(key, value) {
  if (!(key in DEFAULTS)) return;
  state[key] = !!value;
  save();
}
