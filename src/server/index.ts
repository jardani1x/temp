import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import express from "express";
import { config, paymentsEnabled } from "./config.js";
import { initRegistry, toolStatusSnapshot } from "./conversion/registry.js";
import { startCleanupLoop } from "./jobs.js";
import apiRouter from "./routes/api.js";
import webhookRouter from "./routes/webhook.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Static assets live in src/web (served directly; no build step needed).
const webDir = path.resolve(__dirname, "../web");

async function main() {
  fs.mkdirSync(config.workDir, { recursive: true });
  await initRegistry();

  const app = express();
  app.disable("x-powered-by");

  // Webhook must see the raw body, so mount it before the JSON parser.
  app.use("/api/stripe", webhookRouter);

  app.use(express.json({ limit: "1mb" }));

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok", tools: toolStatusSnapshot(), payments: paymentsEnabled() });
  });

  app.use("/api", apiRouter);
  app.use(express.static(webDir, { index: "index.html", maxAge: "1h" }));

  // SPA fallback for any non-API route.
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(webDir, "index.html"));
  });

  startCleanupLoop();

  app.listen(config.port, () => {
    const tools = toolStatusSnapshot();
    console.log(`AnyConv listening on ${config.publicBaseUrl}`);
    console.log(
      `Tools — ffmpeg:${tools.ffmpeg} libreoffice:${tools.soffice} ghostscript:${tools.gs} pandoc:${tools.pandoc}`,
    );
    console.log(`Payments: ${paymentsEnabled() ? "ENABLED (Stripe)" : "disabled (free mode)"}`);
  });
}

main().catch((err) => {
  console.error("Failed to start AnyConv:", err);
  process.exit(1);
});
