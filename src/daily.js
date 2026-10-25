// The daily challenge: one seeded match a day, the same for as long as the
// date stays the same. The seed is computed from the calendar day, so the
// opponent and their signature style, the difficulty, the court theme and
// the wind are all fixed until midnight — one attempt banks its result for
// the day, a win lights the day's tile gold and extends the streak of
// consecutive daily wins kept on the career record, and a loss leaves the
// opponent standing there until tomorrow.

import { ROSTER, selectedCharacter, DIFFICULTIES, athleteUnlocked } from './roster.js';
import { THEMES } from './themes.js';
import { STYLES } from './cup.js';
import { dateKey, dailyRecord, recordDailyResult } from './record.js';

// How hard the breeze blows per difficulty — the same table the match scene
// scales its random winds with, so the seeded daily wind behaves exactly
// like any other match's.
const WIND_SCALE = { easy: 0.38, normal: 0.6, hard: 0.9 };

// FNV-1a: a short, stable hash of the date string.
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32: a tiny seeded generator — the same seed draws the same day,
// no matter how many times the card is opened.
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let run = null;
let cardPending = false;

/// Today's challenge, computed fresh from the date: the opponent drawn from
/// the roster athletes the player did not pick, playing one of the signature
/// styles; a difficulty, a court theme and a wind, all from the same seed.
/// The record says whether the day has been played and how it went.
export function dailyChallenge() {
  const date = dateKey();
  const rng = mulberry32(hash(date));
  // The opponent draws from the signed athletes the player did not pick —
  // the recruit joins the day's pool the moment the career banks her
  // requirement, while a locked recruit leaves every seeded draw as it
  // always was.
  const others = ROSTER.filter((c) => c.id !== selectedCharacter().id &&
    athleteUnlocked(c));
  const opp = { ...others[(rng() * others.length) | 0] };
  opp.style = STYLES[(rng() * STYLES.length) | 0];
  const diff = DIFFICULTIES[(rng() * DIFFICULTIES.length) | 0];
  const theme = THEMES[(rng() * THEMES.length) | 0];
  const ang = (rng() < 0.5 ? 0 : Math.PI) + (rng() - 0.5) * 1.3;
  // The indoor arena has no weather at all: a day drawn under a roof plays
  // in still air, whatever the level would have blown.
  const strength = theme.id === 'indoor'
    ? 0
    : (0.55 + rng() * 0.5) * WIND_SCALE[diff.id];
  const wind = {
    x: Math.cos(ang),
    z: Math.sin(ang),
    strength
  };
  const rec = dailyRecord();
  const played = rec.date === date;
  return {
    date, opp, diff, theme, wind,
    played,
    won: played ? rec.won : false,
    streak: rec.streak
  };
}

/// The challenge is taken up: today's draw becomes the match under way.
export function startDaily() {
  run = dailyChallenge();
  return run;
}

/// The live daily match, or null when none is under way.
export function dailyRun() {
  return run;
}

/// The result banks for the day — a win extends the streak, a loss ends it —
/// and the title scene is told to reopen the daily card over the court, so
/// the day's tile shows what happened.
export function finishDaily(won) {
  if (!run) return;
  recordDailyResult(run.date, won);
  run = null;
  cardPending = true;
}

/// Consumed once by the title scene: true right after a daily was played,
/// so it can raise the card again instead of the plain title.
export function takeDailyCard() {
  const t = cardPending;
  cardPending = false;
  return t;
}
