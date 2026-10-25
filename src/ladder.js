// The season ladder: eight named opponents, one per rung, climbing from easy
// to hard levels, each playing a signature style on top of their level — the
// same three styles the cup rounds draw. Beating the rung you sit on climbs
// one step; a loss slides one back, never below the first. The rank and the
// best-ever rung are remembered on the career record, so the ladder survives
// restarts and can be climbed again in every session. Each rung is one set,
// on a fresh random theme.

import { ROSTER } from './roster.js';
import { STYLES } from './cup.js';
import { randomTheme } from './themes.js';
import { recordLadder, ladderRecord } from './record.js';

// The rank itself is read straight off the career record; it is re-exported
// here so the title screen deals with the ladder alone.
export { ladderRecord } from './record.js';

// The level each rung plays at: three easy, three normal, two hard — the
// climb from warm-up to legend.
const LEVELS = ['easy', 'easy', 'easy', 'normal', 'normal', 'normal', 'hard', 'hard'];

// The ladder itself: each rung names its opponent, dresses one of the roster
// athletes as the body, and hands them a signature style to play.
const SEED = [
  { name: 'RILEY', body: 0, style: 1 },
  { name: 'BEA', body: 1, style: 0 },
  { name: 'SAM', body: 2, style: 2 },
  { name: 'NIA', body: 1, style: 0 },
  { name: 'LO', body: 0, style: 1 },
  { name: 'TARA', body: 2, style: 2 },
  { name: 'TOM', body: 2, style: 0 },
  { name: 'LENA', body: 1, style: 2 }
];

export const LADDER = SEED.map((s, i) => ({
  ...ROSTER[s.body],
  name: s.name,
  rank: i + 1,
  level: LEVELS[i],
  style: STYLES[s.style]
}));

// The rung currently being played, or null when none is.
let match = null;

// Queued once per finished ladder match: the title scene reopens the ladder
// screen on the new rank the first time it runs after the result.
let cardPending = false;

/// Setting up the current rung: the opponent under their ladder name, the
/// level and style the rung carries, and a fresh random theme for the court.
/// One set plays it out.
export function startLadderMatch() {
  const rung = LADDER[ladderRecord().rank - 1];
  match = { rung: rung.rank, opp: { ...rung }, theme: randomTheme() };
  return match;
}

/// The live rung, or null when no ladder match is under way.
export function ladderRun() {
  return match;
}

/// The rung played: the result moves the rank one step — up for a win, down
/// for a loss, never below the first — and the ladder screen is queued to
/// reopen on the title with the new rank showing.
export function finishLadder(won) {
  recordLadder(won);
  match = null;
  cardPending = true;
}

/// Consumed once by the title scene: true the first time after a ladder
/// match, so the screen reopens where the rank now sits.
export function takeLadderCard() {
  const t = cardPending;
  cardPending = false;
  return t;
}
