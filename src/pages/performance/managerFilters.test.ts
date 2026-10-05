import assert from "node:assert/strict";
import test from "node:test";
import { changeManagerScope, defaultManagerFilters, managerDashboardQuery, matchingCoders } from "./managerFilters";

const today = "2026-10-04";
const options = [
  { userId: 1, name: "A", isActive: true, leadId: 10, cohortId: 20 },
  { userId: 2, name: "B", isActive: false, leadId: 10, cohortId: 21 },
  { userId: 3, name: "C", isActive: true, leadId: 11, cohortId: 20 },
  { userId: 4, name: "D", isActive: true, leadId: null, cohortId: null },
];
test("all people is the default and filters reach the manager endpoint", () => {
  const defaults = defaultManagerFilters(today);
  assert.deepEqual(managerDashboardQuery(defaults, today), { month: "2026-10" });
  assert.deepEqual(managerDashboardQuery({ ...defaults, dateMode: "day", coderId: 1, leadId: 10, cohortId: 20, program: "PVP" }, today), { date: today, coderId: 1, leadId: 10, cohortId: 20, program: "PVP" });
});
test("coder options respect lead AND cohort, including inactive and unassigned", () => {
  const defaults = defaultManagerFilters(today);
  assert.equal(matchingCoders(options, defaults).length, 4);
  assert.deepEqual(matchingCoders(options, { ...defaults, leadId: 10 }).map((coder) => coder.userId), [1, 2]);
  assert.deepEqual(matchingCoders(options, { ...defaults, leadId: 10, cohortId: 20 }).map((coder) => coder.userId), [1]);
});
test("changing team or cohort clears an incompatible coder but preserves a valid one", () => {
  const filters = { ...defaultManagerFilters(today), coderId: 1, leadId: 10 };
  assert.equal(changeManagerScope(filters, { cohortId: 20 }, options).coderId, 1);
  assert.equal(changeManagerScope(filters, { cohortId: 21 }, options).coderId, "ALL");
  assert.equal(changeManagerScope(filters, { leadId: 11 }, options).coderId, "ALL");
});
