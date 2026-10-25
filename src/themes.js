import { careerWins } from './record.js';

// The four looks the arena can wear. The beach courts change only the sky,
// the haze and the lights — the sand, the court lines and the athletes stay
// exactly as they are, so a night court is the same court under different
// light. The indoor arena goes further: a smooth blue floor instead of sand,
// gym-hall walls and LED boards ringing the stands, a floor polished enough
// to mirror the play on it, and no weather at all. Each look also carries the
// career-win count that unlocks it — midday is free from the start, the rest
// open up as the wins stack — and the venue picked on the title screen
// overrides the random draw for the plain matches.

/// Consumed by the match scene: a sky-dome palette (zenith, optional mid tone,
/// horizon haze, and the sea beyond the sand), a fog that fades the ground
/// into the horizon colour, one ambient and one key light, whether floodlight
/// poles rise at the corners, and — for a low sun — how far the blob shadows
/// stretch and along which ground azimuth. sunGlow sizes the sun's halo in the
/// dome; clouds and stars dress the rest of the sky. An indoor theme carries
/// the same palette for its dark dome, plus the indoor flag: the match scene
/// swaps the sand for a smooth blue floor, rings the terraces with dark
/// walls and stills the breeze entirely.
export const THEMES = [
  {
    id: 'midday',
    name: 'MIDDAY',
    wins: 0, // free from the first serve
    // A saturated trade-wind sky: deep cerulean overhead, holding through a
    // bright mid tone before paling into haze at the horizon, over a
    // turquoise sea.
    skyTop: 0x1e8fd8,
    skyMid: 0x54b0e6,
    horizon: 0xc6e4f2,
    sea: 0x2b93c9,
    seaFar: 0x62b6d6,
    sky: 0xc6e4f2, // the haze colour, kept for anything that wants "the sky"
    fogNear: 30, fogFar: 70,
    ambient: [0xffffff, 1.15],
    // Warm key light from high behind the camera: the beach afternoon.
    sun: [0xfff1d6, 2.4, 6, 12, 5],
    sunGlow: 0.45,
    clouds: 12,
    stars: false,
    floods: false,
    shadowStretch: null
  },
  {
    id: 'sunset',
    name: 'SUNSET',
    wins: 3,
    skyTop: 0x4b3f7a,
    skyMid: 0xb05c6e,
    horizon: 0xffab5e,
    sea: 0xc2734e,
    seaFar: 0x8a5a55,
    sky: 0xffab5e,
    fogNear: 24, fogFar: 62,
    ambient: [0xffd2a0, 0.95],
    // The sun sits low off one end of the court, so shadows stretch long
    // and everything tints warm.
    sun: [0xffb27a, 2.6, -7, 2.4, 6],
    sunGlow: 1.0,
    clouds: 7,
    stars: false,
    floods: false,
    // Long axis of the stretched shadows, pointing away from the sun.
    shadowStretch: { angle: Math.atan2(6, 7), sx: 1.9 }
  },
  {
    id: 'night',
    name: 'NIGHT',
    wins: 7,
    skyTop: 0x050b18,
    horizon: 0x223349,
    sea: 0x101d30,
    seaFar: 0x18263c,
    sky: 0x223349,
    fogNear: 18, fogFar: 52,
    ambient: [0x5a6d8f, 0.5],
    // A faint cool wash of moonlight; the court itself is lit by floods.
    sun: [0x9fb4d8, 0.55, 4, 10, -6],
    sunGlow: 0.35,
    clouds: 0,
    stars: true,
    floods: true,
    shadowStretch: null
  },
  {
    id: 'indoor',
    name: 'INDOOR',
    wins: 12,
    skyTop: 0x0a0f18,
    horizon: 0x1a2432,
    sea: 0x131b26,
    seaFar: 0x1a2432,
    sky: 0x1a2432,
    fogNear: 26, fogFar: 58,
    ambient: [0x9db4d8, 0.85],
    // A cool floodlit wash from high above the court: no sun, no weather.
    sun: [0xdce8ff, 2.2, 2, 12, 4],
    sunGlow: 0.12,
    clouds: 0,
    stars: false,
    floods: true,
    // The match scene reads this: blue floor instead of sand, gym-hall walls
    // with LED boards and a scoreboard beyond the terraces, a breeze that
    // never blows, and a floor polished enough to mirror the players, the
    // ball and the net standing on it.
    indoor: true,
    shadowStretch: null
  }
];

/// A fresh look for every match.
export function randomTheme() {
  return THEMES[(Math.random() * THEMES.length) | 0];
}


// ----- the picked venue -----
// The court the plain matches play on, picked from a row of swatches beside
// the kit swatches on the title screen: AUTO — every match drawing at random,
// as it always has — then the four looks, each unlocking at its career-win
// count like the kits and ball skins. The pick is remembered across
// sessions; the cup, the daily and the ladder never read it, drawing their
// own courts as they always have.
const VENUE_KEY = 'beachvolley.venue';

let venueId = loadVenue();

function loadVenue() {
  try {
    const v = localStorage.getItem(VENUE_KEY);
    if (v === 'auto' || THEMES.some((t) => t.id === v)) return v;
  } catch (e) { /* private browsing: draw at random */ }
  return 'auto';
}

/// A venue is unlocked once the player has banked its number of career wins.
export function themeUnlocked(theme) {
  return theme.wins <= careerWins();
}

export function selectVenue(id) {
  if (id !== 'auto' && !THEMES.some((t) => t.id === id)) return;
  venueId = id;
  try { localStorage.setItem(VENUE_KEY, id); } catch (e) { /* session-only then */ }
}

/// The picked venue — null while AUTO stands, or when a saved pick's unlock
/// was never banked (a cleared record, say) and the random draw returns.
export function selectedVenue() {
  if (venueId === 'auto') return null;
  const theme = THEMES.find((t) => t.id === venueId);
  return theme && themeUnlocked(theme) ? theme : null;
}