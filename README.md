# Spike Masters

A beach-volleyball game played with your thumbs: serve, bump, spike, dive and
block your way through sets, cups, a season ladder and a daily challenge.

It is plain HTML, CSS and ES modules with Three.js served from `vendor/`, so
there is no build step and no install. Open `index.html` from a static web
server and it runs — on a phone, in a browser.

## Play

- **Move** — drag anywhere on your half of the court.
- **Serve** — tap to toss, then tap jump at the top of the toss.
- **Jump and charge** — the jump button; hold it to fill the power meter.
- **Moves** — dive, strike and launch sit beside the jump button.
- **Two players** — the far side gets its own drag zone and its own buttons.

The title screen holds the modes, the kits, the venues and the career screens;
the in-game HELP explains the controls in full.

## Notes

- Nothing loads from the internet at runtime: the engine and the 3D models are
  in this repository.
- Career records are saved in the browser you play in.
- Haptics work only inside hosts that expose a vibration bridge; in a plain
  browser the game plays with sound and visuals alone.
