// Entry point: the renderer, the camera and the frame loop, and nothing else.
// Gameplay lives in scenes under src/scenes/.

import * as THREE from 'three';
import { SceneManager } from './scene.js';
import { BootScene } from './scenes/BootScene.js';
import { registerIcons } from './icons.js';
import { preloadModels } from './models.js';
import { ATHLETE_MODELS, prepareAthleteClips } from './athleteClips.js';
import { addText } from './hud.js';
import { initOrientation } from './orientation.js';

// The HUD buttons point at CSS variables published here once at startup.
registerIcons(['play', 'arrow-up', 'rotate-ccw', 'zap', 'hand', 'rocket', 'user', 'users', 'users-round', 'users-2', 'shield', 'gauge', 'flame', 'traffic-cone', 'x', 'chevron-left', 'history', 'settings', 'trophy', 'crown', 'lock', 'book-open', 'refresh-cw', 'pause', 'list-checks', 'calendar', 'list', 'timer', 'palette', 'check']);

const stage = document.getElementById('stage');

// MSAA at 2× device pixel ratio is mostly wasted fill rate on a phone — the
// high density already smooths the edges. The GPU budget goes to the game.
const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: 'high-performance'
});

// Phones report a device pixel ratio of 3, which means rendering nine times the
// pixels for a difference nobody can see and a frame rate everybody can.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// The sky colour scenes set their own background; this only covers the first frame.
renderer.setClearColor(0x8fd0ea);
// Real shadows: scenes point their key light at the shadow map.
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// Re-rendering the shadow map every frame is a second skinning pass over
// every shadow caster on a phone — the manager re-arms it on a throttled
// cadence instead (scene.js), so the shadows follow the play without paying
// the full price every frame.
renderer.shadowMap.autoUpdate = false;
stage.appendChild(renderer.domElement);

// Some hosts present the whole frame turned when the device lies sideways
// while the view stays portrait — the turn control (and its session state)
// applies before the first scene builds, so even the loading text reads right.
initOrientation();

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
camera.position.set(0, 3, 7);
camera.lookAt(0, 0, 0);

// On window so the running game can be inspected from outside the module graph.
window.game = new SceneManager(renderer, camera, stage);
const loading = addText('Preparing the team…', {
  left: '0', right: '0', top: '45%', textAlign: 'center',
  color: '#ffffff', fontSize: '18px', fontWeight: '700'
});
await preloadModels(ATHLETE_MODELS);
prepareAthleteClips();
loading.remove();
window.game.start(BootScene);
window.game.run();
