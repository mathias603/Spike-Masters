// Library motion, sampled once at startup. Replaying these recorded poses lets
// a hit start at contact and a replay seek precisely, without procedural elbows.
import * as THREE from 'three';
import { createModel, updateModels } from './models.js';

export const ATHLETE_MODELS = ['mira-athlete', 'rex-athlete', 'bruno-athlete'];
export const CLIPS = ['idle', 'walking', 'running', 'regular-jump', 'over-shoulder-throw', 'right-uppercut-from-guard'];
export const HEIGHT = 1.85;
const library = new Map();
const compact = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function collectBones(model) {
  const bones = [];
  model.traverse((o) => { if (o.isBone) bones.push(o); });
  return bones;
}

// The bones whose hunch reads as a bent body: the spine chain and the neck.
// Their rest rotations are the sculpted straight posture, so easing them back
// toward rest stands an athlete up without touching the limbs — arms, legs
// and the action poses keep their full recorded range.
export function uprightChain(bones) {
  const keys = ['spine', 'chest', 'torso', 'abdomen', 'neck'];
  const chain = [];
  bones.forEach((b, i) => {
    const name = compact(b.name);
    if (keys.some((k) => name.includes(k))) chain.push({ index: i, rest: b.quaternion.clone() });
  });
  return chain;
}

export function findJoint(bones, side, part) {
  const full = side + part;
  return bones.find((b) => compact(b.name).endsWith(full)) ||
    bones.find((b) => compact(b.name).endsWith(part + side[0])) ||
    bones.find((b) => compact(b.name) === side[0] + part) || null;
}

export function packPose(bones, out = new Float32Array(bones.length * 10)) {
  for (let i = 0; i < bones.length; i++) {
    const b = bones[i], k = i * 10;
    b.position.toArray(out, k);
    b.quaternion.toArray(out, k + 3);
    b.scale.toArray(out, k + 7);
  }
  return out;
}

// All interpolation is between captured library poses; no bone is aimed at
// the ball, stretched, or rotated beyond the motion in the original clip.
export function blendPose(bones, a, b, alpha, weight, scratch) {
  for (let i = 0; i < bones.length; i++) {
    const node = bones[i], k = i * 10;
    scratch.p.fromArray(a, k).lerp(scratch.p2.fromArray(b, k), alpha);
    scratch.q.fromArray(a, k + 3).slerp(scratch.q2.fromArray(b, k + 3), alpha);
    scratch.s.fromArray(a, k + 7).lerp(scratch.s2.fromArray(b, k + 7), alpha);
    node.position.lerp(scratch.p, weight);
    node.quaternion.slerp(scratch.q, weight);
    node.scale.lerp(scratch.s, weight);
  }
}

export function motionLibrary(name) { return library.get(name); }

export function sampleMotion(data, id, time, bones, weight, scratch) {
  const clip = data.clips[id];
  if (!clip || weight <= 0) return;
  const t = clip.loop ? ((time % clip.duration) + clip.duration) % clip.duration :
    THREE.MathUtils.clamp(time, 0, clip.duration);
  const f = t / clip.duration * (clip.frames.length - 1);
  const i = Math.min(clip.frames.length - 2, Math.floor(f));
  blendPose(bones, clip.frames[i], clip.frames[i + 1], f - i, weight, scratch);
}

export function prepareAthleteClips() {
  if (library.size) return;
  const stage = new THREE.Scene();
  const p = new THREE.Vector3(), p2 = new THREE.Vector3();
  for (const name of ATHLETE_MODELS) {
    const data = { clips: {}, facing: 0 };
    for (let ci = 0; ci < CLIPS.length; ci++) {
      const id = CLIPS[ci];
      const model = createModel(name, { height: HEIGHT });
      stage.add(model);
      const bones = collectBones(model);
      const hips = bones.find((b) => /hips|pelvis/i.test(b.name)) || bones[0];
      const hipRest = hips ? hips.position.clone() : null;
      const right = findJoint(bones, 'right', 'hand');
      const left = findJoint(bones, 'left', 'hand');
      model.updateMatrixWorld(true);
      if (ci === 0 && right && left) {
        left.getWorldPosition(p);
        right.getWorldPosition(p2);
        p.sub(p2);
        // Right-to-left cross up is the character's forward direction.
        data.facing = -Math.atan2(-p.z, p.x);
      }
      model.rotation.y = data.facing;
      const duration = Math.max(0.05, model.userData.clipDuration(id));
      const count = Math.max(3, Math.min(240, Math.ceil(duration * 30) + 1));
      const loop = ci < 3;
      const clip = { duration, loop, frames: [], contact: 0, palm: new THREE.Vector3(0, 1.4, 0.4) };
      // Looping cycles repeat while sampling; action clips play once and hold.
      model.userData.play(id, { once: ci >= 3 });
      updateModels(0);
      let bestScore = -Infinity;
      for (let frame = 0; frame < count; frame++) {
        if (frame) updateModels(duration / (count - 1));
        // Root translation belongs to arcade movement and gravity, not to
        // the source clip; preserve the connected skeleton's relative joints.
        if (hips) hips.position.copy(hipRest);
        model.updateMatrixWorld(true);
        clip.frames.push(packPose(bones));
        if (ci >= 4 && right) {
          right.getWorldPosition(p);
          const time = frame / (count - 1) * duration;
          // Select a forward-facing open strike, never the hand behind the
          // shoulder during the wind-up. Only this segment is used for hits.
          const score = p.z * 1.6 + (ci === 4 ? p.y * 0.65 : -Math.abs(p.y - 1.3) * 0.4);
          if (p.z > 0.08 && p.y > 0.65 && time < duration * 0.88 && score > bestScore) {
            bestScore = score;
            clip.contact = time;
            clip.palm.copy(p);
          }
        }
      }
      data.clips[id] = clip;
      stage.remove(model);
      updateModels(0); // retire this sampling mixer before the next clip
      const skeletons = new Set();
      model.traverse((o) => { if (o.isSkinnedMesh) skeletons.add(o.skeleton); });
      for (const skeleton of skeletons) skeleton.dispose();
    }
    library.set(name, data);
  }
}
