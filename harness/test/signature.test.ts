import assert from "node:assert/strict";
import { test } from "node:test";
import { signature, type GateResult } from "../src/gates.ts";

const acceptance = (failedCommand: string, tail: string): GateResult => ({
  gate: "acceptance", passed: false, failedCommand, tail, commands: [],
});

const run1 = [
  "Restore complete (0.8s)",
  "2026-10-06T03:46:08.001Z build started",
  "error CS1002: ; expected at C:\\Users\\me\\AppData\\Local\\Temp\\abc123\\Program.cs",
  "Test run failed in 1.52s, commit 0ac62a8f",
].join("\n");
const run2 = [
  "Restore complete (1.4s)",
  "2026-10-07T11:02:55.913Z build started",
  "error CS1002: ; expected at C:\\Users\\me\\AppData\\Local\\Temp\\xyz789\\Program.cs",
  "Test run failed in 3 s, commit 1108986d",
].join("\n");

test("the same failure with different timings, timestamps, hashes and temp paths has the same signature", () => {
  assert.equal(signature(acceptance("npm run verify", run1)), signature(acceptance("npm run verify", run2)));
});

test("a different failing command gives a different signature", () => {
  assert.notEqual(signature(acceptance("npm run verify", run1)), signature(acceptance("npm run setup", run1)));
});

test("a different error gives a different signature", () => {
  const other = run1.replace("CS1002: ; expected", "CS0103: name 'x' does not exist");
  assert.notEqual(signature(acceptance("npm run verify", run1)), signature(acceptance("npm run verify", other)));
});

test("scope failures key on the file list, not on other details", () => {
  const scope = (files: string[]): GateResult => ({ gate: "scope", passed: false, files });
  assert.equal(signature(scope(["a.txt", "b.txt"])), signature(scope(["a.txt", "b.txt"])));
  assert.notEqual(signature(scope(["a.txt"])), signature(scope(["a.txt", "b.txt"])));
  assert.match(signature(scope(["a.txt"])), /^scope:/);
});

test("the same files failing different gates give different signatures", () => {
  const files = ["backend/Inv.cs"];
  assert.notEqual(
    signature({ gate: "scope", passed: false, files }),
    signature({ gate: "protected", passed: false, files }),
  );
});
