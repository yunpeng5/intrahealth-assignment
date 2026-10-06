import { readFileSync } from "node:fs";
import { viewIssue } from "./gh.ts";

export interface Ticket {
  /** GitHub issue number; null for a ticket file without one (scratch tickets). */
  issue: number | null;
  /** "T<n>", from the title prefix, else from the issue number. */
  id: string;
  /** Title without the "T<n>: " prefix. */
  title: string;
  body: string;
  acceptance: string[];
  allowedPaths: string[];
  pendingTests: string[];
  protectedChanges: string[];
}

export class TicketError extends Error {}

/**
 * A ticket file is the issue body preceded by a small header:
 *
 *   ---
 *   issue: 1            (optional)
 *   title: T1: Initialize the project
 *   ---
 */
export function serializeTicket(t: Ticket): string {
  const issueLine = t.issue === null ? "" : `issue: ${t.issue}\n`;
  return `---\n${issueLine}title: ${t.id}: ${t.title}\n---\n\n${t.body.trim()}\n`;
}

export function loadTicket(source: { issue: number } | { file: string }): Ticket {
  if ("issue" in source) {
    const i = viewIssue(source.issue);
    return parseTicket(i.number, i.title, i.body);
  }
  const text = readFileSync(source.file, "utf8").replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!m) throw new TicketError(`${source.file}: missing the --- header with a title`);
  const header = Object.fromEntries(
    m[1].split("\n").map((l) => {
      const at = l.indexOf(":");
      return [l.slice(0, at).trim(), l.slice(at + 1).trim()];
    }),
  );
  if (!header.title) throw new TicketError(`${source.file}: header has no title`);
  return parseTicket(header.issue ? Number(header.issue) : null, header.title, m[2]);
}

export function parseTicket(issue: number | null, fullTitle: string, rawBody: string): Ticket {
  const body = rawBody.replace(/\r\n/g, "\n").trim();
  const prefix = /^(T\d+):\s*/.exec(fullTitle);
  if (!prefix && issue === null) throw new TicketError(`title "${fullTitle}" has no T<n>: prefix and there is no issue number`);
  const sections = splitSections(body);

  const section = (name: string): string => {
    const s = sections.get(name.toLowerCase());
    if (s === undefined) throw new TicketError(`missing section "## ${name}"`);
    return s;
  };

  const shBlock = /```sh\n([\s\S]*?)```/.exec(section("Acceptance commands"));
  if (!shBlock) throw new TicketError(`"Acceptance commands" has no \`\`\`sh block`);
  const acceptance = shBlock[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  if (acceptance.length === 0) throw new TicketError(`"Acceptance commands" is empty`);

  const allowedPaths = bulletPaths(section("Allowed paths"));
  if (allowedPaths.length === 0) throw new TicketError(`"Allowed paths" is empty`);

  return {
    issue,
    id: prefix ? prefix[1] : `T${issue}`,
    title: prefix ? fullTitle.slice(prefix[0].length) : fullTitle,
    body,
    acceptance,
    allowedPaths,
    pendingTests: bulletPaths(section("Pending tests to promote")),
    protectedChanges: bulletPaths(section("Protected test changes")),
  };
}

/** Map of normalized "## heading" (lowercase, "(parsed)" removed) to section text, comments stripped. */
function splitSections(body: string): Map<string, string> {
  const map = new Map<string, string>();
  const parts = body.replace(/<!--[\s\S]*?-->/g, "").split(/^## +/m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    const heading = (nl === -1 ? part : part.slice(0, nl)).replace(/\(parsed\)/i, "").trim().toLowerCase();
    map.set(heading, nl === -1 ? "" : part.slice(nl + 1));
  }
  return map;
}

/**
 * Bullet items as paths. "None" means no items. An item like "`a/b.cs`: reason" yields the
 * first code span; otherwise the first word.
 */
function bulletPaths(text: string): string[] {
  return text
    .split("\n")
    .map((l) => /^\s*[-*]\s+(.*)$/.exec(l)?.[1].trim() ?? "")
    .filter((item) => item && !/^none\b/i.test(item))
    .map((item) => /`([^`]+)`/.exec(item)?.[1] ?? item.split(/[\s:]/)[0]);
}
