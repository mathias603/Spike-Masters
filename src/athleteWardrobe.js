// A separate fitted uniform layer keeps the existing earned kit colours.
// The generated body's skin, hair and face stay untouched — with one beach
// change done right here: the male athletes' baked jerseys become bare,
// sun-tanned skin, and the rest of the body — arms, legs, hands, shorts —
// keeps exactly what was sculpted. The jersey is found twice over, so
// nothing else can be caught: geometrically, the uv footprint of the
// triangles across the chest, and by colour, texels sitting near the baked
// jersey's own hue and away from the athlete's skin. The garment's mean
// shade maps onto the skin's, so the chest reads as tanned muscle, never as
// a dark patch. What is left to dress is the board shorts: the kit's shorts
// colour is the fabric, and the player's name and number are painted on the
// seat.
import * as THREE from 'three';
import { HEIGHT } from './athleteClips.js';

// The athletes who play shirtless. Their baked jersey texels become skin at
// dress time; the rest of the roster keeps the top it was sculpted with.
const SHIRTLESS = new Set(['rex-athlete', 'bruno-athlete']);

function fabric(color, paint = null) {
  // A garment that carries a number or a name is drawn at four times the
  // resolution so the digits and letters stay crisp; plain fabric keeps the
  // small tile.
  const S = paint ? 512 : 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const g = canvas.getContext('2d');
  g.fillStyle = '#' + color.toString(16).padStart(6, '0');
  g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgba(255,255,255,0.055)';
  for (let x = 0; x < S; x += S / 32) g.fillRect(x, 0, 1, S);
  g.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y = 0; y < S; y += S / 32) g.fillRect(0, y, S, 1);
  if (paint) paint(g);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

/// The seat of the shorts: the white number centred in the region the
/// back-facing triangles cover, sized to it, with a faint dark edge so it
/// also reads on pale kits — and, above it, the player's name in small white
/// letters. Either can be missing: a number with no name paints alone, a
/// name with no number takes the panel itself, and neither leaves the back
/// blank.
function paintNumber(box, number, name = '') {
  return (g) => {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const size = number
      ? Math.max(12, Math.min(box.h * 0.5, (box.w * 0.85) / (0.62 * number.length)))
      : 0;
    if (number) {
      g.font = `800 ${size}px -apple-system, 'Helvetica Neue', Arial, sans-serif`;
      g.lineWidth = Math.max(1.5, size * 0.09);
      g.strokeStyle = 'rgba(20, 20, 20, 0.4)';
      g.strokeText(number, box.cx, box.cy);
      g.fillStyle = '#ffffff';
      g.fillText(number, box.cx, box.cy);
    }
    if (name) {
      // Small letters, fitted to the same panel, sitting clear above the
      // number when there is one.
      const nsize = Math.max(7, Math.min(box.h * 0.2, (box.w * 0.82) / (0.6 * name.length)));
      const y = number ? box.cy - size * 0.5 - nsize * 0.62 : box.cy;
      g.font = `800 ${nsize}px -apple-system, 'Helvetica Neue', Arial, sans-serif`;
      g.lineWidth = Math.max(0.8, nsize * 0.08);
      g.strokeStyle = 'rgba(20, 20, 20, 0.4)';
      g.strokeText(name, box.cx, y);
      g.fillStyle = '#ffffff';
      g.fillText(name, box.cx, y);
    }
  };
}

function hue(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  if (delta < 0.0001) return 0;
  const h = max === r ? (g - b) / delta : max === g ? 2 + (b - r) / delta : 4 + (r - g) / delta;
  return ((h / 6) + 1) % 1;
}

// ----- the shirtless conversion -----

const lumaOf = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

// Converted torso textures, cached per source texture: every copy of an
// athlete — player, CPU, reflection, title preview — shares one bare-chested
// version of their body.
const bareCache = new Map();

/// The jersey's uv footprint: every triangle with at least two corners in
/// the chest band of the model-space body — the same band the kit classifier
/// has always used — rasterised into texture space. Bounding the conversion
/// by geometry first is what keeps the cap, the shades, the face and the
/// legs out of reach.
// The band test is a parameter: the chest band finds the baked jersey for the
// shirtless conversion, and the head band — everything above the shoulders'
// line in the bind pose — confines the hairstyle repaint to the hair.
function garmentMask(mesh, inv, W, H, flipY, bandTest) {
  const uvA = mesh.geometry.getAttribute('uv');
  const pos = mesh.geometry.attributes.position;
  const index = mesh.geometry.index;
  if (!uvA || !pos) return null;
  const n = pos.count;
  const test = bandTest || ((v) => {
    const y = v.y / HEIGHT;
    return y > 0.48 && y < 0.83 && Math.abs(v.x) < 0.22;
  });
  const inBand = new Uint8Array(n);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    mesh.getVertexPosition(i, v);
    v.applyMatrix4(mesh.matrixWorld).applyMatrix4(inv);
    inBand[i] = test(v) ? 1 : 0;
  }
  const mask = new Uint8Array(W * H);
  const triCount = (index ? index.count : n) / 3;
  for (let t = 0; t < triCount; t++) {
    const a = index ? index.getX(t * 3) : t * 3;
    const b = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const c = index ? index.getX(t * 3 + 2) : t * 3 + 2;
    if (inBand[a] + inBand[b] + inBand[c] < 2) continue;
    const u0 = uvA.getX(a) * W, t0 = (flipY ? 1 - uvA.getY(a) : uvA.getY(a)) * H;
    const u1 = uvA.getX(b) * W, t1 = (flipY ? 1 - uvA.getY(b) : uvA.getY(b)) * H;
    const u2 = uvA.getX(c) * W, t2 = (flipY ? 1 - uvA.getY(c) : uvA.getY(c)) * H;
    const area = (u1 - u0) * (t2 - t0) - (u2 - u0) * (t1 - t0);
    if (Math.abs(area) < 1e-6) continue;
    const minX = Math.max(0, Math.floor(Math.min(u0, u1, u2)) - 1);
    const maxX = Math.min(W - 1, Math.ceil(Math.max(u0, u1, u2)) + 1);
    const minY = Math.max(0, Math.floor(Math.min(t0, t1, t2)) - 1);
    const maxY = Math.min(H - 1, Math.ceil(Math.max(t0, t1, t2)) + 1);
    for (let py = minY; py <= maxY; py++) {
      for (let xi = minX; xi <= maxX; xi++) {
        const cx = xi + 0.5, cy = py + 0.5;
        const w0 = ((u1 - cx) * (t2 - cy) - (u2 - cx) * (t1 - cy)) / area;
        const w1 = ((u2 - cx) * (t0 - cy) - (u0 - cx) * (t2 - cy)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 >= -0.03 && w1 >= -0.03 && w2 >= -0.03) mask[py * W + xi] = 1;
      }
    }
  }
  let filled = 0;
  for (let i = 0; i < mask.length; i++) filled += mask[i];
  return filled > W * H * 0.002 ? mask : null;
}

/// Repaints the jersey footprint as the athlete's own skin. Only texels that
/// are both inside the footprint and hue-matched to the baked jersey convert
/// — the double gate. That is what keeps a navy pair of shorts sitting in
/// the same band of the body, and the skin's own shading, out of the
/// conversion, so the body stays whole: arms, legs, hands and shorts exactly
/// as sculpted. The jersey's mean luminance maps onto the skin's, and each
/// texel keeps its shading relative to that mean, so the sculpt's folds read
/// as muscle definition. Returns true when something actually converted.
function repaintAsSkin(data, W, H, mask, jersey, skin) {
  const px = data.data;
  const sr = (skin >> 16) & 255, sg = (skin >> 8) & 255, sb = skin & 255;
  // The same brightness cap the look repaint uses: a pale skin shade must
  // saturate at its own full brightness, never bleach past white.
  const skinCap = 255 / Math.max(sr, sg, sb, 1);
  const sh = hue(sr, sg, sb);
  const sl = lumaOf(sr, sg, sb);
  const jh = hue((jersey >> 16) & 255, (jersey >> 8) & 255, jersey & 255);
  // Seed the fabric: saturated texels in the footprint whose hue sits near
  // the baked jersey's and away from this athlete's skin.
  const garment = new Uint8Array(W * H);
  let count = 0;
  for (let i = 0, k = 0; i < W * H; i++, k += 4) {
    if (!mask[i]) continue;
    const r = px[k], g = px[k + 1], b = px[k + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max ? (max - min) / max : 0;
    if (sat < 0.15) continue;
    const h = hue(r, g, b);
    const gapT = Math.min(Math.abs(h - jh), 1 - Math.abs(h - jh));
    const gapS = Math.min(Math.abs(h - sh), 1 - Math.abs(h - sh));
    if (gapT < 0.16 && gapT < gapS + 0.02) { garment[i] = 1; count++; }
  }
  if (count < W * H * 0.002) return false;
  // Pale or near-neutral trim woven into the garment converts too — a texel
  // joins when most of its neighbours already have, so the spread stops at
  // the garment's own edge and never reaches skin or other uv islands.
  for (let pass = 0; pass < 3; pass++) {
    const spread = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!mask[i] || garment[i]) continue;
        const k = i * 4;
        const max = Math.max(px[k], px[k + 1], px[k + 2]);
        const min = Math.min(px[k], px[k + 1], px[k + 2]);
        if (max && (max - min) / max > 0.18) continue;
        let near = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dy && !dx) continue;
          const ny = y + dy, nx = x + dx;
          if (ny < 0 || ny >= H || nx < 0 || nx >= W) continue;
          near += garment[ny * W + nx];
        }
        if (near >= 5) spread.push(i);
      }
    }
    if (!spread.length) break;
    for (const i of spread) { garment[i] = 1; count++; }
  }
  // Anchor on the garment fabric's own mean luminance — pale trim excluded —
  // so whatever shade the baked top was, its average becomes this athlete's
  // skin and every texel keeps its shading relative to that mean.
  let sum = 0, counted = 0;
  for (let i = 0; i < W * H; i++) {
    if (!garment[i]) continue;
    const k = i * 4;
    const r = px[k], g = px[k + 1], b = px[k + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max && (max - min) / max < 0.12) continue;
    sum += lumaOf(r, g, b);
    counted++;
  }
  if (!counted) for (let i = 0; i < W * H; i++) {
    if (!garment[i]) continue;
    const k = i * 4;
    sum += lumaOf(px[k], px[k + 1], px[k + 2]);
    counted++;
  }
  const lJ = counted ? sum / counted : 0.5;
  for (let i = 0, k = 0; i < W * H; i++, k += 4) {
    if (!garment[i]) continue;
    const l = lumaOf(px[k], px[k + 1], px[k + 2]);
    const l2 = Math.max(0.12, Math.min(1.02, sl + (l - lJ) * 1.12));
    const f = Math.min(skinCap, l2 / sl);
    px[k] = Math.min(255, sr * f);
    px[k + 1] = Math.min(255, sg * f);
    px[k + 2] = Math.min(255, sb * f);
    px[k + 3] = 255;
  }
  return true;
}

/// The bare-chested copy of one baked texture, built once and shared: the
/// garment footprint rasterised across every mesh that uses the texture, then
/// repainted as skin.
function bareSkinTexture(map, meshes, inv, jersey, skin) {
  let result = null;
  const image = map.image;
  if (image && image.width && image.height) {
    const W = Math.min(1024, image.width);
    const H = Math.min(1024, image.height);
    let mask = null;
    for (const mesh of meshes) {
      const part = garmentMask(mesh, inv, W, H, map.flipY);
      if (!part) continue;
      if (!mask) mask = part;
      else for (let i = 0; i < mask.length; i++) mask[i] |= part[i];
    }
    if (mask) {
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const g = canvas.getContext('2d', { willReadFrequently: true });
      try {
        g.drawImage(image, 0, 0, W, H);
        const data = g.getImageData(0, 0, W, H);
        if (repaintAsSkin(data, W, H, mask, jersey, skin)) {
          g.putImageData(data, 0, 0);
          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.flipY = map.flipY;
          texture.wrapS = map.wrapS;
          texture.wrapT = map.wrapT;
          texture.repeat.copy(map.repeat);
          texture.offset.copy(map.offset);
          result = texture;
        }
      } catch (e) { result = null; }
    }
  }
  return result;
}

/// The beach body: the baked jersey on a shirtless athlete becomes their own
/// tanned skin. This is the body, not the kit, so it runs for every instance
/// — dressed or not, match, preview or reflection. The skin the jersey
/// repaints into is the pick's skin tone when one was chosen, so a repainted
/// body keeps one uniform shade across the chest and the rest of the skin.
function convertTorsoToSkin(model, baseColors, skin = baseColors.skin) {
  model.updateMatrixWorld(true);
  const inv = model.matrixWorld.clone().invert();
  const meshes = [];
  model.traverse((o) => { if (o.isSkinnedMesh && o.material) meshes.push(o); });
  // Group the materials by the texture they share, so a map used by several
  // meshes is masked once, with every mesh's footprint combined.
  const jobs = new Map();
  for (const mesh of meshes) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (let i = 0; i < mats.length; i++) {
      const map = mats[i].map;
      if (!map) continue;
      let job = jobs.get(map.uuid);
      if (!job) { job = { map, uses: [] }; jobs.set(map.uuid, job); }
      job.uses.push({ mesh, mats, i });
    }
  }
  for (const job of jobs.values()) {
    const key = `${job.map.uuid}|${skin}`;
    let tex = bareCache.get(key);
    if (tex === undefined) {
      tex = bareSkinTexture(job.map, job.uses.map((u) => u.mesh), inv, baseColors.jersey, skin);
      bareCache.set(key, tex);
    }
    if (!tex) continue;
    for (const { mats, i } of job.uses) {
      mats[i].map = tex;
      mats[i].needsUpdate = true;
    }
  }
}

export function fitUniform(model, colors, baseColors, number = '', facing = 0, name = '') {
  // The shirtless body comes first — before any kit decision, for every
  // athlete the model dresses. The chest repaints into the pick's skin tone
  // when one was chosen, so a toned body reads as one uniform shade.
  if (SHIRTLESS.has(model.name)) {
    convertTorsoToSkin(model, baseColors, colors.tone || baseColors.skin);
  }
  // Keep the source kit on classic roster colours. Alternate kits are a
  // separate skinned cloth shell sharing its motion, not a tint on the person.
  // A jersey number or a player name forces the shell too — both live on
  // their own per-athlete shorts texture, so no shared garment is repainted.
  if (colors.jersey === baseColors.jersey && colors.shorts === baseColors.shorts && !number && !name) return;
  // The chest faces the model-space direction the facing yaw maps onto +z;
  // the back panel is everything on the far side of the spine.
  const fx = -Math.sin(facing);
  const fz = Math.cos(facing);
  const meshes = [];
  model.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  model.updateMatrixWorld(true);
  const inv = model.matrixWorld.clone().invert();
  const p = new THREE.Vector3();
  const sourceHue = hue((baseColors.jersey >> 16) & 255, (baseColors.jersey >> 8) & 255, baseColors.jersey & 255);
  const skinHue = hue((baseColors.skin >> 16) & 255, (baseColors.skin >> 8) & 255, baseColors.skin & 255);
  const shortsHue = hue((baseColors.shorts >> 16) & 255, (baseColors.shorts >> 8) & 255, baseColors.shorts & 255);
  const whiteShorts = baseColors.shorts === 0xf2f2f2;
  for (const mesh of meshes) {
    const map = mesh.material.map;
    const uv = mesh.geometry.getAttribute('uv');
    if (!map?.image || !uv) continue;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    try { g.drawImage(map.image, 0, 0, 512, 512); } catch (_) { continue; }
    const pixels = g.getImageData(0, 0, 512, 512).data;
    const attributes = mesh.geometry.attributes;
    const classification = new Uint8Array(attributes.position.count);
    // Bind-pose model-space positions, kept for the back-panel test below.
    const modelPos = number || name ? new Float32Array(classification.length * 3) : null;
    for (let i = 0; i < classification.length; i++) {
      mesh.getVertexPosition(i, p);
      p.applyMatrix4(mesh.matrixWorld).applyMatrix4(inv);
      if (modelPos) { modelPos[i * 3] = p.x; modelPos[i * 3 + 1] = p.y; modelPos[i * 3 + 2] = p.z; }
      const y = p.y / HEIGHT;
      const tx = Math.min(511, Math.max(0, Math.floor(uv.getX(i) * 512)));
      const v = map.flipY ? 1 - uv.getY(i) : uv.getY(i);
      const ty = Math.min(511, Math.max(0, Math.floor(v * 512)));
      const k = (ty * 512 + tx) * 4;
      const r = pixels[k], gg = pixels[k + 1], b = pixels[k + 2];
      const max = Math.max(r, gg, b), min = Math.min(r, gg, b);
      const saturation = max ? (max - min) / max : 0;
      const h = hue(r, gg, b);
      const gapSkin = Math.min(Math.abs(h - skinHue), 1 - Math.abs(h - skinHue));
      // A texel counts as fabric only when it sits nearer the kit's hue than
      // to this athlete's skin — a bare shoulder must never repaint.
      const nearer = (target) => {
        const gapT = Math.min(Math.abs(h - target), 1 - Math.abs(h - target));
        return gapT < 0.11 && gapT < gapSkin + 0.02;
      };
      if (y > 0.5 && y < 0.8 && Math.abs(p.x) < 0.21 && saturation > 0.2 && nearer(sourceHue)) {
        classification[i] = 1;
      } else if (y > 0.34 && y < 0.56 && Math.abs(p.x) < 0.21) {
        // The shorts shell also covers any strong accent colour baked into
        // the shorts — a side panel the plain fabric test would leave
        // showing through as a stray patch.
        if ((whiteShorts ? saturation < 0.23 && max > 85 : saturation > 0.12 && nearer(shortsHue))
          || (saturation > 0.3 && gapSkin > 0.08)) classification[i] = 2;
      }
    }
    const sourceIndex = mesh.geometry.index;
    const count = sourceIndex ? sourceIndex.count : attributes.position.count;
    const groups = [[], []];
    // The back-facing triangles of the shorts, as raw uv pairs — the region
    // the player's name and number are painted into.
    const backUvs = [];
    for (let i = 0; i < count; i += 3) {
      const a = sourceIndex ? sourceIndex.getX(i) : i;
      const b = sourceIndex ? sourceIndex.getX(i + 1) : i + 1;
      const c = sourceIndex ? sourceIndex.getX(i + 2) : i + 2;
      for (let slot = 1; slot <= 2; slot++) {
        if ((classification[a] === slot) + (classification[b] === slot) + (classification[c] === slot) >= 2) {
          groups[slot - 1].push(a, b, c);
          if (slot === 2) {
            if ((number || name) && modelPos) {
              const cxm = (modelPos[a * 3] + modelPos[b * 3] + modelPos[c * 3]) / 3;
              const czm = (modelPos[a * 3 + 2] + modelPos[b * 3 + 2] + modelPos[c * 3 + 2]) / 3;
              // Behind the spine: on the far side of the chest direction.
              if (cxm * fx + czm * fz < -0.04) {
                backUvs.push(uv.getX(a), uv.getY(a), uv.getX(b), uv.getY(b), uv.getX(c), uv.getY(c));
              }
            }
          }
        }
      }
    }
    for (let slot = 0; slot < 2; slot++) {
      if (!groups[slot].length) continue;
      const geometry = mesh.geometry.clone();
      geometry.setIndex(groups[slot]);
      geometry.clearGroups();
      // The shorts carry the player's name and number on the seat; the kit's
      // shorts colour is the fabric. The kit's other colour stays in the
      // swatch row — a waistband band guessed onto the garment's uv layout
      // landed wherever the layout happened to put it, reading as a stray
      // patch mid-leg.
      let paint = null;
      if (slot === 1 && (number || name) && backUvs.length >= 6) {
        let minU = 1, maxU = 0, minV = 1, maxV = 0, su = 0, sv = 0;
        for (let i = 0; i < backUvs.length; i += 2) {
          const u = backUvs[i], v = backUvs[i + 1];
          minU = Math.min(minU, u); maxU = Math.max(maxU, u);
          minV = Math.min(minV, v); maxV = Math.max(maxV, v);
          su += u; sv += v;
        }
        const n = backUvs.length / 2;
        let w = (maxU - minU) * 512;
        let h = (maxV - minV) * 512;
        // A uv seam would blow the box up to the whole texture; fall back to
        // a sensible patch around the centroid instead.
        const seam = w > 280 || h > 280;
        if (seam) { w = 110; h = 130; }
        const cx = (seam ? su / n : (minU + maxU) / 2) * 512;
        const cy = (1 - (seam ? sv / n : (minV + maxV) / 2)) * 512;
        // Numbers sit high on the seat, not down at the hem.
        paint = paintNumber({ cx, cy: cy - h * 0.12, w, h }, number, name);
      }
      const material = new THREE.MeshStandardMaterial({
        map: fabric(slot ? colors.shorts : colors.jersey, paint), roughness: 0.59,
        metalness: 0, envMapIntensity: 0.8, polygonOffset: true,
        polygonOffsetFactor: -2, polygonOffsetUnits: -2
      });
      const cloth = new THREE.SkinnedMesh(geometry, material);
      cloth.position.copy(mesh.position);
      cloth.quaternion.copy(mesh.quaternion);
      cloth.scale.copy(mesh.scale);
      cloth.bindMode = mesh.bindMode;
      cloth.bind(mesh.skeleton, mesh.bindMatrix);
      cloth.castShadow = true;
      cloth.frustumCulled = false;
      mesh.parent.add(cloth);
    }
  }
}

// ----- the athlete's own look -----
// Hairstyles and skin tones picked on the title screen repaint the body's
// baked texture before any kit decision: hair texels confined to the head
// band, skin texels body-wide. Both gates key off the athlete's own roster
// colours — hue first, then luminance to split hair from skin where the two
// share a family (a brunet's brown-on-brown). Every repainted texel keeps
// its shading relative to its base shade, so the sculpt's folds and the
// hair's sheen read through whatever the pick paints. Built once per
// (texture, look) combination and cached like the bare-chest conversion.

const lookCache = new Map();
const headBandTest = (v) => v.y / HEIGHT > 0.76;

/// Repaints the hair and skin texels of one baked texture under the pick.
/// The hair line sits between the athlete's own hair shade and their skin
/// shade: hair texels in the head band repaint under the look, the face
/// repaints under the tone where it is brighter than that line, and the
/// body's skin repaints body-wide — arms, legs, hands and torso.
function repaintLookTexels(data, W, H, head, base, look) {
  const px = data.data;
  const sr = (base.skin >> 16) & 255, sg = (base.skin >> 8) & 255, sb = base.skin & 255;
  const skinHue = hue(sr, sg, sb);
  const skinL = lumaOf(sr, sg, sb);
  const hr = (base.hair >> 16) & 255, hg = (base.hair >> 8) & 255, hb = base.hair & 255;
  const hairHue = hue(hr, hg, hb);
  const hairL = lumaOf(hr, hg, hb);
  // The luminance ceiling hair texels may not cross: just above the athlete's
  // own hair shade, still under the shadows of their skin.
  const hairCut = Math.max(0.2, Math.min(0.38, hairL * 1.35 + 0.03));
  const tr = (look.tone >> 16) & 255, tg = (look.tone >> 8) & 255, tb = look.tone & 255;
  const kr = (look.hair >> 16) & 255, kg = (look.hair >> 8) & 255, kb = look.hair & 255;
  // The brightest factor a pick may scale a texel by: past it, a channel
  // clamps at 255 and the shading bleaches into a flat washed-out patch —
  // pale tones especially turned sunlit skin into white stone. Capping at
  // the pick's own full brightness keeps every texel's hue and shading.
  const toneCap = 255 / Math.max(tr, tg, tb, 1);
  const hairCap = 255 / Math.max(kr, kg, kb, 1);
  const gap = (h, t) => Math.min(Math.abs(h - t), 1 - Math.abs(h - t));
  let changed = 0;
  for (let i = 0, k = 0; i < W * H; i++, k += 4) {
    if (px[k + 3] < 250) continue;
    const r = px[k], g = px[k + 1], b = px[k + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max ? (max - min) / max : 0;
    const l = lumaOf(r, g, b);
    const h = hue(r, g, b);
    if (head && head[i]) {
      // Hair: a mid-saturation texel near the athlete's own hair hue and
      // darker than the hair line — the glossy shade lenses and the pale
      // highlight streaks between them never touch.
      if (look.hair && sat > 0.2 && sat < 0.75 && l < hairCut &&
          gap(h, hairHue) < 0.12) {
        const f = Math.max(0.3, Math.min(hairCap, l / Math.max(0.04, hairL)));
        px[k] = Math.min(255, kr * f);
        px[k + 1] = Math.min(255, kg * f);
        px[k + 2] = Math.min(255, kb * f);
        changed++;
        continue;
      }
      // The face: skin-hued and brighter than the hair line. The saturation
      // floor keeps the plain-white texels of the shorts and shade highlights
      // out of reach — only genuinely skin-hued texels repaint.
      if (look.tone && gap(h, skinHue) < 0.09 && l > hairCut + 0.05 &&
          sat > 0.04 && sat < 0.62) {
        const f = Math.max(0.22, Math.min(toneCap, l / Math.max(0.15, skinL)));
        px[k] = Math.min(255, tr * f);
        px[k + 1] = Math.min(255, tg * f);
        px[k + 2] = Math.min(255, tb * f);
        changed++;
      }
      continue;
    }
    // Body-wide skin: arms, legs, hands and torso — for the bare-chested
    // pair the chest already wears the tone off the conversion. The gates
    // reach down into the creases now: baked shading that dips dark between
    // muscles used to stay unpainted and read as dark cracks across the new
    // tone. The white shorts and any neutral highlight still stay out of
    // reach — near-neutral texels carry no skin hue to match.
    if (look.tone && gap(h, skinHue) < 0.09 && l > 0.12 && l < 0.97 &&
        sat > 0.03 && sat < 0.62) {
      const f = Math.max(0.22, Math.min(toneCap, l / Math.max(0.15, skinL)));
      px[k] = Math.min(255, tr * f);
      px[k + 1] = Math.min(255, tg * f);
      px[k + 2] = Math.min(255, tb * f);
      changed++;
    }
  }
  return changed > W * H * 0.002;
}

/// The repainted body texture, built once and shared per (texture, look):
/// the head band rasterised into texture space the way the garment footprint
/// is, then the picks painted into the texture.
function repaintedLookTexture(map, meshes, inv, base, look) {
  const key = `${map.uuid}|${look.hairId}|${look.toneId}`;
  let tex = lookCache.get(key);
  if (tex !== undefined) return tex;
  tex = null;
  const image = map.image;
  if (image && image.width && image.height) {
    const W = Math.min(1024, image.width);
    const H = Math.min(1024, image.height);
    let head = null;
    for (const mesh of meshes) {
      const part = garmentMask(mesh, inv, W, H, map.flipY, headBandTest);
      if (!part) continue;
      if (!head) head = part;
      else for (let i = 0; i < head.length; i++) head[i] |= part[i];
    }
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    try {
      g.drawImage(image, 0, 0, W, H);
      const data = g.getImageData(0, 0, W, H);
      if (repaintLookTexels(data, W, H, head, base, look)) {
        g.putImageData(data, 0, 0);
        tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = map.flipY;
        tex.wrapS = map.wrapS;
        tex.wrapT = map.wrapT;
        tex.repeat.copy(map.repeat);
        tex.offset.copy(map.offset);
      }
    } catch (e) { tex = null; }
  }
  lookCache.set(key, tex);
  return tex;
}

/// The look the pick chose, painted onto this athlete's own materials before
/// any kit decision: their hairstyle look dyes the hair on their head band
/// and their skin tone repaints the skin everywhere it shows. The CPU keeps
/// roster looks — the call is a no-op when neither was picked.
export function repaintAppearance(model, baseColors, look) {
  if (!look.hair && !look.tone) return;
  model.updateMatrixWorld(true);
  const inv = model.matrixWorld.clone().invert();
  const jobs = new Map();
  model.traverse((o) => {
    if (!o.isSkinnedMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (let i = 0; i < mats.length; i++) {
      const map = mats[i].map;
      if (!map) continue;
      let job = jobs.get(map.uuid);
      if (!job) { job = { map, uses: [] }; jobs.set(map.uuid, job); }
      job.uses.push({ mesh: o, mats, i });
    }
  });
  for (const job of jobs.values()) {
    const tex = repaintedLookTexture(
      job.map, job.uses.map((u) => u.mesh), inv, baseColors, look
    );
    if (!tex) continue;
    for (const { mats, i } of job.uses) {
      mats[i].map = tex;
      mats[i].needsUpdate = true;
    }
  }
}