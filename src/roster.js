// The roster: three athletes with different builds, picked on the title screen.
//
// Selection lives at module scope so it survives scene restarts — the title
// screen writes it, the match reads it. The CPU draws one of the two athletes
// the player did not pick.

import { careerWins, legendUnlocked } from './record.js';

export const ROSTER = [
  {
    id: 'mira',
    name: 'MIRA',
    tag: 'Fastest legs · low jump',
    colors: { jersey: 0x17a289, shorts: 0xf2f2f2, skin: 0xd9a06b, hair: 0x1f1a14 },
    speed: 7.6,   // movement speed, units per second
    jump: 7.9,    // take-off velocity — a lower apex than the others
    // Her serve: a flat laser — almost no hang, real pace off the hand.
    serve: {
      tag: 'LASER SERVE',
      arcJump: 0.85,   // a shorter flight = a faster, flatter launch
      arcFloat: 0.8,
      pace: 1.4,       // the pace cap lifts with the laser's flat bite
      topspin: 2,      // barely any rotation on the ball
      sidespin: 0,
      backDrag: 0,
      aim: 0.85        // the tightest serve in the roster
    }
  },
  {
    id: 'rex',
    name: 'REX',
    tag: 'Balanced all-rounder',
    colors: { jersey: 0x2b6fd6, shorts: 0xf2f2f2, skin: 0xe0b088, hair: 0x5a3b1e },
    speed: 6.2,
    jump: 8.6,
    // His serve: heavy topspin — it hangs at the top of its arc, then falls
    // away late and steep.
    serve: {
      tag: 'TOPSPIN SERVE',
      arcJump: 1.18,   // a longer flight = a taller top, then a late dip
      arcFloat: 1.0,
      pace: 1.05,
      topspin: 13,     // the heavy turnover the serve is named for
      sidespin: 0,
      backDrag: 0,
      aim: 1.0
    }
  },
  {
    id: 'bruno',
    name: 'BRUNO',
    tag: 'Huge jump · slow feet',
    colors: { jersey: 0xc44536, shorts: 0x20304a, skin: 0x8c5a33, hair: 0x14100c },
    speed: 5.2,
    jump: 9.5,
    // His serve: a slow float that hangs and wobbles, then sits down short.
    serve: {
      tag: 'FLOAT SERVE',
      arcJump: 1.12,
      arcFloat: 1.35,  // the longest hang in the game
      pace: 0.9,
      topspin: 3,
      sidespin: 0,
      backDrag: 0.35,  // backspin drag — the float sits down short
      aim: 1.15        // the loosest serve in the roster
    }
  },
  {
    // The season's recruit: the biggest spring in the roster on the slowest
    // legs, joining the playable roster once the career banks her wins
    // requirement.
    id: 'nova',
    name: 'NOVA',
    tag: 'Sky-high jump · slowest feet',
    colors: { jersey: 0x7a4fd0, shorts: 0x222833, skin: 0xf0c8a0, hair: 0x6e2a18 },
    speed: 4.9,
    jump: 10.2,  // the biggest take-off in the game
    wins: 75,    // the career wins that sign her
    // Her serve: the banana — a sidespin bend mid-air on every serve.
    serve: {
      tag: 'BANANA SERVE',
      arcJump: 1.0,
      arcFloat: 1.0,
      pace: 1.0,
      topspin: 4,
      sidespin: 0.8,   // the built-in curve that never flies straight
      backDrag: 0,
      aim: 0.9
    }
  }
];

/// Whether a roster athlete is signed to the playable roster yet: everyone
/// from the opening day always is, and the recruit joins once the career has
/// banked her number of wins — the same currency the kits unlock on.
export function athleteUnlocked(character) {
  return !character.wins || character.wins <= careerWins();
}

let selectedId = 'rex';

export function selectCharacter(id) {
  const pick = ROSTER.find((r) => r.id === id);
  // A locked recruit refuses the pick — she isn't on the roster yet.
  if (pick && athleteUnlocked(pick)) selectedId = id;
}

export function selectedCharacter() {
  const pick = ROSTER.find((r) => r.id === selectedId);
  // A pick whose unlock no longer holds (a record restored back past the
  // recruit's mark, say) falls back to the all-round opener.
  return pick && athleteUnlocked(pick) ? pick : ROSTER[1];
}

export function cpuCharacter() {
  // The CPU draws from the signed athletes the player did not pick.
  const rest = ROSTER.filter((r) => r.id !== selectedId && athleteUnlocked(r));
  return rest[Math.floor(Math.random() * rest.length)];
}

/// Player two's character in a two-player match: the first signed roster
/// slot the player did not pick. It stays deterministic, so the title lineup
/// can dress the far athlete in their kit before any match has drawn anyone.
export function p2Character() {
  return ROSTER.filter((r) => r.id !== selectedId && athleteUnlocked(r))[0]
    || ROSTER[1];
}


// ----- difficulty -----
// Scales how the CPU opponent plays: how fast it runs, how accurately it
// predicts the landing point, how tightly it aims, how often it mistimes its
// jump, how often it rethinks — and how often it serves with a real toss and
// a strike at the top instead of the automatic float. Selection lives at
// module scope like the roster choice, so it survives scene restarts.
export const DIFFICULTIES = [
  { id: 'easy',   name: 'EASY',   speedScale: 0.42, predict: 2.1,  aimError: 2.6,  mistime: 0.58, react: 0.85, think: 0.44, jumpServe: 0 },
  { id: 'normal', name: 'NORMAL', speedScale: 0.68, predict: 0.45, aimError: 1.0,  mistime: 0.09, react: 1.65, think: 0.12, jumpServe: 0.55 },
  { id: 'hard',   name: 'HARD',   speedScale: 0.80, predict: 0.15, aimError: 0.35, mistime: 0.03, react: 2.1, think: 0.09, jumpServe: 0.7 }
];

// LEGEND: the tier above hard, hidden until the season ladder's top rung has
// been beaten. The top scale of everything — full pace, a near-perfect read
// on the ball, tight aim, almost no misjudged jumps — diving and launching
// freely, jumping its serves almost every time and burning its super strike
// willingly. The adaptive balancing never touches it.
export const LEGEND = {
  id: 'legend', name: 'LEGEND',
  speedScale: 1, predict: 0.04, aimError: 0.12, mistime: 0.01,
  react: 2.5, think: 0.05, jumpServe: 0.95, legend: true
};

/// The levels the picker offers: the usual three, with LEGEND joining the
/// row only once the ladder's top rung has fallen. The cup, the daily and
/// the ladder draw their own levels from DIFFICULTIES, so they never hand
/// out the tier.
export function difficultyChoices() {
  return legendUnlocked() ? [...DIFFICULTIES, LEGEND] : DIFFICULTIES;
}

let difficultyId = 'normal';

export function selectDifficulty(id) {
  if (id === 'legend' && !legendUnlocked()) return;
  if (DIFFICULTIES.some((d) => d.id === id) || id === 'legend') difficultyId = id;
}

export function selectedDifficulty() {
  return difficultyChoices().find((d) => d.id === difficultyId) || DIFFICULTIES[1];
}

// ----- match length -----
// The usual best of three, or the MARATHON: five sets a side at 11 points a
// set, the golden tie-break still deciding a 2-2 split. Picked beside the
// difficulty on the title screen and remembered the same way — at module
// scope, so it survives scene restarts. The cup, the daily and the ladder
// stay one set whatever it says.
export const MATCH_LENGTHS = [
  { id: 'bo3', name: 'BEST OF 3', sets: 2, points: 7 },
  { id: 'bo5', name: 'MARATHON', sets: 3, points: 11 }
];

let lengthId = 'bo3';

export function selectLength(id) {
  if (MATCH_LENGTHS.some((l) => l.id === id)) lengthId = id;
}

export function selectedLength() {
  return MATCH_LENGTHS.find((l) => l.id === lengthId) || MATCH_LENGTHS[0];
}

// ----- mode -----
// Against the CPU, two people sharing one screen, a co-op pair of them
// against two CPUs, a three-minute blitz against the CPU, or a no-score
// practice court. Lives at module scope like the other picks, so it survives
// scene restarts.
export const MODES = [
  { id: 'cpu', name: 'VS CPU', icon: 'user' },
  { id: '2p', name: 'TWO PLAYERS', icon: 'users' },
  { id: 'doubles', name: 'DOUBLES', icon: 'users-round' },
  { id: 'coop', name: 'CO-OP 2P', icon: 'users-2' },
  { id: 'blitz', name: 'BLITZ', icon: 'timer' },
  { id: 'practice', name: 'PRACTICE', icon: 'traffic-cone' }
];

let modeId = 'cpu';

export function selectMode(id) {
  if (MODES.some((m) => m.id === id)) modeId = id;
}

export function selectedMode() {
  return MODES.find((m) => m.id === modeId) || MODES[0];
}

// ----- doubles serving tactic -----
// How the near pair lines up at the serve in the doubles modes: the classic
// side-by-side rotation — partner left, player right — or the stacking
// formation, where the pair line up together on one half at the serve and
// the partner takes over the half the player would normally hold. Picked
// beside the mode choices on the title screen and remembered across
// sessions like the other picks.
export const SERVING_TACTICS = [
  { id: 'rotation', name: 'ROTATION' },
  { id: 'stacking', name: 'STACKING' }
];

const TACTIC_KEY = 'beachvolley.tactic';

let tacticId = loadTactic();

function loadTactic() {
  try {
    const v = localStorage.getItem(TACTIC_KEY);
    if (v && SERVING_TACTICS.some((t) => t.id === v)) return v;
  } catch (e) { /* private browsing: start on the classic */ }
  return SERVING_TACTICS[0].id;
}

export function selectTactic(id) {
  if (!SERVING_TACTICS.some((t) => t.id === id)) return;
  tacticId = id;
  try { localStorage.setItem(TACTIC_KEY, id); } catch (e) { /* session-only then */ }
}

export function selectedTactic() {
  return SERVING_TACTICS.find((t) => t.id === tacticId) || SERVING_TACTICS[0];
}
// ----- jersey kits -----
// Jersey and shorts colours picked from a row of swatches on the title
// screen. The first few are classic freebies; the rest unlock as career wins
// stack up. Each choice is remembered separately across sessions — a toggle
// hands the row to whoever is being dressed: player one, player two in a
// two-player match, or the CPU partner in doubles — and only those athletes
// wear them: the CPU opponents always keep their roster colours.
export const KITS = [
  { id: 'league',   name: 'LEAGUE',   jersey: 0x2b6fd6, shorts: 0xf2f2f2, wins: 0 },
  { id: 'shore',    name: 'SHORE',    jersey: 0x17a289, shorts: 0xf2f2f2, wins: 0 },
  { id: 'ember',    name: 'EMBER',    jersey: 0xc44536, shorts: 0x20304a, wins: 0 },
  { id: 'sunset',   name: 'SUNSET',   jersey: 0xe8862c, shorts: 0x2b2b2b, wins: 2 },
  { id: 'lime',     name: 'LIME',     jersey: 0x8cc63f, shorts: 0x1f2933, wins: 4 },
  { id: 'violet',   name: 'VIOLET',   jersey: 0x7b4bd6, shorts: 0xf2f2f2, wins: 6 },
  { id: 'midnight', name: 'MIDNIGHT', jersey: 0x23262b, shorts: 0x151a20, wins: 9 },
  { id: 'gold',     name: 'GOLD',     jersey: 0xd4a017, shorts: 0x151a20, wins: 12 }
];

const KIT_KEYS = {
  p1: 'beachvolley.kit',
  p2: 'beachvolley.kit2',
  partner: 'beachvolley.kitp'
};

// Each pick lives under its own key — player one keeps the original key, so
// a kit already saved stays theirs; the doubles partner keeps their own too.
const kitIds = {
  p1: loadKit(KIT_KEYS.p1),
  p2: loadKit(KIT_KEYS.p2),
  partner: loadKit(KIT_KEYS.partner)
};

function loadKit(key) {
  try {
    const v = localStorage.getItem(key);
    // 'custom' is the kit designer's own pick, living under the same keys.
    if (v && (v === 'custom' || KITS.some((k) => k.id === v))) return v;
  } catch (e) { /* private browsing: start on the classic */ }
  return KITS[0].id;
}

/// A kit is unlocked once the player has banked its number of career wins.
export function kitUnlocked(kit) {
  return kit.wins <= careerWins();
}

export function selectKit(id, who = 'p1') {
  if (!KITS.some((k) => k.id === id)) return;
  kitIds[who] = id;
  try { localStorage.setItem(KIT_KEYS[who], id); } catch (e) { /* session-only then */ }
}

export function selectedKit(who = 'p1') {
  // The custom kit is not in the preset row: it reads back as itself, with
  // the colours its owner painted.
  if (kitIds[who] === 'custom') {
    const c = customKits[who];
    return { id: 'custom', name: 'CUSTOM', jersey: c.jersey, shorts: c.shorts };
  }
  const kit = KITS.find((k) => k.id === kitIds[who]) || KITS[0];
  // A kit whose unlock was never banked (a cleared record, say) falls back
  // to the classic.
  return kitUnlocked(kit) ? kit : KITS[0];
}

// ----- the custom kit -----
// The kit the player paints themselves: a CUSTOM swatch at the preset row's
// end opens a designer with two colour rows — jersey and shorts — each a
// palette of swatches, a few colour pairs locked behind career wins. The
// custom kit dresses whoever the dressing toggle points at when it is opened,
// is remembered per player exactly like the preset kits, and repaints
// everywhere a kit does. The kit itself is free — it is the locked colour
// pairs that earn their way in.
export const CUSTOM_JERSEYS = [
  { name: 'WHITE', color: 0xf6f6f6, wins: 0 },
  { name: 'ROYAL', color: 0x2b6fd6, wins: 0 },
  { name: 'TEAL', color: 0x17a289, wins: 0 },
  { name: 'EMBER', color: 0xc44536, wins: 0 },
  { name: 'SUNSET', color: 0xe8862c, wins: 3 },
  { name: 'VIOLET', color: 0x7b4bd6, wins: 6 },
  { name: 'MIDNIGHT', color: 0x23262b, wins: 10 },
  { name: 'GOLD', color: 0xd4a017, wins: 16 }
];
export const CUSTOM_SHORTS = [
  { name: 'WHITE', color: 0xf2f2f2, wins: 0 },
  { name: 'NAVY', color: 0x20304a, wins: 0 },
  { name: 'CHARCOAL', color: 0x2b2b2b, wins: 0 },
  { name: 'SAND', color: 0xd9c08f, wins: 0 },
  { name: 'SLATE', color: 0x1f2933, wins: 3 },
  { name: 'FOREST', color: 0x1f6d38, wins: 6 },
  { name: 'BERRY', color: 0x641f2f, wins: 10 },
  { name: 'BLACK', color: 0x101418, wins: 16 }
];

/// A custom colour unlocks once the player has banked its number of career
/// wins — the locked jersey and shorts shades share their marks, so a locked
/// pair arrives together.
export function customColorUnlocked(c) {
  return c.wins <= careerWins();
}

const CUSTOM_KEY = 'beachvolley.customkit';
const CUSTOM_DEFAULT = { jersey: CUSTOM_JERSEYS[0].color, shorts: CUSTOM_SHORTS[1].color };

// One custom kit read back through the guards: colours must come from the
// palette rows, anything else falls to the default pair.
function normCustom(d) {
  d = d && typeof d === 'object' ? d : {};
  const jersey = CUSTOM_JERSEYS.find((c) => c.color === d.jersey)
    ? d.jersey : CUSTOM_DEFAULT.jersey;
  const shorts = CUSTOM_SHORTS.find((c) => c.color === d.shorts)
    ? d.shorts : CUSTOM_DEFAULT.shorts;
  return { jersey, shorts };
}

const customKits = (() => {
  const out = {
    p1: { ...CUSTOM_DEFAULT }, p2: { ...CUSTOM_DEFAULT },
    partner: { ...CUSTOM_DEFAULT }
  };
  try {
    const d = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '{}');
    out.p1 = normCustom(d.p1);
    out.p2 = normCustom(d.p2);
    out.partner = normCustom(d.partner);
  } catch (e) { /* private browsing: the default pair */ }
  return out;
})();

/// The colours this player's custom kit carries.
export function customKitColors(who = 'p1') {
  return customKits[who] || customKits.p1;
}

/// One palette row picks a colour for this player's custom kit.
export function selectCustomColor(slot, color, who = 'p1') {
  const kit = customKits[who];
  if (!kit || (slot !== 'jersey' && slot !== 'shorts')) return;
  const row = slot === 'jersey' ? CUSTOM_JERSEYS : CUSTOM_SHORTS;
  const pick = row.find((c) => c.color === color);
  if (!pick) return;
  kit[slot] = color;
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(customKits)); } catch (e) { /* session-only then */ }
}

/// Points the preset row's CUSTOM swatch at this player: the kit they wear
/// reads back as the one they have painted, and stays theirs.
export function selectCustomKit(who = 'p1') {
  kitIds[who] = 'custom';
  try { localStorage.setItem(KIT_KEYS[who], 'custom'); } catch (e) { /* session-only then */ }
}

// ----- ball skins -----
// The ball's painted design, picked from a row of swatches beside the kit
// swatches on the title screen. The first few are classic designs free from
// the start; the rest unlock as career wins stack up. The choice is
// remembered across sessions like a kit, and repaints the one ball in play
// everywhere it appears — the title preview, the match and the practice
// court. Nothing the CPU owns is dressed in it: the ball is the player's.
export const SKINS = [
  { id: 'classic', name: 'CLASSIC', base: 0xf6f2e7, panels: [0x1d6fd1, 0xf2b21d, 0x1d6fd1], wins: 0 },
  { id: 'shore', name: 'SHORE', base: 0xf2f8f6, panels: [0x17a289, 0x2b6fd6, 0x17a289], wins: 0 },
  { id: 'ember', name: 'EMBER', base: 0xfdf3e0, panels: [0xc44536, 0xe8862c, 0xc44536], wins: 0 },
  { id: 'melon', name: 'MELON', base: 0xfdf0e4, panels: [0x2f9e6e, 0xd8453f, 0x2f9e6e], wins: 3 },
  { id: 'midnight', name: 'MIDNIGHT', base: 0x23262b, panels: [0x7b4bd6, 0x9fd8ff, 0x7b4bd6], wins: 6, dark: true },
  { id: 'gold', name: 'GOLD', base: 0x211d13, panels: [0xd4a017, 0xf2d16b, 0xd4a017], wins: 10, dark: true }
];

const SKIN_KEY = 'beachvolley.ball';

let skinId = loadSkin();

function loadSkin() {
  try {
    const v = localStorage.getItem(SKIN_KEY);
    // 'custom' is the ball designer's own pick, living under the same key.
    if (v && (v === 'custom' || SKINS.some((s) => s.id === v))) return v;
  } catch (e) { /* private browsing: start on the classic */ }
  return SKINS[0].id;
}

/// A skin is unlocked once the player has banked its number of career wins.
export function skinUnlocked(skin) {
  return skin.wins <= careerWins();
}

export function selectSkin(id) {
  // 'custom' is the ball designer's own pick, resolving through the live
  // entry the designer keeps at the row's end.
  if (id !== 'custom' && !SKINS.some((s) => s.id === id)) return;
  skinId = id;
  try { localStorage.setItem(SKIN_KEY, id); } catch (e) { /* session-only then */ }
}

/// The skin the game currently plays with: the row entry whose id is banked —
/// the custom design resolved through its live entry, kept in the row by
/// syncCustomSkin — falling back to the classic when the pick was cleared.
export function selectedSkin() {
  return SKINS.find((s) => s.id === skinId) || SKINS[0];
}

// ----- jersey numbers -----
// A one- or two-digit number typed beside the kit swatches, remembered across
// sessions per player, like the kit itself; an empty field means no number.
const NUMBER_KEYS = {
  p1: 'beachvolley.number',
  p2: 'beachvolley.number2',
  partner: 'beachvolley.numberp'
};

const jerseyNumbers = {
  p1: loadNumber(NUMBER_KEYS.p1),
  p2: loadNumber(NUMBER_KEYS.p2),
  partner: loadNumber(NUMBER_KEYS.partner)
};

function loadNumber(key) {
  try {
    const v = localStorage.getItem(key);
    if (v && /^\d{1,2}$/.test(v)) return v;
  } catch (e) { /* private browsing: start blank */ }
  return '';
}

export function selectNumber(value, who = 'p1') {
  const clean = String(value).replace(/\D/g, '').slice(0, 2);
  jerseyNumbers[who] = clean;
  try { localStorage.setItem(NUMBER_KEYS[who], clean); } catch (e) { /* session-only then */ }
}

export function selectedNumber(who = 'p1') {
  return jerseyNumbers[who];
}

// ----- player names -----
// A one- to ten-letter name typed beside the jersey-number field, read by
// the team sheet, the recap headline, the momentum labels and the title
// tally line wherever YOU or P1 would read. Remembered across sessions per
// player, like the kit and the number; an empty field falls back to YOU —
// or to P2 for the far athlete.
const NAME_KEYS = { p1: 'beachvolley.name', p2: 'beachvolley.name2' };

const playerNames = {
  p1: loadName(NAME_KEYS.p1),
  p2: loadName(NAME_KEYS.p2)
};

function loadName(key) {
  try {
    const v = localStorage.getItem(key);
    if (v && /^[A-Za-z]{1,10}$/.test(v)) return v.toUpperCase();
  } catch (e) { /* private browsing: start blank */ }
  return '';
}

export function selectName(value, who = 'p1') {
  const clean = String(value).replace(/[^a-z]/gi, '').slice(0, 10);
  playerNames[who] = clean.toUpperCase();
  try {
    localStorage.setItem(NAME_KEYS[who], playerNames[who]);
  } catch (e) { /* session-only then */ }
}

/// The stored name as typed — an empty string when none was, for the field
/// itself to show.
export function selectedName(who = 'p1') {
  return playerNames[who];
}

/// The name a side reads by: the typed one, or the plain fallback — YOU for
/// player one, P2 for the far athlete — when the field was left empty.
export function playerName(who = 'p1') {
  return playerNames[who] || (who === 'p2' ? 'P2' : 'YOU');
}

// ----- hairstyles and skin tones -----
// A row beside the kit swatches dresses the athlete's own look: the
// hairstyle dyes unlock as career wins stack up — a few free from the
// start, the rest greyed under their requirement — while the skin-tone
// swatches stay free. Both repaint the athlete's baked texture wherever
// they appear, and each player keeps their own pick, remembered across
// sessions exactly like a kit. The first entry of each row is the roster
// look itself — the athlete exactly as sculpted; the CPU keeps roster
// looks always, and so does the CPU-driven doubles partner.
export const LOOKS = [
  { id: 'roster', name: 'ROSTER', hair: 0x000000, wins: 0 },
  { id: 'onyx', name: 'ONYX', hair: 0x17120c, wins: 0 },
  { id: 'honey', name: 'HONEY', hair: 0xc99a4a, wins: 0 },
  { id: 'ember', name: 'EMBER', hair: 0x9a4a22, wins: 3 },
  { id: 'ash', name: 'ASH', hair: 0xcfd2d6, wins: 6 }
];
export const TONES = [
  { id: 'roster', name: 'ROSTER', skin: 0x000000 },
  { id: 'sun', name: 'SUN-KISSED', skin: 0xf0c9a2 },
  { id: 'sand', name: 'SAND', skin: 0xd9a56f },
  { id: 'tan', name: 'TAN', skin: 0xc0854e },
  { id: 'bronze', name: 'BRONZE', skin: 0x9d6238 },
  { id: 'deep', name: 'DEEP', skin: 0x77462a }
];
// Each pick lives under its own key per player, like the kits. Only the two
// human players have keys: the partner is CPU-driven and keeps the roster.
const LOOK_KEYS = {
  p1: 'beachvolley.look',
  p2: 'beachvolley.look2'
};
const lookIds = {
  p1: loadLook(LOOK_KEYS.p1),
  p2: loadLook(LOOK_KEYS.p2)
};
function loadLook(key) {
  try {
    const v = localStorage.getItem(key);
    if (v && LOOKS.some((l) => l.id === v)) return v;
  } catch (e) { /* private browsing: start on the roster look */ }
  return LOOKS[0].id;
}
/// A hairstyle look unlocks once the player has banked its number of
/// career wins.
export function lookUnlocked(look) {
  return look.wins <= careerWins();
}
export function selectLook(id, who = 'p1') {
  if (!LOOKS.some((l) => l.id === id)) return;
  if (who !== 'p1' && who !== 'p2') return;
  lookIds[who] = id;
  try {
    localStorage.setItem(LOOK_KEYS[who], id);
  } catch (e) { /* session-only then */ }
}
export function selectedLook(who = 'p1') {
  const look = LOOKS.find((l) => l.id === lookIds[who]) || LOOKS[0];
  // A look whose unlock was never banked falls back to the roster look.
  return lookUnlocked(look) ? look : LOOKS[0];
}
const TONE_KEYS = {
  p1: 'beachvolley.tone',
  p2: 'beachvolley.tone2'
};
const toneIds = {
  p1: loadTone(TONE_KEYS.p1),
  p2: loadTone(TONE_KEYS.p2)
};
function loadTone(key) {
  try {
    const v = localStorage.getItem(key);
    if (v && TONES.some((t) => t.id === v)) return v;
  } catch (e) { /* private browsing: start on the roster tone */ }
  return TONES[0].id;
}
export function selectTone(id, who = 'p1') {
  if (!TONES.some((t) => t.id === id)) return;
  if (who !== 'p1' && who !== 'p2') return;
  toneIds[who] = id;
  try {
    localStorage.setItem(TONE_KEYS[who], id);
  } catch (e) { /* session-only then */ }
}
export function selectedTone(who = 'p1') {
  return TONES.find((t) => t.id === toneIds[who]) || TONES[0];
}

/// The colours a player's athlete wears: their own skin and hair, dressed in
/// their chosen kit — shorts fabric with the kit's other colour as the
/// waistband — carrying their typed jersey number and the player name
/// painted above it on the seat of the shorts. Player one dresses the picked
/// character; player two and the doubles partner dress the first roster slot
/// the player did not pick, each in their own remembered kit. The partner
/// carries no name: their jersey reads by kit and number alone.
export function playerColors(who = 'p1') {
  const kit = selectedKit(who);
  const character = who === 'p1' ? selectedCharacter() : p2Character();
  const look = selectedLook(who);
  const tone = selectedTone(who);
  return {
    ...character.colors,
    jersey: kit.jersey,
    shorts: kit.shorts,
    number: jerseyNumbers[who] || '',
    name: playerNames[who] || '',
    // The picked look: a hairstyle dye and a skin tone that repaint the
    // athlete's baked texture — null when the roster look itself is chosen,
    // so the CPU and the doubles partner keep their sculpted shades.
    hairId: look.id,
    toneId: tone.id,
    hair: look.id === 'roster' ? null : look.hair,
    tone: tone.id === 'roster' ? null : tone.skin
  };
}
// ----- the custom ball skin -----
// The ball the player paints themselves: a CUSTOM swatch at the preset row's
// end opens a designer with two colour rows — the leather base and the three
// panel bands, which take one shared shade — each a palette of swatches, a
// few colour pairs locked behind career wins. The custom skin is one ball for
// the whole game: it repaints everywhere a skin does — the title preview, the
// match court, the practice court and the career reel — and is remembered
// across sessions exactly like the presets. The designer itself is free; it
// is the locked colour pairs that earn their way in.
export const CUSTOM_BASES = [
  { name: 'LEATHER', color: 0xf6f2e7, wins: 0 },
  { name: 'PARCHMENT', color: 0xe8dfc8, wins: 0 },
  { name: 'ICE', color: 0xdfe8f0, wins: 0 },
  { name: 'BLUSH', color: 0xf0dcd6, wins: 0 },
  { name: 'SAGE', color: 0xb8c9a6, wins: 3 },
  { name: 'OCEAN', color: 0x2b6fd6, wins: 6 },
  { name: 'MIDNIGHT', color: 0x23262b, wins: 10 },
  { name: 'GOLD', color: 0xd4a017, wins: 16 }
];
export const CUSTOM_PANELS = [
  { name: 'ROYAL', color: 0x1d6fd1, wins: 0 },
  { name: 'EMBER', color: 0xc44536, wins: 0 },
  { name: 'FOREST', color: 0x2f9e6e, wins: 0 },
  { name: 'SUN', color: 0xf2b21d, wins: 0 },
  { name: 'VIOLET', color: 0x7b4bd6, wins: 3 },
  { name: 'MELON', color: 0xd8453f, wins: 6 },
  { name: 'LILAC', color: 0x9fd8ff, wins: 10 },
  { name: 'PALE GOLD', color: 0xf2d16b, wins: 16 }
];

const BALL_CUSTOM_KEY = 'beachvolley.customball';
const BALL_CUSTOM_DEFAULT = { base: CUSTOM_BASES[0].color, panels: CUSTOM_PANELS[0].color };

// One custom ball read back through the guards: colours must come from the
// palette rows, anything else falls to the default pair.
function normCustomBall(d) {
  d = d && typeof d === 'object' ? d : {};
  const base = CUSTOM_BASES.find((c) => c.color === d.base)
    ? d.base : BALL_CUSTOM_DEFAULT.base;
  const panels = CUSTOM_PANELS.find((c) => c.color === d.panels)
    ? d.panels : BALL_CUSTOM_DEFAULT.panels;
  return { base, panels };
}

const customBalls = (() => {
  let out = { ...BALL_CUSTOM_DEFAULT };
  try {
    out = normCustomBall(JSON.parse(localStorage.getItem(BALL_CUSTOM_KEY) || '{}'));
  } catch (e) { /* private browsing: the default pair */ }
  return out;
})();

// The dark flag the presets carry by hand reads off the leather's own
// luminance here: the stitching dots flip pale over a dark base.
const customBallLuminance = () =>
  ((customBalls.base >> 16 & 0xff) * 0.299 +
    ((customBalls.base >> 8) & 0xff) * 0.587 +
    (customBalls.base & 0xff) * 0.114);

// The live entry the custom design keeps in the preset row: selectedSkin
// resolves 'custom' through it, so the painted ball rides every path a preset
// does — the swatch miniatures and the texture painter included.
function syncCustomSkin() {
  const live = {
    id: 'custom', name: 'CUSTOM',
    base: customBalls.base,
    panels: [customBalls.panels, customBalls.panels, customBalls.panels],
    dark: customBallLuminance() < 110,
    wins: 0
  };
  const i = SKINS.findIndex((s) => s.id === 'custom');
  if (i >= 0) SKINS[i] = live;
  else SKINS.push(live);
}
syncCustomSkin();

/// The custom ball's colours: the leather base and the shared panel shade.
export function customBallColors() {
  return customBalls;
}

/// One palette row picks a colour for the custom ball.
export function selectCustomBallColor(slot, color) {
  if (slot !== 'base' && slot !== 'panels') return;
  const row = slot === 'base' ? CUSTOM_BASES : CUSTOM_PANELS;
  const pick = row.find((c) => c.color === color);
  if (!pick) return;
  customBalls[slot] = color;
  try {
    localStorage.setItem(BALL_CUSTOM_KEY, JSON.stringify(customBalls));
  } catch (e) { /* session-only then */ }
  syncCustomSkin();
}

/// Banks the row's CUSTOM swatch as the skin the game plays with.
export function selectCustomBall() {
  syncCustomSkin();
  skinId = 'custom';
  try { localStorage.setItem(SKIN_KEY, 'custom'); } catch (e) { /* session-only then */ }
}