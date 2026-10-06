import { readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

export const HARNESS_DIR = resolve(import.meta.dirname, "..");
export const REPO_ROOT = resolve(HARNESS_DIR, "..");
export const RUNS_DIR = resolve(HARNESS_DIR, "runs");

export interface Config {
  makerModel: string;
  reviewerModel: string;
  maxAttempts: number;
  maxTurnsPerCall: number;
  callTimeoutMinutes: number;
  reviewRevisionRounds: number;
  feedbackTailLines: number;
}

export function loadConfig(): Config {
  return JSON.parse(readFileSync(resolve(HARNESS_DIR, "config.json"), "utf8"));
}

/** Repo-root-relative path with forward slashes, for reporting. */
export function repoPath(absolute: string): string {
  return relative(REPO_ROOT, absolute).split(sep).join("/");
}

export function readPrompt(name: string): string {
  return readFileSync(resolve(HARNESS_DIR, "prompts", name), "utf8");
}

/** Replace {{key}} placeholders. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (m, key: string) => values[key] ?? m);
}
