import assert from "node:assert/strict";
import test from "node:test";

import { defaultLeadFilters, leadDashboardQuery, leadFilterError, leadPeriodLabel } from "./leadFilters";

const today = "2026-10-04";
const defaults = defaultLeadFilters(today);

test("all manager date options generate only the selected date parameters", () => {
  assert.deepEqual(leadDashboardQuery(defaults, today), { month: "2026-10" });
  assert.deepEqual(leadDashboardQuery({ ...defaults, dateMode: "day" }, today), { date: today });
  assert.deepEqual(leadDashboardQuery({ ...defaults, dateMode: "year", year: 2025 }, today), { year: 2025 });
  assert.deepEqual(leadDashboardQuery({ ...defaults, dateMode: "range", rangeStart: "2026-09-01", rangeEnd: "2026-09-30" }, today), { from: "2026-09-01", to: "2026-09-30" });
});

test("from-start follows the April financial year across calendar years", () => {
  assert.deepEqual(leadDashboardQuery({ ...defaults, dateMode: "from_start" }, today), { from: "2026-04-01", to: today });
  assert.deepEqual(leadDashboardQuery({ ...defaults, dateMode: "from_start" }, "2026-02-15"), { from: "2025-04-01", to: "2026-02-15" });
});

test("no coder selection requests the whole scoped team; selection sends only coderId", () => {
  const selected = { ...defaults, coderId: 42 as const };
  assert.deepEqual(leadDashboardQuery(selected, today), { month: "2026-10", coderId: 42 });
  assert.equal(leadDashboardQuery(defaults, today).coderId, undefined);
  assert.equal(leadPeriodLabel(selected, today), leadPeriodLabel(defaults, today));
});

test("invalid dates, future periods and reversed ranges cannot be applied", () => {
  assert.equal(leadFilterError(defaults, today), null);
  assert.ok(leadFilterError({ ...defaults, month: "2026-13" }, today));
  assert.ok(leadFilterError({ ...defaults, month: "2026-11" }, today));
  assert.ok(leadFilterError({ ...defaults, dateMode: "day", day: "2026-02-31" }, today));
  assert.ok(leadFilterError({ ...defaults, dateMode: "range", rangeStart: "2026-09-30", rangeEnd: "2026-09-01" }, today));
  assert.ok(leadFilterError({ ...defaults, dateMode: "year", year: 2027 }, today));
  assert.ok(leadFilterError({ ...defaults, dateMode: "year", year: 2025.5 }, today));
  assert.ok(leadFilterError({ ...defaults, coderId: 0 }, today));
});
