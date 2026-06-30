# 🔄 AnyConv

**An open-source website that converts (almost) any file type to any other file type.**

Drop a file, pick a target format, download the result. Images, audio, video,
documents, spreadsheets, presentations, PDFs and structured data — all from one
dead-simple interface. Optional **Stripe pay-per-conversion** built in.

- 🧩 **Broad coverage** via best-in-class engines: `sharp`, `ffmpeg`,
  `LibreOffice`, `Ghostscript` and `Pandoc`.
- 🖱️ **Dead-simple UI** — drag, choose, download. The target dropdown only ever
  shows formats that are actually reachable from your file.
- 🔒 **Private by design** — files live in a temp dir and are auto-deleted after
  a configurable TTL. No accounts, no database.
- 💳 **Optional payments** — set a Stripe key to charge per file; leave it unset
  to run completely free.
- 🐳 **One-command deploy** with Docker (all engines bundled).

---

## Quick start

### Run locally

You need **Node.js ≥ 20** and the conversion tools on your `PATH`
(`ffmpeg`, `soffice`/LibreOffice, `gs`/Ghostscript, `pandoc`). On Debian/Ubuntu:

```bash
sudo apt-get install -y ffmpeg ghostscript pandoc \
  libreoffice-writer libreoffice-calc libreoffice-impress \
  fonts-liberation fonts-dejavu-core
```

Then:

```bash
npm install
npm run dev          # development (auto-reload) → http://localhost:3000
# or
npm run build && npm start   # production
```

AnyConv degrades gracefully: if a tool is missing, the conversions that need it
are simply hidden from the UI. Image and data conversions work with **zero**
system dependencies (`sharp` and pure-JS).

### Run with Docker (recommended)

The image bundles every engine, so there's nothing else to install:

```bash
docker compose up --build
# → http://localhost:3000
```

---

## Supported conversions

The exact, live matrix is served at `GET /api/formats`. In summary:

| Category          | Engine            | Examples |
|-------------------|-------------------|----------|
| **Images**        | sharp (libvips)   | jpg · png · webp · avif · gif · tiff · svg/heic (in) → any raster |
| **Audio**         | ffmpeg            | mp3 · wav · ogg · opus · flac · aac · m4a · wma |
| **Video**         | ffmpeg            | mp4 · webm · mkv · mov · avi · flv · wmv (+ video → audio) |
| **Documents**     | LibreOffice       | docx · doc · odt · rtf · txt · html → pdf and each other |
| **Markup / books**| Pandoc            | md · html · rst · tex · epub ↔ docx · odt · rtf · txt |
| **Spreadsheets**  | LibreOffice       | xlsx · xls · ods · csv → pdf and each other |
| **Presentations** | LibreOffice       | pptx · ppt · odp → pdf and each other |
| **PDF**           | Ghostscript / built-in | pdf → png/jpg (multi-page → ZIP); any image → pdf |
| **Data**          | pure JS           | json · yaml · csv · tsv · xml (interconvertible) |

> Not every theoretical pair exists (you can't turn an MP3 into a video). The UI
> only offers conversions that genuinely work, so you never hit a dead end.

---

## Configuration

All configuration is via environment variables (see [`.env.example`](.env.example)).
Everything has a sensible default — the app runs with no configuration at all.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `PUBLIC_BASE_URL` | `http://localhost:$PORT` | Used for Stripe redirect URLs |
| `MAX_UPLOAD_MB` | `200` | Maximum upload size |
| `FILE_TTL_MINUTES` | `30` | How long converted files are kept |
| `WORK_DIR` | `./tmp-uploads` | Temp working directory |
| `FFMPEG_PATH` / `SOFFICE_PATH` / `GS_PATH` / `PANDOC_PATH` | from `PATH` | Override binary locations |
| `STRIPE_SECRET_KEY` | — | Set to enable payments |
| `STRIPE_WEBHOOK_SECRET` | — | For webhook signature verification |
| `PRICE_AMOUNT` | `99` | Price per file (smallest currency unit, e.g. cents) |
| `PRICE_CURRENCY` | `usd` | ISO currency code |

### Enabling Stripe payments

1. Create a [Stripe](https://stripe.com) account and grab your **secret key**.
2. Set `STRIPE_SECRET_KEY` (and optionally `PRICE_AMOUNT` / `PRICE_CURRENCY`).
3. (Recommended) Add a webhook endpoint pointing at
   `https://your-domain/api/stripe/webhook` for the
   `checkout.session.completed` event, and set `STRIPE_WEBHOOK_SECRET`.

When a key is present, each converted file is held until the user completes
Stripe Checkout; the download is then unlocked. Without a key, AnyConv runs in
**free mode** and downloads are immediate.

---

## API

| Method & path | Purpose |
|---------------|---------|
| `GET /api/formats` | Capabilities: formats, conversion matrix, tool status, pricing |
| `POST /api/convert` | Multipart upload (`file`, `to`) → job info + download URL |
| `GET /api/jobs/:id` | Job status (paid / download URL) |
| `POST /api/checkout/:id` | Create a Stripe Checkout Session (paid mode) |
| `GET /api/download/:id` | Download the converted file (payment-gated in paid mode) |
| `POST /api/stripe/webhook` | Stripe webhook receiver |
| `GET /healthz` | Health + tool status |

Example:

```bash
curl -F "file=@photo.png" -F "to=webp" http://localhost:3000/api/convert
```

---

## Architecture

```
src/
├── server/
│   ├── index.ts              # Express app, static hosting, startup
│   ├── config.ts             # env-driven configuration
│   ├── jobs.ts               # in-memory job store + TTL cleanup
│   ├── stripe.ts             # optional payment integration
│   ├── routes/               # /api/* + Stripe webhook
│   ├── util/                 # safe exec, mime, zip + image→pdf writers
│   └── conversion/
│       ├── registry.ts       # picks the best available converter for a pair
│       ├── formats.ts        # format catalogue + alias normalisation
│       └── converters/       # image · av · office · markup · pdf · data
└── web/                      # static drag-and-drop frontend (no build step)
```

The **registry** is the heart of the system: each converter declares which
`(from → to)` pairs it supports and which external tool it needs. At startup the
server probes the tools, and `findConverter()` returns the first *available*
converter for a requested pair. Reachable targets are computed per source format
so the UI can only ever offer conversions that will succeed.

### Adding a converter

1. Create `src/server/conversion/converters/my.ts` exporting a `Converter`
   (`name`, optional `requiresTool`, `supports()`, `convert()`).
2. Register it in `src/server/conversion/registry.ts` (order = priority).
3. Add any new formats to `src/server/conversion/formats.ts` and
   `src/server/util/mime.ts`.
4. Add a test in `test/`.

---

## Development

```bash
npm run dev         # auto-reloading server
npm run typecheck   # strict TypeScript check
npm test            # unit + integration tests (vitest)
npm run build       # compile to dist/ and copy the frontend
```

Integration tests run real conversions through every engine and verify the
output by magic bytes; engine tests auto-skip if a tool isn't installed.

---

## License

[MIT](LICENSE) — free to use, modify and self-host.
