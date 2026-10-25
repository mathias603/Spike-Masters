// The title screen: the roster lined up on the sand, a character-select row,
// a six-way mode picker, a CPU difficulty picker beside a match-length
// toggle and a SERIES toggle for a best-of-three of full matches, preset kit
// swatches with a CUSTOM swatch opening a two-row kit designer, ball-skin
// swatches with a CUSTOM swatch opening a two-row ball designer, a venue
// picker row, a jersey number and player
// name, a play button, and a season ladder of ranked opponents. A back and
// history pair sits at the title's left edge, settings and the ladder at its
// right, flanking the centred title block. The career screen carries the
// personal bests screen, the highlights reel and the record backup beside
// its other sub-screens, and the title's GOALS button opens the week's
// three rotating goals.

import * as THREE from 'three';
import { Scene, disposeSceneGraph } from '../scene.js';
import { updateModels } from '../models.js';
import { THEMES, themeUnlocked, selectVenue, selectedVenue } from '../themes.js';
import { addText, addButton, clearHUD } from '../hud.js';
import { createAthlete, updateAthlete, applyPose } from '../athlete.js';
import { haptic } from '../hapticsGate.js';
import { makeBallTexture, makeCourtTexture, makeSkyTexture } from '../textures.js';
import { ROSTER, selectCharacter, selectedCharacter, p2Character, athleteUnlocked, DIFFICULTIES, difficultyChoices, selectDifficulty, selectedDifficulty, MATCH_LENGTHS, selectLength, selectedLength, MODES, selectMode, selectedMode, SERVING_TACTICS, selectTactic, selectedTactic, KITS, selectKit, selectedKit, kitUnlocked, playerColors, selectNumber, selectedNumber, SKINS, skinUnlocked, selectSkin, selectedSkin, selectName, selectedName, playerName, LOOKS, lookUnlocked, selectLook, selectedLook, TONES, selectTone, selectedTone, selectCustomKit, customKitColors, selectCustomColor, customColorUnlocked, CUSTOM_JERSEYS, CUSTOM_SHORTS, selectCustomBall, customBallColors, selectCustomBallColor, CUSTOM_BASES, CUSTOM_PANELS } from '../roster.js';
import { getSettings, setSetting, replayNetCam } from '../settings.js';
import { seriesActive, setSeriesOn } from '../series.js';
import { tallyLine, careerStats, BADGES, earnedBadges, matchLog, rivalScout, heatMap, heatRivalMap, HEAT_COLS, HEAT_ROWS, dailyDays, dateKey, playerTitle, rallyReplay, rallyReel, personalBests, serveLeague, titleSteps, takeLegendToast, takeAthleteToast, backupCode, restoreCode, takeGoalCompletions, weeklyGoalName, weeklyProgress, weeklyWeekOf, legendUnlocked, seasonAwards, awardsClaimed, markAwardsClaimed } from '../record.js';
import { iconDataURI } from '../icons.js';
import { startCup, cupRun, takeTrophy, cupTrophyNames, cupTrophyDoubles } from '../cup.js';
import { LADDER, ladderRecord, startLadderMatch, takeLadderCard } from '../ladder.js';
import { dailyChallenge, startDaily, takeDailyCard } from '../daily.js';
import { startRivalMatch } from '../rivalMatch.js';
import { playFanfare, playCheer, playWhoosh, playBadgeSting } from '../sfx.js';
import { MatchScene } from './MatchScene.js';

const SEL_BG = 'rgba(23, 84, 130, 0.85)';
const DIM_BG = 'rgba(23, 84, 130, 0.28)';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const mix = (a, b, t) => a + (b - a) * t;

// The net cam hangs just outside the net post — the same half-width the
// match court's net posts stand at — looking down the tape.
const NET_HALF_W = 4.4;

// A swatch-sized miniature of a ball skin: the leather base with its three
// panel bands, drawn once into a tiny canvas and handed over as a data URL —
// the row shows the design each pick paints, not just a flat colour.
function skinSwatch(skin) {
  const c = document.createElement('canvas');
  c.width = c.height = 26;
  const g = c.getContext('2d');
  const hx = (n) => '#' + n.toString(16).padStart(6, '0');
  g.fillStyle = hx(skin.base);
  g.fillRect(0, 0, 26, 26);
  // The stored design keeps its panel shade single; skins read back with the
  // three bands as an array. Both shapes paint the same three stripes here.
  const bands = Array.isArray(skin.panels)
    ? skin.panels
    : skin.panels != null ? [skin.panels, skin.panels, skin.panels] : [];
  bands.forEach((p, i) => {
    g.fillStyle = hx(p);
    g.fillRect(0, 4 + i * 7, 26, 5);
  });
  return `url(${c.toDataURL()})`;
}

// The heat scale: cool blue for a bucket the shots visit a little, amber in
// the middle, hot red where they pile up — and the tint burns brighter the
// more often it has landed. An empty bucket barely shows at all.
function heatColour(count, max) {
  if (!count) return 'rgba(120, 160, 210, 0.08)';
  const t = Math.min(1, count / max);
  const stops = [[59, 130, 246], [250, 204, 21], [239, 68, 68]];
  const seg = t < 0.5 ? 0 : 1;
  const k = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  const a = stops[seg];
  const b = stops[seg + 1];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * k));
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${(0.42 + 0.55 * t).toFixed(2)})`;
}

// The rivals table: the match log grouped by opponent. Every meeting counts
// toward the head-to-head record, the newest entry is the last meeting, and
// the streak reads straight down the log — consecutive results of one kind
// counting back from the most recent meeting. Sorted most-played first, so
// the familiar names sit at the top.
function rivalRows(log) {
  const rows = [];
  const byName = new Map();
  for (const e of log) {
    let g = byName.get(e.opp);
    if (!g) {
      g = { name: e.opp, wins: 0, losses: 0, played: 0, last: e };
      byName.set(e.opp, g);
      rows.push(g);
    }
    g.played++;
    if (e.won) g.wins++;
    else g.losses++;
  }
  for (const g of rows) {
    let run = 0;
    for (const e of log) {
      if (e.opp !== g.name) continue;
      if (run && e.won !== g.last.won) break;
      run++;
    }
    g.streak = run;
  }
  rows.sort((a, b) => b.played - a.played);
  return rows;
}

export class BootScene extends Scene {
  create() {
    this.root.background = new THREE.Color(0x8fd0ea);
    this.root.fog = new THREE.Fog(0x8fd0ea, 18, 45);
    const reflection = makeSkyTexture(THEMES[0]);
    reflection.mapping = THREE.EquirectangularReflectionMapping;
    this.root.environment = reflection;
    this.root.environmentIntensity = 0.85;
    this.root.add(new THREE.AmbientLight(0xffffff, 1.15));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
    sun.position.set(4, 9, 5);
    this.root.add(sun);

    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 40),
      new THREE.MeshStandardMaterial({ map: makeCourtTexture(), roughness: 1 })
    );
    sand.rotation.x = -Math.PI / 2;
    this.root.add(sand);

    this.selIdx = ROSTER.findIndex((r) => r.id === selectedCharacter().id);
    // Each kit pick, read back separately: the swatch row dresses whoever
    // the toggle points at — player one by default, player two in a
    // two-player match, the CPU partner in doubles. The custom kit reads
    // back as the row's own CUSTOM swatch, sitting at KITS.length.
    const kitIndexOf = (id) => id === 'custom' ? KITS.length
      : KITS.findIndex((k) => k.id === id);
    this.kitIdxP1 = kitIndexOf(selectedKit('p1').id);
    this.kitIdxP2 = kitIndexOf(selectedKit('p2').id);
    this.kitIdxPartner = kitIndexOf(selectedKit('partner').id);
    this.kitWho = 'p1';
    // Read before the lineup is built: the dressing below checks the mode.
    this.modeIdx = MODES.findIndex((m) => m.id === selectedMode().id);
    // Player two's roster slot — deterministic, so the far athlete of a
    // two-player match can be dressed on the preview before any match starts.
    this.p2Idx = ROSTER.findIndex((r) => r.id === p2Character().id);
    // The roster lined up like a team photo; the chosen one steps forward,
    // dressed in their picked kit while the others keep their own colours.
    // The unsigned recruit stands out of the line until her wins sign her —
    // the playable roster takes the sand, packed a touch tighter the moment
    // she joins it so four bodies read as one team photo.
    const signed = ROSTER.filter((character) => athleteUnlocked(character));
    const lineGap = signed.length > 3 ? 1.5 : 2.3;
    const lineStart = -lineGap * (signed.length - 1) / 2;
    const slotOf = new Map();
    signed.forEach((character, slot) => slotOf.set(character.id, slot));
    this.lineup = ROSTER.map((character, i) => {
      const athlete = createAthlete(this.dressedColors(i));
      const onRoster = athleteUnlocked(character);
      athlete.visible = onRoster;
      athlete.position.set(
        lineStart + (onRoster ? slotOf.get(character.id) : signed.length) * lineGap,
        0, -2.6
      );
      athlete.rotation.y = 0.25 -
        (onRoster ? slotOf.get(character.id) : signed.length) * 0.25;
      this.root.add(athlete);
      return athlete;
    });
    // The CPU levels the picker offers: the usual three, with the legend
    // tier joining only once the ladder's top rung has been beaten.
    this.diffChoices = difficultyChoices();
    this.diffIdx = this.diffChoices.findIndex(
      (d) => d.id === selectedDifficulty().id
    );
    this.lenIdx = MATCH_LENGTHS.findIndex((l) => l.id === selectedLength().id);
    // The picked venue: AUTO sits at index 0, the four looks after it.
    const pickedVenue = selectedVenue();
    this.venueIdx = pickedVenue
      ? THEMES.findIndex((t) => t.id === pickedVenue.id) + 1 : 0;

    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 24, 18),
      new THREE.MeshStandardMaterial({ map: makeBallTexture(), roughness: 0.55 })
    );
    this.ball.position.set(0, 0.55, 1.6);
    this.root.add(this.ball);

    // ----- HUD -----
    this.title = addText('BEACH VOLLEY 3D', {
      top: 'calc(env(safe-area-inset-top) + 34px)',
      left: '0',
      right: '0',
      textAlign: 'center',
      fontSize: '34px',
      fontWeight: '800',
      color: '#ffffff',
      textShadow: '0 3px 12px rgba(20,40,60,0.6)'
    });
    this.subtitle = addText('First to 7 · Drag to move, tap to jump', {
      top: 'calc(env(safe-area-inset-top) + 78px)',
      left: '24px',
      right: '24px',
      textAlign: 'center',
      fontSize: '14px',
      color: '#ffffff',
      textShadow: '0 2px 8px rgba(20,40,60,0.6)'
    });

    // The career tally for the picked mode: matches won and lost across
    // sessions, sitting just under the subtitle.
    this.tallyText = addText('', {
      top: 'calc(env(safe-area-inset-top) + 98px)',
      left: '0',
      right: '0',
      textAlign: 'center',
      fontSize: '11px',
      fontWeight: '700',
      letterSpacing: '2px',
      color: 'rgba(255,255,255,0.85)',
      textShadow: '0 1px 4px rgba(20,40,60,0.6)'
    });

    // ----- mode: against the CPU, two players, doubles, co-op, or practice --
    this.modeButtons = [];
    this.modeLabels = [];
    const modeLefts = [
      'calc(50% - 137px)', 'calc(50% - 91px)', 'calc(50% - 45px)',
      'calc(50% + 1px)', 'calc(50% + 47px)', 'calc(50% + 93px)'
    ];
    const modeLabelLefts = [
      'calc(50% - 138px)', 'calc(50% - 92px)', 'calc(50% - 46px)',
      'calc(50% + 0px)', 'calc(50% + 46px)', 'calc(50% + 92px)'
    ];
    MODES.forEach((mode, i) => {
      const btn = addButton({
        icon: mode.icon,
        label: mode.name,
        onPress: () => this.pickMode(i),
        style: {
          position: 'absolute',
          width: '46px',
          height: '52px',
          top: 'calc(env(safe-area-inset-top) + 112px)',
          left: modeLefts[i],
          backgroundColor: i === this.modeIdx ? SEL_BG : DIM_BG
        }
      });
      this.modeButtons.push(btn);
      const label = addText(mode.name, {
        top: 'calc(env(safe-area-inset-top) + 170px)',
        left: modeLabelLefts[i],
        width: '46px',
        textAlign: 'center',
        fontSize: '9px',
        fontWeight: '700',
        letterSpacing: '0.5px',
        color: '#ffffff',
        textShadow: '0 1px 4px rgba(20,40,60,0.6)'
      });
      this.modeLabels.push(label);
    });

    // ----- jersey kits: a row of swatches above the caption -----
    // Each swatch wears its jersey colour with the shorts as a band across
    // the bottom; locked ones grey out under a lock until the wins stack up.
    this.kitButtons = [];
    KITS.forEach((kit, i) => {
      const unlocked = kitUnlocked(kit);
      const opts = {
        label: `Kit ${kit.name}`,
        onPress: () => this.pickKit(i),
        style: {
          position: 'absolute',
          width: '32px',
          height: '32px',
          top: 'calc(env(safe-area-inset-top) + 204px)',
          left: `calc(50% + ${i * 38 - 149}px)`,
          borderRadius: '9px'
        }
      };
      if (!unlocked) opts.icon = 'lock';
      const btn = addButton(opts);
      const band = document.createElement('div');
      band.style.cssText =
        'position:absolute;left:0;right:0;bottom:0;height:9px;' +
        `background:#${kit.shorts.toString(16).padStart(6, '0')};` +
        'border-radius:0 0 7px 7px;';
      btn.appendChild(band);
      this.kitButtons.push(btn);
    });
    // The CUSTOM swatch at the row's end opens the kit designer: two colour
    // rows — jersey and shorts — for whoever the dressing toggle points at.
    // It wears the custom kit as it currently stands and repaints as the
    // design does, under the paint palette's own glyph.
    this.customKitBtn = addButton({
      icon: 'palette',
      label: 'Open the custom kit designer',
      onPress: () => this.openCustomKit(),
      style: {
        position: 'absolute',
        width: '32px',
        height: '32px',
        top: 'calc(env(safe-area-inset-top) + 204px)',
        left: `calc(50% + ${KITS.length * 38 - 149}px)`,
        borderRadius: '9px'
      }
    });
    this.customKitBand = document.createElement('div');
    this.customKitBand.style.cssText =
      'position:absolute;left:0;right:0;bottom:0;height:9px;' +
      'border-radius:0 0 7px 7px;';
    this.customKitBtn.appendChild(this.customKitBand);
    this.kitCaption = addText('', {
      top: 'calc(env(safe-area-inset-top) + 228px)',
      left: '12px',
      width: '150px',
      textAlign: 'left',
      fontSize: '10px',
      fontWeight: '700',
      letterSpacing: '1.5px',
      color: 'rgba(255,255,255,0.85)',
      textShadow: '0 1px 4px rgba(20,40,60,0.6)'
    });

    // ----- ball skins: a row of swatches beside the kit row -----
    // Each unlocked swatch wears a miniature of the ball design it paints;
    // locked ones grey out under a lock until the wins stack up. Picking one
    // repaints the preview ball on the spot, and the choice is remembered
    // across sessions like a kit.
    this.skinButtons = [];
    SKINS.forEach((skin, i) => {
      const unlocked = skinUnlocked(skin);
      const opts = {
        label: `Ball skin ${skin.name}`,
        onPress: () => this.pickSkin(i),
        style: {
          position: 'absolute',
          width: '26px',
          height: '26px',
          top: 'calc(env(safe-area-inset-top) + 254px)',
          left: `calc(50% + ${i * 32 - 93}px)`,
          borderRadius: '999px'
      }
      };
      if (!unlocked) opts.icon = 'lock';
      const btn = addButton(opts);
      // The unlocked swatch wears its design's own miniature; a locked one
      // sits dimmed under its lock.
      if (unlocked) {
        btn.style.backgroundImage = skinSwatch(skin);
      } else {
        btn.style.backgroundColor = 'rgba(110, 120, 130, 0.4)';
      }
      this.skinButtons.push(btn);
    });
    // The CUSTOM swatch at the row's end wears the design as painted — under
    // the paint palette's own glyph — and opens the ball designer: two
    // colour rows over a dark panel beside the dimmed court.
    this.customBallBtn = addButton({
      icon: 'palette',
      label: 'Open the custom ball designer',
      onPress: () => this.openCustomBall(),
      style: {
        position: 'absolute',
        width: '26px',
        height: '26px',
        top: 'calc(env(safe-area-inset-top) + 254px)',
        left: `calc(50% + ${SKINS.length * 32 - 93}px)`,
        borderRadius: '999px'
      }
    });
    this.customBallBtn.style.backgroundImage = skinSwatch(selectedSkin());
    this.customBallBtn.style.backgroundColor = '#26303c';
    this.skinCaption = addText('', {
      left: '0',
      top: 'calc(env(safe-area-inset-top) + 284px)',
      right: '0',
      textAlign: 'center',
      fontSize: '10px',
      fontWeight: '700',
      letterSpacing: '1.5px',
      color: 'rgba(255,255,255,0.85)',
      textShadow: '0 1px 4px rgba(20,40,60,0.6)'
    });

    // ----- venues: a row of swatches under the skin row -----
    // AUTO first — every match keeps drawing its court at random, as it
    // always has — then the four looks, each swatch wearing its own sky as a
    // two-tone gradient. Locked ones grey out under a lock until the wins
    // stack up, exactly like the kits and ball skins, and the pick overrides
    // the random draw for the plain matches, remembered across sessions.
    this.venueButtons = [];
    [{ id: 'auto', name: 'AUTO' }, ...THEMES].forEach((venue, i) => {
      const theme = i > 0 ? THEMES[i - 1] : null;
      const unlocked = !theme || themeUnlocked(theme);
      const opts = {
        label: theme ? `Court ${theme.name}` : 'Court auto',
        onPress: () => this.pickVenue(i),
        style: {
          position: 'absolute',
          width: '26px',
          height: '26px',
          top: 'calc(env(safe-area-inset-top) + 300px)',
          left: `calc(50% + ${i * 32 - 80}px)`,
          borderRadius: '9px'
        }
      };
      if (!unlocked) opts.icon = 'lock';
      else if (!theme) opts.icon = 'refresh-cw';
      const btn = addButton(opts);
      if (theme && unlocked) {
        btn.style.backgroundImage =
          `linear-gradient(#${theme.skyTop.toString(16).padStart(6, '0')},` +
          `#${theme.horizon.toString(16).padStart(6, '0')})`;
      }
      this.venueButtons.push(btn);
    });
    this.venueCaption = addText('', {
      top: 'calc(env(safe-area-inset-top) + 328px)',
      left: '0',
      right: '0',
      textAlign: 'center',
      fontSize: '10px',
      fontWeight: '700',
      letterSpacing: '1.5px',
      color: 'rgba(255,255,255,0.85)',
      textShadow: '0 1px 4px rgba(20,40,60,0.6)'
    });

    // ----- looks: hairstyle dyes and skin tones, beside the kit row -----
    // The hair swatches dye the dressed athlete's hair — three looks free
    // from the start, the rest unlocking with career wins exactly like the
    // kits, greyed under their requirement while locked — and the skin-tone
    // swatches beside them stay free. The row dresses whoever the P1/P2
    // pills point at, each pick remembered across sessions exactly like a
    // kit; the first swatch of each group is the roster look itself, wearing
    // the dressed athlete's own shade until a pick is made.
    this.lookButtons = [];
    LOOKS.forEach((look, i) => {
      const unlocked = lookUnlocked(look);
      const opts = {
        label: look.id === 'roster' ? 'Keep the roster hair colour'
          : `Hairstyle ${look.name}`,
        onPress: () => this.pickLook(i),
        style: {
          position: 'absolute',
          width: '22px',
          height: '22px',
          top: 'calc(env(safe-area-inset-top) + 322px)',
          left: `calc(50% + ${i * 28 - 142}px)`,
          borderRadius: '999px'
        }
      };
      if (!unlocked) opts.icon = 'lock';
      const btn = addButton(opts);
      this.lookButtons.push(btn);
    });
    this.toneButtons = [];
    TONES.forEach((tone, i) => {
      const opts = {
        label: tone.id === 'roster' ? 'Keep the roster skin tone'
          : `Skin tone ${tone.name}`,
        onPress: () => this.pickTone(i),
        style: {
          position: 'absolute',
          width: '22px',
          height: '22px',
          top: 'calc(env(safe-area-inset-top) + 322px)',
          left: `calc(50% + ${i * 28 + 6}px)`,
          borderRadius: '999px'
        }
      };
      const btn = addButton(opts);
      this.toneButtons.push(btn);
    });
    this.lookCaption = addText('', {
      top: 'calc(env(safe-area-inset-top) + 346px)',
      left: '0',
      right: '0',
      textAlign: 'center',
      fontSize: '8px',
      fontWeight: '700',
      letterSpacing: '1.5px',
      color: 'rgba(255,255,255,0.85)',
      textShadow: '0 1px 4px rgba(20,40,60,0.6)'
    });

    // ----- who the swatches dress: a player, or the CPU partner -----
    // Two small pills above the swatches hand the row — the jersey number
    // with it — to the far athlete of a two-player match, or to the CPU
    // partner in doubles. They only show in those modes: against the CPU
    // everyone else keeps roster colours.
    this.kitWhoBtns = [0, 1].map((i) => addButton({
      label: 'Dress the selected athlete',
      onPress: () => this.pickKitWho(this.kitWhoIds()[i]),
      style: {
        position: 'absolute',
        width: '52px',
        height: '20px',
        top: 'calc(env(safe-area-inset-top) + 182px)',
        left: i === 0 ? 'calc(50% - 54px)' : 'calc(50% + 2px)',
        borderRadius: '999px',
        fontSize: '10px',
        fontWeight: '800',
        letterSpacing: '1px'
      }
    }));
    this.kitWhoBtns[0].textContent = 'P1';
    this.kitWhoBtns[1].textContent = 'P2';

    // ----- doubles serving tactic: rotation or stacking -----
    // Two pills on the strip under the mode row, shown only in the doubles
    // modes: the classic side-by-side rotation, or the stacking formation
    // where the near pair line up together on one half at the serve and the
    // partner takes over the half the player would normally hold. The pick
    // is remembered across sessions like the other title picks.
    this.tacticBtns = SERVING_TACTICS.map((tactic, i) => {
      const btn = addButton({
        label: `Serving tactic ${tactic.name}`,
        onPress: () => this.pickTactic(i),
        style: {
          position: 'absolute',
          width: '82px',
          height: '20px',
          top: 'calc(env(safe-area-inset-top) + 148px)',
          left: i === 0 ? 'calc(50% - 140px)' : 'calc(50% + 58px)',
          borderRadius: '999px',
          fontSize: '9px',
          fontWeight: '800',
          letterSpacing: '1px',
          display: 'none'
        }
      });
      btn.textContent = tactic.name;
      return btn;
    });

    // ----- jersey number -----
    // A small field beside the kit swatches: one or two digits, painted in
    // white on the back of the chosen kit's jersey. Empty means no number,
    // and the choice survives sessions like the kit itself.
    this.numberInput = document.createElement('input');
    this.numberInput.type = 'text';
    this.numberInput.inputMode = 'numeric';
    this.numberInput.maxLength = 2;
    this.numberInput.autocomplete = 'off';
    this.numberInput.placeholder = '#';
    this.numberInput.setAttribute('aria-label', 'Jersey number');
    this.numberInput.value = selectedNumber(this.kitWho);
    this.numberInput.style.cssText =
      'position:absolute;left:calc(50% + 6px);top:calc(env(safe-area-inset-top) + 218px);' +
      'width:52px;height:30px;border-radius:8px;text-align:center;' +
      'background:rgba(10,18,30,0.55);border:1.5px solid rgba(255,255,255,0.45);' +
      'color:#ffffff;font-size:15px;font-weight:800;outline:none;';
    this.numberInput.addEventListener('input', () => {
      const clean = this.numberInput.value.replace(/\D/g, '').slice(0, 2);
      if (clean !== this.numberInput.value) this.numberInput.value = clean;
      if (clean === selectedNumber(this.kitWho)) return;
      selectNumber(clean, this.kitWho);
      this.rebuildLineupAthlete(this.lineupIdxOf(this.kitWho));
      haptic('tick');
    });
    document.getElementById('hud').appendChild(this.numberInput);

    // ----- player name -----
    // A field beside the jersey number: one to ten letters, typed once and
    // remembered per player like the kit and the number. It replaces YOU and
    // P1 on the team sheet, the recap headline, the momentum labels and the
    // tally line, and it is painted in small white letters on the back of
    // that player's jersey, above the number. An empty field keeps the
    // readings as they always were and the jersey carrying just its number.
    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.maxLength = 10;
    this.nameInput.autocomplete = 'off';
    this.nameInput.autocapitalize = 'characters';
    this.nameInput.spellcheck = false;
    this.nameInput.placeholder = 'NAME';
    this.nameInput.setAttribute('aria-label', 'Player name');
    this.nameInput.value = selectedName(this.kitWho);
    this.nameInput.style.cssText =
      'position:absolute;left:calc(50% + 64px);top:calc(env(safe-area-inset-top) + 220px);' +
      'width:84px;height:24px;border-radius:8px;text-align:center;' +
      'background:rgba(10,18,30,0.55);border:1.5px solid rgba(255,255,255,0.45);' +
      'color:#ffffff;font-size:11px;font-weight:800;letter-spacing:1px;' +
      'text-transform:uppercase;outline:none;';
    this.nameInput.addEventListener('input', () => {
      const clean = this.nameInput.value.replace(/[^a-z]/gi, '').slice(0, 10);
      if (clean !== this.nameInput.value) this.nameInput.value = clean;
      if (clean.toUpperCase() === selectedName(this.kitWho)) return;
      selectName(clean, this.kitWho);
      // The name is painted on the jersey's back: the athlete re-dresses on
      // the spot, whoever the swatch row currently dresses.
      this.rebuildLineupAthlete(this.lineupIdxOf(this.kitWho));
      haptic('tick');
    });
    document.getElementById('hud').appendChild(this.nameInput);

    this.caption = addText('', {
      bottom: 'calc(env(safe-area-inset-bottom) + 380px)',
      left: '0',
      right: '0',
      textAlign: 'center',
      fontSize: '14px',
      fontWeight: '700',
      color: '#ffffff',
      textShadow: '0 2px 8px rgba(20,40,60,0.6)'
    });

    // The pick buttons across the width, names under each. The unsigned
    // recruit stands in the row dimmed under a lock with her requirement on
    // it until the career banks her wins — the spread computed from the
    // roster's own length so the row stays centred whatever it holds.
    this.pickButtons = [];
    this.nameLabels = [];
    const pickIcons = ['zap', 'user', 'shield', 'rocket'];
    const pickGap = 80;
    const pickOff = ((ROSTER.length - 1) * pickGap + 76) / 2;
    ROSTER.forEach((character, i) => {
      const locked = !athleteUnlocked(character);
      const btn = addButton({
        icon: locked ? 'lock' : pickIcons[i],
        label: character.name,
        onPress: () => this.pick(i),
        style: {
          position: 'absolute',
          width: '76px',
          height: '76px',
          left: `calc(50% + ${i * pickGap - pickOff}px)`,
          bottom: 'calc(env(safe-area-inset-bottom) + 280px)',
          backgroundColor: locked
            ? 'rgba(110, 120, 130, 0.4)'
            : i === this.selIdx ? SEL_BG : DIM_BG
        }
      });
      // The requirement rides on the locked recruit's own tile, under the
      // lock: what the career still owes before she is signed.
      if (locked) {
        btn.appendChild(addText(`AT ${character.wins} WINS`, {
          left: '2px',
          right: '2px',
          bottom: '9px',
          textAlign: 'center',
          fontSize: '8px',
          fontWeight: '800',
          letterSpacing: '0.5px',
          color: 'rgba(255, 255, 255, 0.8)',
          whiteSpace: 'nowrap'
        }));
      }
      this.pickButtons.push(btn);

      const label = addText(character.name, {
        bottom: 'calc(env(safe-area-inset-bottom) + 250px)',
        left: `calc(50% + ${i * pickGap - pickOff - 10}px)`,
        width: '96px',
        textAlign: 'center',
        fontSize: '13px',
        fontWeight: '700',
        color: locked ? 'rgba(255, 255, 255, 0.5)' : '#ffffff',
        textShadow: '0 2px 6px rgba(20,40,60,0.6)'
      });
      this.nameLabels.push(label);
    });

    this.playBtn = addButton({
      icon: 'play',
      label: 'Play',
      onPress: () => this.game.start(MatchScene),
      style: {
        position: 'absolute',
        width: '92px',
        height: '92px',
        left: 'calc(50% - 46px)',
        bottom: 'calc(env(safe-area-inset-bottom) + 56px)',
        backgroundColor: SEL_BG
      }
    });

    // A third way to play: the cup. Three rounds, one set each, each against
    // a CPU opponent playing a step harder than the last, on a fresh random
    // theme — win all three and the trophy is yours.
    this.cupBtn = addButton({
      icon: 'crown',
      label: 'Cup',
      onPress: () => {
        if (!cupRun()) startCup();
        this.openCup();
      },
      style: {
        position: 'absolute',
        width: '64px',
        height: '64px',
        left: 'calc(50% + 62px)',
        bottom: 'calc(env(safe-area-inset-bottom) + 70px)',
        backgroundColor: DIM_BG
      }
    });
    this.cupLbl = addText('CUP', {
      left: 'calc(50% + 54px)',
      bottom: 'calc(env(safe-area-inset-bottom) + 44px)',
      width: '80px',
      textAlign: 'center',
      fontSize: '10px',
      fontWeight: '700',
      letterSpacing: '2px',
      color: '#ffffff',
      textShadow: '0 1px 4px rgba(20,40,60,0.6)'
    });

    // A small help button on the play button's other side opens the
    // how-to-play reference.
    this.helpBtn = addButton({
      icon: 'book-open',
      label: 'How to play',
      onPress: () => this.openHelp(),
      style: {
        position: 'absolute',
        width: '64px',
        height: '64px',
        left: 'calc(50% - 126px)',
        bottom: 'calc(env(safe-area-inset-bottom) + 70px)',
        backgroundColor: DIM_BG
      }
    });
    this.helpLbl = addText('HELP', {
      left: 'calc(50% - 134px)',
      bottom: 'calc(env(safe-area-inset-bottom) + 44px)',
      width: '80px',
      textAlign: 'center',
      fontSize: '10px',
      fontWeight: '700',
      letterSpacing: '2px',
      color: '#ffffff',
      textShadow: '0 1px 4px rgba(20,40,60,0.6)'
    });

    // A small settings button in the top corner opens the settings panel.
    this.switches = [];
    this.settingsBtn = addButton({
      icon: 'settings', label: 'Settings',
      onPress: () => this.openSettings(),
      style: { position: 'absolute', width: '44px', height: '44px',
        right: '16px', top: 'calc(env(safe-area-inset-top) + 12px)', backgroundColor: DIM_BG }
    });
    // The back chevron at the title's left edge: whatever card is open over
    // the title closes, stepping back one screen. On the clear title there
    // is nothing behind to reach.
    this.cornerBackBtn = addButton({
      icon: 'chevron-left', label: 'Back',
      onPress: () => this.goBack(),
      style: { position: 'absolute', width: '44px', height: '44px',
        left: '16px', top: 'calc(env(safe-area-inset-top) + 12px)', backgroundColor: DIM_BG }
    });
    // The match history beside it: the record's last ten matches, raised
    // straight from the title without a detour through the career card.
    // Portrait stacks it under the chevron; landscape lays the pair out flat.
    this.historyBtn = addButton({
      icon: 'history', label: 'Match log',
      onPress: () => { this.logFromTitle = true; this.openLog(); },
      style: { position: 'absolute', width: '44px', height: '44px',
        left: '16px', top: 'calc(env(safe-area-inset-top) + 64px)', backgroundColor: DIM_BG }
    });
    // The career and daily buttons have moved down to flank the play
    // cluster's outer edge, past the how-to-play and cup buttons.
    this.statsBtn = addButton({
      icon: 'trophy', label: 'Career stats',
      onPress: () => this.openStats(),
      style: { position: 'absolute', width: '44px', height: '44px',
        left: 'calc(50% - 156px)', bottom: 'calc(env(safe-area-inset-bottom) + 24px)', backgroundColor: DIM_BG }
    });
    // The weekly goals: a GOALS button stacked above the career button opens
    // the week's three rotating goals card.
    this.goalsBtn = addButton({
      icon: 'list-checks', label: 'Weekly goals',
      onPress: () => this.openGoals(),
      style: { position: 'absolute', width: '44px', height: '44px',
        left: 'calc(50% - 156px)', bottom: 'calc(env(safe-area-inset-bottom) + 78px)', backgroundColor: DIM_BG }
    });
    this.dailyBtn = addButton({
      icon: 'calendar', label: 'Daily challenge',
      onPress: () => this.openDaily(),
      style: { position: 'absolute', width: '44px', height: '44px',
        left: 'calc(50% + 108px)', bottom: 'calc(env(safe-area-inset-bottom) + 24px)', backgroundColor: DIM_BG }
    });

    // The season ladder: eight ranked opponents, one rung at a time — beat
    // the rung you sit on to climb, lose and you slide one back.
    this.ladderBtn = addButton({
      icon: 'list',
      label: 'Season ladder',
      onPress: () => this.openLadder(),
      style: {
        position: 'absolute',
        width: '44px',
        height: '44px',
        right: '16px',
        top: 'calc(env(safe-area-inset-top) + 64px)',
        backgroundColor: DIM_BG
      }
    });

    // ----- CPU difficulty: three or four small buttons, one shared caption
    this.diffCaption = addText('CPU: NORMAL', {
      bottom: 'calc(env(safe-area-inset-bottom) + 222px)',
      left: '0',
      right: '0',
      textAlign: 'center',
      fontSize: '12px',
      fontWeight: '700',
      letterSpacing: '1px',
      color: 'rgba(255,255,255,0.9)',
      textShadow: '0 1px 4px rgba(20,40,60,0.6)'
    });
    this.diffButtons = [];
    const diffIcons = ['shield', 'gauge', 'flame', 'crown'];
    const diffLefts = [
      'calc(50% - 135px)', 'calc(50% - 79px)',
      'calc(50% - 23px)', 'calc(50% + 33px)'
    ];
    this.diffChoices.forEach((level, i) => {
      const btn = addButton({
        icon: diffIcons[i],
        label: level.name,
        onPress: () => this.pickDiff(i),
        style: {
          position: 'absolute',
          width: '52px',
          height: '52px',
          left: diffLefts[i],
          bottom: 'calc(env(safe-area-inset-bottom) + 164px)',
          backgroundColor: i === this.diffIdx ? SEL_BG : DIM_BG
        }
      });
      this.diffButtons.push(btn);
    });

    // ----- match length: best of three, or the marathon -----
    // Two pills flanking the CPU caption, right beside the difficulty
    // picker: the usual best of three at 7 a set, or a MARATHON of five
    // sets at 11. The pick is remembered the same way the difficulty is.
    this.lenButtons = MATCH_LENGTHS.map((len, i) => addButton({
      label: `Match length ${len.name}`,
      onPress: () => this.pickLen(i),
      style: {
        position: 'absolute',
        width: i === 0 ? '72px' : '82px',
        height: '28px',
        bottom: 'calc(env(safe-area-inset-bottom) + 216px)',
        ...(i === 0 ? { left: '14px' } : { right: '14px' }),
        borderRadius: '999px',
        fontSize: '9px',
        fontWeight: '800',
        letterSpacing: '0.5px'
      }
    }));
    this.lenButtons[0].textContent = 'BEST OF 3';
    this.lenButtons[1].textContent = 'MARATHON';
    // The session's series toggle sits beside the length pills.
    this.seriesBtn = addButton({
      label: 'Toggle the best-of-three series',
      onPress: () => {
        setSeriesOn(!seriesActive());
        this.refreshSelection();
        haptic('tick');
      },
      style: {
        position: 'absolute',
        left: '14px',
        top: 'calc(env(safe-area-inset-top) + 420px)',
        width: '60px',
        height: '26px',
        borderRadius: '999px',
        fontSize: '9px',
        fontWeight: '800',
        letterSpacing: '1px'
      }
    });
    this.seriesBtn.textContent = 'SERIES';

    // The whole stack is placed by the layout pass, not by the creation
    // styles above: portrait keeps one centre column, landscape splits into
    // two side columns — the creation styles are only the portrait fallback.
    this.layoutTitle(window.innerWidth, window.innerHeight);

    this.refreshKitWho();
    this.refreshKitRow();
    this.refreshSkinRow();
    this.refreshVenueRow();
    this.refreshLookRow();
    this.refreshSelection();
    // A cup run still live — or a trophy just won — reopens its own screen
    // over the title court.
    if (takeTrophy()) this.openTrophy();
    else if (cupRun()) this.openCup();
    else if (takeDailyCard()) this.openDaily();
    else if (takeLadderCard()) this.openLadder();
    // The legend tier's unlock toast: shown once, ever, the first time the
    // title runs after the ladder's top rung has been beaten.
    if (takeLegendToast()) {
      this.legendToast = addText('LEGEND UNLOCKED · THE TIER ABOVE HARD AWAITS', {
        left: '50%',
        top: 'calc(env(safe-area-inset-top) + 132px)',
        transform: 'translateX(-50%)',
        padding: '5px 14px',
        borderRadius: '999px',
        backgroundColor: 'rgba(228, 178, 34, 0.95)',
        color: '#231503',
        fontSize: '11px',
        fontWeight: '800',
        letterSpacing: '1px',
        whiteSpace: 'nowrap'
      });
      this.legendToastT = 3.6;
      haptic('win');
    }
    // The weekly goals completed away from a match — a daily win or a
    // ladder rung finishing one — toast once here, stacked if several
    // landed between screens.
    this.goalToasts = takeGoalCompletions().map((id, i) => ({
      el: addText(`GOAL COMPLETE · ${weeklyGoalName(id)}`, {
        left: '50%',
        top: `calc(env(safe-area-inset-top) + ${132 + i * 34}px)`,
        transform: 'translateX(-50%)',
        padding: '5px 14px',
        borderRadius: '999px',
        backgroundColor: 'rgba(228, 178, 34, 0.95)',
        color: '#231503',
        fontSize: '11px',
        fontWeight: '800',
        letterSpacing: '1px',
        whiteSpace: 'nowrap'
      }),
      t: 3.6
    }));
    // The recruit's signing: the first title run after the career banked her
    // wins announces her in gold — consumed quietly when the match that
    // crossed the mark already toasted her in play, and still here for a
    // record restored past it.
    const nova = ROSTER.find((r) => r.id === 'nova');
    if (takeAthleteToast(nova && athleteUnlocked(nova))) {
      const stacked = (this.legendToast ? 1 : 0) +
        (this.goalToasts ? this.goalToasts.length : 0);
      this.novaToast = addText(
        `NOVA JOINS THE ROSTER · SIGNED AT ${nova.wins} WINS`, {
          left: '50%',
          top: `calc(env(safe-area-inset-top) + ${132 + stacked * 34}px)`,
          transform: 'translateX(-50%)',
          padding: '5px 14px',
          borderRadius: '999px',
          backgroundColor: 'rgba(228, 178, 34, 0.95)',
          color: '#231503',
          fontSize: '11px',
          fontWeight: '800',
          letterSpacing: '1px',
          whiteSpace: 'nowrap'
        });
      this.novaToastT = 3.6;
      haptic('win');
    }
  }

  pick(i) {
    if (i === this.selIdx) return;
    // The unsigned recruit refuses the pick: her wins haven't banked yet.
    if (!athleteUnlocked(ROSTER[i])) {
      haptic('tick');
      return;
    }
    const prev = this.selIdx;
    const prevP2 = this.p2Idx;
    this.selIdx = i;
    selectCharacter(ROSTER[i].id);
    // The kit follows the player: the new pick dresses in it, the old one
    // goes back to their own roster colours. Player two's slot may move too —
    // the far athlete is whoever the player did not pick — so their kit
    // follows them onto the new body.
    this.p2Idx = ROSTER.findIndex((r) => r.id === p2Character().id);
    for (const k of new Set([prev, i, prevP2, this.p2Idx])) {
      this.rebuildLineupAthlete(k);
    }
    // The roster pick re-dresses the lineup — and the look row's roster
    // swatches wear the newly dressed athlete's own shade now.
    this.refreshSelection();
    this.refreshLookRow();
    haptic('tick');
  }

  pickKit(i) {
    const kit = KITS[i];
    if (!kitUnlocked(kit)) return;
    // The swatch row dresses whoever the toggle points at, and the choice
    // lands on that side's own remembered kit.
    const who = this.kitWho;
    if (i === this.kitIdxOf(who)) return;
    this.setKitIdx(who, i);
    selectKit(kit.id, who);
    this.rebuildLineupAthlete(this.lineupIdxOf(who));
    this.refreshKitRow();
    haptic('tick');
  }

  /// The remembered kit index per dressing target: player one, player two
  /// and the doubles partner each keep their own.
  kitIdxOf(who) {
    return who === 'p2' ? this.kitIdxP2
      : who === 'partner' ? this.kitIdxPartner : this.kitIdxP1;
  }

  setKitIdx(who, i) {
    if (who === 'p2') this.kitIdxP2 = i;
    else if (who === 'partner') this.kitIdxPartner = i;
    else this.kitIdxP1 = i;
  }

  /// The lineup slot a dressing target wears: player one the picked
  /// character; player two in a two-player match and the CPU partner in
  /// doubles both the first roster slot the player did not pick.
  lineupIdxOf(who) {
    if (who === 'p2' && this.twoMode()) return this.p2Idx;
    if (who === 'partner' && this.doublesMode()) return this.p2Idx;
    return this.selIdx;
  }

  /// Rebuilds one lineup athlete in their current colours — the picked
  /// character in the chosen kit, everyone else in their own kit — reusing
  /// the same spot in the line and freeing the old body's geometry.
  /// The colours a lineup slot wears: the picked character in player one's
  /// kit, player two's slot in player two's own kit in a two-player match,
  /// the partner's slot in the partner's own kit in doubles, and everyone
  /// else in their roster colours.
  dressedColors(i) {
    if (this.twoMode() && i === this.p2Idx) return playerColors('p2');
    if (this.doublesMode() && i === this.p2Idx) return playerColors('partner');
    return i === this.selIdx ? playerColors('p1') : ROSTER[i].colors;
  }

  rebuildLineupAthlete(i) {
    const old = this.lineup[i];
    const fresh = createAthlete(this.dressedColors(i));
    fresh.position.copy(old.position);
    fresh.rotation.copy(old.rotation);
    this.root.add(fresh);
    this.root.remove(old);
    this.lineup[i] = fresh;
    disposeSceneGraph(old);
  }

  refreshKitRow() {
    const cur = this.kitIdxOf(this.kitWho);
    this.kitButtons.forEach((btn, i) => {
      const kit = KITS[i];
      btn.style.backgroundColor = kitUnlocked(kit)
        ? `#${kit.jersey.toString(16).padStart(6, '0')}`
        : 'rgba(110, 120, 130, 0.4)';
      btn.style.border = i === cur
        ? '2px solid #ffffff'
        : '2px solid rgba(255,255,255,0.25)';
    });
    // The CUSTOM swatch wears the kit as painted — jersey with the shorts
    // band — and carries the selection ring while it is the one being worn.
    const custom = customKitColors(this.kitWho);
    this.customKitBtn.style.backgroundColor =
      `#${custom.jersey.toString(16).padStart(6, '0')}`;
    this.customKitBand.style.backgroundColor =
      `#${custom.shorts.toString(16).padStart(6, '0')}`;
    this.customKitBtn.style.border = cur === KITS.length
      ? '2px solid #ffffff'
      : '2px solid rgba(255,255,255,0.25)';
    const next = KITS.find((k) => !kitUnlocked(k));
    this.kitCaption.textContent =
      `${cur === KITS.length ? 'CUSTOM' : KITS[cur].name}` +
      (next ? ` · NEXT AT ${next.wins} WINS` : ' · EVERY KIT UNLOCKED');
  }

  /// The ball-skin row's own refresh: the white selection ring rides
  /// whichever design the game is playing with — a preset by its index, the
  /// custom ball by its own swatch — the CUSTOM swatch wears the design as
  /// painted, and the caption names the design and the next unlock.
  refreshSkinRow() {
    const custom = selectedSkin().id === 'custom';
    const cur = SKINS.findIndex((s) => s.id === selectedSkin().id);
    this.skinButtons.forEach((btn, i) => {
      btn.style.border = i === cur
        ? '2px solid #ffffff'
        : '2px solid rgba(255,255,255,0.25)';
    });
    this.customBallBtn.style.backgroundImage = skinSwatch(selectedSkin());
    this.customBallBtn.style.border = custom
      ? '2px solid #ffffff'
      : '2px solid rgba(255,255,255,0.25)';
    const next = SKINS.find((s) => !skinUnlocked(s));
    this.skinCaption.textContent =
      `${custom ? 'CUSTOM' : SKINS[cur].name}` +
      (next ? ` · NEXT AT ${next.wins} WINS` : ' · EVERY SKIN UNLOCKED');
  }

  /// Opening the custom kit: it becomes the kit whoever the dressing toggle
  /// points at wears — banked like a preset — and the designer rises over
  /// the title. Already wearing it just reopens the designer to repaint.
  openCustomKit() {
    const who = this.kitWho;
    const wasCustom = selectedKit(who).id === 'custom';
    selectCustomKit(who);
    this.setKitIdx(who, KITS.length);
    if (!wasCustom) this.rebuildLineupAthlete(this.lineupIdxOf(who));
    this.refreshKitRow();
    this.openCustomKitEditor(who);
    haptic('tick');
  }

  /// The kit designer: a dark translucent card over the dimmed title with
  /// two colour rows — JERSEY and SHORTS — each a palette of swatches, a few
  /// pairs locked behind career wins and dimmed under their requirement. A
  /// pick repaints the dressed athlete on the spot and banks for that
  /// player; the caption reads the pair and the next locked pair. An
  /// outline BACK pill returns to the title.
  openCustomKitEditor(who) {
    this.customWho = who;
    this.hideTitleUI(true);
    this.overlayHost(300);
    this.customDim = addText('', {
      left: '0', right: '0', top: '0', bottom: '0',
      backgroundColor: 'rgba(6, 12, 22, 0.55)'
    });
    this.customPanel = addText('', {
      left: '50%', top: '50%', width: 'min(320px, 86vw)', height: '300px',
      transform: 'translate(-50%, -50%)', borderRadius: '22px',
      backgroundColor: 'rgba(10, 18, 30, 0.85)',
      border: '1px solid rgba(255, 255, 255, 0.14)'
    });
    this.customPanel.appendChild(addText('CUSTOM KIT', {
      left: '0', right: '0', top: '20px', textAlign: 'center',
      fontSize: '18px', fontWeight: '800', letterSpacing: '2px', color: '#ffffff'
    }));
    this.customPanel.appendChild(addText(
      `DRESSING · ${who === 'p1' ? 'P1' : who === 'p2' ? 'P2' : 'PARTNER'}`, {
        left: '0', right: '0', top: '46px', textAlign: 'center',
        fontSize: '9px', fontWeight: '700', letterSpacing: '2px',
        color: 'rgba(255, 255, 255, 0.55)'
      }));
    // The two colour rows, built once and repainted in place on every pick.
    const row = (label, top, palette, slot) => {
      this.customPanel.appendChild(addText(label, {
        left: '22px', top: `${top}px`, fontSize: '10px', fontWeight: '800',
        letterSpacing: '1.5px', color: '#ffd24a'
      }));
      return palette.map((entry, i) => {
        const opts = {
          label: `${label.toLowerCase()} colour ${entry.name}`,
          onPress: () => this.pickCustomColor(slot, entry),
          style: {
            position: 'absolute', width: '30px', height: '30px',
            left: `calc(22px + ${i} * 35px)`, top: `${top + 18}px`,
            borderRadius: '8px'
          }
        };
        if (!customColorUnlocked(entry)) opts.icon = 'lock';
        const btn = addButton(opts);
        this.customPanel.appendChild(btn);
        return btn;
      });
    };
    this.customJerseyBtns = row('JERSEY', 78, CUSTOM_JERSEYS, 'jersey');
    this.customShortsBtns = row('SHORTS', 140, CUSTOM_SHORTS, 'shorts');
    this.customCaption = addText('', {
      left: '16px', right: '16px', top: '198px', textAlign: 'center',
      fontSize: '9px', fontWeight: '700', letterSpacing: '1px',
      color: 'rgba(255, 255, 255, 0.85)'
    });
    this.customPanel.appendChild(this.customCaption);
    this.customBackBtn = addButton({
      label: 'Back to title',
      onPress: () => this.closeCustomKit(),
      style: {
        position: 'absolute', width: '128px', height: '48px',
        left: 'calc(50% - 64px)', bottom: 'calc(50% - 130px)',
        borderRadius: '999px',
        backgroundColor: 'rgba(10, 18, 30, 0.4)',
        border: '1.5px solid rgba(255, 255, 255, 0.45)',
        color: '#ffffff', fontSize: '13px', fontWeight: '700', letterSpacing: '1px'
      }
    });
    this.customBackBtn.textContent = 'BACK';
    this.overlay.append(this.customDim, this.customPanel, this.customBackBtn);
    this.refreshCustomEditor();
  }

  /// The designer's swatches repainted: selection rings on the pair being
  /// worn, locked shades dimmed, and the caption reading the pair with the
  /// next locked pair's requirement behind it.
  refreshCustomEditor() {
    const cur = customKitColors(this.customWho);
    const paint = (btns, palette, picked) => {
      btns.forEach((btn, i) => {
        const entry = palette[i];
        const unlocked = customColorUnlocked(entry);
        btn.style.backgroundColor = unlocked
          ? `#${entry.color.toString(16).padStart(6, '0')}`
          : 'rgba(110, 120, 130, 0.4)';
        btn.style.border = entry.color === picked
          ? '2px solid #ffffff'
          : '2px solid rgba(255,255,255,0.25)';
      });
    };
    paint(this.customJerseyBtns, CUSTOM_JERSEYS, cur.jersey);
    paint(this.customShortsBtns, CUSTOM_SHORTS, cur.shorts);
    const nameOf = (palette, color) => {
      const e = palette.find((c) => c.color === color);
      return e ? e.name : '';
    };
    // The next locked pair: the two rows share their win marks, so the
    // smallest outstanding one names when the next pair arrives together.
    const nextWins = Math.min(
      ...[...CUSTOM_JERSEYS, ...CUSTOM_SHORTS]
        .filter((c) => !customColorUnlocked(c))
        .map((c) => c.wins)
    );
    this.customCaption.textContent = isFinite(nextWins)
      ? `${nameOf(CUSTOM_JERSEYS, cur.jersey)} · ${nameOf(CUSTOM_SHORTS, cur.shorts)}` +
        ` — NEXT PAIR AT ${nextWins} WINS`
      : `${nameOf(CUSTOM_JERSEYS, cur.jersey)} · ${nameOf(CUSTOM_SHORTS, cur.shorts)}` +
        ' — EVERY PAIR UNLOCKED';
    this.customCaption.style.color = 'rgba(255, 255, 255, 0.85)';
  }

  /// Picking a custom colour: a locked shade refuses with its requirement in
  /// the caption; an unlocked one repaints the dressed athlete on the spot
  /// and banks for that player.
  pickCustomColor(slot, entry) {
    if (!customColorUnlocked(entry)) {
      this.customCaption.textContent = `${entry.name} · AT ${entry.wins} WINS`;
      this.customCaption.style.color = 'rgba(255, 138, 122, 0.9)';
      haptic('tick');
      return;
    }
    const cur = customKitColors(this.customWho);
    if (cur[slot] === entry.color) return;
    selectCustomColor(slot, entry.color, this.customWho);
    this.rebuildLineupAthlete(this.lineupIdxOf(this.customWho));
    this.refreshCustomEditor();
    this.refreshKitRow();
    haptic('tick');
  }

  closeCustomKit() {
    this.overlay?.remove();
    this.overlay = null;
    this.customDim?.remove();
    this.customPanel?.remove();
    this.customBackBtn?.remove();
    this.customDim = null;
    this.customPanel = null;
    this.customBackBtn = null;
    this.customJerseyBtns = null;
    this.customShortsBtns = null;
    this.customWho = null;
    this.hideTitleUI(false);
    haptic('tick');
  }

  /// Opening the custom ball: it becomes the skin the game plays with —
  /// banked like a preset — and the designer rises over the title. Already
  /// wearing it just reopens the designer to repaint.
  openCustomBall() {
    const wasCustom = selectedSkin().id === 'custom';
    selectCustomBall();
    if (!wasCustom) this.repaintPreviewBall();
    this.refreshSkinRow();
    this.openCustomBallEditor();
    haptic('tick');
  }

  /// The ball designer: a dark translucent card over the dimmed title with
  /// two colour rows — BASE LEATHER and PANEL BANDS — each a palette of
  /// swatches, a few pairs locked behind career wins and dimmed under their
  /// requirement. A pick repaints the preview ball on the spot and banks;
  /// the caption reads the pair and the next locked pair's requirement. An
  /// outline BACK pill returns to the title.
  openCustomBallEditor() {
    this.hideTitleUI(true);
    this.overlayHost(300);
    this.ballDim = addText('', {
      left: '0', right: '0', top: '0', bottom: '0',
      backgroundColor: 'rgba(6, 12, 22, 0.55)'
    });
    this.ballPanel = addText('', {
      left: '50%', top: '50%', width: 'min(320px, 86vw)', height: '300px',
      transform: 'translate(-50%, -50%)', borderRadius: '22px',
      backgroundColor: 'rgba(10, 18, 30, 0.85)',
      border: '1px solid rgba(255, 255, 255, 0.14)'
    });
    this.ballPanel.appendChild(addText('CUSTOM BALL', {
      left: '0', right: '0', top: '20px', textAlign: 'center',
      fontSize: '18px', fontWeight: '800', letterSpacing: '2px', color: '#ffffff'
    }));
    // The two colour rows, built once and repainted in place on every pick.
    const row = (label, top, palette, slot) => {
      this.ballPanel.appendChild(addText(label, {
        left: '22px', top: `${top}px`, fontSize: '10px', fontWeight: '800',
        letterSpacing: '1.5px', color: '#ffd24a'
      }));
      return palette.map((entry, i) => {
        const opts = {
          label: `${label.toLowerCase()} colour ${entry.name}`,
          onPress: () => this.pickCustomBallColor(slot, entry),
          style: {
            position: 'absolute', width: '30px', height: '30px',
            left: `calc(22px + ${i} * 35px)`, top: `${top + 18}px`,
            borderRadius: '8px'
          }
        };
        if (!customColorUnlocked(entry)) opts.icon = 'lock';
        const btn = addButton(opts);
        this.ballPanel.appendChild(btn);
        return btn;
      });
    };
    this.ballBaseBtns = row('BASE LEATHER', 78, CUSTOM_BASES, 'base');
    this.ballPanelBtns = row('PANEL BANDS', 140, CUSTOM_PANELS, 'panels');
    this.ballCaption = addText('', {
      left: '16px', right: '16px', top: '198px', textAlign: 'center',
      fontSize: '9px', fontWeight: '700', letterSpacing: '1px',
      color: 'rgba(255, 255, 255, 0.85)'
    });
    this.ballPanel.appendChild(this.ballCaption);
    this.ballBackBtn = addButton({
      label: 'Back to title',
      onPress: () => this.closeCustomBall(),
      style: {
        position: 'absolute', width: '128px', height: '48px',
        left: 'calc(50% - 64px)', bottom: 'calc(50% - 130px)',
        borderRadius: '999px',
        backgroundColor: 'rgba(10, 18, 30, 0.4)',
        border: '1.5px solid rgba(255, 255, 255, 0.45)',
        color: '#ffffff', fontSize: '13px', fontWeight: '700', letterSpacing: '1px'
      }
    });
    this.ballBackBtn.textContent = 'BACK';
    this.overlay.append(this.ballDim, this.ballPanel, this.ballBackBtn);
    this.refreshCustomBallEditor();
  }

  /// The designer's swatches repainted: selection rings on the pair being
  /// worn, locked shades dimmed, and the caption reading the pair with the
  /// next locked pair's requirement behind it.
  refreshCustomBallEditor() {
    const cur = customBallColors();
    const paint = (btns, palette, picked) => {
      btns.forEach((btn, i) => {
        const entry = palette[i];
        const unlocked = customColorUnlocked(entry);
        btn.style.backgroundColor = unlocked
          ? `#${entry.color.toString(16).padStart(6, '0')}`
          : 'rgba(110, 120, 130, 0.4)';
        btn.style.border = entry.color === picked
          ? '2px solid #ffffff'
          : '2px solid rgba(255,255,255,0.25)';
      });
    };
    paint(this.ballBaseBtns, CUSTOM_BASES, cur.base);
    paint(this.ballPanelBtns, CUSTOM_PANELS, cur.panels);
    const nameOf = (palette, color) => {
      const e = palette.find((c) => c.color === color);
      return e ? e.name : '';
    };
    // The next locked pair: the two rows share their win marks, so the
    // smallest outstanding one names when the next pair arrives together.
    const nextWins = Math.min(
      ...[...CUSTOM_BASES, ...CUSTOM_PANELS]
        .filter((c) => !customColorUnlocked(c))
        .map((c) => c.wins)
    );
    this.ballCaption.textContent = isFinite(nextWins)
      ? `${nameOf(CUSTOM_BASES, cur.base)} · ${nameOf(CUSTOM_PANELS, cur.panels)}` +
        ` — NEXT PAIR AT ${nextWins} WINS`
      : `${nameOf(CUSTOM_BASES, cur.base)} · ${nameOf(CUSTOM_PANELS, cur.panels)}` +
        ' — EVERY PAIR UNLOCKED';
    this.ballCaption.style.color = 'rgba(255, 255, 255, 0.85)';
  }

  /// Picking a custom ball colour: a locked shade refuses with its
  /// requirement in the caption; an unlocked one repaints the preview ball
  /// on the spot and banks for the whole game.
  pickCustomBallColor(slot, entry) {
    if (!customColorUnlocked(entry)) {
      this.ballCaption.textContent = `${entry.name} · AT ${entry.wins} WINS`;
      this.ballCaption.style.color = 'rgba(255, 138, 122, 0.9)';
      haptic('tick');
      return;
    }
    const cur = customBallColors();
    if (cur[slot] === entry.color) return;
    selectCustomBallColor(slot, entry.color);
    this.repaintPreviewBall();
    this.refreshSkinRow();
    this.refreshCustomBallEditor();
    haptic('tick');
  }

  closeCustomBall() {
    this.overlay?.remove();
    this.overlay = null;
    this.ballDim?.remove();
    this.ballPanel?.remove();
    this.ballBackBtn?.remove();
    this.ballDim = null;
    this.ballPanel = null;
    this.ballBackBtn = null;
    this.ballBaseBtns = null;
    this.ballPanelBtns = null;
    this.ballCaption = null;
    this.hideTitleUI(false);
    haptic('tick');
  }

  /// Tapping a venue banks it for the next match; locked ones stay dimmed
  /// under their mark until the career earns them.
  pickVenue(i) {
    if (i === this.venueIdx) return;
    this.venueIdx = i;
    selectVenue(i === 0 ? 'auto' : THEMES[i - 1].id);
    this.refreshVenueRow();
    haptic('tick');
  }

  refreshVenueRow() {
    this.venueButtons.forEach((btn, i) => {
      const theme = i > 0 ? THEMES[i - 1] : null;
      const unlocked = !theme || themeUnlocked(theme);
      btn.style.backgroundColor = !theme
        ? 'rgba(29, 111, 184, 0.55)'
        : unlocked ? 'transparent' : 'rgba(110, 120, 130, 0.4)';
      btn.style.border = i === this.venueIdx
        ? '2px solid #ffffff'
        : '2px solid rgba(255,255,255,0.25)';
    });
    const next = THEMES.find((t) => !themeUnlocked(t));
    const cur = this.venueIdx === 0 ? 'AUTO' : THEMES[this.venueIdx - 1].name;
    this.venueCaption.textContent =
      `COURT · ${cur}` +
      (next ? ` · NEXT AT ${next.wins} WINS` : ' · EVERY VENUE UNLOCKED');
  }

  /// Repaints the title's preview ball for the skin the game plays with: a
  /// fresh texture off the selected design, swapped onto the mesh with the
  /// old one freed.
  repaintPreviewBall() {
    const old = this.ball.material.map;
    this.ball.material.map = makeBallTexture();
    this.ball.material.needsUpdate = true;
    if (old) old.dispose();
  }

  /// Picking a ball skin: locked swatches refuse, the choice is banked, and
  /// the preview ball repaints on the spot — a fresh texture off the new
  /// skin, with the old one freed.
  pickSkin(i) {
    const skin = SKINS[i];
    if (!skinUnlocked(skin)) return;
    if (skin.id === selectedSkin().id) return;
    selectSkin(skin.id);
    this.repaintPreviewBall();
    this.refreshSkinRow();
    haptic('tick');
  }

  pickLook(i) {
    const look = LOOKS[i];
    if (!lookUnlocked(look)) return;
    const who = this.kitWho;
    // The CPU partner keeps roster looks, so the taps no-op on their turn.
    if (who !== 'p1' && who !== 'p2') return;
    if (look.id === selectedLook(who).id) return;
    selectLook(look.id, who);
    this.rebuildLineupAthlete(this.lineupIdxOf(who));
    this.refreshLookRow();
    haptic('tick');
  }

  pickTone(i) {
    const tone = TONES[i];
    const who = this.kitWho;
    if (who !== 'p1' && who !== 'p2') return;
    if (tone.id === selectedTone(who).id) return;
    selectTone(tone.id, who);
    this.rebuildLineupAthlete(this.lineupIdxOf(who));
    this.refreshLookRow();
    haptic('tick');
  }

  /// The look row redrawn: the hair swatches wear their dye — the roster
  /// swatch wearing the dressed athlete's own hair shade — the skin-tone
  /// swatches their tint, the roster one that athlete's own skin, selection
  /// rings on the current picks for whoever the row dresses, and the caption
  /// naming the look and the next unlock.
  refreshLookRow() {
    const look = selectedLook(this.kitWho);
    const tone = selectedTone(this.kitWho);
    const dressed = ROSTER[this.lineupIdxOf(this.kitWho)];
    this.lookButtons.forEach((btn, i) => {
      const l = LOOKS[i];
      const unlocked = lookUnlocked(l);
      const own = l.id === 'roster' ? dressed.colors.hair : l.hair;
      btn.style.backgroundColor = unlocked
        ? `#${own.toString(16).padStart(6, '0')}`
        : 'rgba(110, 120, 130, 0.4)';
      btn.style.border = l.id === look.id
        ? '2px solid #ffffff'
        : '2px solid rgba(255,255,255,0.25)';
    });
    this.toneButtons.forEach((btn, i) => {
      const t = TONES[i];
      const own = t.id === 'roster' ? dressed.colors.skin : t.skin;
      btn.style.backgroundColor = `#${own.toString(16).padStart(6, '0')}`;
      btn.style.border = t.id === tone.id
        ? '2px solid #ffffff'
        : '2px solid rgba(255,255,255,0.25)';
    });
    const next = LOOKS.find((l) => !lookUnlocked(l));
    this.lookCaption.textContent =
      `LOOK · ${look.name} · SKIN · ${tone.name}` +
      (next ? ` · NEXT AT ${next.wins} WINS` : ' · EVERY LOOK UNLOCKED');
  }

  /// Hands the swatch row and the jersey number to a player — or, in doubles,
  /// to the CPU partner. The pills show whose turn it is, and only show in a
  /// two-player match or a doubles one.
  pickKitWho(who) {
    if (who === this.kitWho || !(this.twoMode() || this.doublesMode())) return;
    this.kitWho = who;
    this.refreshKitWho();
    this.refreshKitRow();
    haptic('tick');
  }

  /// The two dressing targets the toggle offers in the current mode: the two
  /// players in a two-player match, player one and the CPU partner in doubles.
  kitWhoIds() {
    return this.twoMode() ? ['p1', 'p2'] : ['p1', 'partner'];
  }

  refreshKitWho() {
    const show = this.twoMode() || this.doublesMode();
    if (!show || !this.kitWhoIds().includes(this.kitWho)) this.kitWho = 'p1';
    const ids = this.kitWhoIds();
    this.kitWhoBtns.forEach((btn, i) => {
      btn.style.display = show ? '' : 'none';
      btn.textContent = ids[i] === 'p1' ? 'P1' : this.twoMode() ? 'P2' : 'PARTNER';
      btn.style.backgroundColor = ids[i] === this.kitWho ? SEL_BG : DIM_BG;
    });
    this.numberInput.value = selectedNumber(this.kitWho);
    this.nameInput.value = selectedName(this.kitWho);
    this.refreshNameField(false);
    // The look row dresses whoever the toggle just handed it to.
    this.refreshLookRow();
  }

  twoMode() {
    // The modes with a second human: head-to-head two-player, and co-op
    // doubles, where that second human is the near partner.
    const id = MODES[this.modeIdx].id;
    return id === '2p' || id === 'coop';
  }

  doublesMode() {
    return MODES[this.modeIdx].id === 'doubles';
  }

  /// The name field serves the players alone: the partner dresses by kit and
  /// jersey number, so the field steps aside while the row is theirs.
  refreshNameField(hidden) {
    this.nameInput.style.display = hidden || this.kitWho === 'partner' ? 'none' : '';
  }

  pickDiff(i) {
    if (i === this.diffIdx) return;
    this.diffIdx = i;
    selectDifficulty(this.diffChoices[i].id);
    this.refreshSelection();
    haptic('tick');
  }

  pickLen(i) {
    if (i === this.lenIdx) return;
    this.lenIdx = i;
    selectLength(MATCH_LENGTHS[i].id);
    this.refreshSelection();
    haptic('tick');
  }

  pickTactic(i) {
    if (SERVING_TACTICS[i].id === selectedTactic().id) return;
    selectTactic(SERVING_TACTICS[i].id);
    this.refreshSelection();
    haptic('tick');
  }

  pickMode(i) {
    if (i === this.modeIdx) return;
    this.modeIdx = i;
    selectMode(MODES[i].id);
    // The kit toggle and who it dresses follow the mode; the lineup is
    // rebuilt so the preview always wears the right kit.
    this.rebuildLineupAthlete(this.selIdx);
    this.rebuildLineupAthlete(this.p2Idx);
    this.refreshKitWho();
    this.refreshKitRow();
    this.refreshSelection();
    haptic('tick');
  }

  // ------------------------------------------------------------- settings

  /// The settings screen: the title UI hides, the court dims behind a dark
  /// translucent panel, and five toggle rows cover sound, haptics, the
  /// camera kick, the broadcast camera view and which angle the slow-motion
  /// replays cut to. Every change applies the moment the switch moves and is
  /// remembered across sessions.
  openSettings() {
    this.hideTitleUI(true);
    this.overlayHost(426);
    this.dim = addText('', {
      left: '0',
      right: '0',
      top: '0',
      bottom: '0',
      backgroundColor: 'rgba(6, 12, 22, 0.55)'
    });
    this.panel = addText('', {
      left: '50%',
      top: '50%',
      width: 'min(320px, 86vw)',
      height: '426px',
      transform: 'translate(-50%, -50%)',
      borderRadius: '22px',
      backgroundColor: 'rgba(10, 18, 30, 0.85)',
      border: '1px solid rgba(255, 255, 255, 0.14)'
    });
    const heading = addText('SETTINGS', {
      left: '0',
      right: '0',
      top: '24px',
      textAlign: 'center',
      fontSize: '20px',
      fontWeight: '800',
      letterSpacing: '2px',
      color: '#ffffff'
    });
    this.panel.appendChild(heading);

    const rows = [
      ['sfx', 'SOUND EFFECTS'],
      ['haptics', 'HAPTICS'],
      ['shake', 'CAMERA SHAKE'],
      ['broadcast', 'BROADCAST CAMERA'],
      ['replayNetCam', 'NET CAM REPLAYS']
    ];
    rows.forEach(([key, label], i) => {
      const row = addText('', {
        left: '0',
        right: '0',
        top: `${76 + i * 62}px`,
        height: '44px'
      });
      this.panel.appendChild(row);
      const lab = addText(label, {
        left: '20px',
        top: '14px',
        fontSize: '13px',
        fontWeight: '700',
        letterSpacing: '1px',
        color: 'rgba(255, 255, 255, 0.9)'
      });
      row.appendChild(lab);
      row.appendChild(this.makeSwitch(key));
    });

    this.backBtn = addButton({
      label: 'Back to title',
      onPress: () => this.closeSettings(),
      style: {
        position: 'absolute',
        width: '128px',
        height: '48px',
        left: 'calc(50% - 64px)',
        bottom: 'calc(50% - 193px)',
        borderRadius: '999px',
        backgroundColor: 'rgba(10, 18, 30, 0.4)',
        border: '1.5px solid rgba(255, 255, 255, 0.45)'
      }
    });
    this.backBtn.textContent = 'BACK';
    this.overlay.append(this.dim, this.panel, this.backBtn);
    this.refreshSwitches();
  }

  closeSettings() {
    this.overlay?.remove();
    this.overlay = null;
    this.dim?.remove();
    this.panel?.remove();
    this.backBtn?.remove();
    this.dim = null;
    this.panel = null;
    this.backBtn = null;
    this.switches = [];
    this.hideTitleUI(false);
    haptic('tick');
  }

  // ----------------------------------------------------------- how to play

  /// The how-to-play screen: the title UI hides, the court dims behind a dark
  /// translucent panel, and five compact sections walk through the controls —
  /// each a small gold heading over one or two plain lines. An outline BACK
  /// pill closes it.
  openHelp() {
    this.hideTitleUI(true);
    this.overlayHost(410);
    this.dim = addText('', {
      left: '0',
      right: '0',
      top: '0',
      bottom: '0',
      backgroundColor: 'rgba(6, 12, 22, 0.55)'
    });
    this.panel = addText('', {
      left: '50%',
      top: '50%',
      width: 'min(320px, 86vw)',
      height: '410px',
      transform: 'translate(-50%, -50%)',
      borderRadius: '22px',
      backgroundColor: 'rgba(10, 18, 30, 0.85)',
      border: '1px solid rgba(255, 255, 255, 0.14)'
    });
    this.panel.appendChild(addText('HOW TO PLAY', {
      left: '0',
      right: '0',
      top: '24px',
      textAlign: 'center',
      fontSize: '20px',
      fontWeight: '800',
      letterSpacing: '2px',
      color: '#ffffff'
    }));
    const sections = [
      ['MOVING & STEERING',
        'Drag on your half of the court to run.',
        'Keep dragging as you strike to steer.'],
      ['THE SERVE',
        'Tap jump to strike the tossed ball —',
        'high: jump serve · late: float · miss: fault'],
      ['CHARGE & LOB',
        'Jump and hit: you spike like the CPU does.',
        'The meter adds pace; a ground tap lobs.'],
      ['DIVE · STRIKE · LAUNCH · SUPER',
        'DIVE digs, STRIKE fires a flat power shot,',
        'LAUNCH jumps high — full meter arms SUPER.'],
      ['PRACTICE',
        'Glowing rings shrink with every hit.',
        'The rally counter is your survival streak.']
    ];
    sections.forEach(([heading, line1, line2], i) => {
      const y = 62 + i * 56;
      this.panel.appendChild(addText(heading, {
        left: '18px',
        right: '18px',
        top: `${y}px`,
        fontSize: '11px',
        fontWeight: '800',
        letterSpacing: '1.5px',
        color: '#ffd24a'
      }));
      [line1, line2].forEach((line, j) => {
        this.panel.appendChild(addText(line, {
          left: '18px',
          right: '18px',
          top: `${y + 16 + j * 15}px`,
          fontSize: '10px',
          lineHeight: '1',
          color: 'rgba(255, 255, 255, 0.85)'
        }));
      });
    });
    this.helpBackBtn = addButton({
      label: 'Back to title',
      onPress: () => this.closeHelp(),
      style: {
        position: 'absolute',
        width: '128px',
        height: '48px',
        left: 'calc(50% - 64px)',
        bottom: 'calc(50% - 185px)',
        borderRadius: '999px',
        backgroundColor: 'rgba(10, 18, 30, 0.4)',
        border: '1.5px solid rgba(255, 255, 255, 0.45)',
        color: '#ffffff',
        fontSize: '13px',
        fontWeight: '700',
        letterSpacing: '1px'
      }
    });
    this.helpBackBtn.textContent = 'BACK';
    this.overlay.append(this.dim, this.panel, this.helpBackBtn);
    haptic('tick');
  }

  closeHelp() {
    this.overlay?.remove();
    this.overlay = null;
    this.dim?.remove();
    this.panel?.remove();
    this.helpBackBtn?.remove();
    this.dim = null;
    this.panel = null;
    this.helpBackBtn = null;
    this.hideTitleUI(false);
    haptic('tick');
  }

  // -------------------------------------------------------- weekly goals

  /// The weekly goals card: the title UI hides, the court dims behind a dark
  /// translucent panel, and the week's three goals list out — each a gold
  /// label over a slim progress bar filling with the week's progress, a
  /// small white count beneath, and a gold tick where the week has already
  /// got there. The goals are drawn from the week's own Monday, so all
  /// three change together every Monday, and a completed one stays ticked
  /// for the rest of the week. An outline BACK pill returns to the title.
  openGoals() {
    this.hideTitleUI(true);
    const goals = weeklyProgress();
    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const wk = (weeklyWeekOf() || '').split('-');
    const weekOf = wk.length === 3
      ? `WEEK OF ${Number(wk[2])} ${MONTHS[Number(wk[1]) - 1] || ''}`
      : '';
    this.overlayHost(460);
    this.dim = addText('', {
      left: '0',
      right: '0',
      top: '0',
      bottom: '0',
      backgroundColor: 'rgba(6, 12, 22, 0.55)'
    });
    this.panel = addText('', {
      left: '50%',
      top: '50%',
      width: 'min(320px, 86vw)',
      height: '460px',
      transform: 'translate(-50%, -50%)',
      borderRadius: '22px',
      backgroundColor: 'rgba(10, 18, 30, 0.85)',
      border: '1px solid rgba(255, 255, 255, 0.14)'
    });
    this.panel.appendChild(addText('WEEKLY GOALS', {
      left: '0',
      right: '0',
      top: '24px',
      textAlign: 'center',
      fontSize: '20px',
      fontWeight: '800',
      letterSpacing: '2px',
      color: '#ffffff'
    }));
    this.panel.appendChild(addText(weekOf, {
      left: '0',
      right: '0',
      top: '56px',
      textAlign: 'center',
      fontSize: '10px',
      fontWeight: '700',
      letterSpacing: '2px',
      color: 'rgba(255, 255, 255, 0.45)'
    }));
    goals.forEach((goal, i) => {
      const row = addText('', {
        left: '16px',
        right: '16px',
        top: `${88 + i * 92}px`,
        height: '80px',
        borderRadius: '12px',
        backgroundColor: goal.done
          ? 'rgba(255, 210, 74, 0.14)' : 'rgba(255, 255, 255, 0.06)',
        border: goal.done
          ? '1px solid rgba(255, 210, 74, 0.5)'
          : '1px solid rgba(255, 255, 255, 0.08)'
      });
      this.panel.appendChild(row);
      row.appendChild(addText(goal.name, {
        left: '14px',
        right: '48px',
        top: '10px',
        fontSize: '11px',
        fontWeight: '800',
        letterSpacing: '1.5px',
        lineHeight: '1.2',
        color: '#ffd24a'
      }));
      // The gold tick: the week has already got there, and it stays ticked
      // for the rest of the week.
      if (goal.done) {
        row.appendChild(addText('', {
          right: '12px',
          top: '9px',
          width: '26px',
          height: '26px',
          borderRadius: '999px',
          backgroundColor: '#ffd24a',
          backgroundImage: `url("${iconDataURI('check', 'rgba(35, 21, 3, 0.9)')}")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: '16px 16px'
        }));
      }
      // The slim progress bar: the week's progress toward the mark.
      const track = addText('', {
        left: '14px',
        right: '14px',
        top: '36px',
        height: '6px',
        borderRadius: '3px',
        backgroundColor: 'rgba(255, 255, 255, 0.14)'
      });
      row.appendChild(track);
      track.appendChild(addText('', {
        left: '0',
        top: '0',
        bottom: '0',
        width: `${Math.min(100, Math.round(goal.value / goal.target * 100))}%`,
        borderRadius: '3px',
        backgroundColor: '#ffd24a'
      }));
      row.appendChild(addText(
        `${Math.min(goal.value, goal.target)} / ${goal.target} ${goal.unit}`, {
          left: '14px',
          top: '52px',
          fontSize: '10px',
          fontWeight: '700',
          letterSpacing: '1px',
          color: '#ffffff'
        }));
    });
    this.goalsBackBtn = addButton({
      label: 'Back to title',
      onPress: () => this.closeGoals(),
      style: {
        position: 'absolute',
        width: '128px',
        height: '48px',
        left: 'calc(50% - 64px)',
        bottom: 'calc(50% - 210px)',
        borderRadius: '999px',
        backgroundColor: 'rgba(10, 18, 30, 0.4)',
        border: '1.5px solid rgba(255, 255, 255, 0.45)',
        color: '#ffffff',
        fontSize: '13px',
        fontWeight: '700',
        letterSpacing: '1px'
      }
    });
    this.goalsBackBtn.textContent = 'BACK';
    this.overlay.append(this.dim, this.panel, this.goalsBackBtn);
    haptic('tick');
  }

  closeGoals() {
    this.overlay?.remove();
    this.overlay = null;
    this.dim?.remove();
    this.panel?.remove();
    this.goalsBackBtn?.remove();
    this.dim = null;
    this.panel = null;
    this.goalsBackBtn = null;
    this.hideTitleUI(false);
    haptic('tick');
  }

  // --------------------------------------------------------------- career

  /// The career screen: the title UI hides, the court dims behind a dark
  /// translucent panel, and a grid of stat tiles reads back everything the
  /// tally remembers — matches played and the win-loss record per mode, the
  /// live win streak, the points scored, the longest rally ever played, the
  /// cups — singles, hard and doubles counts kept apart — the longest
  /// survival streak in practice, and the career totals of
  /// aces and blocks. An outline BACK pill closes it.
  openStats() {
    this.hideTitleUI(true);
    this.overlayHost(680, 424);
    this.dim = addText('', {
      left: '0',
      right: '0',
      top: '0',
      bottom: '0',
      backgroundColor: 'rgba(6, 12, 22, 0.55)'
    });
    this.panel = addText('', {
      left: '50%',
      top: '50%',
      width: 'min(420px, 92vw)',
      height: '680px',
      transform: 'translate(-50%, -50%)',
      borderRadius: '22px',
      backgroundColor: 'rgba(10, 18, 30, 0.85)',
      border: '1px solid rgba(255, 255, 255, 0.14)'
    });
    const heading = addText('CAREER', {
      left: '0',
      right: '0',
      top: '24px',
      textAlign: 'center',
      fontSize: '20px',
      fontWeight: '800',
      letterSpacing: '2px',
      color: '#ffffff'
    });
    this.panel.appendChild(heading);

    // The awards night: once the ladder's top rung has been beaten, a small
    // gold pill in the card's corner opens the season awards ceremony.
    if (legendUnlocked()) {
      this.awardsBtn = addButton({
        label: 'Open the season awards night',
        onPress: () => this.openAwards(),
        style: {
          position: 'absolute',
          left: 'calc(100% - 122px)',
          top: '14px',
          width: '108px',
          height: '28px',
          borderRadius: '999px',
          backgroundColor: 'rgba(228, 178, 34, 0.92)',
          color: '#231503',
          fontSize: '9px',
          fontWeight: '800',
          letterSpacing: '1px'
        }
      });
      this.awardsBtn.textContent = 'GOLDEN COURT';
      this.panel.appendChild(this.awardsBtn);
    }

    const st = careerStats();
    const tiles = [
      ['MATCHES', `${st.played}`],
      ['WIN STREAK', `${st.streak}`],
      ['VS CPU W–L', st.cpu],
      ['2P · W–L', st.two],
      ['DOUBLES W–L', st.doubles],
      ['POINTS', `${st.points}`],
      ['BEST RALLY', `${st.bestRally}`],
      ['BEST DBL RALLY', `${st.bestDoublesRally}`, null, 8],
      ['CUPS WON', `${st.cups}`],
      ['HARD CUPS', `${st.hardCups}`],
      ['DOUBLES CUPS', `${st.doublesCups}`],
      ['TOP SERVE', st.topServe ? `${st.topServe} KM/H` : '—', 15],
      ['BEST STREAK', `${st.bestStreak}`],
      ['ACES', `${st.aces}`],
      ['BLOCKS', `${st.blocks}`],
      ['DRILL STARS', `${st.drillStars}/4`],
      ['DAILY STREAK', `${st.dailyStreak}`],
      ['TITLE', st.title, 13],
      ['LADDER RANK', `${st.ladder} · BEST ${st.bestLadder}`, 13]
    ];
    // Four columns: seventeen tiles in five rows, one for everything the
    // record keeps — the win-loss record of every mode including doubles,
    // the best rally overall and the best one a doubles match has produced,
    // the practice survival streak, the ace and block totals, the guided
    // drill stars, the run of consecutive daily wins, the player title the
    // career wins have banked and the ladder rank included. Four columns
    // keep the card short enough to scale onto a landscape panel.
    tiles.forEach(([label, value, vSize, lSize], i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const tile = addText('', {
        left: `calc(14px + ${col} * (25% - 10px))`,
        top: `${72 + row * 62}px`,
        width: 'calc(25% - 18px)',
        height: '58px',
        borderRadius: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.06)'
      });
      this.panel.appendChild(tile);
      tile.appendChild(addText(label, {
        left: '10px',
        right: '4px',
        top: '8px',
        fontSize: `${lSize || 9}px`,
        fontWeight: '700',
        letterSpacing: '0.5px',
        lineHeight: '1.05',
        color: 'rgba(255, 255, 255, 0.55)'
      }));
      tile.appendChild(addText(value, {
        left: '10px',
        right: '4px',
        top: '27px',
        fontSize: `${vSize || 19}px`,
        fontWeight: '800',
        color: '#ffffff',
        whiteSpace: 'nowrap'
      }));
    });

    // The placement heat map: the career-long grid of where the player's
    // shots have been landing, opened from its own tile in the grid beside
    // the ladder rank's — the number on it is the shots recorded so far.
    this.statsHeatBtn = addButton({
      label: 'Open the heat map',
      onPress: () => this.openHeat(),
      style: {
        position: 'absolute',
        left: 'calc(14px + 3 * (25% - 10px))',
        top: '320px',
        width: 'calc(25% - 18px)',
        height: '58px',
        borderRadius: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.06)'
      }
    });
    this.statsHeatBtn.appendChild(addText('HEAT MAP', {
      left: '10px',
      right: '4px',
      top: '8px',
      fontSize: '9px',
      fontWeight: '700',
      letterSpacing: '0.5px',
      lineHeight: '1.05',
      color: 'rgba(255, 255, 255, 0.55)'
    }));
    this.statsHeatBtn.appendChild(addText(`${heatMap().reduce((a, b) => a + b, 0)}`, {
      left: '10px',
      right: '4px',
      top: '27px',
      fontSize: '19px',
      fontWeight: '800',
      color: '#ffffff',
      whiteSpace: 'nowrap'
    }));
    this.panel.appendChild(this.statsHeatBtn);

    // The clutch record: the career total of the big points — set point,
    // match point and tie-break — won and lost, sitting in the grid beside
    // the heat map's tile.
    const clutchTile = addText('', {
      left: 'calc(14px + 0 * (25% - 10px))',
      top: '382px',
      width: 'calc(25% - 18px)',
      height: '58px',
      borderRadius: '12px',
      backgroundColor: 'rgba(255, 255, 255, 0.06)'
    });
    clutchTile.appendChild(addText('CLUTCH', {
      left: '10px',
      right: '4px',
      top: '8px',
      fontSize: '9px',
      fontWeight: '700',
      letterSpacing: '0.5px',
      lineHeight: '1.05',
      color: 'rgba(255, 255, 255, 0.55)'
    }));
    clutchTile.appendChild(addText(`${st.clutchWon} – ${st.clutchLost}`, {
      left: '10px',
      right: '4px',
      top: '27px',
      fontSize: '19px',
      fontWeight: '800',
      color: '#ffffff',
      whiteSpace: 'nowrap'
    }));
    this.panel.appendChild(clutchTile);

    // The best run on serve: the career best of the consecutive points won
    // on serve — the run that dies the moment service changes hands — in
    // the last slot of the grid beside the clutch record.
    const serveRunTile = addText('', {
      left: 'calc(14px + 1 * (25% - 10px))',
      top: '382px',
      width: 'calc(25% - 18px)',
      height: '58px',
      borderRadius: '12px',
      backgroundColor: 'rgba(255, 255, 255, 0.06)'
    });
    serveRunTile.appendChild(addText('SERVE RUN', {
      left: '10px',
      right: '4px',
      top: '8px',
      fontSize: '9px',
      fontWeight: '700',
      letterSpacing: '0.5px',
      lineHeight: '1.05',
      color: 'rgba(255, 255, 255, 0.55)'
    }));
    serveRunTile.appendChild(addText(`${st.bestServeRun}`, {
      left: '10px',
      right: '4px',
      top: '27px',
      fontSize: '19px',
      fontWeight: '800',
      color: '#ffffff',
      whiteSpace: 'nowrap'
    }));
    this.panel.appendChild(serveRunTile);

    // The comeback sets: the career total of the sets a side took after
    // trailing it by three or more points — sets stolen from the brink —
    // opening the grid's next row.
    const comebackTile = addText('', {
      left: 'calc(14px + 2 * (25% - 10px))',
      top: '382px',
      width: 'calc(25% - 18px)',
      height: '58px',
      borderRadius: '12px',
      backgroundColor: 'rgba(255, 255, 255, 0.06)'
    });
    comebackTile.appendChild(addText('COMEBACKS', {
      left: '10px',
      right: '4px',
      top: '8px',
      fontSize: '9px',
      fontWeight: '700',
      letterSpacing: '0.5px',
      lineHeight: '1.05',
      color: 'rgba(255, 255, 255, 0.55)'
    }));
    comebackTile.appendChild(addText(`${st.comebacks}`, {
      left: '10px',
      right: '4px',
      top: '27px',
      fontSize: '19px',
      fontWeight: '800',
      color: '#ffffff',
      whiteSpace: 'nowrap'
    }));
    this.panel.appendChild(comebackTile);

    // The rivals: every opponent the match log remembers, grouped into a
    // head-to-head list — the button sits in the grid's next free slot and
    // its number is how many have been faced so far.
    this.statsRivalsBtn = addButton({
      label: 'Open the rivals screen',
      onPress: () => this.openRivals(),
      style: {
        position: 'absolute',
        left: 'calc(14px + 3 * (25% - 10px))',
        top: '382px',
        width: 'calc(25% - 18px)',
        height: '58px',
        borderRadius: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.06)'
      }
    });
    this.statsRivalsBtn.appendChild(addText('RIVALS', {
      left: '10px',
      right: '4px',
      top: '8px',
      fontSize: '9px',
      fontWeight: '700',
      letterSpacing: '0.5px',
      lineHeight: '1.05',
      color: 'rgba(255, 255, 255, 0.55)'
    }));
    this.statsRivalsBtn.appendChild(addText(`${rivalRows(matchLog()).length}`, {
      left: '10px',
      right: '4px',
      top: '27px',
      fontSize: '19px',
      fontWeight: '800',
      color: '#ffffff',
      whiteSpace: 'nowrap'
    }));
    this.panel.appendChild(this.statsRivalsBtn);

    // The shots of the match: how many matches ended with a standout moment
    // — the fastest serve, the longest rally or a super strike — named in
    // gold on the recap.
    const shotTile = addText('', {
      left: 'calc(14px + 2 * (25% - 10px))',
      top: '444px',
      width: 'calc(25% - 18px)',
      height: '58px',
      borderRadius: '12px',
      backgroundColor: 'rgba(255, 255, 255, 0.06)'
    });
    shotTile.appendChild(addText('SHOT OF MATCH', {
      left: '10px',
      right: '4px',
      top: '8px',
      fontSize: '9px',
      fontWeight: '700',
      letterSpacing: '0.5px',
      lineHeight: '1.05',
      color: 'rgba(255, 255, 255, 0.55)'
    }));
    shotTile.appendChild(addText(`${st.shotsOfMatch}`, {
      left: '10px',
      right: '4px',
      top: '27px',
      fontSize: '19px',
      fontWeight: '800',
      color: '#ffffff',
      whiteSpace: 'nowrap'
    }));
    this.panel.appendChild(shotTile);

    // The fastest rally touch ever struck — the pace readout's career best,
    // in km/h, remembered across sessions like the fastest serve is. It sits
    // in the grid's free slot beside the shot-of-match tile.
    const paceTile = addText('', {
      left: 'calc(14px + 1 * (25% - 10px))',
      top: '444px',
      width: 'calc(25% - 18px)',
      height: '58px',
      borderRadius: '12px',
      backgroundColor: 'rgba(255, 255, 255, 0.06)'
    });
    paceTile.appendChild(addText('TOP TOUCH', {
      left: '10px',
      right: '4px',
      top: '8px',
      fontSize: '9px',
      fontWeight: '700',
      letterSpacing: '0.5px',
      lineHeight: '1.05',
      color: 'rgba(255, 255, 255, 0.55)'
    }));
    paceTile.appendChild(addText(st.topTouch ? `${st.topTouch} KM/H` : '—', {
      left: '10px',
      right: '4px',
      top: '27px',
      fontSize: '13px',
      fontWeight: '800',
      color: '#ffffff',
      whiteSpace: 'nowrap'
    }));
    this.panel.appendChild(paceTile);

    // The personal bests: the career's standout numbers with the dates they
    // were set — the button takes the grid's last free slot, its number
    // being how many of the four bests are on the board.
    this.statsBestsBtn = addButton({
      label: 'Open the personal bests screen',
      onPress: () => this.openBests(),
      style: {
        position: 'absolute',
        left: 'calc(14px + 3 * (25% - 10px))',
        top: '444px',
        width: 'calc(25% - 18px)',
        height: '58px',
        borderRadius: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.06)'
      }
    });
    this.statsBestsBtn.appendChild(addText('BESTS', {
      left: '10px',
      right: '4px',
      top: '8px',
      fontSize: '9px',
      fontWeight: '700',
      letterSpacing: '0.5px',
      lineHeight: '1.05',
      color: 'rgba(255, 255, 255, 0.55)'
    }));
    this.statsBestsBtn.appendChild(addText(
      `${personalBests().filter((b) => b.value !== '—').length}/4`, {
        left: '10px',
        right: '4px',
        top: '27px',
        fontSize: '19px',
        fontWeight: '800',
        color: '#ffffff',
        whiteSpace: 'nowrap'
      }));
    this.panel.appendChild(this.statsBestsBtn);

    // The season review: the career's arc — the last ten matches' win rate,
    // the title ladder with its dates and the trophy case — opened from its
    // own tile in the grid, its number being the matches played so far.
    this.statsReviewBtn = addButton({
      label: 'Open the season review screen',
      onPress: () => this.openReview(),
      style: {
        position: 'absolute',
        left: 'calc(14px + 0 * (25% - 10px))',
        top: '444px',
        width: 'calc(25% - 18px)',
        height: '58px',
        borderRadius: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.06)'
      }
    });
    this.statsReviewBtn.appendChild(addText('REVIEW', {
      left: '10px',
      right: '4px',
      top: '8px',
      fontSize: '9px',
      fontWeight: '700',
      letterSpacing: '0.5px',
      lineHeight: '1.05',
      color: 'rgba(255, 255, 255, 0.55)'
    }));
    this.statsReviewBtn.appendChild(addText(`${st.played}`, {
      left: '10px',
      right: '4px',
      top: '27px',
      fontSize: '19px',
      fontWeight: '800',
      color: '#ffffff',
      whiteSpace: 'nowrap'
    }));
    this.panel.appendChild(this.statsReviewBtn);

    // The milestone badges: a row of four tiles that light up gold as the
    // milestones are met, each remembered on the record. Unearned ones stay
    // dimmed, showing the requirement instead of the laurels.
    this.panel.appendChild(addText('MILESTONES', {
      left: '0',
      right: '0',
      top: '504px',
      textAlign: 'center',
      fontSize: '10px',
      fontWeight: '700',
      letterSpacing: '2px',
      color: 'rgba(255,255,255,0.5)'
    }));
    const earned = earnedBadges();
    BADGES.forEach((badge, i) => {
      const got = !!earned[badge.id];
      const tile = addText('', {
        left: `calc(18px + ${i} * (25% - 7.5px))`,
        top: '520px',
        width: 'calc(25% - 13.5px)',
        height: '48px',
        borderRadius: '10px',
        backgroundColor: got ? 'rgba(255, 210, 74, 0.16)' : 'rgba(255, 255, 255, 0.05)',
        border: got ? '1px solid rgba(255, 210, 74, 0.55)' : '1px solid rgba(255, 255, 255, 0.1)'
      });
      this.panel.appendChild(tile);
      tile.appendChild(addText(badge.name, {
        left: '2px',
        right: '2px',
        top: '8px',
        textAlign: 'center',
        fontSize: '9px',
        fontWeight: '800',
        letterSpacing: '0.5px',
        lineHeight: '1.15',
        color: got ? '#ffd24a' : 'rgba(255, 255, 255, 0.45)'
      }));
      tile.appendChild(addText(got ? 'EARNED' : badge.req, {
        left: '3px',
        right: '3px',
        top: '25px',
        textAlign: 'center',
        fontSize: '8px',
        fontWeight: '700',
        letterSpacing: '0.5px',
        lineHeight: '1.25',
        color: got ? '#ffd24a' : 'rgba(255, 255, 255, 0.35)'
      }));
    });

    // The record rally and its reel: the slow-motion recording of the longest
    // rally ever played, kept on the record beside its touch count, with the
    // last two records it broke kept beside it as the career's reel. The
    // REPLAY pill plays the standing record and the REEL pill plays the whole
    // reel back to back; an empty record keeps a quiet line.
    const rec = rallyReplay();
    this.panel.appendChild(addText(rec ? `RECORD RALLY · ${rec.touches} TOUCHES` : 'NO MOMENTS YET', {
      left: '0',
      right: '0',
      top: '572px',
      textAlign: 'center',
      fontSize: '11px',
      fontWeight: '700',
      letterSpacing: '2px',
      color: rec ? '#ffd24a' : 'rgba(255,255,255,0.4)'
    }));

    // The bottom row: match log, the record rally's replay and the highlights
    // reel when a record rally exists, the record backup, and back — five
    // pills across with both, four with the replay alone, three as before.
    // BACKUP opens the record backup screen.
    const rowPills = [['MATCH LOG', () => this.openLog()]];
    if (rec) rowPills.push(['REPLAY', () => this.playRecordRally()]);
    // The reel: the record rally played back to back with the broken records
    // that led to it, in the order the record grew.
    if (rec) rowPills.push(['REEL', () => this.playRallyReel()]);
    rowPills.push(['BACKUP', () => this.openBackup()]);
    rowPills.push(['BACK', () => this.closeStats()]);
    const nPills = rowPills.length;
    const pillLefts = nPills === 5
      ? ['4px', 'calc(20% + 5px)', 'calc(40% + 4px)', 'calc(60% + 3px)', 'calc(80% + 2px)']
      : nPills === 4
        ? ['8px', 'calc(25% + 6px)', 'calc(50% + 4px)', 'calc(75% + 2px)']
        : ['8px', 'calc(33.33% + 5px)', 'calc(66.66% + 2px)'];
    this.statsRowBtns = rowPills.map(([text, onPress], i) => {
      // The replay, the reel and the backup read as the row's filled actions;
      // the rest stay outline pills.
      const filled = text === 'REPLAY' || text === 'REEL' || text === 'BACKUP';
      const btn = addButton({
        label: text === 'BACK' ? 'Back to title'
          : text === 'BACKUP' ? 'Open the record backup screen'
          : text === 'REPLAY' ? 'Replay the record rally'
          : text === 'REEL' ? 'Play the highlights reel' : 'Match log',
        onPress,
        style: {
          position: 'absolute',
          width: nPills === 5 ? 'calc(20% - 9px)'
            : nPills === 4 ? 'calc(25% - 10px)' : 'calc(33.33% - 11px)',
          height: '48px',
          left: pillLefts[i],
          bottom: 'calc(50% - 296px)',
          borderRadius: '999px',
          backgroundColor: filled ? '#1d6fb8' : 'rgba(10, 18, 30, 0.4)',
          border: filled ? 'none' : '1.5px solid rgba(255, 255, 255, 0.45)',
          color: '#ffffff',
          fontSize: nPills === 3 ? '12px' : '10px',
          fontWeight: '700',
          letterSpacing: nPills === 3 ? '1px' : '0.5px'
        }
      });
      btn.textContent = text;
      return btn;
    });
    this.statsBackBtn = this.statsRowBtns[this.statsRowBtns.length - 1];
    this.overlay.append(this.dim, this.panel, ...this.statsRowBtns);
    haptic('tick');
  }

  closeStats() {
    this.overlay?.remove();
    this.overlay = null;
    this.dim?.remove();
    this.panel?.remove();
    for (const b of this.statsRowBtns || []) b.remove();
    this.statsHeatBtn?.remove();
    this.statsRivalsBtn?.remove();
    this.statsBestsBtn?.remove();
    this.statsReviewBtn?.remove();
    this.awardsBtn?.remove();
    this.awardsBtn = null;
    this.dim = null;
    this.panel = null;
    this.statsRowBtns = null;
    this.statsBackBtn = null;
    this.statsHeatBtn = null;
    this.statsRivalsBtn = null;
    this.statsBestsBtn = null;
    this.statsReviewBtn = null;
    this.hideTitleUI(false);
    haptic('tick');
  }

  // ------------------------------------------------------------ heat map

  /// The placement heat map: a small overhead view of the court — the net
  /// along the bottom edge, the baseline along the top, exactly the way the
  /// match camera sees it — with the career-long grid of buckets laid over
  /// it, tinted from cool blue through amber to hot red by how often the
  /// shots have come down in each. A pair of pills flips the one view
  /// between where your shots go and where the far side's do, each grid
  /// scaled to its own hottest bucket. Raised over the career card; its
  /// BACK pill returns there.
  openHeat() {
    // Both grids are read once and kept: the flip repaints between them
    // without going back to the record.
    this.heatMine = heatMap();
    this.heatRival = heatRivalMap();
    this.heatMode = 'mine';
    this.overlayHost(470);
    this.dim = addText('', {
      left: '0',
      right: '0',
      top: '0',
      bottom: '0',
      backgroundColor: 'rgba(6, 12, 22, 0.45)'
    });
    this.heatPanel = addText('', {
      left: '50%',
      top: '50%',
      width: 'min(320px, 86vw)',
      height: '470px',
      transform: 'translate(-50%, -50%)',
      borderRadius: '22px',
      backgroundColor: 'rgba(10, 18, 30, 0.9)',
      border: '1px solid rgba(255, 255, 255, 0.14)'
    });
    this.heatPanel.appendChild(addText('HEAT MAP', {
      left: '0',
      right: '0',
      top: '24px',
      textAlign: 'center',
      fontSize: '20px',
      fontWeight: '800',
      letterSpacing: '2px',
      color: '#ffffff'
    }));
    // The flip: whose placements the court is showing. The live one burns
    // gold, the other sits dim, and tapping either repaints the grid.
    const mkFlip = (mode, label, left) => {
      const btn = addButton({
        label: `Show ${label.toLowerCase()} on the heat map`,
        onPress: () => this.setHeatMode(mode),
        style: {
          position: 'absolute',
          width: '112px',
          height: '30px',
          left,
          top: '56px',
          borderRadius: '999px',
          fontSize: '10px',
          fontWeight: '800',
          letterSpacing: '1px'
        }
      });
      btn.textContent = label;
      this.heatPanel.appendChild(btn);
      return btn;
    };
    this.heatMineBtn = mkFlip('mine', 'YOUR SHOTS', 'calc(50% - 118px)');
    this.heatRivalBtn = mkFlip('rival', 'THEIR SHOTS', 'calc(50% + 6px)');
    // The court itself: a square — it is eight metres each way — with the
    // attack line drawn three metres off the net, which sits along the
    // bottom edge the way both grids read it.
    const court = addText('', {
      left: 'calc(50% - 120px)',
      top: '98px',
      width: '240px',
      height: '240px',
      backgroundColor: 'rgba(214, 186, 138, 0.16)',
      border: '2px solid rgba(255, 255, 255, 0.55)'
    });
    this.heatPanel.appendChild(court);
    court.appendChild(addText('', {
      left: '0',
      right: '0',
      bottom: '89px',
      height: '2px',
      backgroundColor: 'rgba(255, 255, 255, 0.4)'
    }));
    // The buckets: a light grid over the court, row zero at the net. The
    // cells are kept so the flip can repaint them in place.
    this.heatCells = [];
    for (let row = 0; row < HEAT_ROWS; row++) {
      for (let col = 0; col < HEAT_COLS; col++) {
        const cell = addText('', {
          left: `${col * 40}px`,
          top: `${(HEAT_ROWS - 1 - row) * 40}px`,
          width: '40px',
          height: '40px',
          backgroundColor: 'rgba(120, 160, 210, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.07)'
        });
        court.appendChild(cell);
        this.heatCells.push(cell);
      }
    }
    this.heatTotal = addText('', {
      left: '0',
      right: '0',
      top: '348px',
      textAlign: 'center',
      fontSize: '12px',
      fontWeight: '800',
      letterSpacing: '2px',
      color: '#ffd24a'
    });
    this.heatNote = addText('', {
      left: '0',
      right: '0',
      top: '368px',
      textAlign: 'center',
      fontSize: '9px',
      fontWeight: '700',
      letterSpacing: '1px',
      color: 'rgba(255, 255, 255, 0.5)'
    });
    this.heatPanel.appendChild(this.heatTotal);
    this.heatPanel.appendChild(this.heatNote);
    this.paintHeat();
    this.heatBackBtn = addButton({
      label: 'Back to career',
      onPress: () => this.closeHeat(),
      style: {
        position: 'absolute',
        width: '128px',
        height: '48px',
        left: 'calc(50% - 64px)',
        bottom: 'calc(50% - 218px)',
        borderRadius: '999px',
        backgroundColor: 'rgba(10, 18, 30, 0.4)',
        border: '1.5px solid rgba(255, 255, 255, 0.45)',
        color: '#ffffff',
        fontSize: '13px',
        fontWeight: '700',
        letterSpacing: '1px'
      }
    });
    this.heatBackBtn.textContent = 'BACK';
    this.overlay.append(this.dim, this.heatPanel, this.heatBackBtn);
    haptic('tick');
  }

  /// Repaints the buckets, the count and the note for whichever grid the
  /// flip is showing — each side scaled to its own hottest bucket, so a
  /// lone habit reads as hot even next to a busier other side.
  paintHeat() {
    const grid = this.heatMode === 'mine' ? this.heatMine : this.heatRival;
    const max = Math.max(1, ...grid);
    for (let i = 0; i < this.heatCells.length; i++) {
      this.heatCells[i].style.backgroundColor = heatColour(grid[i], max);
    }
    const total = grid.reduce((a, b) => a + b, 0);
    this.heatTotal.textContent = `${total} SHOTS RECORDED`;
    this.heatNote.textContent = total
      ? (this.heatMode === 'mine'
        ? 'NET AT THE BOTTOM · BLUE FEW · RED MANY'
        : 'THEIR LANDINGS · NET AT THE BOTTOM')
      : (this.heatMode === 'mine'
        ? 'NO SHOTS YET — PLAY A MATCH'
        : 'NO SHOTS OF THEIRS YET');
    const on = {
      backgroundColor: 'rgba(255, 210, 74, 0.92)',
      color: 'rgba(30, 22, 4, 0.95)'
    };
    const off = {
      backgroundColor: 'rgba(10, 18, 30, 0.4)',
      color: 'rgba(255, 255, 255, 0.6)'
    };
    Object.assign(this.heatMineBtn.style, this.heatMode === 'mine' ? on : off);
    Object.assign(this.heatRivalBtn.style, this.heatMode === 'rival' ? on : off);
  }

  /// The flip itself: one grid becomes the other, the court repainting on
  /// the spot under a small tick.
  setHeatMode(mode) {
    if (this.heatMode === mode) return;
    this.heatMode = mode;
    this.paintHeat();
    haptic('tick');
  }

  closeHeat() {
    this.overlay?.remove();
    this.overlay = null;
    this.dim?.remove();
    this.heatPanel?.remove();
    this.heatBackBtn?.remove();
    this.dim = null;
    this.heatPanel = null;
    this.heatBackBtn = null;
    this.heatMineBtn = null;
    this.heatRivalBtn = null;
    this.heatTotal = null;
    this.heatNote = null;
    this.heatCells = null;
    this.heatMine = null;
    this.heatRival = null;
    this.heatMode = null;
    this.openStats();
    haptic('tick');
  }

  // ---------------------------------------------------------- record rally

  /// The record rally, played back: the stored slow-motion recording plays
  /// over the dimmed title court from the picked replay angle — the low
  /// sideline shot by default, the net cam on the settings pick — with both
  /// athletes dressed exactly as they were dressed when the rally was played.
  playRecordRally() {
    const rec = rallyReplay();
    if (!rec) return;
    this.beginRallyPlayback([rec]);
  }

  /// The highlights reel: the standing record rally played back to back with
  /// the records that led to it — the last two rallies broken on the way up —
  /// in the order the record grew, so the reel ends on the career's best
  /// moment. Rides the same playback the single record rally uses.
  playRallyReel() {
    const clips = this.reelRunOrder();
    if (!clips.length) return;
    haptic('tick');
    this.beginRallyPlayback(clips);
  }

  /// The reel's running order: the broken records in the order they were set
  /// — ascending touch counts, which is also the order they were overtaken in
  /// — with the standing record closing the reel.
  reelRunOrder() {
    const rec = rallyReplay();
    if (!rec) return [];
    return rallyReel()
      .slice()
      .sort((a, b) => a.touches - b.touches)
      .concat([rec]);
  }

  /// The shared playback opener: the career card steps aside and the dimmed
  /// court — a touch lighter than the card's veil, so the rally reads — takes
  /// the first clip of the list.
  beginRallyPlayback(clips) {
    this.dim?.remove();
    this.panel?.remove();
    for (const b of this.statsRowBtns || []) b.remove();
    this.statsRivalsBtn?.remove();
    this.dim = null;
    this.panel = null;
    this.statsRowBtns = null;
    this.statsBackBtn = null;
    this.statsRivalsBtn = null;
    this.statsBestsBtn = null;

    // The card's host goes with it; the replay stands alone over the court.
    this.overlay?.remove();
    this.overlay = null;

    this.rpClips = clips;
    this.rpIdx = 0;

    // The court stays dimmed behind the replay, a touch lighter so the
    // rally reads.
    this.rpDim = addText('', {
      left: '0px', right: '0px', top: '0px', bottom: '0px',
      backgroundColor: 'rgba(6, 12, 22, 0.35)'
    });

    // The title lineup and its preview ball step out of the shot.
    this.lineup.forEach((a) => { a.visible = false; });
    this.ball.visible = false;
    this.beginRallyClip();
  }

  /// One clip of the playback: both athletes dressed exactly as they were
  /// dressed when that rally was played, the camera cut to the side line,
  /// and the broadcast banner reading the clip's own touch count and date —
  /// left off clips banked before the record began keeping dates. A reel's
  /// next clip swaps the actors in place under a fresh whoosh.
  beginRallyClip() {
    const rec = this.rpClips[this.rpIdx];
    // A reel's previous clip hands over: its actors leave first.
    if (this.rpPlayer) {
      for (const a of [this.rpPlayer, this.rpCpu]) {
        this.root.remove(a);
        disposeSceneGraph(a);
      }
      this.root.remove(this.rpBall);
      this.rpBall.geometry.dispose();
      this.rpBall.material.map?.dispose();
      this.rpBall.material.dispose();
    }
    this.rp = {
      rec, i: 0,
      t: rec.frames[0].t,
      end: rec.frames[rec.frames.length - 1].t
    };
    this.rp.side = rec.frames[0].b[0] >= 0 ? 1 : -1;
    this.rpQ1 = new THREE.Quaternion();
    this.rpQ2 = new THREE.Quaternion();
    this.rpPlayer = createAthlete(rec.pc);
    this.rpCpu = createAthlete(rec.cc);
    this.root.add(this.rpPlayer, this.rpCpu);
    this.rpBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 24, 18),
      new THREE.MeshStandardMaterial({ map: makeBallTexture(), roughness: 0.3, envMapIntensity: 1.15 })
    );
    this.root.add(this.rpBall);
    this.hydrateRallyPoses();

    // The cut is instant, the way a broadcast replay cuts — to whichever
    // angle the settings pick: the low side-line shot, or the net cam hung
    // on the post the rally dies toward, looking down the tape.
    const cam = this.game.camera;
    if (replayNetCam()) {
      cam.position.set(this.rp.side * (NET_HALF_W + 0.3), 3.1, 0);
    } else {
      cam.position.set(this.rp.side * 6.4, 1.4, rec.frames[0].b[2]);
    }
    cam.lookAt(0, 1.0, 0);

    // The banner and this clip's own line beneath it, created once and
    // repainted per clip.
    if (!this.rpBanner) {
      this.rpBanner = addText('REPLAY', {
        left: '50%',
        top: 'calc(env(safe-area-inset-top) + 92px)',
        transform: 'translateX(-50%)',
        padding: '4px 14px',
        borderRadius: '6px',
        backgroundColor: 'rgba(206, 38, 52, 0.85)',
        color: '#ffffff',
        fontSize: '13px',
        fontWeight: '800',
        letterSpacing: '4px'
      });
      this.rpCount = addText('', {
        left: '50%',
        top: 'calc(env(safe-area-inset-top) + 122px)',
        transform: 'translateX(-50%)',
        fontSize: '13px',
        fontWeight: '800',
        letterSpacing: '2px',
        color: '#ffd24a',
        textShadow: '0 2px 8px rgba(20,40,60,0.65)'
      });
      this.rpCloseBtn = addButton({
        icon: 'x',
        label: 'Close the replay',
        onPress: () => this.endRallyPlayback(),
        style: {
          position: 'absolute',
          width: '44px',
          height: '44px',
          right: '16px',
          top: 'calc(env(safe-area-inset-top) + 12px)',
          backgroundColor: 'rgba(20, 40, 60, 0.5)'
        }
      });
    }
    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const p = (rec.date || '').split('-');
    const day = p.length === 3
      ? ` · ${p[2]} ${MONTHS[Number(p[1]) - 1] || ''}`
      : '';
    this.rpCount.textContent = `RALLY · ${rec.touches} TOUCHES${day}`;
    playWhoosh();
  }

  /// The stored poses carry quaternion channels only; positions and scales
  /// come from the playback athlete's own rest pose — live play never moves
  /// a bone off it — so each frame hydrates into the full packed arrays
  /// applyPose interpolates across. Done once; the frames keep their
  /// hydrated arrays for any later replay this session.
  hydrateRallyPoses() {
    for (const [who, key] of [[this.rpPlayer, 'p'], [this.rpCpu, 'c']]) {
      const bones = who.userData.bones;
      const n = bones.length;
      for (const f of this.rp.rec.frames) {
        const s = f[key].pose;
        if (s.bones) continue;
        const arr = new Float32Array(n * 10);
        for (let i = 0; i < n; i++) {
          const b = bones[i], k = i * 10, qk = i * 4;
          b.position.toArray(arr, k);
          arr[k + 3] = s.q[qk];
          arr[k + 4] = s.q[qk + 1];
          arr[k + 5] = s.q[qk + 2];
          arr[k + 6] = s.q[qk + 3];
          b.scale.toArray(arr, k + 7);
        }
        s.bones = arr;
      }
    }
  }

  /// The playback itself: quarter speed through the stored frames — the
  /// ball's flight, spin and squash, both athletes' root transforms and
  /// poses — from whichever replay angle the settings pick.
  updateRallyPlayback(dt) {
    const rp = this.rp;
    const frames = rp.rec.frames;
    rp.t += dt * 0.25;
    if (rp.t >= rp.end) {
      // The clip is played out: a reel hands to its next moment under a
      // soft whoosh — the cut between clips is the reel's own — while a
      // single rally goes straight home.
      if (this.rpIdx < this.rpClips.length - 1) {
        this.rpIdx++;
        this.beginRallyClip();
      } else {
        this.endRallyPlayback();
      }
      return;
    }
    while (rp.i < frames.length - 2 && frames[rp.i + 1].t < rp.t) rp.i++;
    const fa = frames[rp.i];
    const fb = frames[rp.i + 1];
    const al = clamp((rp.t - fa.t) / Math.max(0.0001, fb.t - fa.t), 0, 1);

    const m = this.rpBall;
    m.position.set(
      mix(fa.b[0], fb.b[0], al), mix(fa.b[1], fb.b[1], al), mix(fa.b[2], fb.b[2], al)
    );
    m.scale.set(
      mix(fa.b[3], fb.b[3], al), mix(fa.b[4], fb.b[4], al), mix(fa.b[5], fb.b[5], al)
    );
    this.rpQ1.set(fa.b[6], fa.b[7], fa.b[8], fa.b[9]);
    this.rpQ2.set(fb.b[6], fb.b[7], fb.b[8], fb.b[9]);
    m.quaternion.slerpQuaternions(this.rpQ1, this.rpQ2, al);

    this.rpAthlete(this.rpPlayer, fa.p, fb.p, al);
    this.rpAthlete(this.rpCpu, fa.c, fb.c, al);

    // The same two broadcast angles the match replays cut to: the low
    // side-line shot drifting along the touchline — or the net cam, hung
    // still on its post and panning gently down the tape after the play,
    // its look point biased toward the tape.
    const cam = this.game.camera;
    const k = Math.min(1, dt * 3);
    if (replayNetCam()) {
      cam.position.x += (rp.side * (NET_HALF_W + 0.3) - cam.position.x) * k;
      cam.position.y += (3.1 - cam.position.y) * k;
      cam.position.z += (0 - cam.position.z) * k;
      cam.lookAt(
        mix(m.position.x, -rp.side * 4.2, 0.45),
        Math.max(1.0, m.position.y * 0.55),
        clamp(m.position.z * 0.55, -4.2, 4.2)
      );
    } else {
      cam.position.x += (rp.side * 6.4 - cam.position.x) * k;
      cam.position.y += (1.4 + m.position.y * 0.08 - cam.position.y) * k;
      cam.position.z += (clamp(m.position.z * 0.85, -7.4, 7.4) - cam.position.z) * k;
      cam.lookAt(
        m.position.x * 0.6,
        Math.max(0.9, m.position.y * 0.55),
        m.position.z * 0.8
      );
    }
  }

  rpAthlete(a, fa, fb, al) {
    a.position.set(mix(fa.x, fb.x, al), mix(fa.y, fb.y, al), mix(fa.z, fb.z, al));
    a.rotation.y = mix(fa.ry, fb.ry, al);
    applyPose(a, fa.pose, fb.pose, al);
  }

  /// The replay is over — played out or closed early: the actors leave, the
  /// camera goes home, the lineup returns, and the career card comes back.
  endRallyPlayback() {
    if (!this.rp) return;
    this.rp = null;
    this.rpClips = null;
    this.rpIdx = 0;
    for (const a of [this.rpPlayer, this.rpCpu]) {
      this.root.remove(a);
      disposeSceneGraph(a);
    }
    this.root.remove(this.rpBall);
    this.rpBall.geometry.dispose();
    this.rpBall.material.map?.dispose();
    this.rpBall.material.dispose();
    this.rpPlayer = null;
    this.rpCpu = null;
    this.rpBall = null;
    this.rpDim?.remove();
    this.rpBanner?.remove();
    this.rpCount?.remove();
    this.rpCloseBtn?.remove();
    this.rpDim = null;
    this.rpBanner = null;
    this.rpCount = null;
    this.rpCloseBtn = null;
    // The lineup comes back — the unsigned recruit stays off it until her
    // wins sign her, exactly as the lineup was built.
    this.lineup.forEach((a, i) => { a.visible = athleteUnlocked(ROSTER[i]); });
    this.ball.visible = true;
    this.resize(window.innerWidth, window.innerHeight);
    this.openStats();
  }

  /// The match log: the career record's last ten matches, newest first, each
  /// row a small dot tinted gold for a win and red for a loss beside the
  /// opponent's name, the score, and the mode and date it was played on.
  /// Raised over the career screen — its BACK pill returns there. Empty until
  /// the first match has been played, then it fills as matches end.
  openLog() {
    // Raised from the career card or straight from the title's history
    // button: either way the title interface hides behind the card.
    this.hideTitleUI(true);
    const log = matchLog();
    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const dayLabel = (key) => {
      const parts = (key || '').split('-');
      return parts.length === 3
        ? `${parts[2]} ${MONTHS[Number(parts[1]) - 1] || ''}`
        : '';
    };
    this.overlayHost(470);
    this.logDim = addText('', {
      left: '0',
      right: '0',
      top: '0',
      bottom: '0',
      backgroundColor: 'rgba(6, 12, 22, 0.45)'
    });
    this.logPanel = addText('', {
      left: '50%',
      top: '50%',
      width: 'min(320px, 86vw)',
      height: '470px',
      transform: 'translate(-50%, -50%)',
      borderRadius: '22px',
      backgroundColor: 'rgba(10, 18, 30, 0.9)',
      border: '1px solid rgba(255, 255, 255, 0.14)'
    });
    this.logPanel.appendChild(addText('MATCH LOG', {
      left: '0',
      right: '0',
      top: '24px',
      textAlign: 'center',
      fontSize: '20px',
      fontWeight: '800',
      letterSpacing: '2px',
      color: '#ffffff'
    }));
    if (!log.length) {
      this.logPanel.appendChild(addText('NO MATCHES YET', {
        left: '0',
        right: '0',
        top: '220px',
        textAlign: 'center',
        fontSize: '12px',
        fontWeight: '700',
        letterSpacing: '2px',
        color: 'rgba(255, 255, 255, 0.4)'
      }));
    }
    log.forEach((e, i) => {
      const y = 60 + i * 32;
      // The result dot: gold for a win, red for a loss.
      this.logPanel.appendChild(addText('', {
        left: '16px',
        top: `${y + 11}px`,
        width: '9px',
        height: '9px',
        borderRadius: '999px',
        backgroundColor: e.won ? '#ffd24a' : '#e2483d'
      }));
      this.logPanel.appendChild(addText(e.opp, {
        left: '34px',
        top: `${y + 2}px`,
        width: '150px',
        fontSize: '12px',
        fontWeight: '700',
        color: '#ffffff',
        whiteSpace: 'nowrap',
        overflow: 'hidden'
      }));
      this.logPanel.appendChild(addText(`${e.mode} · ${dayLabel(e.date)}`, {
        left: '34px',
        top: `${y + 17}px`,
        fontSize: '8px',
        fontWeight: '700',
        letterSpacing: '0.5px',
        color: 'rgba(255, 255, 255, 0.5)'
      }));
      this.logPanel.appendChild(addText(e.score, {
        right: '16px',
        top: `${y + 8}px`,
        fontSize: '11px',
        fontWeight: '800',
        color: '#ffffff',
        whiteSpace: 'nowrap'
      }));
    });
    this.logBackBtn = addButton({
      label: 'Back to career',
      onPress: () => this.closeLog(),
      style: {
        position: 'absolute',
        width: '128px',
        height: '48px',
        left: 'calc(50% - 64px)',
        bottom: 'calc(50% - 218px)',
        borderRadius: '999px',
        backgroundColor: 'rgba(10, 18, 30, 0.4)',
        border: '1.5px solid rgba(255, 255, 255, 0.45)',
        color: '#ffffff',
        fontSize: '13px',
        fontWeight: '700',
        letterSpacing: '1px'
      }
    });
    this.logBackBtn.textContent = 'BACK';
    this.overlay.append(this.logDim, this.logPanel, this.logBackBtn);
    haptic('tick');
  }

  closeLog() {
    this.overlay?.remove();
    this.overlay = null;
    this.logDim?.remove();
    this.logPanel?.remove();
    this.logBackBtn?.remove();
    this.logDim = null;
    this.logPanel = null;
    this.logBackBtn = null;
    if (this.logFromTitle) {
      // Raised straight from the title: back means back to the title.
      this.logFromTitle = false;
      this.hideTitleUI(false);
    } else {
      // Raised over the career card: the card went with the log's host, so
      // it is rebuilt — over a fresh dim, the stale one stepping aside.
      this.dim?.remove();
      this.dim = null;
      this.openStats();
    }
    haptic('tick');
  }

  // --------------------------------------------------------------- rivals

  /// The rivals screen: the match log grouped by opponent, most-played
  /// first — each row the opponent's name, their win-loss record against
  /// the player, a gold or red dot for the last meeting's result, that
  /// meeting's set scores at the right edge and, when one is running, the
  /// streak of meetings taken in a row. Raised over the career card — its
  /// BACK pill returns there. Empty until a match has been played.
  openRivals() {
    this.hideTitleUI(true);
    const rows = rivalRows(matchLog());
    this.overlayHost(520);
    this.rivalsDim = addText('', {
      left: '0',
      right: '0',
      top: '0',
      bottom: '0',
      backgroundColor: 'rgba(6, 12, 22, 0.45)'
    });
    this.rivalsPanel = addText('', {
      left: '50%',
      top: '50%',
      width: 'min(320px, 86vw)',
      height: '520px',
      transform: 'translate(-50%, -50%)',
      borderRadius: '22px',
      backgroundColor: 'rgba(10, 18, 30, 0.9)',
      border: '1px solid rgba(255, 255, 255, 0.14)'
    });
    this.rivalsPanel.appendChild(addText('RIVALS', {
      left: '0',
      right: '0',
      top: '24px',
      textAlign: 'center',
      fontSize: '20px',
      fontWeight: '800',
      letterSpacing: '2px',
      color: '#ffffff'
    }));
    if (!rows.length) {
      this.rivalsPanel.appendChild(addText('NO RIVALS YET', {
        left: '0',
        right: '0',
        top: '220px',
        textAlign: 'center',
        fontSize: '12px',
        fontWeight: '700',
        letterSpacing: '2px',
        color: 'rgba(255, 255, 255, 0.4)'
      }));
    }
    rows.forEach((g, i) => {
      const y = 60 + i * 38;
      // Each row is its own tappable card: a faint plate with the row's
      // content laid out within it, and an invisible button across the whole
      // thing that opens this rival's dossier.
      const row = addText('', {
        left: '16px',
        right: '16px',
        top: `${y}px`,
        height: '34px',
        borderRadius: '10px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)'
      });
      this.rivalsPanel.appendChild(row);
      // The last meeting's result dot: gold for a win, red for a loss.
      row.appendChild(addText('', {
        left: '12px',
        top: '12px',
        width: '9px',
        height: '9px',
        borderRadius: '999px',
        backgroundColor: g.last.won ? '#ffd24a' : '#e2483d'
      }));
      row.appendChild(addText(g.name, {
        left: '30px',
        top: '3px',
        width: '170px',
        fontSize: '12px',
        fontWeight: '700',
        color: '#ffffff',
        whiteSpace: 'nowrap',
        overflow: 'hidden'
      }));
      // The head-to-head record: this rival's wins and losses against the
      // player across every meeting the log holds.
      row.appendChild(addText(`${g.wins} W · ${g.losses} L`, {
        left: '30px',
        top: '19px',
        fontSize: '8px',
        fontWeight: '700',
        letterSpacing: '0.5px',
        color: 'rgba(255, 255, 255, 0.5)'
      }));
      // The last meeting's set scores, at the row's right edge.
      row.appendChild(addText(g.last.score, {
        right: '16px',
        top: '3px',
        fontSize: '11px',
        fontWeight: '800',
        color: '#ffffff',
        whiteSpace: 'nowrap'
      }));
      // The streak: two or more meetings in a row taken — or dropped —
      // against this rival, reading down from the most recent.
      if (g.streak >= 2) {
        row.appendChild(addText(`${g.last.won ? 'W' : 'L'}${g.streak} RUN`, {
          right: '16px',
          top: '19px',
          fontSize: '8px',
          fontWeight: '800',
          letterSpacing: '0.5px',
          color: g.last.won ? '#ffd24a' : '#ff8a7a'
        }));
      }
      // The tap layer: an invisible button across the whole row.
      const open = addButton({
        label: `Open the dossier for ${g.name}`,
        onPress: () => this.openRivalCard(g.name),
        style: {
          position: 'absolute',
          left: '0',
          right: '0',
          top: '0',
          bottom: '0',
          borderRadius: '10px',
          backgroundColor: 'transparent',
          border: 'none'
        }
      });
      row.appendChild(open);
    });
    this.rivalsBackBtn = addButton({
      label: 'Back to career',
      onPress: () => this.closeRivals(),
      style: {
        position: 'absolute',
        width: '128px',
        height: '48px',
        left: 'calc(50% - 64px)',
        bottom: 'calc(50% - 240px)',
        borderRadius: '999px',
        backgroundColor: 'rgba(10, 18, 30, 0.4)',
        border: '1.5px solid rgba(255, 255, 255, 0.45)',
        color: '#ffffff',
        fontSize: '13px',
        fontWeight: '700',
        letterSpacing: '1px'
      }
    });
    this.rivalsBackBtn.textContent = 'BACK';
    this.overlay.append(this.rivalsDim, this.rivalsPanel, this.rivalsBackBtn);
    haptic('tick');
  }

  closeRivals() {
    this.overlay?.remove();
    this.overlay = null;
    this.rivalsDim?.remove();
    this.rivalsPanel?.remove();
    this.rivalsBackBtn?.remove();
    this.rivalsDim = null;
    this.rivalsPanel = null;
    this.rivalsBackBtn = null;
    // Raised over the career card: the card went with the host, so it is
    // rebuilt — over a fresh dim, the stale one stepping aside.
    this.dim?.remove();
    this.dim = null;
    this.openStats();
    haptic('tick');
  }

  // ------------------------------------------------------ rival dossier

  /// One rival's dossier: raised over the rivals screen — their name and
  /// head-to-head record in gold at the top, every logged meeting listed
  /// chronologically in a scrollable list, the run of results either side
  /// is on, and the scouting read off those meetings — their aces and
  /// spikes landed, and which way the last one went. A filled PLAY THEM
  /// pill fields them in a plain VS CPU match dressed with their style tag
  /// at the chosen difficulty; the outline BACK pill returns to the rivals.
  openRivalCard(name) {
    this.hideTitleUI(true);
    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const dayLabel = (key) => {
      const parts = (key || '').split('-');
      return parts.length === 3
        ? `${parts[2]} ${MONTHS[Number(parts[1]) - 1] || ''}`
        : '';
    };
    // The meetings in the order they were played — the log keeps newest
    // first, so the dossier reads oldest down to the latest.
    const meets = matchLog().filter((e) => e.opp === name).slice().reverse();
    const scout = rivalScout(name);
    this.overlayHost(520);
    this.rivalCardDim = addText('', {
      left: '0',
      right: '0',
      top: '0',
      bottom: '0',
      backgroundColor: 'rgba(6, 12, 22, 0.45)'
    });
    this.rivalCardPanel = addText('', {
      left: '50%',
      top: '50%',
      width: 'min(320px, 86vw)',
      height: '520px',
      transform: 'translate(-50%, -50%)',
      borderRadius: '22px',
      backgroundColor: 'rgba(10, 18, 30, 0.9)',
      border: '1px solid rgba(255, 255, 255, 0.14)'
    });
    // The rival's own card: name and head-to-head record in gold.
    this.rivalCardPanel.appendChild(addText(name, {
      left: '0',
      right: '0',
      top: '24px',
      textAlign: 'center',
      fontSize: '20px',
      fontWeight: '800',
      letterSpacing: '2px',
      color: '#ffd24a'
    }));
    this.rivalCardPanel.appendChild(addText(
      `${scout.wins} W – ${scout.losses} L · ${scout.played} MEETINGS`, {
        left: '0',
        right: '0',
        top: '54px',
        textAlign: 'center',
        fontSize: '10px',
        fontWeight: '800',
        letterSpacing: '2px',
        color: '#ffd24a'
      }));
    // The meetings themselves: a scrollable list, oldest first, each row
    // carrying its result dot, the mode and the day it was played, and the
    // set scores at its right edge.
    const box = addText('', {
      left: '16px',
      right: '16px',
      top: '84px',
      height: '216px',
      overflowY: 'auto',
      borderRadius: '10px',
      backgroundColor: 'rgba(4, 10, 20, 0.55)',
      border: '1px solid rgba(255, 255, 255, 0.12)'
    });
    this.rivalCardPanel.appendChild(box);
    meets.forEach((e, i) => {
      const y = i * 38;
      box.appendChild(addText('', {
        left: '12px',
        top: `${y + 13}px`,
        width: '9px',
        height: '9px',
        borderRadius: '999px',
        backgroundColor: e.won ? '#ffd24a' : '#e2483d'
      }));
      box.appendChild(addText(e.mode, {
        left: '30px',
        top: `${y + 5}px`,
        fontSize: '12px',
        fontWeight: '700',
        color: '#ffffff',
        whiteSpace: 'nowrap'
      }));
      box.appendChild(addText(dayLabel(e.date), {
        left: '30px',
        top: `${y + 21}px`,
        fontSize: '8px',
        fontWeight: '700',
        letterSpacing: '0.5px',
        color: 'rgba(255, 255, 255, 0.5)'
      }));
      box.appendChild(addText(e.score, {
        right: '14px',
        top: `${y + 11}px`,
        fontSize: '11px',
        fontWeight: '800',
        color: '#ffffff',
        whiteSpace: 'nowrap'
      }));
    });
    // The run of results: whoever holds the streak between the two of you.
    this.rivalCardPanel.appendChild(addText(
      scout.streak >= 2
        ? `${scout.last.won ? 'YOU' : 'THEY'} TOOK ${scout.streak} STRAIGHT`
        : 'NO RUN EITHER WAY', {
        left: '0',
        right: '0',
        top: '310px',
        textAlign: 'center',
        fontSize: '11px',
        fontWeight: '800',
        letterSpacing: '1px',
        color: scout.streak >= 2
          ? (scout.last.won ? '#ffd24a' : '#ff8a7a')
          : 'rgba(255, 255, 255, 0.5)'
      }));
    // The scouting read the pre-match team sheet uses: their aces and
    // spikes landed across these meetings, and which way the last one went.
    this.rivalCardPanel.appendChild(addText(
      `${scout.aces} ACES · ${scout.spikes} SPIKES LANDED — ` +
      `LAST WENT ${scout.last.won ? 'TO YOU' : 'THEIR WAY'}`, {
        left: '16px',
        right: '16px',
        top: '336px',
        height: '40px',
        lineHeight: '40px',
        textAlign: 'center',
        fontSize: '10px',
        fontWeight: '700',
        letterSpacing: '0.5px',
        color: 'rgba(255, 255, 255, 0.85)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '10px'
      }));
    // PLAY THEM: fields the rival in a plain VS CPU match — their body and
    // signature style where they carry one, the difficulty the picker chose.
    // A name the singles court cannot dress — the doubles pair, player two —
    // dims the pill instead.
    const opp = this.opponentForRival(name);
    this.rivalPlayBtn = addButton({
      label: opp
        ? `Play a VS CPU match against ${name}`
        : `No VS CPU rival to field for ${name}`,
      onPress: () => {
        if (!opp) return;
        startRivalMatch(opp);
        this.game.start(MatchScene);
      },
      style: {
        position: 'absolute',
        width: '150px',
        height: '48px',
        left: 'calc(50% - 160px)',
        bottom: 'calc(50% - 240px)',
        borderRadius: '999px',
        backgroundColor: opp ? '#1d6fb8' : 'rgba(10, 18, 30, 0.4)',
        color: '#ffffff',
        fontSize: '13px',
        fontWeight: '700',
        letterSpacing: '1px'
      }
    });
    this.rivalPlayBtn.textContent = 'PLAY THEM';
    this.rivalCardBackBtn = addButton({
      label: 'Back to rivals',
      onPress: () => this.closeRivalCard(),
      style: {
        position: 'absolute',
        width: '108px',
        height: '48px',
        left: 'calc(50% + 30px)',
        bottom: 'calc(50% - 240px)',
        borderRadius: '999px',
        backgroundColor: 'rgba(10, 18, 30, 0.4)',
        border: '1.5px solid rgba(255, 255, 255, 0.45)',
        color: '#ffffff',
        fontSize: '13px',
        fontWeight: '700',
        letterSpacing: '1px'
      }
    });
    this.rivalCardBackBtn.textContent = 'BACK';
    // The rivals screen's own refs went with its host: while this card is
    // up, the chevron reads this card's BACK pill instead.
    this.rivalsDim = null;
    this.rivalsPanel = null;
    this.rivalsBackBtn = null;
    this.overlay.append(
      this.rivalCardDim, this.rivalCardPanel,
      this.rivalPlayBtn, this.rivalCardBackBtn
    );
    haptic('tick');
  }

  /// The opponent a rival's name fields: the ladder's rung athletes play
  /// under their own names with their signature styles riding along;
  /// everyone else fields under a roster name. Null when the name belongs
  /// to nobody the singles court can dress — the doubles pair, player two.
  opponentForRival(name) {
    const n = String(name || '').toUpperCase();
    const rung = LADDER.find((r) => r.name.toUpperCase() === n);
    if (rung) return { ...rung };
    const roster = ROSTER.find((r) => r.name.toUpperCase() === n);
    return roster ? { ...roster } : null;
  }

  closeRivalCard() {
    this.overlay?.remove();
    this.overlay = null;
    this.rivalCardDim?.remove();
    this.rivalCardPanel?.remove();
    this.rivalPlayBtn?.remove();
    this.rivalCardBackBtn?.remove();
    this.rivalCardDim = null;
    this.rivalCardPanel = null;
    this.rivalPlayBtn = null;
    this.rivalCardBackBtn = null;
    // Back means back to the rivals screen, rebuilt over the career card it
    // was raised from.
    this.openRivals();
    haptic('tick');
  }

  // --------------------------------------------------------------- bests

  /// The personal bests screen: the career's standout numbers listed one to
  /// a row — the fastest serve, the longest rally, the best survival streak
  /// and the best run on serve — each a small gold label over a large white
  /// number, with the tiny date it was set beneath. Raised over the career
  /// card; its BACK pill returns there.
  openBests() {
    this.hideTitleUI(true);
    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const dayLabel = (key) => {
      const parts = (key || '').split('-');
      return parts.length === 3
        ? `SET ${parts[2]} ${MONTHS[Number(parts[1]) - 1] || ''}`
        : '';
    };
    // The card grows a fifth section: the serve speed league rides under
    // the bests, so the panel is drawn taller to hold it.
    this.overlayHost(560);
    this.bestsDim = addText('', {
      left: '0',
      right: '0',
      top: '0',
      bottom: '0',
      backgroundColor: 'rgba(6, 12, 22, 0.45)'
    });
    this.bestsPanel = addText('', {
      left: '50%',
      top: '50%',
      width: 'min(320px, 86vw)',
      height: '560px',
      transform: 'translate(-50%, -50%)',
      borderRadius: '22px',
      backgroundColor: 'rgba(10, 18, 30, 0.9)',
      border: '1px solid rgba(255, 255, 255, 0.14)'
    });
    this.bestsPanel.appendChild(addText('PERSONAL BESTS', {
      left: '0',
      right: '0',
      top: '24px',
      textAlign: 'center',
      fontSize: '20px',
      fontWeight: '800',
      letterSpacing: '2px',
      color: '#ffffff'
    }));
    personalBests().forEach((best, i) => {
      const row = addText('', {
        left: '16px',
        right: '16px',
        top: `${62 + i * 78}px`,
        height: '70px',
        borderRadius: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.06)'
      });
      this.bestsPanel.appendChild(row);
      row.appendChild(addText(best.label, {
        left: '14px',
        top: '9px',
        fontSize: '10px',
        fontWeight: '700',
        letterSpacing: '1.5px',
        color: '#ffd24a'
      }));
      row.appendChild(addText(best.value, {
        left: '14px',
        top: '25px',
        fontSize: '24px',
        fontWeight: '800',
        color: '#ffffff',
        whiteSpace: 'nowrap'
      }));
      // The date it was set — left off entirely when the best was banked
      // before the record began keeping dates.
      if (best.date) {
        row.appendChild(addText(dayLabel(best.date), {
          left: '14px',
          top: '52px',
          fontSize: '8px',
          fontWeight: '700',
          letterSpacing: '1px',
          color: 'rgba(255, 255, 255, 0.5)'
        }));
      }
    });
    // The serve speed league: the five fastest serves ever struck, beneath
    // the fastest-serve readout — each row its rank, the pace, the kit it
    // was struck in as two colour dots, and the day it was played. Serves
    // banked before the league began leave a quiet line that fills as new
    // ones are struck.
    this.bestsPanel.appendChild(addText('SERVE SPEED LEAGUE', {
      left: '0',
      right: '0',
      top: '384px',
      textAlign: 'center',
      fontSize: '10px',
      fontWeight: '700',
      letterSpacing: '2px',
      color: 'rgba(255,255,255,0.5)'
    }));
    const league = serveLeague();
    if (league.length) {
      league.forEach((e, i) => {
        const y = 408 + i * 24;
        this.bestsPanel.appendChild(addText(`#${i + 1}`, {
          left: '16px',
          top: `${y}px`,
          fontSize: '13px',
          fontWeight: '800',
          color: '#ffd24a'
        }));
        this.bestsPanel.appendChild(addText(`${Math.round(e.kmh)} KM/H`, {
          left: '48px',
          top: `${y}px`,
          fontSize: '13px',
          fontWeight: '800',
          color: '#ffffff'
        }));
        // The kit it was struck in: jersey and shorts as two small dots.
        const kit = (e.kit || '').split(',').filter(Boolean);
        kit.slice(0, 2).forEach((col, k) => {
          this.bestsPanel.appendChild(addText('', {
            left: `${124 + k * 13}px`,
            top: `${y + 4}px`,
            width: '9px',
            height: '9px',
            borderRadius: '999px',
            backgroundColor: col
          }));
        });
        // The day it was played, at the row's right edge.
        const p = (e.date || '').split('-');
        if (p.length === 3) {
          this.bestsPanel.appendChild(addText(
            `${Number(p[2])} ${MONTHS[Number(p[1]) - 1] || ''}`, {
              right: '16px',
              top: `${y + 2}px`,
              fontSize: '8px',
              fontWeight: '700',
              letterSpacing: '1px',
              color: 'rgba(255,255,255,0.5)'
            }));
        }
      });
    } else {
      this.bestsPanel.appendChild(addText('NO SERVES RANKED YET', {
        left: '0',
        right: '0',
        top: '408px',
        textAlign: 'center',
        fontSize: '10px',
        fontWeight: '700',
        letterSpacing: '2px',
        color: 'rgba(255,255,255,0.35)'
      }));
    }

    this.bestsBackBtn = addButton({
      label: 'Back to career',
      onPress: () => this.closeBests(),
      style: {
        position: 'absolute',
        width: '128px',
        height: '48px',
        left: 'calc(50% - 64px)',
        bottom: 'calc(50% - 218px)',
        borderRadius: '999px',
        backgroundColor: 'rgba(10, 18, 30, 0.4)',
        border: '1.5px solid rgba(255, 255, 255, 0.45)',
        color: '#ffffff',
        fontSize: '13px',
        fontWeight: '700',
        letterSpacing: '1px'
      }
    });
    this.bestsBackBtn.textContent = 'BACK';
    this.overlay.append(this.bestsDim, this.bestsPanel, this.bestsBackBtn);
    haptic('tick');
  }

  closeBests() {
    this.overlay?.remove();
    this.overlay = null;
    this.bestsDim?.remove();
    this.bestsPanel?.remove();
    this.bestsBackBtn?.remove();
    this.bestsDim = null;
    this.bestsPanel = null;
    this.bestsBackBtn = null;
    // Raised over the career card: the card went with the host, so it is
    // rebuilt — over a fresh dim, the stale one stepping aside.
    this.dim?.remove();
    this.dim = null;
    this.openStats();
    haptic('tick');
  }

  // -------------------------------------------------------- season review

  /// The season review screen: the career's arc in three panels over the
  /// dimmed title court — a sparkline of the win rate across the last ten
  /// logged matches, the title ladder from ROOKIE to the current title with
  /// the date each step was reached, and the trophy case reading the cups,
  /// hard cups and doubles cups with their counts. Everything reads off the
  /// record, so the review grows as the career does. Raised over the career
  /// card; its BACK pill returns there.
  openReview() {
    this.hideTitleUI(true);
    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const dayLabel = (key) => {
      const parts = (key || '').split('-');
      return parts.length === 3
        ? `${parts[2]} ${MONTHS[Number(parts[1]) - 1] || ''}`
        : '';
    };
    // The last ten matches in the order they were played — the log keeps
    // newest first, so the sparkline runs oldest on the left.
    const games = matchLog().slice(0, 10).reverse();
    const steps = titleSteps();
    const st = careerStats();
    this.overlayHost(470);
    this.reviewDim = addText('', {
      left: '0',
      right: '0',
      top: '0',
      bottom: '0',
      backgroundColor: 'rgba(6, 12, 22, 0.45)'
    });
    this.reviewPanel = addText('', {
      left: '50%',
      top: '50%',
      width: 'min(320px, 86vw)',
      height: '470px',
      transform: 'translate(-50%, -50%)',
      borderRadius: '22px',
      backgroundColor: 'rgba(10, 18, 30, 0.9)',
      border: '1px solid rgba(255, 255, 255, 0.14)'
    });
    this.reviewPanel.appendChild(addText('SEASON REVIEW', {
      left: '0',
      right: '0',
      top: '24px',
      textAlign: 'center',
      fontSize: '20px',
      fontWeight: '800',
      letterSpacing: '2px',
      color: '#ffffff'
    }));

    // Panel one — the sparkline: one slim bar per logged match in order,
    // its tint the result and its height the running win rate across the run.
    this.reviewPanel.appendChild(addText('LAST TEN · WIN RATE', {
      left: '16px',
      right: '16px',
      top: '64px',
      fontSize: '11px',
      fontWeight: '800',
      letterSpacing: '1.5px',
      color: '#ffd24a'
    }));
    if (games.length) {
      const track = addText('', {
        left: '16px',
        right: '16px',
        top: '84px',
        height: '46px'
      });
      this.reviewPanel.appendChild(track);
      let wins = 0;
      games.forEach((e, i) => {
        if (e.won) wins++;
        const rate = wins / (i + 1);
        track.appendChild(addText('', {
          left: `calc(${i} * 10%)`,
          bottom: '0',
          width: 'calc(10% - 3px)',
          height: `${Math.round(8 + rate * 38)}px`,
          borderRadius: '2px',
          backgroundColor: e.won
            ? 'rgba(255, 210, 74, 0.85)'
            : 'rgba(226, 72, 61, 0.75)'
        }));
      });
      const won = games.filter((e) => e.won).length;
      this.reviewPanel.appendChild(addText(
        `${won} W · ${games.length - won} L · WIN RATE ${Math.round(won / games.length * 100)}%`, {
          left: '16px',
          right: '16px',
          top: '138px',
          textAlign: 'center',
          fontSize: '9px',
          fontWeight: '700',
          letterSpacing: '1px',
          color: 'rgba(255, 255, 255, 0.6)'
        }));
    } else {
      this.reviewPanel.appendChild(addText('NO MATCHES LOGGED YET', {
        left: '0',
        right: '0',
        top: '100px',
        textAlign: 'center',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '2px',
        color: 'rgba(255, 255, 255, 0.4)'
      }));
    }

    // Panel two — the title ladder: four ribbons in order, lit where the
    // career's win column has carried the player onto the title — the date
    // beneath where the record stamped one, the requirement beneath where
    // it hasn't got there yet.
    this.reviewPanel.appendChild(addText('TITLE LADDER', {
      left: '16px',
      right: '16px',
      top: '164px',
      fontSize: '11px',
      fontWeight: '800',
      letterSpacing: '1.5px',
      color: '#ffd24a'
    }));
    steps.forEach((step, i) => {
      const ribbon = addText('', {
        left: `calc(16px + ${i} * (25% - 6.5px))`,
        top: '184px',
        width: 'calc(25% - 12.5px)',
        height: '48px',
        borderRadius: '10px',
        backgroundColor: step.reached
          ? 'rgba(255, 210, 74, 0.16)'
          : 'rgba(255, 255, 255, 0.05)',
        border: step.reached
          ? '1px solid rgba(255, 210, 74, 0.55)'
          : '1px solid rgba(255, 255, 255, 0.1)'
      });
      this.reviewPanel.appendChild(ribbon);
      ribbon.appendChild(addText(step.name, {
        left: '2px',
        right: '2px',
        top: '8px',
        textAlign: 'center',
        fontSize: '10px',
        fontWeight: '800',
        letterSpacing: '0.5px',
        color: step.reached ? '#ffd24a' : 'rgba(255, 255, 255, 0.45)'
      }));
      ribbon.appendChild(addText(
        step.reached ? (step.date ? dayLabel(step.date) : 'REACHED')
          : `AT ${step.wins} WINS`, {
          left: '2px',
          right: '2px',
          top: '25px',
          textAlign: 'center',
          fontSize: '8px',
          fontWeight: '700',
          letterSpacing: '0.5px',
          lineHeight: '1.25',
          color: step.reached ? '#ffd24a' : 'rgba(255, 255, 255, 0.35)'
        }));
    });

    // Panel three — the trophy case: the cups in their three flavours, each
    // a tile with its count.
    this.reviewPanel.appendChild(addText('TROPHY CASE', {
      left: '16px',
      right: '16px',
      top: '254px',
      fontSize: '11px',
      fontWeight: '800',
      letterSpacing: '1.5px',
      color: '#ffd24a'
    }));
    [['CUPS WON', st.cups], ['HARD CUPS', st.hardCups], ['DOUBLES CUPS', st.doublesCups]]
      .forEach(([label, count], i) => {
        const tile = addText('', {
          left: `calc(16px + ${i} * (33.33% - 8px))`,
          top: '286px',
          width: 'calc(33.33% - 16px)',
          height: '80px',
          borderRadius: '12px',
          backgroundColor: 'rgba(255, 255, 255, 0.06)'
        });
        this.reviewPanel.appendChild(tile);
        tile.appendChild(addText(label, {
          left: '4px',
          right: '4px',
          top: '10px',
          textAlign: 'center',
          fontSize: '9px',
          fontWeight: '700',
          letterSpacing: '0.5px',
          lineHeight: '1.15',
          color: 'rgba(255, 255, 255, 0.55)'
        }));
        tile.appendChild(addText(`${count}`, {
          left: '0',
          right: '0',
          top: '34px',
          textAlign: 'center',
          fontSize: '26px',
          fontWeight: '800',
          color: count ? '#ffd24a' : '#ffffff'
        }));
      });

    this.reviewBackBtn = addButton({
      label: 'Back to career',
      onPress: () => this.closeReview(),
      style: {
        position: 'absolute',
        width: '128px',
        height: '48px',
        left: 'calc(50% - 64px)',
        bottom: 'calc(50% - 218px)',
        borderRadius: '999px',
        backgroundColor: 'rgba(10, 18, 30, 0.4)',
        border: '1.5px solid rgba(255, 255, 255, 0.45)',
        color: '#ffffff',
        fontSize: '13px',
        fontWeight: '700',
        letterSpacing: '1px'
      }
    });
    this.reviewBackBtn.textContent = 'BACK';
    this.overlay.append(this.reviewDim, this.reviewPanel, this.reviewBackBtn);
    haptic('tick');
  }

  closeReview() {
    this.overlay?.remove();
    this.overlay = null;
    this.reviewDim?.remove();
    this.reviewPanel?.remove();
    this.reviewBackBtn?.remove();
    this.reviewDim = null;
    this.reviewPanel = null;
    this.reviewBackBtn = null;
    // Raised over the career card: the card went with the host, so it is
    // rebuilt — over a fresh dim, the stale one stepping aside.
    this.dim?.remove();
    this.dim = null;
    this.openStats();
    haptic('tick');
  }

  // --------------------------------------------------------- record backup

  /// The record backup screen: the career card steps aside and a dark
  /// translucent panel shows the whole saved record packed into one compact
  /// text code — tallies, badges, bests with their dates, log, heat grids
  /// and the rally recording — in a scrollable monospaced block with a
  /// filled COPY pill beneath it, and below a divider a paste field with a
  /// filled RESTORE pill. A malformed code is refused with a quiet line,
  /// the save untouched; a good one rebuilds the record wholesale. The
  /// outline BACK pill returns to the career screen.
  openBackup() {
    this.hideTitleUI(true);
    this.overlayHost(520);
    this.backupDim = addText('', {
      left: '0', right: '0', top: '0', bottom: '0',
      backgroundColor: 'rgba(6, 12, 22, 0.45)'
    });
    this.backupPanel = addText('', {
      left: '50%', top: '50%', width: 'min(320px, 86vw)', height: '520px',
      transform: 'translate(-50%, -50%)', borderRadius: '22px',
      backgroundColor: 'rgba(10, 18, 30, 0.9)',
      border: '1px solid rgba(255, 255, 255, 0.14)'
    });
    this.backupPanel.appendChild(addText('RECORD BACKUP', {
      left: '0', right: '0', top: '24px', textAlign: 'center',
      fontSize: '20px', fontWeight: '800', letterSpacing: '2px', color: '#ffffff'
    }));
    // The code itself: monospaced, scrollable, and fully selectable, so a
    // clipboard that refuses the pill can still be beaten by hand.
    this.backupCodeBox = document.createElement('div');
    this.backupCodeBox.textContent = backupCode();
    this.backupCodeBox.style.cssText =
      'position:absolute;left:16px;right:16px;top:58px;height:140px;' +
      'overflow-y:auto;padding:8px 10px;border-radius:10px;' +
      'background:rgba(4, 10, 20, 0.75);' +
      'border:1px solid rgba(255,255,255,0.14);' +
      'color:rgba(255,255,255,0.85);' +
      'font-family:Menlo,Consolas,monospace;font-size:10px;' +
      'line-height:1.45;word-break:break-all;' +
      '-webkit-user-select:all;user-select:all;';
    this.backupPanel.appendChild(this.backupCodeBox);
    this.backupCopyBtn = addButton({
      label: 'Copy the backup code',
      onPress: () => this.copyBackup(),
      style: {
        position: 'absolute', left: 'calc(50% - 70px)', top: 'calc(50% - 54px)',
        width: '140px', height: '44px', borderRadius: '999px',
        backgroundColor: '#1d6fb8', color: '#ffffff',
        fontSize: '12px', fontWeight: '700', letterSpacing: '1px'
      }
    });
    this.backupCopyBtn.textContent = 'COPY CODE';
    // The quiet line reporting what the last press did.
    this.backupStatus = addText('', {
      left: '16px', right: '16px', top: '254px', textAlign: 'center',
      fontSize: '9px', fontWeight: '700', letterSpacing: '1px',
      color: 'rgba(255, 255, 255, 0.6)'
    });
    this.backupPanel.appendChild(this.backupStatus);
    // The divider between the code half and the paste half.
    this.backupPanel.appendChild(addText('', {
      left: '16px', right: '16px', top: '276px', height: '1px',
      backgroundColor: 'rgba(255, 255, 255, 0.16)'
    }));
    this.backupPaste = document.createElement('textarea');
    this.backupPaste.placeholder = 'PASTE A BACKUP CODE HERE';
    this.backupPaste.setAttribute('aria-label', 'Backup code');
    this.backupPaste.spellcheck = false;
    this.backupPaste.autocapitalize = 'off';
    this.backupPaste.autocomplete = 'off';
    this.backupPaste.style.cssText =
      'position:absolute;left:16px;right:16px;top:288px;height:104px;' +
      'resize:none;outline:none;padding:8px 10px;border-radius:10px;' +
      'background:rgba(4, 10, 20, 0.75);' +
      'border:1px solid rgba(255,255,255,0.14);color:#ffffff;' +
      'font-family:Menlo,Consolas,monospace;font-size:10px;' +
      'line-height:1.45;word-break:break-all;';
    this.backupPanel.appendChild(this.backupPaste);
    this.backupRestoreBtn = addButton({
      label: 'Restore the record from a code',
      onPress: () => this.restoreBackup(),
      style: {
        position: 'absolute', left: 'calc(50% - 80px)', top: 'calc(50% + 140px)',
        width: '160px', height: '44px', borderRadius: '999px',
        backgroundColor: '#1d6fb8', color: '#ffffff',
        fontSize: '12px', fontWeight: '700', letterSpacing: '1px'
      }
    });
    this.backupRestoreBtn.textContent = 'RESTORE';
    this.backupBackBtn = addButton({
      label: 'Back to career',
      onPress: () => this.closeBackup(),
      style: {
        position: 'absolute', width: '128px', height: '48px',
        left: 'calc(50% - 64px)', bottom: 'calc(50% - 240px)',
        borderRadius: '999px',
        backgroundColor: 'rgba(10, 18, 30, 0.4)',
        border: '1.5px solid rgba(255, 255, 255, 0.45)',
        color: '#ffffff', fontSize: '13px', fontWeight: '700', letterSpacing: '1px'
      }
    });
    this.backupBackBtn.textContent = 'BACK';
    this.overlay.append(
      this.backupDim, this.backupPanel, this.backupCopyBtn,
      this.backupRestoreBtn, this.backupBackBtn
    );
    haptic('tick');
  }

  /// The copy: the clipboard API first, and where it refuses — private mode,
  /// a non-secure view — the code is selected whole for the old-fashioned
  /// copy command, with the status line saying which way it went.
  copyBackup() {
    const code = this.backupCodeBox.textContent;
    const done = () => {
      this.backupStatus.textContent = 'COPIED — PASTE IT SOMEWHERE SAFE';
      this.backupStatus.style.color = '#ffd24a';
      haptic('tick');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done, () => this.copyFallback());
    } else {
      this.copyFallback();
    }
  }

  copyFallback() {
    const box = this.backupCodeBox;
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(box);
    sel.removeAllRanges();
    sel.addRange(range);
    const ok = document.execCommand && document.execCommand('copy');
    sel.removeAllRanges();
    this.backupStatus.textContent = ok
      ? 'COPIED — PASTE IT SOMEWHERE SAFE'
      : 'SELECT THE CODE AND COPY BY HAND';
    this.backupStatus.style.color = ok ? '#ffd24a' : 'rgba(255, 138, 122, 0.9)';
    haptic('tick');
  }

  /// The restore: an empty field asks for a code; a malformed one is
  /// refused with a quiet line, the save untouched; a good one rebuilds the
  /// record — and the career card behind the panel reads it afresh when the
  /// BACK pill returns there.
  restoreBackup() {
    if (!this.backupPaste.value.trim()) {
      this.backupStatus.textContent = 'PASTE A CODE FIRST';
      this.backupStatus.style.color = 'rgba(255, 138, 122, 0.9)';
      haptic('tick');
      return;
    }
    if (restoreCode(this.backupPaste.value)) {
      this.backupStatus.textContent = 'RECORD RESTORED';
      this.backupStatus.style.color = '#ffd24a';
      haptic('win');
    } else {
      this.backupStatus.textContent = 'NOT A VALID CODE — CHECK THE PASTE';
      this.backupStatus.style.color = 'rgba(255, 138, 122, 0.9)';
      haptic('tick');
    }
  }

  closeBackup() {
    this.overlay?.remove();
    this.overlay = null;
    this.backupDim?.remove();
    this.backupPanel?.remove();
    this.backupCopyBtn?.remove();
    this.backupStatus?.remove();
    this.backupRestoreBtn?.remove();
    this.backupBackBtn?.remove();
    this.backupDim = null;
    this.backupPanel = null;
    this.backupCopyBtn = null;
    this.backupStatus = null;
    this.backupRestoreBtn = null;
    this.backupBackBtn = null;
    // Raised over the career card: the card went with the host, so it is
    // rebuilt — over a fresh dim, the stale one stepping aside.
    this.dim?.remove();
    this.dim = null;
    this.openStats();
    haptic('tick');
  }

  // --------------------------------------------------------- awards night

  /// The season awards night: once the ladder's top rung has been beaten, the
  /// career's GOLDEN COURT pill opens a ceremony over a night court — a deep
  /// blue dim with a spotlight sweeping slowly across it — and three award
  /// cards are revealed one at a time on their own stings: the fastest serve,
  /// the longest rally and the cup count, the earned ones lit gold with the
  /// day they were set and the unearned ones sitting dim. The fanfare and a
  /// confetti burst close the ceremony, and the card remembers the day it was
  /// last claimed. The outline BACK pill returns to the career screen.
  openAwards() {
    this.hideTitleUI(true);
    this.overlayHost(520);
    // The night court behind the card: a deep blue fall-off with a slow
    // spotlight sweeping across it.
    this.awardsDim = addText('', {
      left: '0',
      right: '0',
      top: '0',
      bottom: '0',
      background: 'radial-gradient(120% 90% at 50% 8%, rgba(24, 40, 82, 0.92), rgba(3, 7, 16, 0.97))'
    });
    this.awardsSpot = addText('', {
      left: '-30%',
      top: '-40%',
      width: '160%',
      height: '150%',
      background: 'radial-gradient(closest-side, rgba(255, 226, 150, 0.2), rgba(255, 226, 150, 0))',
      pointerEvents: 'none',
      animation: 'awards-sweep 9s ease-in-out infinite'
    });
    this.awardsPanel = addText('', {
      left: '50%',
      top: '50%',
      width: 'min(320px, 86vw)',
      height: '470px',
      transform: 'translate(-50%, -50%)',
      borderRadius: '22px',
      backgroundColor: 'rgba(8, 14, 26, 0.84)',
      border: '1px solid rgba(255, 214, 110, 0.35)'
    });
    this.awardsPanel.appendChild(addText('SEASON AWARDS', {
      left: '0',
      right: '0',
      top: '24px',
      textAlign: 'center',
      fontSize: '19px',
      fontWeight: '800',
      letterSpacing: '3px',
      color: '#ffd24a'
    }));
    // When the ceremony was last claimed — read before this visit marks it.
    const last = awardsClaimed();
    this.awardsPanel.appendChild(addText(
      last ? `LAST CLAIMED · ${last}` : 'FIRST CEREMONY · THE TOP RUNG FELL', {
        left: '0',
        right: '0',
        top: '50px',
        textAlign: 'center',
        fontSize: '9px',
        fontWeight: '700',
        letterSpacing: '1px',
        color: 'rgba(255, 255, 255, 0.5)'
      }));
    // The three awards: earned rows lit gold with their date, unearned ones
    // dim with a quiet line instead.
    const awards = seasonAwards();
    this.awardsRows = awards.map((award, i) => {
      const row = addText('', {
        left: '20px',
        right: '20px',
        top: `${84 + i * 108}px`,
        height: '92px',
        borderRadius: '14px',
        backgroundColor: award.earned
          ? 'rgba(255, 210, 74, 0.12)' : 'rgba(255, 255, 255, 0.04)',
        border: award.earned
          ? '1px solid rgba(255, 210, 74, 0.5)'
          : '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: award.earned ? '0 0 22px rgba(255, 210, 74, 0.18)' : 'none',
        opacity: '0',
        transform: 'translateY(10px)',
        transition: 'opacity 0.45s ease, transform 0.45s ease'
      });
      row.appendChild(addText(award.label, {
        left: '14px',
        right: '14px',
        top: '12px',
        textAlign: 'center',
        fontSize: '10px',
        fontWeight: '800',
        letterSpacing: '2px',
        color: award.earned ? '#ffd24a' : 'rgba(255, 255, 255, 0.45)'
      }));
      row.appendChild(addText(award.value, {
        left: '14px',
        right: '14px',
        top: '30px',
        textAlign: 'center',
        fontSize: '26px',
        fontWeight: '800',
        color: award.earned ? '#ffffff' : 'rgba(255, 255, 255, 0.35)'
      }));
      row.appendChild(addText(award.earned ? award.date : 'NOT YET EARNED', {
        left: '14px',
        right: '14px',
        top: '66px',
        textAlign: 'center',
        fontSize: '9px',
        fontWeight: '700',
        letterSpacing: '1px',
        color: award.earned
          ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.3)'
      }));
      this.awardsPanel.appendChild(row);
      return row;
    });
    this.awardsBackBtn = addButton({
      label: 'Back to career',
      onPress: () => this.closeAwards(),
      style: {
        position: 'absolute',
        width: '128px',
        height: '48px',
        left: 'calc(50% - 64px)',
        bottom: 'calc(50% - 240px)',
        borderRadius: '999px',
        backgroundColor: 'rgba(10, 18, 30, 0.4)',
        border: '1.5px solid rgba(255, 255, 255, 0.45)',
        color: '#ffffff',
        fontSize: '13px',
        fontWeight: '700',
        letterSpacing: '1px'
      }
    });
    this.awardsBackBtn.textContent = 'BACK';
    this.overlay.append(
      this.awardsDim, this.awardsSpot, this.awardsPanel, this.awardsBackBtn
    );
    // The reveal: one card at a time, each with its own short sting, then the
    // fanfare and the confetti close the ceremony.
    this.awardsTimers = [];
    this.awardsRows.forEach((row, i) => {
      this.awardsTimers.push(setTimeout(() => {
        row.style.opacity = '1';
        row.style.transform = 'translateY(0)';
        playBadgeSting();
      }, 700 + i * 900));
    });
    this.awardsTimers.push(setTimeout(() => {
      playFanfare();
      haptic('win');
      this.awardsConfetti();
    }, 700 + this.awardsRows.length * 900 + 500));
    markAwardsClaimed();
    haptic('tick');
  }

  /// The confetti: a burst of small coloured bits falling over the ceremony
  /// as the fanfare closes it, gone with the card.
  awardsConfetti() {
    const colours = ['#ffd24a', '#ffffff', '#9fd8ff', '#ff8a7a', '#7ddb6a'];
    this.awardsBits = [];
    for (let i = 0; i < 26; i++) {
      const bit = addText('', {
        left: `${Math.round(Math.random() * 100)}%`,
        top: '-6%',
        width: '7px',
        height: '10px',
        borderRadius: '2px',
        backgroundColor: colours[i % colours.length],
        opacity: '0.95',
        pointerEvents: 'none',
        animation: `awards-confetti ${(0.9 + Math.random() * 0.9).toFixed(2)}s ` +
          `ease-in ${(Math.random() * 0.5).toFixed(2)}s forwards`
      });
      this.overlay.appendChild(bit);
      this.awardsBits.push(bit);
    }
  }

  closeAwards() {
    for (const id of this.awardsTimers || []) clearTimeout(id);
    this.awardsTimers = null;
    this.overlay?.remove();
    this.overlay = null;
    this.awardsDim?.remove();
    this.awardsSpot?.remove();
    this.awardsPanel?.remove();
    this.awardsBackBtn?.remove();
    for (const bit of this.awardsBits || []) bit.remove();
    this.awardsBits = null;
    this.awardsDim = null;
    this.awardsSpot = null;
    this.awardsPanel = null;
    this.awardsBackBtn = null;
    this.awardsRows = null;
    // Raised over the career card: the card went with the host, so it is
    // rebuilt over a fresh dim.
    this.dim?.remove();
    this.dim = null;
    this.openStats();
    haptic('tick');
  }

  // ---------------------------------------------------------------- daily

  /// The daily challenge card: the title UI hides, the court dims behind a
  /// dark translucent panel, and today's seeded match-up shows — both
  /// athletes as silhouettes, the opponent's style tag, the day's court,
  /// level and wind, and the streak of consecutive daily wins. One attempt:
  /// a win lights the day's tile gold and banks the streak, a loss leaves
  /// the opponent standing there until tomorrow.
  openDaily() {
    const ch = dailyChallenge();
    this.hideTitleUI(true);
    this.overlayHost(372);
    this.dim = addText('', {
      left: '0',
      right: '0',
      top: '0',
      bottom: '0',
      backgroundColor: 'rgba(6, 12, 22, 0.55)'
    });
    this.panel = addText('', {
      left: '50%',
      top: '50%',
      width: 'min(320px, 86vw)',
      height: '372px',
      transform: 'translate(-50%, -50%)',
      borderRadius: '22px',
      backgroundColor: 'rgba(10, 18, 30, 0.85)',
      border: '1px solid rgba(255, 255, 255, 0.14)'
    });
    this.panel.appendChild(addText('DAILY CHALLENGE', {
      left: '0',
      right: '0',
      top: '24px',
      textAlign: 'center',
      fontSize: '20px',
      fontWeight: '800',
      letterSpacing: '2px',
      color: '#ffffff'
    }));
    // The date line, large: the whole card belongs to this one day.
    this.panel.appendChild(addText(
      new Date().toLocaleDateString(undefined, {
        weekday: 'long', day: 'numeric', month: 'long'
      }).toUpperCase(), {
        left: '0',
        right: '0',
        top: '56px',
        textAlign: 'center',
        fontSize: '14px',
        fontWeight: '800',
        letterSpacing: '2px',
        color: '#ffd24a'
      }));

    // The match-up row: both athletes' silhouettes over their names, the
    // day's state at its right — and lit gold once the day has been won.
    const won = ch.played && ch.won;
    const row = addText('', {
      left: '16px',
      right: '16px',
      top: '92px',
      height: '104px',
      borderRadius: '12px',
      backgroundColor: won ? 'rgba(255, 210, 74, 0.16)' : 'rgba(255, 255, 255, 0.06)',
      border: won
        ? '1px solid rgba(255, 210, 74, 0.55)'
        : '1px solid rgba(255, 255, 255, 0.1)'
    });
    this.panel.appendChild(row);
    const silhouette = (name, at, icon) => {
      row.appendChild(addText('', {
        left: `calc(${at}% - 26px)`,
        top: '14px',
        width: '52px',
        height: '52px',
        borderRadius: '999px',
        backgroundColor: 'rgba(10, 18, 30, 0.55)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        backgroundImage: `var(--icon-${icon})`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundSize: '30px 30px'
      }));
      row.appendChild(addText(name, {
        left: `calc(${at}% - 70px)`,
        top: '70px',
        width: '140px',
        textAlign: 'center',
        fontSize: '13px',
        fontWeight: '800',
        color: '#ffffff'
      }));
    };
    silhouette(selectedCharacter().name, 25, 'user');
    silhouette(ch.opp.name, 75, 'user');
    row.appendChild(addText('VS', {
      left: 'calc(50% - 20px)',
      top: '32px',
      width: '40px',
      textAlign: 'center',
      fontSize: '17px',
      fontWeight: '800',
      letterSpacing: '1px',
      color: 'rgba(255, 255, 255, 0.7)'
    }));
    row.appendChild(addText(ch.played ? (ch.won ? 'WON' : 'BEATEN') : 'ONE SHOT', {
      right: '10px',
      top: '8px',
      fontSize: '10px',
      fontWeight: '800',
      letterSpacing: '1.5px',
      color: ch.played ? (ch.won ? '#ffd24a' : 'rgba(255, 138, 122, 0.95)') : 'rgba(255, 255, 255, 0.35)'
    }));

    // How the opponent plays, and what the day plays on: the style tag, then
    // the level, the court and the breeze the seed drew.
    row.appendChild(addText(ch.opp.style.tag, {
      left: '14px',
      top: '88px',
      fontSize: '8px',
      fontWeight: '800',
      letterSpacing: '1px',
      color: '#ffd24a'
    }));
    const windName = ch.wind.strength === 0 ? 'CALM AIR'
      : ch.wind.strength < 0.55 ? 'GENTLE BREEZE'
      : ch.wind.strength < 0.8 ? 'STEADY BREEZE' : 'STIFF WIND';
    this.panel.appendChild(addText(
      `${ch.diff.name} · ${ch.theme.name} COURT · ${windName}`, {
        left: '0',
        right: '0',
        top: '208px',
        textAlign: 'center',
        fontSize: '10px',
        fontWeight: '700',
        letterSpacing: '1.5px',
        color: 'rgba(255, 255, 255, 0.6)'
      }));
    this.panel.appendChild(addText(`CONSECUTIVE WINS · ${ch.streak}`, {
      left: '0',
      right: '0',
      top: '240px',
      textAlign: 'center',
      fontSize: '12px',
      fontWeight: '800',
      letterSpacing: '2px',
      color: ch.streak > 0 ? '#ffd24a' : 'rgba(255, 255, 255, 0.6)'
    }));

    // The week strip: seven small day tiles under the streak line, covering
    // the past week — gold for a won day, dim grey for a lost or skipped one.
    // Today's tile pulses while the day is still unplayed. The results are
    // read off the record's per-date store, so the strip survives restarts.
    const days = dailyDays();
    const today = dateKey();
    const letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    for (let back = 6; back >= 0; back--) {
      const day = new Date();
      day.setDate(day.getDate() - back);
      const key = dateKey(day);
      const wonDay = days[key] === 'won';
      const tile = addText(letters[day.getDay()], {
        left: `calc(16px + ${6 - back} * ((100% - 68px) / 7 + 6px))`,
        top: '266px',
        width: 'calc((100% - 68px) / 7)',
        height: '30px',
        textAlign: 'center',
        lineHeight: '30px',
        fontSize: '11px',
        fontWeight: '800',
        color: wonDay ? 'rgba(45, 32, 5, 0.9)' : 'rgba(255, 255, 255, 0.35)',
        backgroundColor: wonDay ? '#ffd24a' : 'rgba(255, 255, 255, 0.08)',
        borderRadius: '8px'
      });
      if (key === today && !ch.played) {
        tile.style.animation = 'daily-pulse 1.4s ease-in-out infinite';
      }
      this.panel.appendChild(tile);
    }

    // The attempt: filled while the day is unplayed, a dim promise of
    // tomorrow once it has been spent either way.
    this.dailyStartBtn = addButton({
      label: 'Start the daily challenge',
      onPress: () => {
        if (ch.played) return;
        startDaily();
        this.game.start(MatchScene);
      },
      style: {
        position: 'absolute',
        width: '158px',
        height: '48px',
        left: 'calc(50% - 164px)',
        bottom: 'calc(50% - 166px)',
        borderRadius: '999px',
        backgroundColor: ch.played ? 'rgba(10, 18, 30, 0.4)' : '#1d6fb8',
        color: '#ffffff',
        fontSize: '12px',
        fontWeight: '700',
        letterSpacing: '1px'
      }
    });
    this.dailyStartBtn.textContent = ch.played ? 'BACK TOMORROW' : 'START CHALLENGE';
    this.dailyBackBtn = addButton({
      label: 'Back to title',
      onPress: () => this.closeDaily(),
      style: {
        position: 'absolute',
        width: '104px',
        height: '48px',
        left: 'calc(50% + 38px)',
        bottom: 'calc(50% - 166px)',
        borderRadius: '999px',
        backgroundColor: 'rgba(10, 18, 30, 0.4)',
        border: '1.5px solid rgba(255, 255, 255, 0.45)',
        color: '#ffffff',
        fontSize: '13px',
        fontWeight: '700',
        letterSpacing: '1px'
      }
    });
    this.dailyBackBtn.textContent = 'BACK';
    this.overlay.append(this.dim, this.panel, this.dailyStartBtn, this.dailyBackBtn);
    haptic('tick');
  }

  closeDaily() {
    this.overlay?.remove();
    this.overlay = null;
    this.dim?.remove();
    this.panel?.remove();
    this.dailyStartBtn?.remove();
    this.dailyBackBtn?.remove();
    this.dim = null;
    this.panel = null;
    this.dailyStartBtn = null;
    this.dailyBackBtn = null;
    this.hideTitleUI(false);
    haptic('tick');
  }

  // ------------------------------------------------------------------ cup

  /// The cup screen: the title UI hides, the court dims behind a dark
  /// translucent panel, and a vertical bracket of three round rows shows each
  /// opponent and where the run stands — rounds already won, the round up
  /// next highlighted, and the rounds still locked behind it. A filled pill
  /// plays the current round; an outline BACK pill closes the screen.
  openCup() {
    const run = cupRun();
    this.hardCup = !!run.hard;
    this.dblCup = !!run.doubles;
    // The tier toggles appear once any cup has been won at all — singles,
    // hard or doubles — and they need a taller card to sit in.
    const st = careerStats();
    const toggles = st.cups + st.hardCups + st.doublesCups >= 1;
    this.cupTall = toggles;
    this.hideTitleUI(true);
    this.overlayHost(toggles ? 460 : 372);
    this.dim = addText('', {
      left: '0',
      right: '0',
      top: '0',
      bottom: '0',
      backgroundColor: 'rgba(6, 12, 22, 0.55)'
    });
    this.panel = addText('', {
      left: '50%',
      top: '50%',
      width: 'min(320px, 86vw)',
      height: `${toggles ? 460 : 372}px`,
      transform: 'translate(-50%, -50%)',
      borderRadius: '22px',
      backgroundColor: 'rgba(10, 18, 30, 0.85)',
      border: '1px solid rgba(255, 255, 255, 0.14)'
    });
    // The tier decides the headline: the hard cup announces itself.
    this.panel.appendChild(addText(
      run.hard && run.doubles ? 'HARD DOUBLES CUP'
        : run.hard ? 'HARD CUP' : run.doubles ? 'DOUBLES CUP' : 'CUP', {
      left: '0',
      right: '0',
      top: '24px',
      textAlign: 'center',
      fontSize: '20px',
      fontWeight: '800',
      letterSpacing: '2px',
      color: run.hard ? '#ff8a7a' : '#ffffff'
    }));

    run.opponents.forEach((opp, i) => {
      const round = i + 1;
      const state = round < run.round ? 'WON' : round === run.round ? 'NEXT' : 'LOCKED';
      // The hard run tints its whole bracket red, the current round deepest.
      const row = addText('', {
        left: '16px',
        right: '16px',
        top: `${70 + i * 66}px`,
        height: '56px',
        borderRadius: '12px',
        backgroundColor: round === run.round
          ? (run.hard ? 'rgba(206, 38, 52, 0.42)' : 'rgba(47, 127, 209, 0.4)')
          : (run.hard ? 'rgba(206, 38, 52, 0.12)' : 'rgba(255, 255, 255, 0.06)')
      });
      this.panel.appendChild(row);
      row.appendChild(addText(`ROUND ${round}`, {
        left: '14px',
        top: '9px',
        fontSize: '10px',
        fontWeight: '700',
        letterSpacing: '1.5px',
        color: 'rgba(255, 255, 255, 0.55)'
      }));
      row.appendChild(addText((run.doubles && run.partners
        ? `${opp.name} & ${run.partners[i].name}`
        : opp.name
      ).toUpperCase(), {
        left: '14px',
        top: '21px',
        fontSize: '16px',
        fontWeight: '800',
        color: '#ffffff'
      }));
      // The signature style under the name: how this opponent plays.
      row.appendChild(addText(opp.style ? opp.style.tag : '', {
        left: '14px',
        top: '39px',
        fontSize: '8px',
        fontWeight: '800',
        letterSpacing: '1px',
        color: '#ffd24a'
      }));
      row.appendChild(addText(state, {
        right: '14px',
        top: '18px',
        fontSize: '12px',
        fontWeight: '800',
        letterSpacing: '2px',
        color: state === 'WON' ? '#ffd24a'
          : state === 'NEXT' ? (run.hard ? '#ffb0a6' : '#9fd8ff')
          : 'rgba(255, 255, 255, 0.35)'
      }));
    });

    // The tier toggles, once any cup has been won at all: the hard run —
    // every round against an opponent a level stronger, the bracket burning
    // red — and the doubles run — the co-op rules all three rounds, the
    // player and their CPU partner against two CPU pairs. Either toggle
    // starts a fresh run in that shape, and the two combine.
    if (toggles) {
      this.hardRow = addText('', {
        left: '16px',
        right: '16px',
        top: '262px',
        height: '38px',
        borderRadius: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.06)'
      });
      this.panel.appendChild(this.hardRow);
      this.hardRow.appendChild(addText('HARD CUP', {
        left: '14px',
        top: '7px',
        fontSize: '12px',
        fontWeight: '800',
        letterSpacing: '1px',
        color: run.hard ? '#ff8a7a' : 'rgba(255, 255, 255, 0.9)'
      }));
      this.hardRow.appendChild(addText('EVERY ROUND A STEP HARDER', {
        left: '14px',
        top: '23px',
        fontSize: '8px',
        fontWeight: '700',
        letterSpacing: '1px',
        color: 'rgba(255, 255, 255, 0.45)'
      }));
      this.hardSwitch = addButton({
        label: 'Toggle hard cup',
        onPress: () => {
          this.hardCup = !this.hardCup;
          startCup(this.hardCup, this.dblCup);
          this.closeCup();
          this.openCup();
        },
        style: {
          position: 'absolute',
          right: '12px',
          top: '4px',
          width: '52px',
          height: '30px',
          borderRadius: '999px',
          backgroundColor: run.hard ? '#c8323e' : 'rgba(120, 130, 140, 0.55)'
        }
      });
      this.hardKnob = document.createElement('div');
      this.hardKnob.style.cssText =
        'position:absolute;top:2px;left:' + (run.hard ? '24px' : '2px') + ';' +
        'width:26px;height:26px;border-radius:999px;background:#ffffff;' +
        'box-shadow:0 1px 4px rgba(0,0,0,0.35);transition:left 0.15s';
      this.hardSwitch.appendChild(this.hardKnob);
      this.hardRow.appendChild(this.hardSwitch);
      // The doubles toggle: the whole run under the co-op rules.
      this.dblRow = addText('', {
        left: '16px',
        right: '16px',
        top: '306px',
        height: '38px',
        borderRadius: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.06)'
      });
      this.panel.appendChild(this.dblRow);
      this.dblRow.appendChild(addText('DOUBLES', {
        left: '14px',
        top: '7px',
        fontSize: '12px',
        fontWeight: '800',
        letterSpacing: '1px',
        color: run.doubles ? '#ffd24a' : 'rgba(255, 255, 255, 0.9)'
      }));
      this.dblRow.appendChild(addText('YOU & YOUR PARTNER VS TWO PAIRS', {
        left: '14px',
        top: '23px',
        fontSize: '8px',
        fontWeight: '700',
        letterSpacing: '1px',
        color: 'rgba(255, 255, 255, 0.45)'
      }));
      this.dblSwitch = addButton({
        label: 'Toggle doubles cup',
        onPress: () => {
          this.dblCup = !this.dblCup;
          startCup(this.hardCup, this.dblCup);
          this.closeCup();
          this.openCup();
        },
        style: {
          position: 'absolute',
          right: '12px',
          top: '4px',
          width: '52px',
          height: '30px',
          borderRadius: '999px',
          backgroundColor: run.doubles ? '#d4a017' : 'rgba(120, 130, 140, 0.55)'
        }
      });
      this.dblKnob = document.createElement('div');
      this.dblKnob.style.cssText =
        'position:absolute;top:2px;left:' + (run.doubles ? '24px' : '2px') + ';' +
        'width:26px;height:26px;border-radius:999px;background:#ffffff;' +
        'box-shadow:0 1px 4px rgba(0,0,0,0.35);transition:left 0.15s';
      this.dblSwitch.appendChild(this.dblKnob);
      this.dblRow.appendChild(this.dblSwitch);
    }

    this.cupPlayBtn = addButton({
      label: 'Play the cup round',
      onPress: () => this.game.start(MatchScene),
      style: {
        position: 'absolute',
        width: '150px',
        height: '48px',
        left: 'calc(50% - 160px)',
        bottom: `calc(50% - ${this.cupTall ? 210 : 166}px)`,
        borderRadius: '999px',
        backgroundColor: run.hard ? '#b23340' : '#1d6fb8',
        color: '#ffffff',
        fontSize: '13px',
        fontWeight: '700',
        letterSpacing: '1px'
      }
    });
    this.cupPlayBtn.textContent = `PLAY ROUND ${run.round}`;
    this.cupBackBtn = addButton({
      label: 'Back to title',
      onPress: () => this.closeCup(),
      style: {
        position: 'absolute',
        width: '108px',
        height: '48px',
        left: 'calc(50% + 30px)',
        bottom: `calc(50% - ${this.cupTall ? 210 : 166}px)`,
        borderRadius: '999px',
        backgroundColor: 'rgba(10, 18, 30, 0.4)',
        border: '1.5px solid rgba(255, 255, 255, 0.45)',
        color: '#ffffff',
        fontSize: '13px',
        fontWeight: '700',
        letterSpacing: '1px'
      }
    });
    this.cupBackBtn.textContent = 'BACK';
    this.overlay.append(this.dim, this.panel, this.cupPlayBtn, this.cupBackBtn);
    haptic('tick');
  }

  closeCup() {
    this.overlay?.remove();
    this.overlay = null;
    this.dim?.remove();
    this.panel?.remove();
    this.cupPlayBtn?.remove();
    this.cupBackBtn?.remove();
    this.dim = null;
    this.panel = null;
    this.cupPlayBtn = null;
    this.cupBackBtn = null;
    this.hardRow = null;
    this.hardSwitch = null;
    this.hardKnob = null;
    this.dblRow = null;
    this.dblSwitch = null;
    this.dblKnob = null;
    this.hideTitleUI(false);
    haptic('tick');
  }

  // --------------------------------------------------------------- ladder

  /// The season ladder: the title UI hides, the court dims behind a dark
  /// translucent panel, and the eight rungs list out — each with its rank
  /// number, opponent and state: the rungs below yours gold BEATEN, the rung
  /// you sit on highlighted as the one to play, the rungs above locked
  /// behind it. A filled PLAY RUNG pill plays the current rung; an outline
  /// BACK pill closes the screen.
  openLadder() {
    const rec = ladderRecord();
    this.hideTitleUI(true);
    this.overlayHost(440);
    this.dim = addText('', {
      left: '0',
      right: '0',
      top: '0',
      bottom: '0',
      backgroundColor: 'rgba(6, 12, 22, 0.55)'
    });
    this.panel = addText('', {
      left: '50%',
      top: '50%',
      width: 'min(320px, 86vw)',
      height: '440px',
      transform: 'translate(-50%, -50%)',
      borderRadius: '22px',
      backgroundColor: 'rgba(10, 18, 30, 0.85)',
      border: '1px solid rgba(255, 255, 255, 0.14)'
    });
    this.panel.appendChild(addText('SEASON LADDER', {
      left: '0',
      right: '0',
      top: '24px',
      textAlign: 'center',
      fontSize: '20px',
      fontWeight: '800',
      letterSpacing: '2px',
      color: '#ffffff'
    }));

    LADDER.forEach((rung, i) => {
      const n = i + 1;
      const cur = n === rec.rank;
      const state = n < rec.rank ? 'BEATEN' : cur ? 'NEXT' : 'LOCKED';
      const row = addText('', {
        left: '16px',
        right: '16px',
        top: `${58 + i * 34}px`,
        height: '30px',
        borderRadius: '10px',
        backgroundColor: cur
          ? 'rgba(47, 127, 209, 0.4)'
          : 'rgba(255, 255, 255, 0.06)'
      });
      this.panel.appendChild(row);
      row.appendChild(addText(`#${n}`, {
        left: '12px',
        top: '9px',
        fontSize: '11px',
        fontWeight: '800',
        letterSpacing: '1px',
        color: 'rgba(255, 255, 255, 0.5)'
      }));
      row.appendChild(addText(rung.name, {
        left: '46px',
        top: '6px',
        fontSize: '14px',
        fontWeight: '800',
        color: cur ? '#ffffff' : 'rgba(255, 255, 255, 0.8)'
      }));
      row.appendChild(addText(state, {
        right: '12px',
        top: '9px',
        fontSize: '10px',
        fontWeight: '800',
        letterSpacing: '1.5px',
        color: state === 'BEATEN' ? '#ffd24a'
          : cur ? '#9fd8ff' : 'rgba(255, 255, 255, 0.35)'
      }));
    });

    // Where the rank sits now, and the highest it has ever climbed.
    this.panel.appendChild(addText(`RANK ${rec.rank} · BEST ${rec.best}`, {
      left: '0',
      right: '0',
      top: '336px',
      textAlign: 'center',
      fontSize: '12px',
      fontWeight: '800',
      letterSpacing: '2px',
      color: '#ffd24a'
    }));

    this.ladderPlayBtn = addButton({
      label: 'Play the ladder rung',
      onPress: () => {
        startLadderMatch();
        this.game.start(MatchScene);
      },
      style: {
        position: 'absolute',
        width: '150px',
        height: '48px',
        left: 'calc(50% - 160px)',
        bottom: 'calc(50% - 200px)',
        borderRadius: '999px',
        backgroundColor: '#1d6fb8',
        color: '#ffffff',
        fontSize: '13px',
        fontWeight: '700',
        letterSpacing: '1px'
      }
    });
    this.ladderPlayBtn.textContent = `PLAY RUNG ${rec.rank}`;
    this.ladderBackBtn = addButton({
      label: 'Back to title',
      onPress: () => this.closeLadder(),
      style: {
        position: 'absolute',
        width: '108px',
        height: '48px',
        left: 'calc(50% + 30px)',
        bottom: 'calc(50% - 200px)',
        borderRadius: '999px',
        backgroundColor: 'rgba(10, 18, 30, 0.4)',
        border: '1.5px solid rgba(255, 255, 255, 0.45)',
        color: '#ffffff',
        fontSize: '13px',
        fontWeight: '700',
        letterSpacing: '1px'
      }
    });
    this.ladderBackBtn.textContent = 'BACK';
    this.overlay.append(this.dim, this.panel, this.ladderPlayBtn, this.ladderBackBtn);
    haptic('tick');
  }

  closeLadder() {
    this.overlay?.remove();
    this.overlay = null;
    this.dim?.remove();
    this.panel?.remove();
    this.ladderPlayBtn?.remove();
    this.ladderBackBtn?.remove();
    this.dim = null;
    this.panel = null;
    this.ladderPlayBtn = null;
    this.ladderBackBtn = null;
    this.hideTitleUI(false);
    haptic('tick');
  }

  /// The back chevron: whatever card is open over the title closes — the
  /// match log steps back to wherever it was raised from, and a replay in
  /// progress returns to the career card it came from. On the clear title
  /// there is nothing behind to reach.
  goBack() {
    if (this.rp) {
      this.endRallyPlayback();
      return;
    }
    if (this.logBackBtn) {
      this.closeLog();
      return;
    }
    if (this.rivalsBackBtn) {
      this.closeRivals();
      return;
    }
    const closers = [
      [this.backBtn, () => this.closeSettings()],
      [this.customBackBtn, () => this.closeCustomKit()],
      [this.ballBackBtn, () => this.closeCustomBall()],
      [this.helpBackBtn, () => this.closeHelp()],
      [this.goalsBackBtn, () => this.closeGoals()],
      [this.backupBackBtn, () => this.closeBackup()],
      [this.statsBackBtn, () => this.closeStats()],
      [this.heatBackBtn, () => this.closeHeat()],
      [this.bestsBackBtn, () => this.closeBests()],
      [this.reviewBackBtn, () => this.closeReview()],
      [this.rivalCardBackBtn, () => this.closeRivalCard()],
      [this.dailyBackBtn, () => this.closeDaily()],
      [this.cupBackBtn, () => this.closeCup()],
      [this.ladderBackBtn, () => this.closeLadder()],
      [this.trophyDoneBtn, () => this.closeTrophy()]
    ];
    const open = closers.find(([btn]) => btn);
    if (open) open[1]();
    else haptic('tick');
  }

  /// The trophy screen, raised over the title court the moment the final
  /// round is won: the fanfare plays over the big cheer, the three beaten
  /// opponents are listed as WON, and the cup count on the career record
  /// ticks up. An outline DONE pill returns to the title.
  openTrophy() {
    this.hideTitleUI(true);
    this.overlayHost(372);
    this.dim = addText('', {
      left: '0',
      right: '0',
      top: '0',
      bottom: '0',
      backgroundColor: 'rgba(6, 12, 22, 0.55)'
    });
    this.panel = addText('', {
      left: '50%',
      top: '50%',
      width: 'min(320px, 86vw)',
      height: '372px',
      transform: 'translate(-50%, -50%)',
      borderRadius: '22px',
      backgroundColor: 'rgba(10, 18, 30, 0.85)',
      border: '1px solid rgba(255, 255, 255, 0.14)'
    });
    this.panel.appendChild(addText('CUP CHAMPION!', {
      left: '0',
      right: '0',
      top: '24px',
      textAlign: 'center',
      fontSize: '22px',
      fontWeight: '800',
      letterSpacing: '1.5px',
      color: '#ffd24a'
    }));
    this.panel.appendChild(addText('ALL THREE ROUNDS BEATEN', {
      left: '0',
      right: '0',
      top: '58px',
      textAlign: 'center',
      fontSize: '11px',
      fontWeight: '700',
      letterSpacing: '2px',
      color: 'rgba(255, 255, 255, 0.6)'
    }));

    cupTrophyNames().forEach((name, i) => {
      const row = addText('', {
        left: '16px',
        right: '16px',
        top: `${92 + i * 54}px`,
        height: '44px',
        borderRadius: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.06)'
      });
      this.panel.appendChild(row);
      row.appendChild(addText(`ROUND ${i + 1} · ${name.toUpperCase()}`, {
        left: '14px',
        top: '14px',
        fontSize: '14px',
        fontWeight: '700',
        color: '#ffffff'
      }));
      row.appendChild(addText('WON', {
        right: '14px',
        top: '16px',
        fontSize: '12px',
        fontWeight: '800',
        letterSpacing: '2px',
        color: '#ffd24a'
      }));
    });

    this.panel.appendChild(addText(cupTrophyDoubles()
      ? `DOUBLES CUPS · ${careerStats().doublesCups}`
      : `CUPS WON · ${careerStats().cups}`, {
      left: '0',
      right: '0',
      top: '268px',
      textAlign: 'center',
      fontSize: '12px',
      fontWeight: '800',
      letterSpacing: '2px',
      color: '#ffd24a'
    }));

    this.trophyDoneBtn = addButton({
      label: 'Done',
      onPress: () => this.closeTrophy(),
      style: {
        position: 'absolute',
        width: '128px',
        height: '48px',
        left: 'calc(50% - 64px)',
        bottom: 'calc(50% - 166px)',
        borderRadius: '999px',
        backgroundColor: 'rgba(10, 18, 30, 0.4)',
        border: '1.5px solid rgba(255, 255, 255, 0.45)',
        color: '#ffffff',
        fontSize: '13px',
        fontWeight: '700',
        letterSpacing: '1px'
      }
    });
    this.trophyDoneBtn.textContent = 'DONE';
    this.overlay.append(this.dim, this.panel, this.trophyDoneBtn);
    playFanfare();
    playCheer(true);
    haptic('win');
  }

  closeTrophy() {
    this.overlay?.remove();
    this.overlay = null;
    this.dim?.remove();
    this.panel?.remove();
    this.trophyDoneBtn?.remove();
    this.dim = null;
    this.panel = null;
    this.trophyDoneBtn = null;
    this.hideTitleUI(false);
    haptic('tick');
  }

  /// One iOS-style switch: a pill that fills blue when on and dims grey when
  /// off, with a white knob that slides across.
  makeSwitch(key) {
    const sw = addButton({
      label: `Toggle ${key}`,
      onPress: () => {
        setSetting(key, !getSettings()[key]);
        this.refreshSwitches();
        haptic('tick');
      },
      style: {
        position: 'absolute',
        right: '20px',
        top: '7px',
        width: '52px',
        height: '30px',
        borderRadius: '999px',
        backgroundColor: 'rgba(120, 130, 140, 0.55)'
      }
    });
    const knob = document.createElement('div');
    knob.style.cssText =
      'position:absolute;top:2px;left:2px;width:26px;height:26px;border-radius:999px;' +
      'background:#ffffff;box-shadow:0 1px 4px rgba(0,0,0,0.35);transition:left 0.15s';
    sw.appendChild(knob);
    this.switches.push({ key, sw, knob });
    return sw;
  }

  refreshSwitches() {
    const s = getSettings();
    this.switches.forEach(({ key, sw, knob }) => {
      const on = !!s[key];
      sw.style.backgroundColor = on ? '#2f7fd1' : 'rgba(120, 130, 140, 0.55)';
      knob.style.left = on ? '24px' : '2px';
    });
  }

  /// The title layout, rebuilt for the panel's shape. The stack was drawn
  /// for a tall phone, so on a landscape panel every row landed on another:
  /// portrait keeps one centre column — compacted on short phones — while
  /// landscape splits into two side columns with only the play cluster at
  /// the bottom centre, leaving the middle of the court to the lineup.
  /// Runs on create and on every resize.
  layoutTitle(w, h) {
    const T = (px) => `calc(env(safe-area-inset-top) + ${px}px)`;
    const B = (px) => `calc(env(safe-area-inset-bottom) + ${px}px)`;
    const L = (px) => `calc(50% + ${px}px)`;
    const set = (el, o) => { for (const k in o) el.style[k] = o[k]; };
    if (w <= h) {
      const sq = h < 640;
      const tiny = h < 600;
      // A phone's portrait width in CSS pixels is small: the corner button
      // pairs sit exactly where a full-width title and tally line would run,
      // so on narrow panels the top block shrinks to fit between them.
      const narrow = w < 500;
      // The look picker's caption folds away on the smallest panels, where
      // the swatches alone carry the picks.
      this.lookCaptionFold = tiny;
      set(this.title, { left: '0', right: '0', top: T(narrow ? 12 : 20), bottom: 'auto', fontSize: narrow ? '24px' : '30px', textAlign: 'center' });
      set(this.subtitle, { left: '16px', right: '16px', top: T(narrow ? 44 : 56), bottom: 'auto', fontSize: narrow ? '11px' : '12px' });
      set(this.tallyText, {
        left: narrow ? '62px' : '0', right: narrow ? '62px' : '0',
        top: T(narrow ? 64 : 74), bottom: 'auto',
        fontSize: narrow ? '8.5px' : '10px',
        letterSpacing: narrow ? '0.5px' : '2px'
      });
      this.modeButtons.forEach((b, i) => set(b, {
        left: L(i * 46 - 137), right: 'auto', top: T(84), bottom: 'auto', width: '44px', height: '48px'
      }));
      this.modeLabels.forEach((l, i) => set(l, {
        left: L(i * 46 - 138), right: 'auto', top: T(134), bottom: 'auto', width: '46px', fontSize: '8px', textAlign: 'center'
      }));
      this.kitWhoBtns.forEach((b, i) => set(b, {
        left: i ? L(2) : L(-54), right: 'auto', top: T(tiny ? 146 : 148), bottom: 'auto', width: '52px', height: '20px'
      }));
      // The serving tactic pills flank the dressing pair on the same strip.
      this.tacticBtns.forEach((b, i) => set(b, {
        left: i ? L(58) : L(-140), right: 'auto', top: T(tiny ? 146 : 148), bottom: 'auto', width: '82px', height: '20px'
      }));
      this.kitButtons.forEach((b, i) => set(b, {
        left: L(i * 36 - 142), right: 'auto', top: T(tiny ? 170 : 172), bottom: 'auto', width: '32px', height: '32px'
      }));
      // The CUSTOM swatch closes the kit row: the designer behind it edits
      // whoever the dressing toggle points at.
      set(this.customKitBtn, {
        left: L(KITS.length * 36 - 142), right: 'auto', top: T(tiny ? 170 : 172), bottom: 'auto', width: '32px', height: '32px'
      });
      // Wide enough for its longest line on one row — the wrapped second
      // line used to hang beside the number and name fields.
      set(this.kitCaption, { left: '12px', right: 'auto', top: T(tiny ? 206 : 208), bottom: 'auto', fontSize: '10px', textAlign: 'left', width: '200px' });
      this.skinButtons.forEach((b, i) => set(b, {
        left: L(i * 32 - 93), right: 'auto', top: T(tiny ? 240 : 234), bottom: 'auto', width: '26px', height: '26px'
      }));
      // The CUSTOM swatch closes the ball skin row: the designer behind it
      // paints the one ball the game plays with.
      set(this.customBallBtn, {
        left: L(SKINS.length * 32 - 93), right: 'auto', top: T(tiny ? 240 : 234), bottom: 'auto', width: '26px', height: '26px'
      });
      set(this.skinCaption, { left: '0', right: '0', top: T(tiny ? 268 : 262), bottom: 'auto', fontSize: '10px', textAlign: 'center', width: 'auto' });
      // The venue picker: five swatches under the skin row — AUTO first, then
      // the four looks — with its caption beneath them.
      this.venueButtons.forEach((b, i) => set(b, {
        left: L(i * 32 - 80), right: 'auto', top: T(tiny ? 284 : 278), bottom: 'auto', width: '26px', height: '26px'
      }));
      set(this.venueCaption, { left: '0', right: '0', top: T(tiny ? 312 : 306), bottom: 'auto', fontSize: '10px', textAlign: 'center', width: 'auto' });
      // The look picker: hairstyle dyes left of centre, skin tones right,
      // one line — with its caption beneath, folded away on tiny panels.
      this.lookButtons.forEach((b, i) => set(b, {
        left: L(i * 28 - 142), right: 'auto', top: T(tiny ? 326 : 322), bottom: 'auto', width: '22px', height: '22px'
      }));
      this.toneButtons.forEach((b, i) => set(b, {
        left: L(i * 28 + 6), right: 'auto', top: T(tiny ? 326 : 322), bottom: 'auto', width: '22px', height: '22px'
      }));
      set(this.lookCaption, { left: '0', right: '0', top: T(346), bottom: 'auto', fontSize: '8px', textAlign: 'center', width: 'auto', display: tiny ? 'none' : '' });
      // The number and name fields sit beside the kit caption, on its line —
      // the space their old row took is the venue picker's.
      set(this.numberInput, { left: L(6), right: 'auto', top: T(tiny ? 204 : 200), bottom: 'auto', width: '52px', height: '30px' });
      set(this.nameInput, { left: L(64), right: 'auto', top: T(tiny ? 206 : 202), bottom: 'auto', width: '84px', height: '26px' });
      // The difficulty row: three buttons centred, four once the legend tier
      // has joined, the spread widened to keep the row centred either way.
      const dOff = this.diffButtons.length === 4 ? -107 : -79;
      this.diffButtons.forEach((b, i) => set(b, {
        left: L(i * 56 + dOff), right: 'auto', top: T(tiny ? 352 : 360), bottom: 'auto', width: '46px', height: '46px'
      }));
      set(this.diffCaption, { left: '0', right: '0', top: T(tiny ? 400 : 408), bottom: 'auto', fontSize: '11px', textAlign: 'center', width: 'auto' });
      set(this.lenButtons[0], { left: '14px', right: 'auto', top: T(tiny ? 398 : 406), bottom: 'auto', width: '72px', height: '28px' });
      set(this.lenButtons[1], { left: 'auto', right: '14px', top: T(tiny ? 398 : 406), bottom: 'auto', width: '82px', height: '28px' });
      // The series toggle sits under the best-of-three pill, clear of the
      // centred roster pick row.
      set(this.seriesBtn, { left: '14px', right: 'auto', top: T(tiny ? 430 : 438), bottom: 'auto', width: '60px', height: '26px' });
      const pw = tiny ? '50px' : sq ? '56px' : '64px';
      // The pick row spreads from the roster's own length: the recruit
      // joining packs it tighter while the same centre holds it.
      const pwNum = parseInt(pw, 10);
      const pickGap = 70;
      const pickOff = ((ROSTER.length - 1) * pickGap + pwNum) / 2;
      this.pickButtons.forEach((b, i) => set(b, {
        left: L(i * pickGap - pickOff), right: 'auto', top: T(tiny ? 412 : 446), bottom: 'auto', width: pw, height: pw
      }));
      this.nameLabels.forEach((l, i) => set(l, {
        left: L(i * pickGap - pickOff + pwNum / 2 - 38), right: 'auto', top: T(tiny ? 464 : sq ? 504 : 512), bottom: 'auto', fontSize: '11px', width: '76px', textAlign: 'center'
      }));
      set(this.caption, { left: '0', right: '0', top: T(tiny ? 477 : sq ? 516 : 524), bottom: 'auto', fontSize: '12px', textAlign: 'center', width: 'auto' });
      set(this.playBtn, {
        left: `calc(50% - ${tiny ? 32 : sq ? 36 : 40}px)`, top: 'auto', bottom: B(tiny ? 8 : sq ? 12 : 16),
        width: tiny ? '64px' : sq ? '72px' : '80px', height: tiny ? '64px' : sq ? '72px' : '80px'
      });
      set(this.cupBtn, { left: L(50), right: 'auto', top: 'auto', bottom: B(tiny ? 18 : 24), width: '56px', height: '56px' });
      set(this.cupLbl, { left: L(42), right: 'auto', top: 'auto', bottom: B(4), width: '68px', fontSize: '9px' });
      set(this.helpBtn, { left: L(-106), right: 'auto', top: 'auto', bottom: B(tiny ? 18 : 24), width: '56px', height: '56px' });
      set(this.helpLbl, { left: L(-114), right: 'auto', top: 'auto', bottom: B(4), width: '68px', fontSize: '9px' });
      // The career and daily buttons flank the cluster's outer edge, and the
      // goals button stacks above the career one.
      set(this.statsBtn, { left: L(-156), right: 'auto', top: 'auto', bottom: B(tiny ? 18 : 24), width: '44px', height: '44px' });
      set(this.goalsBtn, { left: L(-156), right: 'auto', top: 'auto', bottom: B(tiny ? 72 : 78), width: '44px', height: '44px' });
      set(this.dailyBtn, { left: L(108), right: 'auto', top: 'auto', bottom: B(tiny ? 18 : 24), width: '44px', height: '44px' });
      return;
    }
    const cq = h < 350;
    const mt = cq ? 80 : 85;  // the left column's first row
    const rc = cq ? 102 : 108;  // the right column's first row
    // The look picker's caption folds away on the shortest landscape panels.
    this.lookCaptionFold = cq;
    set(this.title, { left: '0', right: '0', top: T(cq ? 4 : 6), bottom: 'auto', fontSize: cq ? '22px' : '26px', textAlign: 'center' });
    set(this.subtitle, { left: '12px', right: '12px', top: T(cq ? 38 : 44), bottom: 'auto', fontSize: cq ? '10px' : '12px' });
    set(this.tallyText, { left: '0', right: '0', top: T(cq ? 54 : 62), bottom: 'auto', fontSize: '9px' });
    // The corner pairs read across the top: back and history on the left,
    // settings and the ladder on the right, the title block centred between.
    set(this.cornerBackBtn, { left: '12px', right: 'auto', top: T(10), bottom: 'auto' });
    set(this.historyBtn, { left: '68px', right: 'auto', top: T(10), bottom: 'auto' });
    set(this.settingsBtn, { left: 'auto', right: '12px', top: T(10), bottom: 'auto' });
    set(this.ladderBtn, { left: 'auto', right: '12px', top: T(cq ? 52 : 58), bottom: 'auto' });
    this.modeButtons.forEach((b, i) => set(b, {
      left: `${12 + i * 46}px`, right: 'auto', top: T(mt), bottom: 'auto', width: '44px', height: cq ? '46px' : '48px'
    }));
    this.modeLabels.forEach((l, i) => set(l, {
      left: `${10 + i * 46}px`, right: 'auto', top: T(mt + 44), bottom: 'auto', width: '46px', fontSize: '8px', textAlign: 'center'
    }));
    this.kitWhoBtns.forEach((b, i) => set(b, {
      left: `${12 + i * 56}px`, right: 'auto', top: T(mt + 56), bottom: 'auto', width: '52px', height: '20px'
    }));
    // The serving tactic pills beside them on the same strip.
    this.tacticBtns.forEach((b, i) => set(b, {
      left: `${128 + i * 88}px`, right: 'auto', top: T(mt + 56), bottom: 'auto', width: '82px', height: '20px'
    }));
    this.kitButtons.forEach((b, i) => {
      const row = i < 5 ? 0 : 1;
      set(b, {
        left: `${12 + (i % 5) * 36}px`, right: 'auto',
        top: T(mt + 78 + row * 34), bottom: 'auto', width: '32px', height: '32px'
      });
    });
    // The CUSTOM swatch closes the designer rows here too, on the second
    // row's next slot beside the last preset kits.
    set(this.customKitBtn, {
      left: `${12 + (KITS.length % 5) * 36}px`, right: 'auto',
      top: T(mt + 78 + (KITS.length < 5 ? 0 : 34)), bottom: 'auto', width: '32px', height: '32px'
    });
    set(this.kitCaption, { left: '12px', right: 'auto', top: T(mt + 146), bottom: 'auto', fontSize: '9px', textAlign: 'left', width: '240px' });
    this.skinButtons.forEach((b, i) => set(b, {
      left: `${12 + i * 30}px`, right: 'auto', top: T(mt + 160), bottom: 'auto', width: '26px', height: '26px'
    }));
    // The CUSTOM swatch closes the ball skin row here too.
    set(this.customBallBtn, {
      left: `${12 + SKINS.length * 30}px`, right: 'auto', top: T(mt + 160), bottom: 'auto', width: '26px', height: '26px'
    });
    set(this.skinCaption, { left: '12px', right: 'auto', top: T(mt + 188), bottom: 'auto', fontSize: '9px', textAlign: 'left', width: '260px' });
    // The venue picker closes the dressing rows: five swatches, then its caption.
    this.venueButtons.forEach((b, i) => set(b, {
      left: `${12 + i * 32}px`, right: 'auto', top: T(mt + 204), bottom: 'auto', width: '26px', height: '26px'
    }));
    set(this.venueCaption, { left: '12px', right: 'auto', top: T(mt + 232), bottom: 'auto', fontSize: '9px', textAlign: 'left', width: '240px' });
    // The look row closes the column: hairstyle dyes and skin tones in one
    // line, the caption beneath — folded away on the shortest panels, where
    // the swatches alone carry the picks.
    this.lookButtons.forEach((b, i) => set(b, {
      left: `${12 + i * 28}px`, right: 'auto', top: T(mt + 250), bottom: 'auto', width: '22px', height: '22px'
    }));
    this.toneButtons.forEach((b, i) => set(b, {
      left: `${150 + i * 28}px`, right: 'auto', top: T(mt + 250), bottom: 'auto', width: '22px', height: '22px'
    }));
    set(this.lookCaption, { left: '12px', right: 'auto', top: T(mt + 274), bottom: 'auto', fontSize: '8px', textAlign: 'left', width: '260px', display: cq ? 'none' : '' });
    set(this.numberInput, { left: 'auto', right: '102px', top: T(rc), bottom: 'auto', width: '52px', height: '30px' });
    set(this.nameInput, { left: 'auto', right: '12px', top: T(rc + 2), bottom: 'auto', width: '84px', height: '26px' });
    set(this.diffCaption, { left: 'auto', right: '12px', top: T(rc + 40), bottom: 'auto', fontSize: '10px', textAlign: 'right', width: '160px' });
    // The difficulty row reflows for its count too: four buttons pack a
    // touch tighter along the right column's edge.
    const fourDiff = this.diffButtons.length === 4;
    this.diffButtons.forEach((b, i) => set(b, {
      left: `calc(100% - ${(fourDiff ? 190 : 158) - i * (fourDiff ? 46 : 50)}px)`,
      right: 'auto', top: T(rc + (cq ? 58 : 62)), bottom: 'auto', width: '46px', height: '46px'
    }));
    set(this.lenButtons[0], { left: 'calc(100% - 244px)', right: 'auto', top: T(rc + (cq ? 110 : 116)), bottom: 'auto', width: '72px', height: '28px' });
    set(this.lenButtons[1], { left: 'calc(100% - 168px)', right: 'auto', top: T(rc + (cq ? 110 : 116)), bottom: 'auto', width: '82px', height: '28px' });
    set(this.seriesBtn, { left: 'calc(100% - 82px)', right: 'auto', top: T(rc + (cq ? 110 : 116)), bottom: 'auto', width: '76px', height: '28px' });
    set(this.caption, { left: 'auto', right: '12px', top: T(rc + (cq ? 144 : 150)), bottom: 'auto', fontSize: '10px', textAlign: 'right', width: '200px' });
    set(this.playBtn, {
      left: `calc(50% - ${cq ? 32 : 38}px)`, top: 'auto', bottom: B(cq ? 8 : 10),
      width: cq ? '64px' : '76px', height: cq ? '64px' : '76px'
    });
    set(this.cupBtn, { left: L(48), right: 'auto', top: 'auto', bottom: B(cq ? 16 : 22), width: cq ? '44px' : '52px', height: cq ? '44px' : '52px' });
    set(this.cupLbl, { left: L(40), right: 'auto', top: 'auto', bottom: B(2), width: '68px', fontSize: '9px' });
    set(this.helpBtn, { left: L(-100), right: 'auto', top: 'auto', bottom: B(cq ? 16 : 22), width: cq ? '44px' : '52px', height: cq ? '44px' : '52px' });
    set(this.helpLbl, { left: L(-108), right: 'auto', top: 'auto', bottom: B(2), width: '68px', fontSize: '9px' });
    // The career and daily buttons flank the cluster's outer edge, icon-only
    // like they were in the corners, the goals button above the career one.
    set(this.statsBtn, { left: L(-156), right: 'auto', top: 'auto', bottom: B(cq ? 16 : 22), width: '44px', height: '44px' });
    set(this.goalsBtn, { left: L(-156), right: 'auto', top: 'auto', bottom: B(cq ? 68 : 74), width: '44px', height: '44px' });
    set(this.dailyBtn, { left: L(110), right: 'auto', top: 'auto', bottom: B(cq ? 16 : 22), width: '44px', height: '44px' });
    const lw = cq ? 48 : 60;
    // The pick row spreads from the roster's own length here too.
    const lwGap = ROSTER.length > 3 ? 64 : 66;
    const lwOff = ((ROSTER.length - 1) * lwGap + lw) / 2;
    this.pickButtons.forEach((b, i) => set(b, {
      left: L(i * lwGap - lwOff), right: 'auto', top: 'auto', bottom: B(cq ? 84 : 94), width: `${lw}px`, height: `${lw}px`
    }));
    this.nameLabels.forEach((l, i) => set(l, {
      left: L(i * lwGap - lwOff + lw / 2 - 32), right: 'auto', top: 'auto', bottom: B(cq ? 136 : 156), fontSize: '10px', width: '64px', textAlign: 'center'
    }));
  }

  /// A full-screen host for an overlay card and its buttons: the cards were
  /// drawn for a tall phone, so on a short panel the whole host scales down
  /// about the screen centre until it fits. The card's dimming veil is
  /// appended into the host alongside the panel — a veil left directly on the
  /// HUD layer would sit above the host and swallow every tap meant for the
  /// card beneath it.
  overlayHost(designH, designW = 344) {
    this.overlay?.remove();
    this.overlay = addText('', { left: '0', right: '0', top: '0', bottom: '0' });
    this.overlayH = designH;
    this.overlayW = designW;
    this.fitOverlay();
    return this.overlay;
  }

  fitOverlay() {
    if (!this.overlay) return;
    const s = Math.min(
      1,
      (window.innerHeight - 12) / this.overlayH,
      (window.innerWidth - 12) / this.overlayW
    );
    this.overlay.style.transformOrigin = '50% 50%';
    this.overlay.style.transform = s < 0.99 ? `scale(${s})` : 'none';
  }

  hideTitleUI(hidden) {
    const display = hidden ? 'none' : '';
    this.title.style.display = display;
    this.subtitle.style.display = display;
    this.tallyText.style.display = display;
    this.caption.style.display = display;
    this.diffCaption.style.display = display;
    this.modeButtons.forEach((b) => { b.style.display = display; });
    this.modeLabels.forEach((l) => { l.style.display = display; });
    this.kitButtons.forEach((b) => { b.style.display = display; });
    // The dressing pills reappear in a two-player match or in doubles.
    this.kitWhoBtns.forEach((b) => {
      b.style.display = hidden ? 'none' : (this.twoMode() || this.doublesMode()) ? '' : 'none';
    });
    // The serving tactic pills reappear in the doubles modes only.
    this.tacticBtns.forEach((b) => {
      b.style.display = hidden ? 'none' : this.doublesMode() ? '' : 'none';
    });
    this.kitCaption.style.display = display;
    this.customKitBtn.style.display = display;
    this.skinButtons.forEach((b) => { b.style.display = display; });
    this.customBallBtn.style.display = display;
    this.skinCaption.style.display = display;
    this.venueButtons.forEach((b) => { b.style.display = display; });
    this.venueCaption.style.display = display;
    // The look row hides with the rest; on the smallest panels the caption
    // stays folded away even while the row is up (layoutTitle says so).
    this.lookButtons.forEach((b) => { b.style.display = display; });
    this.toneButtons.forEach((b) => { b.style.display = display; });
    this.lookCaption.style.display = hidden || this.lookCaptionFold
      ? 'none' : '';
    this.numberInput.style.display = display;
    this.refreshNameField(hidden);
    this.pickButtons.forEach((b) => { b.style.display = display; });
    this.nameLabels.forEach((l) => { l.style.display = display; });
    this.diffButtons.forEach((b) => { b.style.display = display; });
    this.lenButtons.forEach((b) => { b.style.display = display; });
    this.seriesBtn.style.display = display;
    this.playBtn.style.display = display;
    this.cornerBackBtn.style.display = display;
    this.historyBtn.style.display = display;
    this.settingsBtn.style.display = display;
    this.statsBtn.style.display = display;
    this.goalsBtn.style.display = display;
    this.dailyBtn.style.display = display;
    this.ladderBtn.style.display = display;
    this.cupBtn.style.display = display;
    this.cupLbl.style.display = display;
    this.helpBtn.style.display = display;
    this.helpLbl.style.display = display;
  }

  refreshSelection() {
    this.pickButtons.forEach((btn, i) => {
      // The unsigned recruit stays dimmed under her lock until her wins bank.
      btn.style.backgroundColor = !athleteUnlocked(ROSTER[i])
        ? 'rgba(110, 120, 130, 0.4)'
        : i === this.selIdx ? SEL_BG : DIM_BG;
    });
    this.caption.textContent = ROSTER[this.selIdx].tag;
    this.diffButtons.forEach((btn, i) => {
      btn.style.backgroundColor = i === this.diffIdx ? SEL_BG : DIM_BG;
    });
    this.diffCaption.textContent = `CPU: ${this.diffChoices[this.diffIdx].name}`;
    this.lenButtons.forEach((btn, i) => {
      btn.style.backgroundColor = i === this.lenIdx ? SEL_BG : DIM_BG;
    });
    // The series toggle lights gold while the session's series runs.
    this.seriesBtn.style.backgroundColor =
      seriesActive() ? '#d4a017' : DIM_BG;
    // The serving tactic pills follow the doubles modes: the formation is
    // picked only where a partner shares the near court, and the running
    // pick burns lit.
    const doublesOn = this.doublesMode();
    this.tacticBtns.forEach((btn, i) => {
      btn.style.display = doublesOn ? '' : 'none';
      btn.style.backgroundColor =
        SERVING_TACTICS[i].id === selectedTactic().id ? SEL_BG : DIM_BG;
    });
    this.modeButtons.forEach((btn, i) => {
      btn.style.backgroundColor = i === this.modeIdx ? SEL_BG : DIM_BG;
    });
    // The control hints follow the mode and the match length.
    const mode = selectedMode().id;
    const len = MATCH_LENGTHS[this.lenIdx];
    this.subtitle.textContent =
      mode === '2p' ? `First to ${len.points} · P1: left drag, right jump · P2: right drag, left jump` :
      mode === 'coop' ? `First to ${len.points} · P1 & P2 vs two CPUs · P2: right drag, left jump` :
      mode === 'doubles' ? `First to ${len.points} · You and a CPU partner vs two CPUs` :
      mode === 'practice' ? 'PRACTICE · no score, faults re-serve' :
      mode === 'blitz' ? 'BLITZ · 3:00 on the clock, every point counts' :
      `First to ${len.points} · Drag to move, tap to jump`;
    // The tally follows the picked mode; the practice court keeps none. The
    // player's name leads it — the typed one, YOU when the field is empty —
    // with the career title the wins have banked and the ladder rank beside.
    this.tallyText.textContent = mode === 'practice' ? '' :
      `${playerName('p1')} · ${tallyLine(mode === 'coop' ? 'doubles' : mode === 'blitz' ? 'cpu' : mode)} · ${playerTitle().name} · LADDER RANK ${ladderRecord().rank}`;
  }

  update(dt) {
    updateModels(dt);
    // The legend unlock toast fades itself out after its few seconds.
    if (this.legendToastT > 0) {
      this.legendToastT -= dt;
      if (this.legendToastT <= 0) {
        this.legendToast?.remove();
        this.legendToast = null;
      }
    }
    // The recruit's signing toast fades out after its few seconds too.
    if (this.novaToastT > 0) {
      this.novaToastT -= dt;
      if (this.novaToastT <= 0) {
        this.novaToast?.remove();
        this.novaToast = null;
      }
    }
    // The weekly goal toasts fade out after their few seconds too.
    if (this.goalToasts && this.goalToasts.length) {
      this.goalToasts = this.goalToasts.filter((g) => {
        g.t -= dt;
        if (g.t <= 0) {
          g.el.remove();
          return false;
        }
        return true;
      });
    }
    // The record rally's playback owns the frame while it runs.
    if (this.rp) {
      this.updateRallyPlayback(dt);
      return;
    }
    this.time = (this.time ?? 0) + dt;
    this.ball.rotation.y += dt * 1.1;
    // The short-court framing bounces the ball lower and gentler, keeping
    // its whole arc beneath the picker stack.
    const rest = this.shortCourt ? 0.46 : 0.55;
    const amp = this.shortCourt ? 0.26 : 0.5;
    this.ball.position.y = rest + Math.abs(Math.sin(this.time * 1.6)) * amp;

    // The chosen athlete steps forward out of the line — or, while the
    // swatch row dresses player two or the partner, that athlete does.
    const focus = (this.twoMode() || this.doublesMode()) && this.kitWho !== 'p1'
      ? this.p2Idx : this.selIdx;
    this.lineup.forEach((athlete, i) => {
      const target = i === focus ? -1.5 : -2.6;
      athlete.position.z += (target - athlete.position.z) * Math.min(1, dt * 6);
      updateAthlete(athlete, dt, { speed: 0 });
    });
  }

  resize(width, height) {
    const cam = this.game.camera;
    if (width < height) {
      // A phone's portrait panel is short in CSS pixels: the picker stack
      // reaches past the screen's middle, so the camera lifts its gaze and
      // the court, the lineup and the ball play out in the lower half —
      // clear of the character row and its captions. Taller portrait
      // panels keep the original framing.
      const short = height < 1150;
      cam.position.set(0, short ? 2.5 : 2.2, short ? 7.2 : 6.2);
      cam.lookAt(0, short ? 2.6 : 1.1, 0);
      if (this.ball) {
        this.ball.scale.setScalar(short ? 0.8 : 1);
        this.shortCourt = short;
      }
    } else {
      cam.position.set(0, 1.9, 5.0);
      cam.lookAt(0, 1.1, 0);
      if (this.ball) {
        this.ball.scale.setScalar(1);
        this.shortCourt = false;
      }
    }
    // The title stack reflows for the panel's shape, and any open overlay
    // card scales down when the panel is too short for its full height.
    this.layoutTitle(width, height);
    this.fitOverlay();
  }

  dispose() {
    for (const id of this.awardsTimers || []) clearTimeout(id);
    this.root.environment?.dispose();
    this.root.environment = null;
    clearHUD();
    this.legendToast?.remove();
    this.novaToast?.remove();
    if (this.goalToasts) for (const g of this.goalToasts) g.el.remove();
    this.goalToasts = null;
    this.title.remove();
    this.subtitle.remove();
    this.tallyText.remove();    this.caption.remove();
    this.diffCaption.remove();
    this.kitCaption.remove();
    this.skinCaption.remove();
    this.venueCaption.remove();
    this.lookCaption.remove();
    this.numberInput.remove();
    this.nameInput.remove();
    this.modeLabels.forEach((l) => l.remove());
    this.nameLabels.forEach((l) => l.remove());
    this.cupLbl.remove();
    this.helpLbl.remove();
  }
}
