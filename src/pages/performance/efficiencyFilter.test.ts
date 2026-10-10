import assert from "node:assert/strict";
import test from "node:test";
import type { CoderPerformanceMember } from "@/api/coderPerformance";
import { filterMembersByEfficiency } from "./efficiencyFilter";

function member(id: number, kairon: string | null, manual: string | null = kairon): CoderPerformanceMember {
  return { userId: id, name: `Person ${id}`, isActive: true, efficiency: {
    kaironCharts: 0, manualCharts: 0, adjustedCpd: null, kaironCpd: null,
    manualCpd: null, targetCpd: null, kaironEfficiencyPercent: kairon, manualEfficiencyPercent: manual,
  } };
}
const members = [member(1, "0"), member(2, "79.9"), member(3, "80"), member(4, "99.9"), member(5, "100"), member(6, "120"), member(7, null)];
const ids = (rows: CoderPerformanceMember[]) => rows.map((row) => row.userId);

test("efficiency bands include the correct boundary and zero values", () => {
  assert.deepEqual(ids(filterMembersByEfficiency(members, { source: "kairon", band: "below80" })), [1, 2]);
  assert.deepEqual(ids(filterMembersByEfficiency(members, { source: "kairon", band: "80to100" })), [3, 4]);
  assert.deepEqual(ids(filterMembersByEfficiency(members, { source: "kairon", band: "achieved" })), [5, 6]);
});
test("source selection filters Kairon and Manual independently", () => {
  const rows = [member(1, "50", "110"), member(2, "110", "50")];
  assert.deepEqual(ids(filterMembersByEfficiency(rows, { source: "kairon", band: "achieved" })), [2]);
  assert.deepEqual(ids(filterMembersByEfficiency(rows, { source: "manual", band: "achieved" })), [1]);
});
test("missing and invalid efficiency remains distinct from zero", () => {
  const rows = [...members, member(8, ""), member(9, "invalid"), { ...member(10, "0"), efficiency: null }];
  assert.deepEqual(ids(filterMembersByEfficiency(rows, { source: "kairon", band: "unavailable" })), [7, 8, 9, 10]);
});
test("all efficiencies preserves every row without mutating the input", () => {
  assert.equal(filterMembersByEfficiency(members, { source: "manual", band: "all" }), members);
  filterMembersByEfficiency(members, { source: "kairon", band: "achieved" });
  assert.equal(members.length, 7);
});
