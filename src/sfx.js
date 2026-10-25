// Synthesised sounds — no audio files, just the Web Audio API.
//
// A slap is a burst of filtered noise with a near-instant attack (the "crack"
// of skin on leather) layered over a low sine that drops in pitch (the body of
// the hit). Power scales the loudness and the brightness, so a full-meter
// spike cracks while a soft platform bump only thuds. Alongside the contact
// sounds there is a referee's pea whistle for serves and a swelling crowd
// cheer for points and won matches. The crowd itself is a living bed: a
// murmur loop whose level and character the match reshapes as the rally
// builds, a rhythmic chant layer that rises behind whichever side owns the
// momentum — beating in the rhythm of the name it chants when one is set —
// plus short eruptions for the moments that earn a roar, and a comeback
// sting — a rising run under a swelling chord — for the set stolen back from
// the brink.

import { soundOn } from './settings.js';

let ctx = null;
let noiseBuf = null;

function audio() {
  // The settings switch gates everything: with sound off no effect even
  // reaches the audio graph.
  if (!soundOn()) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function noise(c) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.25), c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/// The meaty part under every contact: a sine that drops in pitch and dies out.
function thump(c, freq, gain, time) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.setValueAtTime(freq, time);
  o.frequency.exponentialRampToValueAtTime(freq * 0.4, time + 0.12);
  g.gain.setValueAtTime(gain, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
  o.connect(g).connect(c.destination);
  o.start(time);
  o.stop(time + 0.16);
}

/// The crack on top: bandpassed noise with a fast attack and short tail.
function crack(c, freq, q, gain, time, dur) {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(time);
  src.stop(time + dur + 0.02);
}

/// A hand slapping the ball. power 0..1 sets how hard the hit lands.
export function playSlap(power = 1) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const p = Math.max(0, Math.min(1, power));
  crack(c, 1400 + 900 * p, 1.2, 0.5 + 0.4 * p, t, 0.05 + 0.03 * p);
  crack(c, 3200 + 1200 * p, 2.5, 0.2 + 0.25 * p, t, 0.03);
  thump(c, 190 + 60 * p, 0.25 + 0.3 * p, t);
}

/// A softer platform bump: rounder, lower, no bright crack on top.
export function playBump(power = 0.6) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  crack(c, 700, 1.5, 0.18 + 0.2 * power, t, 0.06);
  thump(c, 150, 0.18 + 0.25 * power, t);
}

/// Ball on the net tape or mesh: a dull, slightly rattly tap.
export function playNet() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  crack(c, 420, 3, 0.3, t, 0.09);
  thump(c, 110, 0.2, t);
}

/// Ball landing on sand.
export function playFloor() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  crack(c, 260, 1, 0.25, t, 0.1);
  thump(c, 90, 0.3, t);
}


/// A referee's pea whistle for the serve: two close tones beating against
/// each other, chopped by a fast tremolo — the trill the pea makes — over a
/// puff of breath noise.
export function playWhistle(dur = 0.55) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const end = t + dur;

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.3, t + 0.03);
  g.gain.setValueAtTime(0.3, end - 0.07);
  g.gain.exponentialRampToValueAtTime(0.001, end);
  g.connect(c.destination);

  // The pea chops the tone into a trill.
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 37;
  lfoGain.gain.value = 0.14;
  lfo.connect(lfoGain).connect(g.gain);

  // Two close carriers beat against each other — the whistle's edge.
  for (const [f, lvl] of [[2093, 0.5], [2517, 0.32]]) {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const og = c.createGain();
    og.gain.value = lvl;
    o.connect(og).connect(g);
    o.start(t);
    o.stop(end + 0.02);
  }

  // The puff of air underneath.
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1100;
  f.Q.value = 1.2;
  const ng = c.createGain();
  ng.gain.value = 0.08;
  src.connect(f).connect(ng).connect(g);
  src.start(t);
  src.stop(end + 0.02);

  lfo.start(t);
  lfo.stop(end + 0.02);
}

/// A crowd cheering: swelling, bandpassed noise — a low roar with a bright,
/// shouty edge sitting on top — that rises fast and dies away. big stretches
/// it into the long cheer for a won match, and intensity (roughly 0.5 to
/// 1.35) sizes the moment: a fault after one touch barely lifts the crowd,
/// a long battle or a match point brings the full roar, with the shouty
/// edge brightening past full voice.
export function playCheer(big = false, intensity = 1) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const dur = big ? 2.6 : 1.3;
  const i = Math.max(0.4, Math.min(1.6, intensity));

  // The roar.
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(700, t);
  f.frequency.linearRampToValueAtTime(1050, t + dur * 0.25);
  f.frequency.linearRampToValueAtTime(600, t + dur);
  f.Q.value = 0.7;
  const g = c.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime((big ? 0.55 : 0.4) * i, t + dur * 0.2);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
  src.stop(t + dur + 0.05);

  // The bright edge: shouts and clapping over the roar.
  const src2 = c.createBufferSource();
  src2.buffer = noise(c);
  src2.loop = true;
  const f2 = c.createBiquadFilter();
  f2.type = 'bandpass';
  f2.frequency.value = 2700 + 480 * (i - 1);
  f2.Q.value = 2.2;
  const g2 = c.createGain();
  g2.gain.setValueAtTime(0.001, t);
  g2.gain.exponentialRampToValueAtTime((big ? 0.16 : 0.11) * i, t + dur * 0.15);
  g2.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.8);
  src2.connect(f2).connect(g2).connect(c.destination);
  src2.start(t);
  src2.stop(t + dur + 0.05);

  // A swell underneath that lifts the whole cheer off the ground.
  thump(c, 75, (big ? 0.3 : 0.2) * i, t);
}

/// A crowd eruption: a short, sharp roar that swells almost instantly and
/// dies away inside a second or so — the sound of a stadium jumping to its
/// feet for one moment. Layered over the murmur on big spikes and the
/// arrival of match point; power 0..1 sets how big the moment is.
export function crowdErupt(power = 0.7) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const p = Math.max(0, Math.min(1, power));
  const dur = 0.8 + 0.5 * p;

  // The roar: up in a blink, a short hang, then gone.
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(850, t);
  f.frequency.linearRampToValueAtTime(1250, t + dur * 0.3);
  f.frequency.linearRampToValueAtTime(650, t + dur);
  f.Q.value = 0.8;
  const g = c.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(0.22 + 0.3 * p, t + 0.12);
  g.gain.setValueAtTime(0.22 + 0.3 * p, t + dur * 0.45);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
  src.stop(t + dur + 0.05);

  // The bright edge on top: shouts and claps, the more the bigger the moment.
  const src2 = c.createBufferSource();
  src2.buffer = noise(c);
  src2.loop = true;
  const f2 = c.createBiquadFilter();
  f2.type = 'bandpass';
  f2.frequency.value = 2900;
  f2.Q.value = 2;
  const g2 = c.createGain();
  g2.gain.setValueAtTime(0.001, t);
  g2.gain.exponentialRampToValueAtTime(0.05 + 0.12 * p, t + 0.14);
  g2.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.85);
  src2.connect(f2).connect(g2).connect(c.destination);
  src2.start(t);
  src2.stop(t + dur + 0.05);
}

// ---- drama: the heartbeat, the sneakers, the murmur of a waiting crowd ----

/// One heartbeat: a soft lub-dub, felt more than heard — the sound of
/// pressure on the big points.
export function playHeartbeat(intensity = 1) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  thump(c, 58, 0.5 * intensity, t);
  thump(c, 46, 0.38 * intensity, t + 0.28);
}

/// A sneaker squeaking: a fast rubber chirp that sweeps up, grips, and slips
/// back down — what a hard change of direction on court sounds like.
export function playSqueak() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(1500 + Math.random() * 500, t);
  o.frequency.exponentialRampToValueAtTime(2500 + Math.random() * 700, t + 0.06);
  o.frequency.exponentialRampToValueAtTime(1800, t + 0.13);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + 0.16);
}

// The murmur: one permanent loop of softly filtered crowd noise whose level
// and character the match scene sets as the arena warms up, cools down or
// holds its breath. The low roar carries the bed; a brighter, shouty layer
// fades in over it as the crowd gets onto its feet; and on top of both, a
// faint rhythmic chant — a low voice-ish tone chopped into a steady pulse —
// that rises behind whichever side the momentum is running for.
let murmurNodes = null;

/// Sets the crowd murmur: level 0 to about 0.2, and bright 0..1 lifting the
/// excited edge — the low band drifts up and the shout layer fades in over
/// it. chant 0..0.6 is the loudness of the rhythmic chant layer, and tint
/// −1..1 its pitch: positive when the crowd chants for the near side, so a
/// surging player lifts the chant higher while a surging far side drags it
/// lower. rate is the chant's pulse tempo in beats a second — the rhythm of
/// the name the crowd is chanting, back to the steady default when no name
/// is set. Ramps smoothly, so changing the state fades the crowd rather than
/// switching it.
export function murmur(level = 0, bright = 0, chant = 0, tint = 0, rate = 2.4) {
  // With sound off the crowd dies down instead of holding its last level —
  // audio() is gated, but the loop may already be running from before.
  if (!soundOn()) {
    if (murmurNodes && ctx) {
      for (const n of [murmurNodes.g, murmurNodes.g2, murmurNodes.gc]) {
        n.gain.cancelScheduledValues(ctx.currentTime);
        n.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      }
    }
    return;
  }
  const c = audio();
  if (!c) return;
  if (!murmurNodes) {
    const src = c.createBufferSource();
    src.buffer = noise(c);
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 480;
    f.Q.value = 0.5;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(c.destination);
    // The excited edge: a brighter bandpass over the same loop, silent until
    // the rally gives the crowd something to shout about.
    const f2 = c.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.value = 2400;
    f2.Q.value = 1.6;
    const g2 = c.createGain();
    g2.gain.value = 0;
    src.connect(f2).connect(g2).connect(c.destination);
    // The chant: a triangle tone chopped by a slow LFO into a steady
    // heave-ho pulse. Both the base gain and the LFO depth ride the same
    // level, so the pulse swells and dies with the surge and never ticks
    // over when the crowd falls quiet.
    const oc = c.createOscillator();
    oc.type = 'triangle';
    oc.frequency.value = 170;
    const gc = c.createGain();
    gc.gain.value = 0;
    const lfo = c.createOscillator();
    lfo.frequency.value = 2.4;
    const lfoG = c.createGain();
    lfoG.gain.value = 0;
    lfo.connect(lfoG).connect(gc.gain);
    oc.connect(gc).connect(c.destination);
    src.start();
    oc.start();
    lfo.start();
    murmurNodes = { f, g, g2, oc, gc, lfoG, lfo };
  }
  const t = c.currentTime;
  murmurNodes.g.gain.cancelScheduledValues(t);
  murmurNodes.g.gain.setTargetAtTime(level, t, 0.6);
  murmurNodes.f.frequency.cancelScheduledValues(t);
  murmurNodes.f.frequency.setTargetAtTime(480 + 320 * bright, t, 0.5);
  murmurNodes.g2.gain.cancelScheduledValues(t);
  murmurNodes.g2.gain.setTargetAtTime(level * 0.16 * bright, t, 0.45);
  // The chant layer: loudness follows the size of the surge, the pitch tint
  // follows which side the crowd is behind.
  const cl = Math.max(0, Math.min(0.6, chant)) * 0.18;
  murmurNodes.oc.frequency.cancelScheduledValues(t);
  murmurNodes.oc.frequency.setTargetAtTime(
    170 + 55 * Math.max(-1, Math.min(1, tint)), t, 0.5
  );
  murmurNodes.gc.gain.cancelScheduledValues(t);
  murmurNodes.gc.gain.setTargetAtTime(cl, t, 0.5);
  murmurNodes.lfoG.gain.cancelScheduledValues(t);
  murmurNodes.lfoG.gain.setTargetAtTime(cl, t, 0.5);
  // The chant's tempo: the crowd beats the name it is chanting in its own
  // rhythm, gliding between them rather than switching.
  murmurNodes.lfo.frequency.cancelScheduledValues(t);
  murmurNodes.lfo.frequency.setTargetAtTime(rate, t, 0.35);
}

/// The people say a name aloud: the device's own speech voice, pitched up a
/// little and repeated once, the way a crowd calls a player's name across the
/// sand. Used when the arena greets the player, hands them a set or the match.
/// Silent with the sound switch off, and simply does nothing where the web
/// view has no speech engine.
export function speakName(name) {
  if (!soundOn()) return false;
  const text = String(name || '').trim();
  if (!text) return false;
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') return false;
  try {
    // One call at a time: a fresh cheer replaces the last rather than queueing
    // behind it.
    synth.cancel();
    const utter = new window.SpeechSynthesisUtterance(`${text}! ${text}!`);
    utter.rate = 0.92;
    utter.pitch = 1.12;
    utter.volume = 0.85;
    const voice = (synth.getVoices() || []).find((v) => /^en/i.test(v.lang || ''));
    if (voice) utter.voice = voice;
    synth.speak(utter);
    return true;
  } catch (err) {
    return false;
  }
}

/// The booth reads a line aloud in the same voice the arena uses for a name:
/// one spoken sentence, gated by the sound switch and silent where the web
/// view has no speech engine at all.
export function speakLine(text) {
  if (!soundOn()) return false;
  const line = String(text || '').trim();
  if (!line) return false;
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') return false;
  try {
    synth.cancel();
    const utter = new window.SpeechSynthesisUtterance(line);
    utter.rate = 1;
    utter.pitch = 1;
    utter.volume = 0.85;
    const voice = (synth.getVoices() || []).find((v) => /^en/i.test(v.lang || ''));
    if (voice) utter.voice = voice;
    synth.speak(utter);
    return true;
  } catch (err) {
    return false;
  }
}

/// A short victory fanfare: a rising arpeggio that lands on a held chord —
/// the "music explodes" moment the script asks for when the match is won.
export function playFanfare() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const notes = [392, 523.25, 659.25, 783.99];
  notes.forEach((f, i) => {
    const start = t + i * 0.13;
    const last = i === notes.length - 1;
    const end = last ? start + 1.2 : start + 0.13;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
    g.gain.setValueAtTime(0.2, end - 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, end);
    o.connect(g).connect(c.destination);
    o.start(start);
    o.stop(end + 0.02);
    if (last) {
      // The landing note becomes a chord: a fifth and an octave above.
      for (const [mult, vol] of [[1.5, 0.12], [2, 0.08]]) {
        const o2 = c.createOscillator();
        o2.type = 'triangle';
        o2.frequency.value = f * mult;
        const g2 = c.createGain();
        g2.gain.setValueAtTime(0.0001, start);
        g2.gain.exponentialRampToValueAtTime(vol, start + 0.04);
        g2.gain.setValueAtTime(vol, end - 0.06);
        g2.gain.exponentialRampToValueAtTime(0.001, end);
        o2.connect(g2).connect(c.destination);
        o2.start(start);
        o2.stop(end + 0.02);
      }
    }
  });
}
/// The soft whoosh under a replay: bandpassed air that swells, sweeps up and
/// fades — the sound of a broadcast winding the tape back.
export function playWhoosh() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(320, t);
  f.frequency.exponentialRampToValueAtTime(1100, t + 0.9);
  f.frequency.exponentialRampToValueAtTime(420, t + 1.6);
  f.Q.value = 1.1;
  const g = c.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(0.15, t + 0.5);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
  src.stop(t + 1.65);
}
/// The zap of a hard strike flashing over: a quick rising chirp with a puff
/// of noise on top — bright, brief, gone.
export function playZap() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(340, t);
  o.frequency.exponentialRampToValueAtTime(1500, t + 0.16);
  o.frequency.exponentialRampToValueAtTime(500, t + 0.3);
  const g = c.createGain();
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + 0.32);
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 2400;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.09, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  src.connect(f).connect(ng).connect(c.destination);
  src.start(t);
  src.stop(t + 0.24);
}
/// The tie-break sting: two hard minor hits under a rising shimmer, played
/// once when the golden set begins.
export function playSting() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  for (const [f, d, g] of [[196, 0, 0.16], [196, 0.22, 0.16], [233, 0.22, 0.1], [293, 0.22, 0.1]]) {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const og = c.createGain();
    og.gain.setValueAtTime(0.0001, t + d);
    og.gain.exponentialRampToValueAtTime(g, t + d + 0.03);
    og.gain.exponentialRampToValueAtTime(0.001, t + d + 0.7);
    o.connect(og).connect(c.destination);
    o.start(t + d);
    o.stop(t + d + 0.75);
  }
  // A cymbal-ish shimmer of bright noise over the second hit.
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 5000;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.0001, t + 0.2);
  ng.gain.exponentialRampToValueAtTime(0.08, t + 0.25);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
  src.connect(f).connect(ng).connect(c.destination);
  src.start(t + 0.2);
  src.stop(t + 1.05);
}
/// The badge sting: a quick, bright ascending arpeggio — a sparkle of a
/// reward, lighter and shorter than the fanfare, for the moment a milestone
/// badge is earned.
export function playBadgeSting() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const notes = [659.25, 830.61, 987.77, 1318.51];
  notes.forEach((f, i) => {
    const start = t + i * 0.085;
    const last = i === notes.length - 1;
    const end = last ? start + 0.55 : start + 0.09;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(last ? 0.16 : 0.11, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, end);
    o.connect(g).connect(c.destination);
    o.start(start);
    o.stop(end + 0.02);
    if (last) {
      // A bell-like octave overtone on the landing note.
      const o2 = c.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = f * 2;
      const g2 = c.createGain();
      g2.gain.setValueAtTime(0.0001, start);
      g2.gain.exponentialRampToValueAtTime(0.07, start + 0.03);
      g2.gain.exponentialRampToValueAtTime(0.001, end);
      o2.connect(g2).connect(c.destination);
      o2.start(start);
      o2.stop(end + 0.02);
    }
  });
}
/// The comeback sting: a rising major run — four notes climbing the triad,
/// each a little louder — landing on a held chord that swells in underneath,
/// the sound of a set being stolen back from the brink. Played once, the
/// moment a comeback set is taken.
export function playComebackSting() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const notes = [392, 493.88, 587.33, 783.99];
  notes.forEach((f, i) => {
    const start = t + i * 0.11;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.1 + i * 0.03, start + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.55);
    o.connect(g).connect(c.destination);
    o.start(start);
    o.stop(start + 0.6);
  });
  // The landing chord: root, fifth and octave swelling in under the climb.
  for (const [f, lvl] of [[392, 0.1], [587.33, 0.07], [783.99, 0.05]]) {
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t + 0.33);
    g.gain.exponentialRampToValueAtTime(lvl, t + 0.45);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    o.connect(g).connect(c.destination);
    o.start(t + 0.33);
    o.stop(t + 1.15);
  }
}