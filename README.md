# 📺 CATHODE‑88

### *a haunted broadcast you tune by hand*

CATHODE‑88 is a **fake retro television set that broadcasts generative art**. You
don't click tabs — you *tune the dial*. Each "station" is a different real‑time
generative system, and every one of them is rendered through a serious multi‑pass
**WebGL2 CRT pipeline**: screen curvature, scanlines, an aperture‑grille subpixel
mask, chromatic aberration, bloom, phosphor‑persistence ghosting, VHS tracking
noise, and a burst of static every time you change the channel.

It's vanilla **TypeScript + Vite + raw WebGL2** — no framework, ~45 kB of JS, one
command to run.

```bash
npm install
npm run dev      # open the printed http://localhost:5173 URL
```

---

## The stations

| # | Station   | What it is |
|---|-----------|------------|
| 1 | `SUNSET`  | The iconic vaporwave scene — banded sun, neon perspective grid, twinkling stars. Move the mouse to parallax it. |
| 2 | `FLOW`    | Domain‑warped fractal noise drifting like ink. The cursor swirls the field; hold the button to intensify it. |
| 3 | `PLASMA`  | Sum‑of‑sines demoscene plasma with a glowing oscilloscope Lissajous trace. Drag to re‑tune it. |
| 4 | `BLOOM`   | A live **Gray‑Scott reaction‑diffusion** simulation. Paint new growth with the cursor. |
| 5 | `LIFE`    | **Conway's Game of Life** with decaying phosphor heat‑trails. Draw to seed colonies. |
| 6 | `DEADAIR` | The haunted "no signal" channel — television snow, ghost color bars, rolling sync bar. Tune left/right to find signal. |

## Controls

| Input | Action |
|-------|--------|
| **Drag on the screen** | Perturb the current station (swirl, paint, seed…) |
| **← →**, scroll, or the **TUNE** dial | Change station |
| **1 – 6** | Jump straight to a station |
| **TRACKING / GLOW / SCANLINE / PERSIST / HUE** knobs | Dial the CRT look from clean signal → degraded haunted VHS |
| **P** | Snap a photo — downloads the current frame as a PNG |
| **R** | Shuffle the palette (hue) |
| **S** | Reseed the current simulation |
| **H** | Hide the set for a pure full‑screen broadcast |
| **F** | Fullscreen · **Space** pause/resume · **?** help panel |

Knobs respond to drag (up/down) and scroll. Everything has a keyboard equivalent.

---

## How it works

Everything on screen is a **full‑screen fragment‑shader pass**. The render loop,
each frame, does:

```
 active station ─► scene ─► bright-pass ─► blur ×2 ─► bloom
                     │                                  │
                     └───────────────┬──────────────────┘
                                     ▼
                       CRT composite (+ previous frame) ─► swap ─► blit to canvas
                                     ▲
                            phosphor persistence feedback
```

- **Stateless stations** (`SUNSET`, `FLOW`, `PLASMA`, `DEADAIR`) are a single
  fragment shader.
- **Simulation stations** (`BLOOM`, `LIFE`) are *ping‑pong* simulations: they read
  last frame's state texture and write the next, then a display shader colors the
  result. Reaction‑diffusion runs on a 16‑bit float texture; Life runs on an 8‑bit
  grid with a decaying "heat" channel for the glow trails.
- The **CRT pass** ties it together and owns the signature look. Phosphor
  persistence is screen‑space feedback (this frame `max`’d against the last,
  decayed), which is why motion leaves ghost trails.

### Project layout

```
src/
  main.ts              boot + graceful "NO SIGNAL" error screen
  app.ts               render loop, input wiring, channel switching, photo export
  input.ts             pointer → UV-space tracking
  util.ts              pure helpers (clamp, wrapIndex, mapRange) — unit-tested
  types.ts             shared Frame / FxSettings types
  style.css            the television set: bezel, knobs, glass, OSD, help panel

  core/                tiny WebGL2 layer
    gl.ts              context + shader compile/link with line-numbered errors
    framebuffer.ts     render targets + ping-pong buffers
    pass.ts            a full-screen ShaderPass with a typed uniform setter

  shaders/             all GLSL (imported as ?raw and composed in index.ts)
    common.glsl        shared noise / palette / color helpers
    *.frag, *.glsl     one file per station + post-processing passes

  channels/            station modules implementing the Channel interface
  post/crt.ts          the CRT / bloom / persistence pipeline orchestrator
  ui/                  knob.ts (rotary + tuner), bezel.ts (the set), osd.ts
```

There is no `#include` in GLSL ES, so `shaders/index.ts` is the single place that
prepends the `#version` + precision header and the shared `common.glsl` helpers to
each fragment body. Shader compile failures surface the **line‑numbered source**
in the console and a "NO SIGNAL" card on screen, so problems are debuggable rather
than blank.

---

## Deploying to GitHub Pages

The app is built with `base: "./"`, so it runs from a project subpath
(`https://<user>.github.io/<repo>/`) with no extra config.

A workflow is included at `.github/workflows/deploy.yml`. To use it:

1. In the repo, go to **Settings → Pages → Build and deployment** and set
   **Source: GitHub Actions**.
2. Push to the default branch (`main`/`master`) — or trigger the workflow manually
   from the **Actions** tab (it has `workflow_dispatch`).

The workflow runs `npm ci && npm run build` and publishes `dist/`.

You can also host the `dist/` folder on any static host (`npm run build`), or
preview the production build locally with `npm run preview`.

---

## Scripts

| Command | Does |
|---------|------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check (`tsc --noEmit`) then production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Vitest unit tests (pure logic + shader‑composition sanity) |
| `npm run typecheck` | Type-check only |

## Requirements

A browser with **WebGL2** (every current Chrome, Firefox, Edge, Safari 15+). The
`BLOOM` station additionally needs the `EXT_color_buffer_float` extension, which is
standard on those browsers. No network, accounts, or API keys — it runs entirely
on your GPU.
