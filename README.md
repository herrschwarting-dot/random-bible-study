# Random Bible Study Spinner

An innocent-looking web app that randomly selects 3 Bible chapters for study — and detonates into **full disco chaos** the moment you hit Spin.

Replicates a tradition of one friend (Daniel) putting on sunglasses, dropping dubstep, and creating a 15-second rave every time the wheel spins. This app preserves that energy.

## How it works

- Innocent white landing page with a boring spinner wheel and a "Spin" button
- Hit Spin → **instant full rave**: strobes, disco ball, spotlights, flying words, confetti detonation
- **6 raves total**: Book → Chapter, three times, for three study assignments
- Final screen shows all 3 holy assignments

## Stack

- Vanilla HTML / CSS / JavaScript — no build step
- [`canvas-confetti`](https://github.com/catdad/canvas-confetti) (CDN) for the detonation particles
- Static, hostable on GitHub Pages

## File structure

```
random-bible-study/
├── index.html       # Markup — landing + hidden rave/confetti layers
├── style.css        # Innocent styles + (stubbed) chaos styles
├── script.js        # State machine — LANDING → RAVE → REVEAL → LOCK_IN → …
├── disco.js         # Effects engine (strobes, spotlights, cycler) — stubbed
├── particles.js     # canvas-confetti wrapper — detonate()
├── bible-data.js    # All 66 books with chapter counts
└── README.md
```

## Running locally

No build step. Open `index.html` directly, or serve the folder with any static server:

```bash
# Python
python -m http.server 8000

# Node
npx serve .
```

## Deployment

Intended for GitHub Pages. Push to `main`, enable Pages on the repo, point it at root.

## Current status — scaffolding

State machine runs end-to-end but visuals are stubbed:

- [x] Innocent landing layout
- [x] 66-book data
- [x] 6-spin sequence state machine
- [x] Random book/chapter selection
- [x] Progress tracker (3 assignment slots)
- [x] `canvas-confetti` wired via CDN
- [ ] Actual disco effects (strobes, spotlights, disco ball, flying words)
- [ ] Deceleration animation
- [ ] Flash + confetti detonation at reveal
- [ ] Fullscreen takeover animation
- [ ] Lock-in slide into tracker
- [ ] Audio (Suno tracks, crossfade between spins)
- [ ] Epilepsy warning modal
- [ ] Reduced-motion alternative
