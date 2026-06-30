import path from "node:path";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

const workDir = process.env.WORK_DIR
  ? path.resolve(process.env.WORK_DIR)
  : path.resolve(process.cwd(), "tmp-uploads");

export const config = {
  port: envInt("PORT", 3000),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${envInt("PORT", 3000)}`,
  maxUploadBytes: envInt("MAX_UPLOAD_MB", 200) * 1024 * 1024,
  fileTtlMs: envInt("FILE_TTL_MINUTES", 30) * 60 * 1000,
  workDir,

  tools: {
    ffmpeg: process.env.FFMPEG_PATH || "ffmpeg",
    soffice: process.env.SOFFICE_PATH || "soffice",
    gs: process.env.GS_PATH || "gs",
    pandoc: process.env.PANDOC_PATH || "pandoc",
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    priceAmount: envInt("PRICE_AMOUNT", 99),
    priceCurrency: (process.env.PRICE_CURRENCY || "usd").toLowerCase(),
  },
};

/** Whether pay-per-conversion is enabled (Stripe key present). */
export const paymentsEnabled = (): boolean => Boolean(config.stripe.secretKey);
