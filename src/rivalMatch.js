// The rival dossier's one-off match: the opponent the rivals screen wants
// to field, held between the two scenes that hand it over. The dossier's
// PLAY THEM pill stashes the rival here, the match scene picks them up on
// the way in — their body, their signature style where they carry one, the
// plain best-of-three rules around them — and clears the hand-off, so the
// match plays and banks exactly like any other VS CPU match.

let pending = null;

/// The rival to field in the next match, or null when none is waiting.
export function rivalRun() {
  return pending;
}

/// Stashes the rival the dossier's PLAY THEM pill chose.
export function startRivalMatch(opp) {
  pending = opp;
}

/// Consumed once the match scene has taken the rival on board.
export function finishRivalMatch() {
  pending = null;
}