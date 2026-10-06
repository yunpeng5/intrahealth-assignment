import assert from "node:assert/strict";
import { test } from "node:test";
import { INVARIANTS, validateReview } from "../src/review.ts";

const requirements = INVARIANTS.map((id) => ({ id, status: "n/a", evidence: "no product code yet" }));
const finding = {
  severity: "blocking", category: "scope", file: "a.ts", line: 3, requirement: "S-1",
  summary: "s", evidence: "e", suggestion: "g",
};
const review = (overrides: object = {}) => ({ verdict: "approve", requirements, findings: [], ...overrides });

test("a valid review passes", () => {
  assert.deepEqual(validateReview(review()), []);
  assert.deepEqual(validateReview(review({ verdict: "request-changes", findings: [finding] })), []);
  assert.deepEqual(validateReview(review({ findings: [{ ...finding, severity: "nit", line: 0 }] })), []);
});

test("verdict must be request-changes exactly when there is a blocking finding", () => {
  const rule = /if and only if/;
  assert.match(validateReview(review({ findings: [finding] })).join(), rule);
  assert.match(validateReview(review({ verdict: "request-changes", findings: [{ ...finding, severity: "should-fix" }] })).join(), rule);
  assert.match(validateReview(review({ verdict: "maybe" })).join(), /verdict/);
});

test("every global invariant needs an entry", () => {
  const errors = validateReview(review({ requirements: requirements.filter((r) => r.id !== "D-7") }));
  assert.deepEqual(errors, ["requirements is missing the global invariants: D-7"]);
});

test("invalid severity, category or line is rejected", () => {
  const bad = (f: object) => validateReview(review({ verdict: "request-changes", findings: [{ ...finding, ...f }] }));
  assert.match(bad({ severity: "critical" }).join(), /severity/);
  assert.match(bad({ category: "style" }).join(), /category/);
  assert.match(bad({ line: 1.5 }).join(), /line/);
  assert.match(bad({ line: "3" }).join(), /line/);
});

test("non-objects and wrong shapes are rejected", () => {
  assert.deepEqual(validateReview(undefined), ["output is not a JSON object"]);
  assert.ok(validateReview({ verdict: "approve", requirements: {}, findings: [] }).length > 0);
  assert.ok(validateReview(review({ requirements: [...requirements, { id: "1.4", status: "done", evidence: "" }] })).length > 0);
});
