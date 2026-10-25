// The settings-aware face of the haptic layer. src/haptics.js itself is a
// fixed contract written by the tooling, so the on/off switch lives here: the
// scenes import their haptics from this module and every effect call passes
// the settings gate first. Stopping an effect always passes through, so a
// charge loop that is mid-flight when the switch flips off still ends.

import { haptic as play, hapticUpdate as update, hapticStop as stop, hapticNow as now } from './haptics.js';
import { hapticsOn } from './settings.js';

export function haptic(name, id) {
  if (hapticsOn()) play(name, id);
}

export function hapticUpdate(id, params) {
  if (hapticsOn()) update(id, params);
}

export function hapticStop(id) {
  stop(id);
}

export function hapticNow(effect, id) {
  if (hapticsOn()) now(effect, id);
}
