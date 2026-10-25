// The session's series: the title screen's SERIES toggle turns plain VS CPU
// play into a best-of-three of full matches. Unlike the career record this is
// deliberately session state — the score and the toggle live in memory, so a
// fresh session starts clean — while inside a session the standing score
// carries across every match, whoever lost the last one serving the next.
// Any match stays single while the toggle is off.

let series = null;

/// Whether the series is on: matches started while it is play as its rounds.
export function seriesActive() {
  return !!series;
}

/// The toggle: on, it opens a fresh series at 0–0; off, it closes whatever
/// series was running, and the next match is a single again.
export function setSeriesOn(on) {
  series = on ? { wins: 0, losses: 0, lastLoser: null, matchNo: 0 } : null;
}

/// The running score, read for the pill and the cards.
export function seriesScore() {
  return series
    ? { wins: series.wins, losses: series.losses }
    : null;
}

/// Which side serves a fresh match: whoever lost the previous one — null
/// before the series has played a match, when the player serves as always.
export function seriesNextServer() {
  return series ? series.lastLoser : null;
}

/// The number of the series match being played: 1 for its first.
export function seriesMatchNo() {
  return series ? series.matchNo + 1 : 1;
}

/// A series match decided: the score moves, the loser is remembered for the
/// next serve, and the moment either side reaches two the series is settled —
/// the store is cleared, so the next match is single unless the toggle is
/// thrown again. Returns { res, wins, losses }: res 'won' when the player
/// took the series, 'lost' when the CPU did, null while it runs on.
export function recordSeriesMatch(won) {
  if (!series) return { res: null, wins: 0, losses: 0 };
  if (won) series.wins++;
  else series.losses++;
  series.matchNo++;
  series.lastLoser = won ? 'cpu' : 'player';
  const res = series.wins >= 2 ? 'won' : series.losses >= 2 ? 'lost' : null;
  const out = { res, wins: series.wins, losses: series.losses };
  if (res) series = null;
  return out;
}
