import test from "node:test";
import assert from "node:assert/strict";

import {
  parseOptionalFloat,
  parseOptionalInt,
  parseJsonField,
} from "../utils/parsers.js";

test("parseOptionalFloat returns null for empty-like values", () => {
  assert.equal(parseOptionalFloat(undefined), null);
  assert.equal(parseOptionalFloat(null), null);
  assert.equal(parseOptionalFloat(""), null);
  assert.equal(parseOptionalFloat("   "), null);
});

test("parseOptionalFloat parses valid numeric values", () => {
  assert.equal(parseOptionalFloat("12.50"), 12.5);
  assert.equal(parseOptionalFloat(7), 7);
  assert.equal(parseOptionalFloat("abc"), null);
});

test("parseOptionalInt respects defaults and parses integers", () => {
  assert.equal(parseOptionalInt(undefined, 3), 3);
  assert.equal(parseOptionalInt("", 9), 9);
  assert.equal(parseOptionalInt("42", null), 42);
  assert.equal(parseOptionalInt("nope", 11), 11);
});

test("parseJsonField parses valid JSON and falls back on invalid input", () => {
  const fallback = { ok: false };

  assert.deepEqual(parseJsonField('{"ok": true}', fallback), { ok: true });
  assert.deepEqual(parseJsonField("{bad-json", fallback), fallback);
  assert.deepEqual(parseJsonField("", fallback), fallback);
  assert.deepEqual(parseJsonField(null, fallback), fallback);
});
