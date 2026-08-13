import test from "node:test";
import assert from "node:assert/strict";
import {
  parseImageModeration,
  parsePromptModeration,
} from "../lib/ai/moderation";
import { reportSchema } from "../lib/validation/report";

test("prompt moderation accepts exact safe and unsafe results", () => {
  assert.deepEqual(parsePromptModeration("safe"), { status: "safe" });
  assert.deepEqual(parsePromptModeration("safe\n"), { status: "safe" });
  assert.deepEqual(parsePromptModeration("unsafe\nS11"), {
    status: "unsafe",
    category: "self_harm",
  });
});

test("prompt moderation fails closed for malformed results", () => {
  for (const value of [undefined, null, "", "SAFE", "unsafe", "unsafe\nS99", {}]) {
    assert.deepEqual(parsePromptModeration(value), { status: "unavailable" });
  }
});

test("image moderation accepts only its closed schema", () => {
  assert.deepEqual(parseImageModeration("SAFE"), { status: "safe" });
  assert.deepEqual(parseImageModeration("VIOLENCE"), {
    status: "unsafe",
    category: "violence",
  });
  assert.deepEqual(parseImageModeration("SAFE\n"), { status: "safe" });
  for (const value of [undefined, "safe", "UNSAFE", "UNSAFE:other", "SAFE because clear"]) {
    assert.deepEqual(parseImageModeration(value), { status: "unavailable" });
  }
});

test("report validation rejects unknown ids, categories and extra values", () => {
  const id = "10000000-0000-4000-8000-000000000001";
  assert.equal(reportSchema.safeParse({ generationId: id, reason: "hate" }).success, true);
  assert.equal(reportSchema.safeParse({ generationId: "bad", reason: "hate" }).success, false);
  assert.equal(reportSchema.safeParse({ generationId: id, reason: "other" }).success, false);
  assert.equal(
    reportSchema.safeParse({ generationId: id, reason: "hate", decision: "unsafe" }).success,
    false,
  );
});
