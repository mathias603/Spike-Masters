// Entry point: the renderer, the camera and the frame loop, and nothing else.
// Gameplay lives in scenes under src/scenes/.

import * as THREE from 'three';
import { SceneManager } from './scene.js';
import { BootScene } from './scenes/BootScene.js';
import { registerIcons } from './icons.js';
import { preloadModels } from './models.js';
import { ATHLETE_MODELS, prepareAthleteClips } from './athleteClips.js';
import { initOrientation } from './orientation.js';

// The HUD buttons point at CSS variables published here once at startup.
registerIcons(['play', 'arrow-up', 'rotate-ccw', 'zap', 'hand', 'rocket', 'user', 'users', 'users-round', 'users-2', 'shield', 'gauge', 'flame', 'traffic-cone', 'x', 'chevron-left', 'history', 'settings', 'trophy', 'crown', 'lock', 'book-open', 'refresh-cw', 'pause', 'list-checks', 'calendar', 'list', 'timer', 'palette', 'check']);

const stage = document.getElementById('stage');

// The boot card is painted by the browser before any module loads, so a slow
// first visit — the players are several megabytes — reads as loading instead of
// as a page that never changes. It is filled in here and taken down the moment
// the title scene is running.
const boot = document.getElementById('boot');

function bootSay(title, line, hint) {
  if (!boot) return;
  const set = (selector, text) => {
    const el = boot.querySelector(selector);
    if (el && text) el.textContent = text;
  };
  set('.boot-title', title);
  set('.boot-line', line);
  set('.boot-hint', hint);
}

async function start() {
  // A device without WebGL 2 cannot run the game at all, and three throws while
  // the renderer is built. Put the reason on the boot card rather than leaving
  // the visitor with a page that never changes.
  let renderer;
  try {
    // MSAA at 2× device pixel ratio is mostly wasted fill rate on a phone —
    // the high density already smooths the edges. The GPU budget goes to the
    // game.
    renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance'
    });
  } catch (error) {
    bootSay("This browser can't run the game",
      'It needs WebGL 2, which this browser does not offer.',
      'Open the link in Safari on iOS 16.4 or newer, or in a current Chrome, Edge or Firefox.');
    return;
  }

  // Phones report a device pixel ratio of 3, which means rendering nine times
  // the pixels for a difference nobody can see and a frame rate everybody can.
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

  try {
    await preloadModels(ATHLETE_MODELS);
    prepareAthleteClips();
  } catch (error) {
    bootSay("The team didn't arrive",
      'The players could not be downloaded.',
      'Check the connection, then reload the page.');
    throw error;
  }

  window.game.start(BootScene);
  window.game.run();
  boot.remove();
}

start();
