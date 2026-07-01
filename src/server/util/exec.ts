import { spawn } from "node:child_process";

export interface RunOptions {
  cwd?: string;
  /** Hard timeout in milliseconds. */
  timeoutMs?: number;
  /** Max captured stdout/stderr bytes (each) before truncation. */
  maxBuffer?: number;
  env?: NodeJS.ProcessEnv;
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Run an external command with arguments passed as an array (never through a
 * shell), so user-controlled filenames cannot inject shell syntax.
 */
export function run(cmd: string, args: string[], opts: RunOptions = {}): Promise<RunResult> {
  const { cwd, timeoutMs = 120_000, maxBuffer = 8 * 1024 * 1024, env } = opts;
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env: env ?? process.env });
    let stdout = "";
    let stderr = "";
    let stdoutLen = 0;
    let stderrLen = 0;
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`Command timed out after ${timeoutMs}ms: ${cmd}`));
    }, timeoutMs);

    child.stdout.on("data", (d: Buffer) => {
      if (stdoutLen < maxBuffer) {
        stdout += d.toString();
        stdoutLen += d.length;
      }
    });
    child.stderr.on("data", (d: Buffer) => {
      if (stderrLen < maxBuffer) {
        stderr += d.toString();
        stderrLen += d.length;
      }
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

/** Check whether a binary is invocable (used for capability reporting). */
export async function toolAvailable(cmd: string, versionArg = "-version"): Promise<boolean> {
  try {
    const res = await run(cmd, [versionArg], { timeoutMs: 10_000 });
    return res.code === 0 || res.stdout.length > 0 || res.stderr.length > 0;
  } catch {
    return false;
  }
}
