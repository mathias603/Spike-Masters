// The tournament cup: a three-round run played one set at a time, each round
// against a CPU opponent playing a step harder than the last, on a fresh
// randomly drawn theme. Every round's opponent also plays a signature style
// — a net-hugging blocker, a deep-court defender, a jump-serve ace — that
// biases how the CPU brain moves, jumps and serves on top of its level, and
// the hard tier sharpens every style. The run lives in memory — lose once
// and it is over, win all three rounds and a cup goes onto the career
// record. A run can also be taken at the harder tier, where every round is
// played against an opponent a level stronger still; those cups are counted
// separately. A run can also be taken in doubles — the co-op rules all three
// rounds, the player and their CPU partner facing the round's named opponent
// beside the player's own build in its roster colours, the pairing labelled
// on the bracket — and those cups count on their own tile too.

import { ROSTER, selectedCharacter, athleteUnlocked } from './roster.js';
import { randomTheme } from './themes.js';
import { recordCupWin } from './record.js';

// The levels the three rounds are played at, one step harder each time.
const LEVELS = ['easy', 'normal', 'hard'];

// The signature styles a cup opponent can play. Each biases the CPU brain on
// top of the round's difficulty: where it stands and covers (the T values
// read 0 at its own baseline and 1 at the net), how willingly it launches
// for the block, whether it lobs instead of hitting, how it serves, and
// whether it attacks soft balls outright. The hard tier multiplies the
// willingness biases, so every style leans harder into what it does.
export const STYLES = [
  {
    id: 'blocker',
    name: 'THE WALL',
    tag: 'NET-HUGGING BLOCKER',
    // Lives at the tape: stands and covers close to the net, shades tight
    // for anything net-bound, and goes up early and often for the block.
    homeT: 0.77,
    coverT: 0.8,
    netShadeT: 0.12,
    launchChance: 0.72,
    lobChance: 0,
    serveJump: 0,
    serveHeat: 0,
    secondBall: 0
  },
  {
    id: 'defender',
    name: 'THE BACKLINE',
    tag: 'DEEP-COURT DEFENDER',
    // Lives on the baseline: stands and covers deep, shades late, almost
    // never launches, and lobs nearly everything straight back — no free
    // spikes against it.
    homeT: 0.11,
    coverT: 0.14,
    netShadeT: 0.4,
    launchChance: 0.12,
    lobChance: 0.75,
    serveJump: 0,
    serveHeat: 0,
    secondBall: 0
  },
  {
    id: 'ace',
    name: 'THE ACE',
    tag: 'JUMP-SERVE ACE',
    // Plays from its plain spot but lives on its serve: it always tosses up
    // and strikes flat and hotter than the level alone, and it attacks any
    // soft ball that crosses — a bump, a lob or a float never lands twice.
    homeT: 0.31,
    coverT: 0.31,
    netShadeT: 0.24,
    launchChance: 0.3,
    lobChance: 0,
    serveJump: 1,
    serveHeat: 0.2,
    secondBall: 0.8
  }
];

/// One level up the difficulty ladder, clamped at the top — the hard cup
/// plays every round against an opponent a step stronger than usual.
const stepUp = (id) => LEVELS[Math.min(LEVELS.length - 1, LEVELS.indexOf(id) + 1)];

let run = null;
let trophyPending = false;
let trophyNames = [];
let trophyDoubles = false;

/// Opens a fresh run: the two roster athletes the player did not pick are the
/// first two opponents, a random one of them returns for the final, each
/// round draws a theme different from the one before it, and each round's
/// opponent plays one of the three signature styles, shuffled across the run.
/// A hard run lifts every round one level up the ladder and sharpens every
/// style. A doubles run plays the same three rounds under the co-op rules —
/// the player and their CPU partner against the round's named opponent and
/// the player's own build in its roster colours — with the near partner
/// taking whichever roster slot the round's opponent is not in, so every
/// round's pairing reads differently on the bracket.
export function startCup(hard = false, doubles = false) {
  // The bracket draws from the signed athletes only: the recruit joins the
  // cup pool the moment the career banks her requirement.
  const others = ROSTER.filter((c) => c.id !== selectedCharacter().id &&
    athleteUnlocked(c));
  const themes = [];
  for (let i = 0; i < 3; i++) {
    let t;
    do { t = randomTheme(); } while (i > 0 && t.id === themes[i - 1].id);
    themes.push(t);
  }
  const styles = [...STYLES];
  for (let i = styles.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [styles[i], styles[j]] = [styles[j], styles[i]];
  }
  const opponents = [others[0], others[1], others[(Math.random() * others.length) | 0]]
    .map((o, i) => ({ ...o, style: styles[i] }));
  run = {
    round: 1,
    hard,
    doubles,
    // How hard the tier sharpens each style's willingness biases.
    sharp: hard ? 1.3 : 1,
    opponents,
    themes,
    levels: hard ? LEVELS.map(stepUp) : LEVELS
  };
  if (doubles) {
    // The near partner's body each round: the roster slot the round's
    // opponent is not wearing.
    run.partners = opponents.map((o) =>
      others.find((c) => c.id !== o.id) || others[0]);
  }
  trophyPending = false;
  return run;
}

/// The live run, or null when no cup is under way.
export function cupRun() {
  return run;
}

/// A round won: the bracket moves on.
export function advanceCup() {
  if (run) run.round = Math.min(3, run.round + 1);
}

/// The run is over — knocked out. The bracket is cleared and the title
/// screen opens plain.
export function endCup() {
  run = null;
}

/// All three rounds won: the cup goes onto the career record — a hard run
/// onto the hard-cup count, a doubles run onto its own doubles count — and
/// the trophy screen is queued up for the title scene to raise. A doubles
/// run's trophy lists the round pairings.
export function completeCup() {
  const doubles = run ? !!run.doubles : false;
  trophyNames = run
    ? run.opponents.map((o, i) => doubles && run.partners
      ? `${o.name} & ${run.partners[i].name}` : o.name)
    : [];
  const hard = run ? !!run.hard : false;
  run = null;
  trophyDoubles = doubles;
  trophyPending = true;
  recordCupWin(hard, doubles);
}

/// Whether the trophy just lifted was a doubles run's — the trophy screen
/// reads its own count line by it.
export function cupTrophyDoubles() {
  return trophyDoubles;
}

/// Consumed once by the title scene: true the first time after a cup win.
export function takeTrophy() {
  const t = trophyPending;
  trophyPending = false;
  return t;
}

/// The names of the three opponents beaten on the way to the trophy.
export function cupTrophyNames() {
  return trophyNames;
}
