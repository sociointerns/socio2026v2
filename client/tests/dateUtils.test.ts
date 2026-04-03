import test from "node:test";
import assert from "node:assert/strict";

import {
  formatDate,
  formatDateFull,
  formatTime,
  formatDateUTC,
  getDaysUntil,
  isDeadlinePassed,
  isBeforeToday,
  formatDateRange,
} from "../lib/dateUtils";

test("formatDate handles valid and invalid dates", () => {
  assert.equal(formatDate("2026-01-30"), "Jan 30, 2026");
  assert.equal(formatDate("not-a-date"), "Date TBD");
  assert.equal(formatDate(null), "Date TBD");
});

test("formatDateFull handles valid and invalid dates", () => {
  assert.equal(formatDateFull("2026-01-05"), "Jan 05, 2026");
  assert.equal(formatDateFull(undefined), "Date TBD");
});

test("formatTime parses and normalizes time values", () => {
  assert.equal(formatTime("14:30"), "2:30 PM");
  assert.equal(formatTime("2:30 PM"), "2:30 PM");
  assert.equal(formatTime(""), "Time TBD");
  assert.equal(formatTime("oops"), "Time TBD");
});

test("formatDateUTC formats date consistently", () => {
  assert.equal(formatDateUTC("2026-05-01T00:00:00Z"), "May 1, 2026");
  assert.equal(formatDateUTC("bad"), "Date TBD");
});

test("deadline helpers behave for null, past, and future dates", () => {
  assert.equal(getDaysUntil(null), null);
  assert.equal(isDeadlinePassed(null), false);

  assert.equal(isDeadlinePassed("1900-01-01"), true);
  assert.equal(isDeadlinePassed("2999-01-01"), false);

  const daysUntilFuture = getDaysUntil("2999-01-01");
  assert.ok(daysUntilFuture !== null && daysUntilFuture > 0);

  const daysUntilPast = getDaysUntil("1900-01-01");
  assert.ok(daysUntilPast !== null && daysUntilPast < 0);
});

test("isBeforeToday and formatDateRange handle edge cases", () => {
  assert.equal(isBeforeToday(null), true);
  assert.equal(isBeforeToday("1900-01-01"), true);
  assert.equal(isBeforeToday("2999-01-01"), false);

  assert.equal(formatDateRange(null, null), "Dates TBD");
  assert.equal(formatDateRange("2026-01-01", null), "Jan 01, 2026");
  assert.equal(formatDateRange(null, "2026-01-02"), "Jan 02, 2026");
  assert.equal(formatDateRange("2026-01-01", "2026-01-02"), "Jan 01, 2026 - Jan 02, 2026");
});
