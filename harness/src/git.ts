import { run } from "./proc.ts";

export const git = (...args: string[]) => run("git", args);

export const currentBranch = () => git("rev-parse", "--abbrev-ref", "HEAD");
export const headSha = () => git("rev-parse", "HEAD");
export const isClean = () => git("status", "--porcelain") === "";

/** Every path changed relative to `base` (committed, staged, unstaged, deleted) plus untracked files. */
export function changedFiles(base: string): string[] {
  const split = (s: string) => s.split("\0").filter(Boolean);
  const tracked = split(git("diff", "--name-only", "--no-renames", "-z", base));
  const untracked = split(git("ls-files", "--others", "--exclude-standard", "-z"));
  return [...new Set([...tracked, ...untracked])].sort();
}

/** Files, insertions and deletions between two refs, excluding the run records. */
export function diffStats(base: string, head = "HEAD"): { files: number; insertions: number; deletions: number } {
  const out = git("diff", "--shortstat", `${base}...${head}`, "--", ".", ":(exclude)harness/runs");
  const num = (re: RegExp) => Number(re.exec(out)?.[1] ?? 0);
  return { files: num(/(\d+) files? changed/), insertions: num(/(\d+) insertions?/), deletions: num(/(\d+) deletions?/) };
}
