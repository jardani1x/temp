import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { config } from "./config.js";

export interface Job {
  id: string;
  /** Per-job working directory (inputs + outputs live here). */
  dir: string;
  outputPath: string;
  fileName: string;
  mimeType: string;
  size: number;
  from: string;
  to: string;
  createdAt: number;
  /** Whether the converted file may be downloaded. */
  paid: boolean;
  /** Whether payment is required to unlock the download. */
  paymentRequired: boolean;
  stripeSessionId?: string;
}

const jobs = new Map<string, Job>();

export function newJobId(): string {
  return crypto.randomBytes(16).toString("hex");
}

export async function createJobDir(id: string): Promise<string> {
  const dir = path.join(config.workDir, id);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function saveJob(job: Job): void {
  jobs.set(job.id, job);
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function findJobBySession(sessionId: string): Job | undefined {
  for (const job of jobs.values()) {
    if (job.stripeSessionId === sessionId) return job;
  }
  return undefined;
}

async function removeJob(job: Job): Promise<void> {
  jobs.delete(job.id);
  await fs.rm(job.dir, { recursive: true, force: true }).catch(() => {});
}

/** Delete expired jobs and their files. Returns the number removed. */
export async function cleanupExpired(now = Date.now()): Promise<number> {
  let removed = 0;
  for (const job of [...jobs.values()]) {
    if (now - job.createdAt > config.fileTtlMs) {
      await removeJob(job);
      removed++;
    }
  }
  return removed;
}

let timer: NodeJS.Timeout | null = null;

/** Start periodic cleanup of expired jobs. */
export function startCleanupLoop(): void {
  if (timer) return;
  const interval = Math.max(60_000, Math.floor(config.fileTtlMs / 2));
  timer = setInterval(() => {
    void cleanupExpired();
  }, interval);
  timer.unref();
}

export function stopCleanupLoop(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
