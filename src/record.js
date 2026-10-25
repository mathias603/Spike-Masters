// The career record: matches won and lost per mode, the current win streak,
// the points scored, the longest rally ever played, the longest rally ever
// kept alive in practice, the career totals of the aces and blocks player
// one has served up, the career count of the big points — set point, match
// point and tie-break — won and lost, the best run of consecutive points
// won on serve, the sets taken after trailing by three or more points —
// the comebacks — the matches that ended with a shot of the match named
// in gold, the gold stars banked for the guided practice drills, the cups
// won in the cup runs — singles, hard and doubles counts kept apart —
// the daily challenge's streak of consecutive wins and its result for each
// day of the past week, the season ladder's current and best rank, the
// legend CPU tier's unlock — banked the moment the ladder's top rung falls —
// the week's three rotating goals and the progress banked toward them, keyed
// by the week's own Monday, a log of the last ten matches played, the career-long heat grids of where the
// shots land — the player's and the far side's — the slow-motion
// recording of the longest rally ever played — with the last two broken
// record rallies kept beside it as the career's reel — and the dates the four
// personal bests — fastest serve, longest rally, survival streak and best
// run on serve — were set, so the bests screen can date them, with the serve
// speed league beneath it — the five fastest serves ever struck, each with
// its date and the kit colours it was struck in. The whole
// thing packs into one compact text code — copied out of the career screen
// and pasted back in elsewhere — all remembered across sessions, backed by
// localStorage, so the numbers outlive the web view.

const KEY = 'beachvolley.record';

// Per mode: the matches that ended in a win or a loss for player one, the
// points player one scored in them, and the longest rally any of them held.
function blankSlot() {
  return { wins: 0, losses: 0, points: 0, bestRally: 0 };
}

// The season ladder's slice of the record: the rung the player sits on and
// the highest one ever reached. Rungs count from one; there are eight.
// Declared ahead of the load below, which reads a saved ladder through them.
const LADDER_RUNGS = 8;

function clampRung(v) {
  const n = Math.round(Number(v) || 1);
  return Math.min(LADDER_RUNGS, Math.max(1, n));
}

// A saved ladder read back: both rungs clamped into range, the best never
// sitting below the rank.
function normLadder(l) {
  const rank = clampRung(l && l.rank);
  return { rank, best: Math.max(rank, clampRung(l && l.best)) };
}

// The weekly goals' slice of the record: the Monday the counters belong to
// and the progress banked toward each goal this week. A stale week reads
// back as a fresh one the first time anything touches it.
function normWeekly(w) {
  w = obj(w);
  return {
    week: str(w.week),
    wins: int(w.wins), aces: int(w.aces), rally: int(w.rally),
    daily: int(w.daily), ladder: int(w.ladder),
    serveRun: Math.max(0, num(w.serveRun))
  };
}

// The shot placement heat grid: six buckets across the far court and six
// deep — thirty-six counts, one per bucket, kept career long. It is stored
// as a flat array; anything shorter, or carrying junk, reads back as zeros.
export const HEAT_COLS = 6;
export const HEAT_ROWS = 6;
const HEAT_N = HEAT_COLS * HEAT_ROWS;

function normHeat(h) {
  const out = new Array(HEAT_N).fill(0);
  if (Array.isArray(h)) {
    for (let i = 0; i < HEAT_N; i++) {
      out[i] = Math.max(0, Math.round(Number(h[i]) || 0));
    }
  }
  return out;
}

// The serve speed league: the five fastest serves ever struck, each with
// the date it was played and the kit colours it was struck in. A saved one
// reads back through the guards, fastest first and trimmed to five.
function normLeague(list) {
  if (!Array.isArray(list)) return [];
  return list.map((e) => ({
    kmh: Math.max(0, num(e && e.kmh)),
    date: str(e && e.date),
    kit: str(e && e.kit)
  })).filter((e) => e.kmh > 0)
    .sort((a, b) => b.kmh - a.kmh)
    .slice(0, 5);
}

// Read-back helpers: a saved record — and a pasted backup code, which can
// carry anything at all — is read defensively. Numbers clamp into range,
// objects fall back to blanks and junk falls away rather than corrupting
// the tally.
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const int = (v) => Math.max(0, Math.round(num(v)));
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
const str = (v) => typeof v === 'string' ? v : '';

// One per-mode slot read back through the guards.
function normSlot(s) {
  s = obj(s);
  return {
    wins: int(s.wins), losses: int(s.losses),
    points: int(s.points), bestRally: int(s.bestRally)
  };
}

// A whole record read back, every field through its guard. Both the
// localStorage load and a pasted backup code come through here, so neither
// can leave a malformed value behind.
function normTally(d) {
  d = obj(d);
  const dd = obj(d.daily);
  return {
    cpu: { ...blankSlot(), ...normSlot(d.cpu) },
    two: { ...blankSlot(), ...normSlot(d.two) },
    doubles: { ...blankSlot(), ...normSlot(d.doubles) },
    streak: int(d.streak),
    cups: int(d.cups),
    hardCups: int(d.hardCups),
    doublesCups: int(d.doublesCups),
    topServe: Math.max(0, num(d.topServe)),
    topTouch: Math.max(0, num(d.topTouch)),
    bestStreak: int(d.bestStreak),
    aces: int(d.aces),
    blocks: int(d.blocks),
    clutchWon: int(d.clutchWon),
    clutchLost: int(d.clutchLost),
    bestServeRun: int(d.bestServeRun),
    comebacks: int(d.comebacks),
    shotsOfMatch: int(d.shotsOfMatch),
    topServeDate: str(d.topServeDate),
    bestStreakDate: str(d.bestStreakDate),
    bestServeRunDate: str(d.bestServeRunDate),
    bestRallyDate: str(d.bestRallyDate),
    badges: obj(d.badges),
    titleDays: obj(d.titleDays),
    athleteSeen: !!d.athleteSeen,
    drills: obj(d.drills),
    daily: { date: str(dd.date), won: !!dd.won, streak: int(dd.streak) },
    dailyDays: obj(d.dailyDays),
    ladder: normLadder(d.ladder),
    legend: !!d.legend,
    legendSeen: !!d.legendSeen,
    log: Array.isArray(d.log) ? d.log.slice(0, 10).map(obj) : [],
    heat: normHeat(d.heat),
    heatRival: normHeat(d.heatRival),
    serveLeague: normLeague(d.serveLeague),
    weekly: normWeekly(d.weekly)
  };
}

// A record from nothing — the shape every load and restore lands on.
function blankTally() {
  return { cpu: blankSlot(), two: blankSlot(), doubles: blankSlot(), streak: 0, cups: 0, hardCups: 0, doublesCups: 0, topServe: 0, topTouch: 0, bestStreak: 0, aces: 0, blocks: 0, clutchWon: 0, clutchLost: 0, bestServeRun: 0, comebacks: 0, shotsOfMatch: 0, badges: {}, titleDays: {}, athleteSeen: false, drills: {}, daily: { date: '', won: false, streak: 0 }, dailyDays: {}, ladder: { rank: 1, best: 1 }, legend: false, legendSeen: false, weekly: { week: '', wins: 0, aces: 0, rally: 0, daily: 0, ladder: 0, serveRun: 0 }, log: [], heat: normHeat(null), heatRival: normHeat(null), serveLeague: [], topServeDate: '', bestStreakDate: '', bestServeRunDate: '', bestRallyDate: '' };
}

let tally = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normTally(JSON.parse(raw));
  } catch (e) { /* private mode or a broken save: start from zero */ }
  return blankTally();
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(tally)); } catch (e) { /* ignore */ }
}

/// Called once, the moment a match ends. modeId is 'cpu' or '2p';
/// playerOneWon says whether player one took the match, pointsForOne is the
/// points player one scored across the whole match, bestRally the longest
/// rally of it, in touches, acesForOne and blocksForOne the aces and blocks
/// player one served up in it, clutchWon and clutchLost the big points —
/// set point, match point and tie-break — player one won and lost in it,
/// and bestServeRun the longest run of consecutive points won on serve the
/// match held, either side, comebacks the sets in it taken after trailing
/// by three or more points, and shotOfMatch whether the match ended with a
/// standout moment — a shot of the match — named in gold. All of it banks
/// as career totals. Returns the ids of any milestone badges
/// earned for the first time by this match, so the caller can celebrate them.
export function recordMatch(modeId, playerOneWon, pointsForOne = 0, bestRally = 0, acesForOne = 0, blocksForOne = 0, clutchWon = 0, clutchLost = 0, bestServeRun = 0, comebacks = 0, shotOfMatch = 0) {
  if (modeId !== 'cpu' && modeId !== '2p' && modeId !== 'doubles') return [];
  const slot = tally[modeId];
  if (playerOneWon) {
    slot.wins++;
    tally.streak++;
  } else {
    slot.losses++;
    tally.streak = 0;
  }
  // Milestones off the win column: the first career win, then the tenth.
  const earned = [];
  const winsNow = tally.cpu.wins + tally.two.wins + tally.doubles.wins;
  if (playerOneWon) {
    if (winsNow >= 1 && recordMilestone('firstWin')) earned.push('firstWin');
    if (winsNow >= 10 && recordMilestone('tenWins')) earned.push('tenWins');
  }
  // The season review's title ladder reads the date each step was reached:
  // stamped here the moment the banked win carries the career onto a new
  // title — ROOKIE the day the first match lands at all, the climbs the day
  // the win that got there was banked. A career older than the stamping
  // keeps its earlier steps undated, shown quietly without one.
  if (!tally.titleDays.rookie) tally.titleDays.rookie = dateKey();
  const titleNow = titleForWins(winsNow).id;
  const titleBefore = titleForWins(Math.max(0, winsNow - (playerOneWon ? 1 : 0))).id;
  if (titleNow !== titleBefore && !tally.titleDays[titleNow]) {
    tally.titleDays[titleNow] = dateKey();
  }
  slot.points += Math.max(0, Math.round(pointsForOne));
  // The rally best is dated only when it lifts the career-wide mark — an
  // improvement inside one mode that doesn't take the overall record is
  // banked quietly, without moving the date.
  if (bestRally > slot.bestRally) {
    const prevBest = Math.max(tally.cpu.bestRally, tally.two.bestRally, tally.doubles.bestRally);
    slot.bestRally = bestRally;
    if (bestRally > prevBest) tally.bestRallyDate = dateKey();
  }
  tally.aces += Math.max(0, Math.round(acesForOne));
  tally.blocks += Math.max(0, Math.round(blocksForOne));
  tally.clutchWon += Math.max(0, Math.round(clutchWon));
  tally.clutchLost += Math.max(0, Math.round(clutchLost));
  if (bestServeRun > (tally.bestServeRun || 0)) {
    tally.bestServeRun = Math.round(bestServeRun);
    tally.bestServeRunDate = dateKey();
  }
  tally.comebacks += Math.max(0, Math.round(comebacks));
  tally.shotsOfMatch += shotOfMatch ? 1 : 0;
  save();
  return earned;
}

/// The tally line for the title screen: "WINS 4 · LOSSES 2" for the mode
/// that is picked.
export function tallyLine(modeId) {
  const slot = modeId === '2p' ? tally.two
    : modeId === 'doubles' ? tally.doubles : tally.cpu;
  return `WINS ${slot.wins} · LOSSES ${slot.losses}`;
}

/// Total career wins across both modes — the currency the unlockable jersey
/// kits are measured against.
export function careerWins() {
  return tally.cpu.wins + tally.two.wins + tally.doubles.wins;
}

/// Total career losses across both modes — the counter the recap's coaching
/// tip rotates on, so a run of defeats is taught something new each time
/// rather than the same line over and over.
export function careerLosses() {
  return tally.cpu.losses + tally.two.losses + tally.doubles.losses;
}

// The career player titles, banked by total wins: what each is called and
// how many wins it takes to hold it. ROOKIE is held from a career's first
// serve; the climbs come at ten, twenty-five and fifty.
export const TITLES = [
  { id: 'rookie', name: 'ROOKIE', wins: 0 },
  { id: 'challenger', name: 'CHALLENGER', wins: 10 },
  { id: 'pro', name: 'PRO', wins: 25 },
  { id: 'legend', name: 'LEGEND', wins: 50 }
];

/// The title a given number of career wins holds — the highest one met.
export function titleForWins(wins) {
  let title = TITLES[0];
  for (const t of TITLES) {
    if (wins >= t.wins) title = t;
  }
  return title;
}

/// The title the player currently holds, read off the remembered win totals —
/// so it is remembered with the rest of the record, with nothing extra to
/// store, and survives restarts exactly as the wins do.
export function playerTitle() {
  return titleForWins(careerWins());
}

/// The season review's title ladder: the four titles in order, whether the
/// career's win column has carried the player onto each, and the date each
/// was reached — stamped as the record banked the win that got there. A
/// step banked before the record began keeping dates reads back undated.
export function titleSteps() {
  const wins = careerWins();
  return TITLES.map((t) => ({
    ...t,
    reached: wins >= t.wins,
    date: tally.titleDays[t.id] || ''
  }));
}

/// A cup run taken all the way: the trophy count on the career record. A run
/// at the harder tier counts separately, as a hard cup; a run taken in the
/// co-op doubles rules counts on its own, as a doubles cup — whichever tier
/// it was won at.
export function recordCupWin(isHard = false, isDoubles = false) {
  if (isDoubles) tally.doublesCups++;
  else if (isHard) tally.hardCups++;
  else tally.cups++;
  // The awards night dates the cup count by the day its last cup was won.
  tally.cupsLastDate = dateKey();
  save();
}

/// A ladder rung played: a win climbs one rung, a loss slides one back —
/// never below the first, never past the last. The best-ever mark rides
/// along, and everything is remembered with the record.
export function recordLadder(won) {
  const l = tally.ladder;
  // A win at the top rung is the rung's beating: it unlocks the legend tier
  // above hard, remembered with the record from here on.
  const wonTop = won && l.rank >= LADDER_RUNGS;
  l.rank = clampRung(l.rank + (won ? 1 : -1));
  if (l.rank > l.best) l.best = l.rank;
  if (wonTop) tally.legend = true;
  // A rung climbed banks toward the weekly ladder goal, queued for the
  // title screen the same way the daily's is.
  if (won && recordWeeklyStat('ladder')) goalQueue.push('ladder');
  save();
  return l;
}

/// The ladder's remembered rank and best-ever rung.
export function ladderRecord() {
  return tally.ladder;
}

/// The legend tier's unlock: the ladder's top rung has been beaten, and the
/// level above hard shows on the picker.
export function legendUnlocked() {
  return !!tally.legend;
}

/// Consumed once, ever: true the first time the title runs after the top
/// rung fell, so the unlock toasts exactly once and never again.
export function takeLegendToast() {
  if (!tally.legend || tally.legendSeen) return false;
  tally.legendSeen = true;
  save();
  return true;
}

/// The fourth roster slot's unlock announcement: a gold toast on the title
/// screen the first time it runs while the career stands past the recruit's
/// requirement — the match that banked the crossing toasts her in play
/// itself and consumes this quietly, while a record restored past the mark
/// gets its announcement here. The caller passes whether the roster
/// currently has such an announcement pending.
export function takeAthleteToast(pending) {
  if (!pending || tally.athleteSeen) return false;
  tally.athleteSeen = true;
  save();
  return true;
}

/// The radar gun's all-time best: the fastest serve ever struck, in km/h,
/// remembered across sessions — and the league it sits atop: the five
/// fastest serves ever struck, each banked with the date it was played and
/// the kit colours it was struck in. The return says where the serve lands
/// in that league — 1 for a new career best, 2 to 5 for one that makes the
/// top five, 0 when it misses — so the caller can name the moment.
export function recordServe(kmh, kit = '') {
  if (kmh <= 0) return 0;
  const rank = kmh > tally.topServe ? 1
    : tally.serveLeague.filter((e) => e.kmh >= kmh).length + 1;
  if (kmh > tally.topServe) {
    tally.topServe = kmh;
    tally.topServeDate = dateKey();
  }
  if (rank <= 5) {
    tally.serveLeague.splice(rank - 1, 0, { kmh, date: dateKey(), kit });
    if (tally.serveLeague.length > 5) tally.serveLeague.length = 5;
  }
  save();
  return rank <= 5 ? rank : 0;
}

/// The league itself, fastest first, for the bests screen.
export function serveLeague() {
  return tally.serveLeague;
}

/// Practice survival: the longest rally ever kept alive against the CPU, in
/// touches, remembered across sessions. Returns true when this rally set a
/// new best, so the caller can flag the moment.
export function recordStreak(touches) {
  if (touches <= tally.bestStreak) return false;
  tally.bestStreak = touches;
  tally.bestStreakDate = dateKey();
  save();
  return true;
}

/// The pace readout's all-time best: the fastest rally touch ever struck, in
/// km/h, remembered across sessions like the fastest serve is. Returns true
/// when this touch set a new best, so the caller can flag the moment.
export function recordTouch(kmh) {
  if (kmh <= tally.topTouch) return false;
  tally.topTouch = kmh;
  save();
  return true;
}

// The record rally's slow-motion recording lives under its own key, kept out
// of the main tally so the frequent small saves never re-stringify a few
// hundred kilobytes of stored frames.
const REC_KEY = 'beachvolley.rallyrec';

let rallyRec = loadRallyRec();

function loadRallyRec() {
  try {
    const raw = localStorage.getItem(REC_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.frames) || d.frames.length < 2) return null;
    return d;
  } catch (e) { return null; }
}

/// The longest rally ever played, kept as its own slow-motion recording: a
/// rally longer than the stored one replaces it — and the rally it displaced
/// joins the reel of broken records kept beside it — and the career screen
/// reads both back for its REPLAY and REEL pills. rec carries the closing
/// frames of the rally plus both athletes' colours, so the playback dresses
/// them as they played. Returns true when this rally set the record.
export function recordRallyReplay(touches, rec) {
  const n = Math.round(touches);
  if (!rec || !Array.isArray(rec.frames) || rec.frames.length < 2 || n < 1) return false;
  if (rallyRec && n <= rallyRec.touches) return false;
  // The record has just changed hands: the rally that held it joins the reel
  // as the moment of its beating — the newest broken record at the front,
  // the last two kept — and the new record saves with its own date.
  if (rallyRec) {
    reelList.unshift({
      touches: rallyRec.touches, frames: rallyRec.frames,
      pc: rallyRec.pc, cc: rallyRec.cc, date: rallyRec.date || ''
    });
    if (reelList.length > 2) reelList.length = 2;
    saveRallyReel();
  }
  rallyRec = { touches: n, frames: rec.frames, pc: rec.pc, cc: rec.cc, date: dateKey() };
  try { localStorage.setItem(REC_KEY, JSON.stringify(rallyRec)); } catch (e) { /* private mode */ }
  return true;
}

/// The stored record rally — its touch count, its frames and both athletes'
/// colours — or null while the record is empty.
export function rallyReplay() {
  return rallyRec;
}

// The reel of record rallies lives under its own key beside the recording:
// the last two records broken on the way up — each the rally that held the
// record until a longer one landed — kept with the date each was played, and
// only rewritten the rare moment a record changes hands.
const REEL_KEY = 'beachvolley.rallyreel';

let reelList = loadRallyReel();

// One reel entry read back through the guards: a touch count, the stored
// frames, both athletes' colours and the date when the record keeps one.
function normReelEntry(d) {
  const e = obj(d);
  return Array.isArray(e.frames) && e.frames.length >= 2 && int(e.touches) >= 1
    ? {
        touches: int(e.touches), frames: e.frames,
        pc: obj(e.pc), cc: obj(e.cc), date: str(e.date)
      }
    : null;
}

function loadRallyReel() {
  try {
    const raw = localStorage.getItem(REEL_KEY);
    if (!raw) return [];
    const d = JSON.parse(raw);
    if (!Array.isArray(d)) return [];
    return d.map(normReelEntry).filter(Boolean).slice(0, 2);
  } catch (e) { return []; }
}

function saveRallyReel() {
  try { localStorage.setItem(REEL_KEY, JSON.stringify(reelList)); }
  catch (e) { /* private mode */ }
}

/// The reel itself: the last two record rallies as they were broken, newest
/// first, each with its own touch count and date. The standing record rally
/// plays with them — the career screen's reel is that rally followed by the
/// records that led to it.
export function rallyReel() {
  return reelList;
}

/// The guided practice drills: one gold star per drill passed, remembered
/// forever — the ladder can be replayed as often as liked, but the star is
/// earned once. Returns true only the first time a drill is passed.
export function recordDrillStar(id) {
  if (tally.drills[id]) return false;
  tally.drills[id] = true;
  save();
  return true;
}

/// How many of the four drills have stars banked, for the career screen.
export function drillStars() {
  return Object.values(tally.drills).filter(Boolean).length;
}

/// Append a finished match to the log the moment it ends: the mode it was
/// played in, the opponent, the set scores, the result and the date — newest
/// first, the last ten kept.
export function recordMatchLog(entry) {
  tally.log.unshift({ ...entry });
  if (tally.log.length > 10) tally.log.length = 10;
  save();
}

/// The match log, newest first, for the career screen.
export function matchLog() {
  return tally.log;
}

/// One rival's scouting read off the match log: their head-to-head record
/// against the player, the run of like results counting back from the most
/// recent meeting, and the aces and spikes they have landed across those
/// meetings — everything the pre-match team sheet's scouting row reads.
/// Null for an opponent the log has never heard of.
export function rivalScout(opp) {
  const name = String(opp || '').toUpperCase();
  const meets = tally.log.filter((e) => e.opp === name);
  if (!meets.length) return null;
  let streak = 0;
  for (const e of meets) {
    if (streak && e.won !== meets[0].won) break;
    streak++;
  }
  return {
    played: meets.length,
    wins: meets.filter((e) => e.won).length,
    losses: meets.filter((e) => !e.won).length,
    streak,
    last: meets[0],
    aces: meets.reduce((a, e) => a + int(e.aces), 0),
    spikes: meets.reduce((a, e) => a + int(e.spikes), 0)
  };
}

/// Today's local date as a stable key — the daily challenge is seeded from
/// it, and its result is banked against it.
export function dateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/// The daily challenge's slice of the record: today's date, whether it has
/// been played and how, and the streak of consecutive daily wins.
export function dailyRecord() {
  return tally.daily;
}

/// A daily result, banked once a day: a win extends the streak when
/// yesterday was also won and starts a fresh streak otherwise; a loss ends
/// the streak and the day shows as beaten until tomorrow. The result also
/// lands in the per-date store the week strip reads, with the streak
/// recomputed from it — so the line and the strip can never drift apart.
export function recordDailyResult(date, won) {
  tally.dailyDays[date] = won ? 'won' : 'lost';
  pruneDailyDays(tally.dailyDays);
  tally.daily = {
    date,
    won,
    streak: won ? walkDailyStreak(tally.dailyDays, date) : 0
  };
  // The weekly goals read the day's result too: a daily win banks toward
  // the daily goal, queued for the title screen — the match flow has
  // already handed over to it by the time this runs.
  if (won && recordWeeklyStat('daily')) goalQueue.push('daily');
  save();
}

/// The daily results by date — 'won' or 'lost' — the week strip on the
/// challenge card is drawn from.
export function dailyDays() {
  return tally.dailyDays;
}

// The streak of consecutive won days ending at the given date: a lost day or
// an unplayed one ends the run. Recomputed from the per-date store rather
// than counted along the way, so it survives restarts with no bookkeeping.
function walkDailyStreak(days, date) {
  const day = new Date(`${date}T12:00:00`);
  let streak = 0;
  while (days[dateKey(day)] === 'won') {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

// The per-date store keeps a fortnight — more than the week strip needs —
// and anything older is dropped, so the record stays small.
function pruneDailyDays(days) {
  const cut = new Date();
  cut.setDate(cut.getDate() - 14);
  const cutoff = dateKey(cut);
  for (const key of Object.keys(days)) {
    if (key < cutoff) delete days[key];
  }
}

// The four career milestone badges, in the order the career screen shows
// them: what each is called and what it takes to earn it.
export const BADGES = [
  { id: 'firstWin', name: 'FIRST WIN', req: 'WIN A MATCH' },
  { id: 'tenWins', name: 'TEN WINS', req: 'WIN 10 MATCHES' },
  { id: 'rally10', name: 'RALLY 10', req: 'RALLY OF 10 TOUCHES' },
  { id: 'tiebreak', name: 'GOLD SET', req: 'WIN A TIE-BREAK' }
];

/// A milestone, banked the moment it is met. Earned once, remembered forever;
/// returns true only the first time, so a caller can celebrate the moment.
export function recordMilestone(id) {
  if (tally.badges[id]) return false;
  tally.badges[id] = true;
  save();
  return true;
}

/// Which milestones have been earned: a map of badge ids to true.
export function earnedBadges() {
  return tally.badges;
}

// ---------------------------------------------------------- weekly goals

// The weekly goals' pool: more than a week plays, so the three on the card
// have something to rotate through. The first three are the trio the card
// opens its life with.
export const WEEKLY_POOL = [
  { id: 'wins', name: 'WIN 3 MATCHES', target: 3, unit: 'MATCHES' },
  { id: 'aces', name: 'LAND 5 ACES', target: 5, unit: 'ACES' },
  { id: 'rally', name: 'KEEP A 12-TOUCH RALLY', target: 12, unit: 'TOUCHES', best: true },
  { id: 'daily', name: 'WIN THE DAILY CHALLENGE', target: 1, unit: 'DAILY WIN' },
  { id: 'ladder', name: 'CLIMB 2 LADDER RUNGS', target: 2, unit: 'RUNGS' },
  { id: 'serveRun', name: 'WIN 5 STRAIGHT ON SERVE', target: 5, unit: 'POINTS', best: true }
];

// The weekly goals' completion queue: a goal crossing its target while no
// match is on screen to toast it — a daily win, a ladder rung — waits here
// for the title screen, which toasts each once on arrival.
let goalQueue = [];

/// The week's own key: the Monday the running week started on, local time.
/// Everything weekly is keyed by it, so every counter starts from zero the
/// moment a new week arrives.
function mondayKey(d = new Date()) {
  const m = new Date(d);
  m.setHours(12, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return dateKey(m);
}

// How many weeks have passed since the pool's epoch Monday — the number the
// rotation reads, so the same week always draws the same three goals.
function weekOffset() {
  const epoch = Date.parse('2024-01-01T12:00:00');
  const mon = Date.parse(`${mondayKey()}T12:00:00`);
  return Math.floor((mon - epoch) / (7 * 86400000));
}

// The week's counters, keyed to the running week: a new Monday resets them.
function ensureWeek() {
  const wk = mondayKey();
  if (tally.weekly.week !== wk) {
    tally.weekly = {
      week: wk, wins: 0, aces: 0, rally: 0,
      daily: 0, ladder: 0, serveRun: 0
    };
  }
}

/// The three goals this week plays, drawn from the pool by the week's own
/// Monday — the window steps one slot along the pool each Monday, so all
/// three change together and no week repeats the last one's trio.
export function weeklyGoals() {
  const n = WEEKLY_POOL.length;
  const o = ((weekOffset() % n) + n) % n;
  return [0, 1, 2].map((i) => WEEKLY_POOL[(o + i) % n]);
}

/// A weekly goal's counter pushed: how much this week has banked toward it.
/// Returns true the moment the push carries the goal past its target for
/// the first time this week, so the caller can celebrate the completion.
export function recordWeeklyStat(id, add = 1) {
  const goal = WEEKLY_POOL.find((g) => g.id === id);
  if (!goal || goal.best) return false;
  ensureWeek();
  const w = tally.weekly;
  const before = w[id] >= goal.target;
  w[id] += Math.max(0, Math.round(add));
  save();
  return !before && w[id] >= goal.target;
}

/// The best-type weekly goal: only a bigger value moves the needle — a
/// longer rally, a longer serve run — and the return says when the week's
/// best first reached the target.
export function recordWeeklyBest(id, value) {
  const goal = WEEKLY_POOL.find((g) => g.id === id);
  if (!goal || !goal.best) return false;
  const v = Math.max(0, Math.round(num(value)));
  if (v <= 0) return false;
  ensureWeek();
  const w = tally.weekly;
  const before = w[id] >= goal.target;
  if (v > w[id]) w[id] = v;
  save();
  return !before && w[id] >= goal.target;
}

/// The week's three goals with their progress read off the record: the
/// count banked, the target, and whether the week has already got there —
/// a completed goal stays ticked for the rest of the week.
export function weeklyProgress() {
  ensureWeek();
  return weeklyGoals().map((g) => ({
    ...g,
    value: tally.weekly[g.id],
    done: tally.weekly[g.id] >= g.target
  }));
}

/// The week-of Monday the card's grey line reads, as its date key.
export function weeklyWeekOf() {
  return mondayKey();
}

/// A weekly goal's name by id — the completion toast reads it.
export function weeklyGoalName(id) {
  const g = WEEKLY_POOL.find((x) => x.id === id);
  return g ? g.name : '';
}

/// The weekly goals completed since the last take — consumed once, so each
/// completion is celebrated exactly once.
export function takeGoalCompletions() {
  const out = goalQueue;
  goalQueue = [];
  return out;
}

/// The whole career picture for the stats screen: matches played overall,
/// the win-loss record per mode, the live win streak, the points scored, the
/// longest rally ever played — overall and within doubles alone — the
/// longest survival streak in practice, the career totals of aces and
/// blocks, the big points — set point, match point and tie-break — won
/// and lost across every session, and the best run of consecutive points
/// won on serve ever strung together, the comeback sets — taken from
/// three or more points down — banked across every session, and the
/// matches that ended with a shot of the match counted.
export function careerStats() {
  const s = tally.cpu;
  const t = tally.two;
  const d = tally.doubles;
  return {
    played: s.wins + s.losses + t.wins + t.losses + d.wins + d.losses,
    cpu: `${s.wins} – ${s.losses}`,
    two: `${t.wins} – ${t.losses}`,
    doubles: `${d.wins} – ${d.losses}`,
    streak: tally.streak,
    points: s.points + t.points + d.points,
    bestRally: Math.max(s.bestRally, t.bestRally, d.bestRally),
    bestDoublesRally: d.bestRally,
    topServe: Math.round(tally.topServe),
    topTouch: Math.round(tally.topTouch),
    cups: tally.cups,
    hardCups: tally.hardCups,
    doublesCups: tally.doublesCups,
    bestStreak: tally.bestStreak,
    aces: tally.aces,
    blocks: tally.blocks,
    clutchWon: tally.clutchWon,
    clutchLost: tally.clutchLost,
    bestServeRun: tally.bestServeRun || 0,
    comebacks: tally.comebacks || 0,
    shotsOfMatch: tally.shotsOfMatch || 0,
    drillStars: drillStars(),
    heatShots: tally.heat.reduce((a, b) => a + b, 0),
    dailyStreak: tally.daily.streak,
    ladder: tally.ladder.rank,
    bestLadder: tally.ladder.best,
    title: playerTitle().name
  };
}

/// The personal bests the career's BESTS screen lists: the fastest serve
/// ever struck, the longest rally ever played, the longest practice rally
/// ever kept alive and the best run of consecutive points won on serve —
/// each with the date it was set, or an empty date when it was banked
/// before the record began keeping them, so the screen shows it quietly
/// without one.
export function personalBests() {
  const bestRally = Math.max(
    tally.cpu.bestRally, tally.two.bestRally, tally.doubles.bestRally
  );
  return [
    {
      label: 'FASTEST SERVE',
      value: tally.topServe ? `${Math.round(tally.topServe)} KM/H` : '—',
      date: tally.topServeDate || ''
    },
    {
      label: 'LONGEST RALLY',
      value: bestRally ? `${bestRally} TOUCHES` : '—',
      date: tally.bestRallyDate || ''
    },
    {
      label: 'BEST SURVIVAL STREAK',
      value: tally.bestStreak ? `${tally.bestStreak} TOUCHES` : '—',
      date: tally.bestStreakDate || ''
    },
    {
      label: 'BEST RUN ON SERVE',
      value: tally.bestServeRun ? `${tally.bestServeRun} POINTS` : '—',
      date: tally.bestServeRunDate || ''
    }
  ];
}

/// The three awards the season awards night presents, read off the record:
/// the fastest serve, the longest rally ever played and the career cup count
/// — each with the date it was set where one is kept, and whether it has been
/// earned at all, so the ceremony can light the earned ones gold.
export function seasonAwards() {
  const bests = personalBests();
  const longest = Math.max(
    tally.cpu.bestRally, tally.two.bestRally, tally.doubles.bestRally
  );
  const cups = tally.cups + tally.hardCups + tally.doublesCups;
  return [
    {
      label: 'FASTEST SERVE',
      value: bests[0].value,
      date: bests[0].date,
      earned: tally.topServe > 0
    },
    {
      label: 'LONGEST RALLY',
      value: bests[1].value,
      date: bests[1].date,
      earned: longest > 0
    },
    {
      label: 'CUP COUNT',
      value: `${cups}`,
      date: tally.cupsLastDate || '',
      earned: cups > 0
    }
  ];
}

/// The date the awards night was last claimed, or '' on a first visit.
export function awardsClaimed() {
  return tally.awardsSeen || '';
}

/// The ceremony marks itself claimed: the card remembers the day it opened.
export function markAwardsClaimed() {
  tally.awardsSeen = dateKey();
  save();
}

/// A finished match's heat grid banked into the career-long one: the counts
/// add in bucket by bucket, saved only when something actually landed.
export function recordHeatShots(buckets) {
  let added = 0;
  for (let i = 0; i < HEAT_N; i++) {
    const n = Math.max(0, Math.round(Number(buckets && buckets[i]) || 0));
    if (n > 0) {
      tally.heat[i] += n;
      added += n;
    }
  }
  if (added) save();
}

/// The career heat grid, copied — a fresh array, so a caller cannot wear out
/// the record's own counts.
export function heatMap() {
  return tally.heat.slice();
}

/// The far side's match grid banked the same way: their placements on the
/// near court add in bucket by bucket beside the player's own.
export function recordRivalHeatShots(buckets) {
  let added = 0;
  for (let i = 0; i < HEAT_N; i++) {
    const n = Math.max(0, Math.round(Number(buckets && buckets[i]) || 0));
    if (n > 0) {
      tally.heatRival[i] += n;
      added += n;
    }
  }
  if (added) save();
}

/// The rival heat grid, copied like the player's.
export function heatRivalMap() {
  return tally.heatRival.slice();
}

// ------------------------------------------------------------ backup code

// The backup code's wrapper: a version tag the restore checks before it
// tries anything else.
const CODE_PREFIX = 'VB1.';

// UTF-8-safe base64, URL-safe — + and / become - and _ and the padding goes,
// so the code survives a trip through any paste target intact.
function b64encode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64decode(code) {
  let b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/// The whole saved record as one compact text code: the tallies, the badges,
/// the bests with their dates, the daily results, the ladder, the match log,
/// the heat grids, the record rally's own recording and the reel of broken
/// records beside it — JSON-packed and base64-wrapped under the version tag.
/// restoreCode reads it back.
export function backupCode() {
  return CODE_PREFIX + b64encode(JSON.stringify({ v: 1, t: tally, r: rallyRec, e: reelList }));
}

/// A pasted code read back into the record: anything malformed — the wrong
/// tag, a body that will not decode or parse, the wrong shape — returns
/// false and leaves the save untouched rather than corrupting it. A good one
/// replaces the record wholesale, the rally recording and its reel of broken
/// records riding along when they came through intact, and saves it,
/// returning true so the caller can say so.
export function restoreCode(code) {
  try {
    const text = String(code || '').trim();
    if (!text.startsWith(CODE_PREFIX)) return false;
    const d = JSON.parse(b64decode(text.slice(CODE_PREFIX.length)));
    if (!d || d.v !== 1 || typeof d.t !== 'object' || !d.t) return false;
    tally = normTally(d.t);
    save();
    const r = obj(d.r);
    rallyRec = Array.isArray(r.frames) && r.frames.length >= 2 ? r : null;
    reelList = Array.isArray(d.e)
      ? d.e.map(normReelEntry).filter(Boolean).slice(0, 2)
      : [];
    try {
      localStorage.setItem(REC_KEY, JSON.stringify(rallyRec));
      localStorage.setItem(REEL_KEY, JSON.stringify(reelList));
    } catch (e) { /* private mode */ }
    return true;
  } catch (e) { return false; }
}