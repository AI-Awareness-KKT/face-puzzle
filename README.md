# Face Gesture Puzzle

A browser game that captures a face photo and turns it into a 3 × 3 puzzle.
Swap pieces by pinching with your hand, or use mouse, touch, or keyboard controls.
A numbered demo works without a camera.

## Pages
- `index.html`: project details and instructions.
- `play.html`: playable game.
- `assets/css/`: separate styles for the details page and game.
- `assets/js/puzzle.js`: board rules, shuffling, swaps, coordinates.
- `assets/js/pinch.js`: pinch gesture state and debounce.
- `assets/js/face-crop.js`: face crop calculation.
- `assets/js/vision.js`: MediaPipe worker and model loading.
- `assets/js/game.js`: game interface, camera, and controls.
- `assets/js/translate.js`: details page translation callback.
- `assets/images/`: project illustrations and the supplied programme logo banner.

The playable page uses a simple white and blue layout with the NITK, AI Awareness, CSD, and Department of Science and Technology banner.

## Preview
From the parent folder containing both `webpage` and `face-puzzle`, run:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open http://localhost:8765/webpage/projects.html or
http://localhost:8765/face-puzzle/ . Camera access needs localhost or HTTPS.
Allow camera permission to try photo capture and hand tracking.
Internet access is required for MediaPipe code/models and Google Translate.
Photos are held in the game’s browser memory; the game contains no photo upload endpoint.

## Publish
Use repository name `face-puzzle` under `AI-Awareness-KKT`.
In Settings → Pages, publish `main` / `(root)` using Deploy from a branch.
Live details: https://ai-awareness-kkt.github.io/face-puzzle/
Live game: https://ai-awareness-kkt.github.io/face-puzzle/play.html

The Back to Projects links use `../webpage/projects.html`.
This assumes both repositories are published under the same GitHub Pages owner.
The main website card uses `../face-puzzle/`.

No build step or package installation is needed. The existing game logic and
model versions were preserved while extracting the inline scripts and styles.
