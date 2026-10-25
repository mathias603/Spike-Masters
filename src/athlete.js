// Connected, skinned human players. Every body motion is a fitted library
// animation; there is no free-rotating shoulder or backward elbow solver.
import * as THREE from 'three';
import { createModel } from './models.js';
import { HEIGHT, collectBones, uprightChain, motionLibrary, sampleMotion, blendPose, packPose } from './athleteClips.js';
import { fitUniform, repaintAppearance } from './athleteWardrobe.js';

const clamp = THREE.MathUtils.clamp;
// Roster base kits. For the shirtless pair the jersey colour no longer shows
// on the body — the board shorts carry the kit — but its hue still keys the
// bare-chest conversion; Mira wears hers as a beach top.
// Roster base kits, plus the skin and hair shade each sculpt is baked in —
// the gate hues the look repaint keys off (they match the roster's own).
const BASE = {
  'mira-athlete': { jersey: 0x17a289, shorts: 0xf2f2f2, skin: 0xd9a06b, hair: 0x1f1a14 },
  'rex-athlete': { jersey: 0x2b6fd6, shorts: 0xf2f2f2, skin: 0xe0b088, hair: 0x5a3b1e },
  'bruno-athlete': { jersey: 0xc44536, shorts: 0x20304a, skin: 0x8c5a33, hair: 0x14100c }
};
// The fourth athlete's body is the female roster sculpt: her own look rides
// on top of it — the roster colours paint her kit, and her hair and skin
// arrive as the default look targets below — while everything that reads the
// baked texture (the kit classifier's seeding hues, the look repaint's
// own-shade detection) reads the sculpt she stands on.
const BODIES = { 'nova-athlete': 'mira-athlete' };
// Nova's own shades, mirrored from her roster entry: her hair and skin ride
// in as the default look targets when no pick covers them, so the borrowed
// sculpt reads as her.
const NOVA_LOOK = { hair: 0x6e2a18, skin: 0xf0c8a0 };
const OVER = 'over-shoulder-throw';
const DIG = 'right-uppercut-from-guard';
const modelFor = (colors) => colors.skin === 0xd9a06b ? 'mira-athlete' : colors.skin === 0x8c5a33 ? 'bruno-athlete' : colors.skin === 0xf0c8a0 ? 'nova-athlete' : 'rex-athlete';
// How hard each base motion is pulled back toward the sculpted straight
// posture. Standing tall comes closest to rest; running and jumping keep a
// little of their natural forward drive.
const UPRIGHT = { idle: 0.72, walking: 0.55, running: 0.32, 'regular-jump': 0.3 };

export function createAthlete(colors) {
  const name = modelFor(colors);
  const rig = BODIES[name] || name;
  const group = new THREE.Group();
  const visual = createModel(rig, { height: HEIGHT });
  // The clips are sampled with contact-phase control, so the live mixer is
  // intentionally stopped. The scene still retires unused model mixers.
  visual.userData.play(null);
  const library = motionLibrary(rig);
  const materials = new Map();
  visual.traverse((o) => {
    if (!o.isMesh) return;
    o.userData.sharedGeometry = true;
    o.castShadow = true;
    o.frustumCulled = false;
    const finish = (source) => {
      if (materials.has(source)) return materials.get(source);
      const mat = source.clone();
      // Photographic skin finish: a low-roughness, sunlit surface with a real
      // sky reflection, like a sports photograph. Colours stay untouched.
      mat.roughness = 0.42;
      mat.metalness = 0;
      mat.envMapIntensity = 0.95;
      mat.userData.sharedTextures = true;
      materials.set(source, mat);
      return mat;
    };
    o.material = Array.isArray(o.material) ? o.material.map(finish) : finish(o.material);
  });
  // Nova arrives with her own hair and skin: her roster shades ride in as
  // the default look targets whenever no pick covers them, so the borrowed
  // sculpt reads as her — and any dye or tone the player chooses paints
  // over the same gates.
  if (BODIES[name]) {
    if (!colors.hair) {
      colors = { ...colors, hair: NOVA_LOOK.hair, hairId: 'nova-hair' };
    }
    if (!colors.tone) {
      colors = { ...colors, tone: NOVA_LOOK.skin, toneId: 'nova-tone' };
    }
  }
  // The athlete's own look first: the hairstyle and skin tone picks repaint
  // the baked body before the kit decides anything, so the bare-chest
  // conversion and the kit classifier both read the toned body. The gates
  // read the sculpt the body stands on.
  repaintAppearance(visual, BASE[rig], colors);
  fitUniform(visual, colors, BASE[rig], colors.number || '', library.facing, colors.name || '');
  // Dives tip the whole body forward, so pitch has to apply after the facing yaw.
  visual.rotation.order = 'YXZ';
  visual.rotation.y = library.facing;
  group.add(visual);
  const bones = collectBones(visual);
  const upright = uprightChain(bones);
  group.userData = {
    visual, bones, library, upright,
    cur: { handWeight: 0 }, tgt: { handWeight: 0 }, bob: 0,
    clock: 0, move: 0, airT: 0, wasAir: false,
    reach: 0, reachTime: 0, reachClip: DIG, baseClip: 'idle', baseTime: 0,
    swing: null, turn: 0, alignment: new THREE.Vector3(),
    lastPose: packPose(bones), transition: 1,
    scratch: {
      p: new THREE.Vector3(), p2: new THREE.Vector3(), s: new THREE.Vector3(), s2: new THREE.Vector3(),
      q: new THREE.Quaternion(), q2: new THREE.Quaternion(),
      local: new THREE.Vector3(), palm: new THREE.Vector3(), target: new THREE.Vector3()
    }
  };
  applyPose(group);
  return group;
}

function strikeClip(a, worldBall) {
  const d = a.userData;
  const p = d.scratch.local.copy(worldBall);
  a.updateWorldMatrix(true, false);
  a.worldToLocal(p);
  // Jumping athletes meet a high ball at chest height, so the overhead throw
  // reads as the spike; grounded players take the same ball with the dig.
  const threshold = a.position.y > 0.25 ? 1.15 : 1.7;
  return p.y > threshold ? OVER : DIG;
}

export function canStrikeBall(a, worldBall) {
  const d = a.userData;
  const id = strikeClip(a, worldBall);
  const p = d.scratch.local;
  // A strike belongs in front of the chest, not behind the athlete's back.
  if (p.z < 0.02 || p.y < 0.35 || d.swing) return false;
  const palm = d.library.clips[id].palm;
  // The 20 cm ball meets the actual library hand: the strike only lands when
  // the ball centre sits within palm reach of the contact frame's hand. No
  // limb is ever extended through the torso to rescue an unreachable ball.
  const dx = p.x - palm.x;
  const dy = p.y - palm.y;
  const dz = p.z - palm.z;
  return dx * dx + dy * dy + dz * dz < 0.64 * 0.64;
}

export function triggerSwing(a, type = 'spike', worldBall = null) {
  const d = a.userData;
  const id = worldBall ? strikeClip(a, worldBall) : (type === 'bump' ? DIG : OVER);
  const clip = d.library.clips[id];
  d.swing = { id, t: 0, duration: type === 'tip' ? 0.44 : 0.55 };
  d.reach = 0;
  d.turn = 0;
  d.alignment.set(0, 0, 0);
  if (worldBall) {
    // A small planted step shifts the whole connected body toward contact;
    // the wrist and shoulder remain in their original anatomical relationship.
    const p = d.scratch.local;
    d.alignment.set(p.x - clip.palm.x, 0, p.z - clip.palm.z - 0.18);
    const length = d.alignment.length();
    if (length > 0.22) d.alignment.multiplyScalar(0.22 / length);
  }
  applyPose(a); // contact pose now, never a new backswing after ball launch
}

export function resetAthlete(a) {
  const d = a.userData;
  d.swing = null;
  d.reach = 0;
  d.turn = 0;
  d.alignment.set(0, 0, 0);
  d.cur.handWeight = d.tgt.handWeight = 0;
}

/// The dive lean: the whole visual tips forward into a full-length dive and
/// rises back out of it, around the athlete's facing. The bones stay in their
/// library poses; only the body's pitch changes.
export function setDiveLean(a, lean) {
  a.userData.visual.rotation.x = -lean * 1.15;
}

export function updateAthlete(a, dt, { speed = 0, airborne = false, reach = false, dir = null, ballPosition = null } = {}) {
  const d = a.userData;
  d.clock += dt;
  d.move += (speed - d.move) * (1 - Math.exp(-dt * 9));
  d.airT = airborne ? (d.wasAir ? d.airT + dt : 0) : 0;
  d.wasAir = airborne;
  // The gait changes with hysteresis — a pace hovering on a threshold would
  // otherwise flick between walk and run every frame — and the cycle's phase
  // carries across the change, so switching never snaps the stride back to its
  // first frame.
  const wasRunning = d.baseClip === 'running';
  const wasWalking = d.baseClip === 'walking';
  const base = airborne ? 'regular-jump'
    : d.move > (wasRunning ? 0.34 : 0.46) ? 'running'
    : d.move > (wasWalking ? 0.05 : 0.1) ? 'walking' : 'idle';
  if (base !== d.baseClip) {
    packPose(d.bones, d.lastPose);
    const prev = d.library.clips[d.baseClip];
    const next = d.library.clips[base];
    const phase = prev && next && prev.loop && next.loop && prev.duration > 0
      ? (d.baseTime % prev.duration) / prev.duration
      : 0;
    d.baseClip = base;
    d.baseTime = next && next.loop ? phase * next.duration : 0;
    d.transition = 0;
  }
  // The cycle's pace eases between gaits too, so a walk that becomes a run
  // does not step its stride rate in one frame.
  const rate = base === 'running' ? 0.75 + d.move * 0.65
    : base === 'walking' ? 0.65 + d.move * 1.5 : 1;
  const was = d.rate ?? 1;
  d.rate = was + (rate - was) * Math.min(1, dt * 6);
  d.baseTime += dt * d.rate;
  d.transition = Math.min(1, d.transition + dt / 0.16);
  if (d.swing) {
    d.swing.t += dt;
    if (d.swing.t >= d.swing.duration) {
      packPose(d.bones, d.lastPose);
      d.transition = 0;
      d.swing = null;
    }
  }
  let tracking = 0;
  if (!d.swing && reach && ballPosition) {
    const id = strikeClip(a, ballPosition);
    const p = d.scratch.local;
    const clip = d.library.clips[id];
    const distance = p.distanceTo(clip.palm);
    if (p.z > 0.02 && distance < 1.5) {
      tracking = clamp((1.5 - distance) / 0.85, 0, 1);
      d.reachClip = id;
      // Use only the last forward part of preparation, not a hand wound far
      // behind the head. The free arm follows the recorded balancing motion.
      d.reachTime = Math.max(0, clip.contact - (1 - tracking) * 0.1);
    }
  }
  d.reach += (tracking - d.reach) * (1 - Math.exp(-dt * 16));
  d.cur.handWeight = d.reach;
  d.tgt.handWeight = tracking;
  let turn = 0;
  if (dir && d.move > 0.1 && !reach && !d.swing && !airborne) {
    const sn = Math.sin(a.rotation.y), cs = Math.cos(a.rotation.y);
    const x = dir.x * cs - dir.z * sn;
    const z = dir.x * sn + dir.z * cs;
    turn = clamp(Math.atan2(x, Math.max(0.4, z)), -0.65, 0.65);
  }
  d.turn += (turn - d.turn) * (1 - Math.exp(-dt * 10));
  if (!d.swing) d.alignment.multiplyScalar(Math.exp(-dt * 12));
  applyPose(a);
}

// Used both live and by the match's recorded-pose replay. All joints remain
// connected by the generated skin weights, including during interpolation.
export function applyPose(a, recordedA = null, recordedB = null, alpha = 0) {
  const d = a.userData;
  if (recordedA) {
    const b = recordedB || recordedA;
    blendPose(d.bones, recordedA.bones, b.bones, alpha, 1, d.scratch);
    d.visual.position.fromArray(recordedA.offset).lerp(d.scratch.p.fromArray(b.offset), alpha);
    d.visual.rotation.y = THREE.MathUtils.lerp(recordedA.yaw, b.yaw, alpha);
    return;
  }
  sampleMotion(d.library, d.baseClip, d.baseTime, d.bones, 1, d.scratch);
  // Straighten the body: the spine chain eases back toward the sculpted
  // straight posture while the base motion plays, so standing, walking and
  // running read tall instead of hunched. Swings, digs and reaches are
  // sampled after this and still own their poses at full weight.
  const uprightW = UPRIGHT[d.baseClip];
  if (uprightW) {
    for (let i = 0; i < d.upright.length; i++) {
      const u = d.upright[i];
      d.bones[u.index].quaternion.slerp(d.scratch.q2.copy(u.rest), uprightW);
    }
  }
  if (d.transition < 1) blendPose(d.bones, d.lastPose, d.lastPose, 0, 1 - d.transition, d.scratch);
  if (d.swing) {
    const s = d.swing, clip = d.library.clips[s.id];
    const phase = clamp((s.t - 0.028) / (s.duration - 0.028), 0, 1);
    const end = Math.min(clip.duration, clip.contact + 0.75);
    const time = THREE.MathUtils.lerp(clip.contact, end, phase);
    const weight = 1 - THREE.MathUtils.smoothstep(phase, 0.68, 1);
    sampleMotion(d.library, s.id, time, d.bones, weight, d.scratch);
    d.visual.position.copy(d.alignment).multiplyScalar(1 - phase);
  } else {
    sampleMotion(d.library, d.reachClip, d.reachTime, d.bones, d.reach, d.scratch);
    d.visual.position.copy(d.alignment);
  }
  d.visual.rotation.y = d.library.facing + d.turn;
}

export function captureAthletePose(a) {
  const d = a.userData;
  return { bones: packPose(d.bones), offset: d.visual.position.toArray(), yaw: d.visual.rotation.y };
}
