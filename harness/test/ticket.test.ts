import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadTicket, parseTicket, serializeTicket, TicketError } from "../src/ticket.ts";

const body = (overrides: Record<string, string> = {}) => {
  const sections: Record<string, string> = {
    "Goal": "Do the thing.",
    "Acceptance commands (parsed)": "<!-- Run from the repo root. -->\n```sh\nnpm run setup\n# a comment\n\nnpm run verify\n```",
    "Pending tests to promote": "- `frontend/src/a.pending.test.ts`: promote it",
    "Protected test changes (parsed)": "<!-- \"None\", or paths. -->\n- None",
    "Allowed paths (parsed)": "<!-- Globs.\n- not/a/path -->\n- backend/**\n- `frontend/**`\n- package.json",
    ...overrides,
  };
  return Object.entries(sections).map(([h, s]) => `## ${h}\n\n${s}\n`).join("\n");
};

test("parses the four sections, ignoring (parsed), comments and blank or comment lines", () => {
  const t = parseTicket(3, "T2: Questionnaire endpoint", body());
  assert.equal(t.id, "T2");
  assert.equal(t.issue, 3);
  assert.equal(t.title, "Questionnaire endpoint");
  assert.deepEqual(t.acceptance, ["npm run setup", "npm run verify"]);
  assert.deepEqual(t.allowedPaths, ["backend/**", "frontend/**", "package.json"]);
  assert.deepEqual(t.pendingTests, ["frontend/src/a.pending.test.ts"]);
  assert.deepEqual(t.protectedChanges, []);
});

test("falls back to the issue number when the title has no T<n> prefix", () => {
  const t = parseTicket(7, "Untitled", body());
  assert.equal(t.id, "T7");
  assert.equal(t.title, "Untitled");
});

test("a protected path with a reason yields the path", () => {
  const t = parseTicket(1, "T1: x", body({ "Protected test changes (parsed)": "- `backend/Inv.cs`: fixture renamed" }));
  assert.deepEqual(t.protectedChanges, ["backend/Inv.cs"]);
});

test("a missing required section is a TicketError", () => {
  const b = body().replace(/## Allowed paths \(parsed\)[\s\S]*$/, "");
  assert.throws(() => parseTicket(1, "T1: x", b), (e) => e instanceof TicketError && /Allowed paths/.test(e.message));
});

test("an acceptance block with only comments is a TicketError", () => {
  const b = body({ "Acceptance commands (parsed)": "```sh\n# nothing yet\n```" });
  assert.throws(() => parseTicket(1, "T1: x", b), (e) => e instanceof TicketError && /empty/.test(e.message));
});

test("an acceptance section without an sh block is a TicketError", () => {
  const b = body({ "Acceptance commands (parsed)": "npm run verify" });
  assert.throws(() => parseTicket(1, "T1: x", b), TicketError);
});

test("ticket files: header with and without issue, and the snapshot round-trips", () => {
  const dir = mkdtempSync(join(tmpdir(), "ticket-test-"));
  const withIssue = join(dir, "a.md");
  writeFileSync(withIssue, `---\r\nissue: 4\r\ntitle: T3: Paging\r\n---\r\n\r\n${body().replace(/\n/g, "\r\n")}`);
  const a = loadTicket({ file: withIssue });
  assert.equal(a.issue, 4);
  assert.equal(a.id, "T3");
  assert.deepEqual(a.acceptance, ["npm run setup", "npm run verify"]);

  const noIssue = join(dir, "b.md");
  writeFileSync(noIssue, `---\ntitle: T901: Scratch\n---\n\n${body()}`);
  const b = loadTicket({ file: noIssue });
  assert.equal(b.issue, null);
  assert.equal(b.id, "T901");

  const snapshot = join(dir, "c.md");
  writeFileSync(snapshot, serializeTicket(a));
  assert.deepEqual(loadTicket({ file: snapshot }), a);
});

test("a ticket file without a header, or without a T<n> title and issue, is a TicketError", () => {
  const dir = mkdtempSync(join(tmpdir(), "ticket-test-"));
  const noHeader = join(dir, "a.md");
  writeFileSync(noHeader, body());
  assert.throws(() => loadTicket({ file: noHeader }), TicketError);
  const noId = join(dir, "b.md");
  writeFileSync(noId, `---\ntitle: Scratch\n---\n\n${body()}`);
  assert.throws(() => loadTicket({ file: noId }), TicketError);
});
