import { run } from "./proc.ts";

export const gh = (...args: string[]) => run("gh", args);

export function viewIssue(n: number): { number: number; title: string; body: string } {
  return JSON.parse(gh("issue", "view", String(n), "--json", "number,title,body"));
}

export interface PrInfo {
  number: number;
  url: string;
  body: string;
  headRefName: string;
  baseRefName: string;
}

export function viewPr(ref: string): PrInfo {
  return JSON.parse(gh("pr", "view", ref, "--json", "number,url,body,headRefName,baseRefName"));
}

/** Create a PR from the current branch; returns its URL. */
export function createPr(title: string, bodyFile: string, base = "main"): string {
  return gh("pr", "create", "--base", base, "--title", title, "--body-file", bodyFile);
}

export function commentPr(ref: string, bodyFile: string): void {
  gh("pr", "comment", ref, "--body-file", bodyFile);
}
