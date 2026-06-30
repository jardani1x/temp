import path from "node:path";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import express, { type Request, type Response } from "express";
import multer from "multer";
import { config } from "../config.js";
import { FORMATS } from "../conversion/formats.js";
import { conversionMatrix, toolStatusSnapshot } from "../conversion/registry.js";
import { runConversion } from "../conversion/index.js";
import { ConversionError } from "../conversion/types.js";
import { newJobId, createJobDir, saveJob, getJob, type Job } from "../jobs.js";
import {
  paymentsEnabled,
  createCheckoutSession,
  isSessionPaid,
  priceLabel,
} from "../stripe.js";

const router = express.Router();

// ---- Uploads -> per-job working directory ----
const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const id = newJobId();
    (req as Request & { jobId?: string }).jobId = id;
    createJobDir(id).then((dir) => cb(null, dir)).catch((err) => cb(err as Error, ""));
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `input${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes, files: 1 },
});

// ---- GET /api/formats : capabilities for the UI ----
router.get("/formats", (_req: Request, res: Response) => {
  res.json({
    formats: FORMATS.map((f) => ({ id: f.id, label: f.label, category: f.category })),
    matrix: conversionMatrix(),
    tools: toolStatusSnapshot(),
    payments: {
      enabled: paymentsEnabled(),
      price: paymentsEnabled() ? priceLabel() : null,
    },
  });
});

// ---- POST /api/convert : upload + convert ----
router.post("/convert", (req: Request, res: Response) => {
  upload.single("file")(req, res, async (uploadErr) => {
    if (uploadErr) {
      const msg =
        (uploadErr as { code?: string }).code === "LIMIT_FILE_SIZE"
          ? `File is too large (max ${config.maxUploadBytes / (1024 * 1024)} MB).`
          : "Upload failed.";
      return res.status(400).json({ error: msg });
    }

    const file = req.file;
    const to = String(req.body?.to ?? "").trim();
    const jobId = (req as Request & { jobId?: string }).jobId!;

    if (!file) return res.status(400).json({ error: "No file uploaded." });
    if (!to) {
      await fs.rm(path.dirname(file.path), { recursive: true, force: true }).catch(() => {});
      return res.status(400).json({ error: "No target format specified." });
    }

    try {
      const result = await runConversion({
        inputPath: file.path,
        originalName: file.originalname,
        to,
        outputDir: path.dirname(file.path),
      });

      // Remove the uploaded source to save space; keep only the output.
      await fs.rm(file.path, { force: true }).catch(() => {});

      const stat = await fs.stat(result.outputPath);
      const paymentRequired = paymentsEnabled();
      const job: Job = {
        id: jobId,
        dir: path.dirname(file.path),
        outputPath: result.outputPath,
        fileName: result.fileName,
        mimeType: result.mimeType,
        size: stat.size,
        from: path.extname(file.originalname).replace(/^\./, "").toLowerCase(),
        to,
        createdAt: Date.now(),
        paid: !paymentRequired,
        paymentRequired,
      };
      saveJob(job);

      return res.json({
        jobId: job.id,
        fileName: job.fileName,
        mimeType: job.mimeType,
        size: job.size,
        paymentRequired,
        downloadUrl: paymentRequired ? null : `/api/download/${job.id}`,
      });
    } catch (err) {
      await fs.rm(path.dirname(file.path), { recursive: true, force: true }).catch(() => {});
      if (err instanceof ConversionError) {
        return res.status(422).json({ error: err.userMessage });
      }
      console.error("Conversion error:", err);
      return res.status(500).json({ error: "An unexpected error occurred during conversion." });
    }
  });
});

// ---- GET /api/jobs/:id : status ----
router.get("/jobs/:id", (req: Request, res: Response) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found or expired." });
  return res.json({
    jobId: job.id,
    fileName: job.fileName,
    size: job.size,
    paymentRequired: job.paymentRequired,
    paid: job.paid,
    downloadUrl: job.paid ? `/api/download/${job.id}` : null,
  });
});

// ---- POST /api/checkout/:id : create a Stripe Checkout Session ----
router.post("/checkout/:id", async (req: Request, res: Response) => {
  if (!paymentsEnabled()) return res.status(400).json({ error: "Payments are not enabled." });
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found or expired." });
  if (job.paid) return res.json({ url: `/api/download/${job.id}`, alreadyPaid: true });

  try {
    const { url, sessionId } = await createCheckoutSession(job);
    job.stripeSessionId = sessionId;
    return res.json({ url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return res.status(502).json({ error: "Could not start checkout. Please try again." });
  }
});

// ---- GET /api/download/:id : stream the converted file ----
router.get("/download/:id", async (req: Request, res: Response) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "File not found or expired." });

  // Payment gate: allow a fresh Stripe session_id to unlock the download.
  if (job.paymentRequired && !job.paid) {
    const sessionId = String(req.query.session_id ?? "");
    if (sessionId && paymentsEnabled()) {
      try {
        if (await isSessionPaid(sessionId)) job.paid = true;
      } catch {
        /* fall through to 402 */
      }
    }
    if (!job.paid) return res.status(402).json({ error: "Payment required." });
  }

  try {
    await fs.access(job.outputPath);
  } catch {
    return res.status(404).json({ error: "File expired." });
  }

  res.setHeader("Content-Type", job.mimeType);
  res.setHeader("Content-Length", String(job.size));
  const asciiName = job.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(job.fileName)}`,
  );
  createReadStream(job.outputPath).pipe(res);
  return;
});

export default router;
