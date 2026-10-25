// Canvas-painted textures for the volleyball world: the ball — painted in
// whichever skin the player has picked — the open sand, the court lines, the
// net mesh, the sky dome and the indoor arena's smooth blue floor. Three has
// no asset loader art in this project, so surface detail is drawn into
// canvases once and wrapped in textures.

import * as THREE from 'three';
import { selectedSkin } from './roster.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

/// A beach volleyball painted in one of the ball skins: the leather base
/// carrying three coloured curved panels and a faint seam of stitching dots.
/// Called with no skin it paints the player's selected one — the choice made
/// on the title screen — so every ball in the game, from the title preview
/// to the match court and the practice court, wears it.
export function makeBallTexture(skin = selectedSkin()) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const g = canvas.getContext('2d');

  g.fillStyle = hex(skin.base);
  g.fillRect(0, 0, 256, 128);

  const [c1, c2, c3] = skin.panels;
  const stripe = (y0, color) => {
    g.beginPath();
    for (let x = 0; x <= 256; x += 8) {
      const y = y0 + Math.sin((x / 256) * Math.PI * 4) * 9;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.lineWidth = 15;
    g.strokeStyle = color;
    g.stroke();
  };
  stripe(32, hex(c1));
  stripe(64, hex(c2));
  stripe(96, hex(c3));

  // A faint seam of stitching dots reads as a real ball at small sizes —
  // pale on a dark skin, dark on a pale one.
  g.fillStyle = skin.dark ? 'rgba(255,255,255,0.2)' : 'rgba(60,50,40,0.25)';
  for (let x = 6; x < 256; x += 16) {
    for (const y of [32, 64, 96]) g.fillRect(x, y - 1, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/// The open sand around the court: pale grain with the odd shell, tiling out
/// to where the haze takes over.
export function makeSandTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');

  g.fillStyle = '#dfbe83';
  g.fillRect(0, 0, size, size);

  // Grain: specks of light and dark scattered at random.
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    g.fillStyle = Math.random() > 0.5 ? 'rgba(120,90,50,0.12)' : 'rgba(255,250,230,0.12)';
    g.fillRect(x, y, 1.6, 1.6);
  }
  // Soft mottled patches so the tiling never reads as a grid.
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 14 + Math.random() * 26;
    g.fillStyle = Math.random() > 0.5 ? 'rgba(160,120,70,0.05)' : 'rgba(255,244,214,0.05)';
    g.beginPath();
    g.ellipse(x, y, r, r * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  // The odd shell catching the light.
  for (let i = 0; i < 6; i++) {
    g.fillStyle = 'rgba(250,246,235,0.55)';
    g.beginPath();
    g.ellipse(Math.random() * size, Math.random() * size, 1.6, 1.1, Math.random() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(48, 48);
  return texture;
}

/// The court painted on the same sand: boundary lines only — beach volleyball
/// has no centre line under the net. The plane it wraps is 20 units across (x)
/// and 18 deep (z), world centre 0; the court itself spans x -4..4, z -8..8,
/// the real 8 by 16 metre court.
export function makeCourtTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');

  g.fillStyle = '#dfbe83';
  g.fillRect(0, 0, size, size);

  // Sand grain: specks of light and dark scattered at random.
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    g.fillStyle = Math.random() > 0.5 ? 'rgba(120,90,50,0.10)' : 'rgba(255,250,230,0.10)';
    g.fillRect(x, y, 2, 2);
  }
  // Softer footprints trampled around the court edges.
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    g.fillStyle = 'rgba(140,105,60,0.06)';
    g.beginPath();
    g.ellipse(x, y, 6 + Math.random() * 10, 4 + Math.random() * 6, Math.random() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }

  // Court boundary lines. World x -10..10 maps to 0..512, world z -9..9
  // likewise; the court spans x -4..4 and z -8..8.
  const toX = (x) => ((x + 10) / 20) * size;
  const toZ = (z) => ((z + 9) / 18) * size;

  g.strokeStyle = '#ffffff';
  g.lineWidth = 5;
  g.strokeRect(toX(-4), toZ(-8), toX(4) - toX(-4), toZ(8) - toZ(-8));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/// The indoor arena's floor: a smooth blue sports court carrying the same
/// white boundary lines — no sand, no grain, just broad soft patches where
/// the floodlights catch the surface. Same mapping as the beach court: the
/// plane it wraps is 20 units across (x) and 18 deep (z), world centre 0.
export function makeIndoorCourtTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');

  g.fillStyle = '#2f6fb4';
  g.fillRect(0, 0, size, size);

  // A faint mottled sheen: the smooth floor catching the floods in wide,
  // soft patches instead of sand grain.
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 30 + Math.random() * 70;
    g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(10,30,60,0.05)';
    g.beginPath();
    g.ellipse(x, y, r, r * 0.55, Math.random() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }

  // The same court boundary lines, world x -10..10 and z -9..9 mapping.
  const toX = (x) => ((x + 10) / 20) * size;
  const toZ = (z) => ((z + 9) / 18) * size;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 5;
  g.strokeRect(toX(-4), toZ(-8), toX(4) - toX(-4), toZ(8) - toZ(-8));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/// The indoor hall's advertising boards: a strip of LED sponsor panels — bold
/// letters on bright blocks — the low ring a real arena stands round its
/// floor. One strip dresses all four runs of boards.
export function makeAdBoardTexture() {
  const W = 1024;
  const H = 96;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');

  const ads = [
    ['#d8453f', '#ffffff', 'VOLLEY3D'],
    ['#f2f2f2', '#1d3a5f', 'ACE ENERGY'],
    ['#1d6fb8', '#ffffff', 'SPIKE GEAR'],
    ['#f2d16b', '#231503', 'COURT SIDE'],
    ['#2f9e6e', '#ffffff', 'SET POINT'],
    ['#231503', '#ffd24a', 'BLOCK CLUB']
  ];
  const pw = W / ads.length;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  ads.forEach(([bg, fg, text], i) => {
    g.fillStyle = bg;
    g.fillRect(i * pw, 0, pw, H);
    g.fillStyle = fg;
    g.font = 'italic 800 40px sans-serif';
    g.fillText(text, i * pw + pw / 2, H / 2 + 4);
  });
  // A bright trim along the top edge, like the LED bezel.
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.fillRect(0, 0, W, 5);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/// The indoor hall's walls: pale grey-blue panels up top with vertical seams,
/// a red accent stripe, and a dark padded wainscot along the floor — the way
/// a real gym hall is dressed. The far end carries the house name in big
/// letters and two championship banners hung either side. On a box face the
/// canvas's top row lands at the wall's foot, so heights are painted
/// downward from row zero.
export function makeGymWallTexture(end = false) {
  const W = 1024;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  // Wall metres to canvas rows: the wall stands 11 m and the canvas top is
  // its foot.
  const y = (m) => (m / 11) * H;

  // The upper wall: pale panels with soft vertical seams.
  g.fillStyle = '#33404f';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(10, 16, 24, 0.4)';
  g.lineWidth = 3;
  for (let x = 0; x <= W; x += 128) {
    g.beginPath();
    g.moveTo(x, y(3.6));
    g.lineTo(x, H);
    g.stroke();
  }

  // The padded wainscot along the foot, stitched like mats.
  g.fillStyle = '#1b2430';
  g.fillRect(0, 0, W, y(2.9));
  g.strokeStyle = 'rgba(130, 150, 170, 0.14)';
  g.lineWidth = 2;
  for (let x = 16; x < W; x += 32) {
    g.beginPath();
    g.moveTo(x, y(0.1));
    g.lineTo(x, y(2.8));
    g.stroke();
  }

  // The accent stripe above the padding, with a white pinline under it.
  g.fillStyle = '#d8453f';
  g.fillRect(0, y(2.9), W, y(3.35) - y(2.9));
  g.fillStyle = '#f2f2f2';
  g.fillRect(0, y(3.35), W, y(3.55) - y(3.35));

  if (end) {
    // The house name across the upper wall, and two championship banners
    // hung either side of it.
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(214, 226, 238, 0.9)';
    g.font = '800 62px sans-serif';
    g.fillText('VOLLEY3D ARENA', W / 2, y(6.1));
    const banner = (bx, bg, text) => {
      g.fillStyle = bg;
      g.fillRect(bx - 78, y(5.0), 156, y(7.0) - y(5.0));
      g.fillStyle = '#f2d16b';
      g.fillRect(bx - 78, y(5.0), 156, 10);
      g.fillStyle = '#ffffff';
      g.font = '700 21px sans-serif';
      g.fillText(text, bx, y(6.0));
    };
    banner(W * 0.14, '#1d6fb8', 'CUP 2024');
    banner(W * 0.86, '#2f9e6e', 'LEAGUE 2023');
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/// The scoreboard hung high on the far wall: a dark LED panel with the house
/// name, a big amber score readout and the set line — a fixture of the hall,
/// painted once; the live score lives in the HUD above the court.
export function makeScoreboardTexture() {
  const W = 512;
  const H = 176;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');

  g.fillStyle = '#0a0e14';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#2b3440';
  g.lineWidth = 8;
  g.strokeRect(4, 4, W - 8, H - 8);

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#8fa4b8';
  g.font = '700 22px sans-serif';
  g.fillText('VOLLEY3D ARENA', W / 2, 32);
  g.fillStyle = '#ffb24a';
  g.font = '800 72px sans-serif';
  g.fillText('0 : 0', W / 2, 100);
  g.fillStyle = '#57d08a';
  g.font = '700 24px sans-serif';
  g.fillText('SET 1 · BEST OF 3', W / 2, 152);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/// The net's mesh: a fine square grid of about seven centimetres a side, with
/// small knots at the crossings — seen through cleanly from either side.
export function makeNetTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, size, size);

  const pitch = 16;
  g.strokeStyle = 'rgba(244,246,248,0.95)';
  g.lineWidth = 2;
  for (let x = 0; x <= size; x += pitch) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, size);
    g.stroke();
  }
  for (let y = 0; y <= size; y += pitch) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(size, y);
    g.stroke();
  }
  g.fillStyle = '#eef1f4';
  for (let x = 0; x <= size; x += pitch) {
    for (let y = 0; y <= size; y += pitch) {
      g.beginPath();
      g.arc(x, y, 1.7, 0, Math.PI * 2);
      g.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // Eight tiles across the 8.8 m net and two up its 1.9 m: about 7 cm cells.
  texture.repeat.set(8, 2);
  return texture;
}

/// The sky dome: an equirectangular panorama — zenith colour fading through
/// the theme's mid tones into haze at the horizon, sea beyond it — with the
/// sun or the moon glowing exactly where the theme's key light sits, clouds
/// by day and stars at night. Painted once per match.
export function makeSkyTexture(t) {
  const W = 1024;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const hY = H / 2; // the dome's equator is the horizon

  // Sky: zenith down to the horizon haze.
  const sky = g.createLinearGradient(0, 0, 0, hY);
  sky.addColorStop(0, hex(t.skyTop));
  if (t.skyMid) sky.addColorStop(0.55, hex(t.skyMid));
  sky.addColorStop(1, hex(t.horizon));
  g.fillStyle = sky;
  g.fillRect(0, 0, W, hY);

  // Sea beyond the sand, deepening with distance.
  const sea = g.createLinearGradient(0, hY, 0, H);
  sea.addColorStop(0, hex(t.sea));
  sea.addColorStop(1, hex(t.seaFar));
  g.fillStyle = sea;
  g.fillRect(0, hY, W, H - hY);

  // The sun or the moon, placed where the theme's key light sits: the dome's
  // texture runs east-west along u and pole-to-pole along v.
  const lx = t.sun[2];
  const ly = t.sun[3];
  const lz = t.sun[4];
  const len = Math.hypot(lx, ly, lz) || 1;
  const hl = Math.hypot(lx, lz) || 1;
  let u = Math.atan2(lz / hl, -lx / hl) / (Math.PI * 2);
  if (u < 0) u += 1;
  const px = u * W;
  const py = (Math.acos(Math.max(-1, Math.min(1, ly / len))) / Math.PI) * H;
  const strength = t.sunGlow ?? 0.6;
  const tint = t.stars ? '220,232,250' : '255,236,200';
  const glow = g.createRadialGradient(px, py, 0, px, py, W * 0.2 * (0.5 + strength * 0.5));
  glow.addColorStop(0, `rgba(${tint},${0.85 * strength})`);
  glow.addColorStop(1, `rgba(${tint},0)`);
  g.fillStyle = glow;
  // It runs over the horizon on purpose: a low sun glints on the water.
  g.fillRect(0, 0, W, H);

  if (t.stars) {
    // The moon: a small pale disc.
    g.fillStyle = '#e6edf6';
    g.beginPath();
    g.arc(px, py, W * 0.012, 0, Math.PI * 2);
    g.fill();
  } else if (strength > 0.8) {
    // A low sun: a disc you can just about look at.
    g.fillStyle = '#ffedc4';
    g.beginPath();
    g.arc(px, py, W * 0.018, 0, Math.PI * 2);
    g.fill();
  }

  // A bright line along the horizon itself, where sea meets haze.
  g.fillStyle = 'rgba(255,255,255,0.3)';
  g.fillRect(0, hY - 2, W, 3);

  // Clouds by day: puffy cumulus — each one a little cluster of overlapping
  // soft lobes with bright tops riding a shaded underside, drifting low
  // across the trade winds, warm-lit at sunset.
  if (t.clouds > 0) {
    const cloudTint = t.id === 'sunset' ? '255,216,186' : '255,255,255';
    const shadeTint = t.id === 'sunset' ? '150,92,80' : '158,196,220';
    for (let i = 0; i < t.clouds; i++) {
      const cx = Math.random() * W;
      const cy = hY * (0.4 + Math.random() * 0.52);
      const s = 0.6 + Math.random() * 0.9;
      const lobes = 5 + (Math.random() * 4 | 0);
      g.save();
      g.translate(cx, cy);
      g.scale(s, s * 0.72);
      // The shaded slab under the lobes first, so the bright tops overlap it.
      const shade = g.createLinearGradient(0, 2, 0, 26);
      shade.addColorStop(0, `rgba(${shadeTint},0.2)`);
      shade.addColorStop(1, `rgba(${shadeTint},0)`);
      g.fillStyle = shade;
      g.beginPath();
      g.ellipse(0, 11, 62, 13, 0, 0, Math.PI * 2);
      g.fill();
      for (let l = 0; l < lobes; l++) {
        const fx = lobes > 1
          ? (l / (lobes - 1) - 0.5) * 116 + (Math.random() - 0.5) * 14 : 0;
        // A gentle arc: the middle lobes ride highest, the ends tuck down.
        const arc = lobes > 1 ? Math.cos((l / (lobes - 1)) * Math.PI) * 11 : 0;
        const fy = -arc + (Math.random() - 0.5) * 7;
        const r = 14 + Math.random() * 15;
        const cg = g.createRadialGradient(fx, fy - r * 0.3, r * 0.15, fx, fy, r);
        cg.addColorStop(0, `rgba(${cloudTint},0.9)`);
        cg.addColorStop(0.55, `rgba(${cloudTint},0.55)`);
        cg.addColorStop(1, `rgba(${cloudTint},0)`);
        g.fillStyle = cg;
        g.beginPath();
        g.arc(fx, fy, r, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
  }

  // Stars at night, scattered over the upper sky.
  if (t.stars) {
    for (let i = 0; i < 170; i++) {
      const x = Math.random() * W;
      const y = Math.random() * hY * 0.8;
      g.fillStyle = `rgba(230,240,255,${0.25 + Math.random() * 0.6})`;
      g.fillRect(x, y, 1.5, 1.5);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
