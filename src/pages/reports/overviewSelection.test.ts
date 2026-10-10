import assert from "node:assert/strict";
import test from "node:test";
import { selectOverviewCards } from "./overviewSelection";
const members = [
  {userId: 1, roleType: "lead" as const, leadId: 1},
  {userId: 2, roleType: "employee" as const, leadId: 1},
  {userId: 3, roleType: "employee" as const, leadId: 1},
  {userId: 4, roleType: "lead" as const, leadId: 4},
  {userId: 5, roleType: "employee" as const, leadId: 4},
  {userId: 6, roleType: "employee" as const, leadId: null},
];
const cards = [...members, {userId: 99}].map(member => ({userId: member.userId}));
const ids = (teams: string[] | null, coders: string[] | null, qa: boolean, showCoders: boolean) =>
  selectOverviewCards(cards, members, teams, coders, {qa, coders: showCoders}).map(card => card.userId);
test("manager can display QA and coders together or either alone", () => {
  assert.deepEqual(ids(null, null, true, true), [1,2,3,4,5,6]);
  assert.deepEqual(ids(null, null, true, false), [1,4]);
  assert.deepEqual(ids(null, null, false, true), [2,3,5,6]);
  assert.deepEqual(ids(null, null, false, false), []);
});
test("team selection scopes both groups; coder selection keeps the selected teams' QA", () => {
  assert.deepEqual(ids(["lead-1"], ["3"], true, true), [1,3]);
  assert.deepEqual(ids(["lead-1", "lead-4"], ["3", "5"], true, true), [1,3,4,5]);
  assert.deepEqual(ids(["lead-1"], ["5"], true, true), [1]);
  assert.deepEqual(ids(["lead-1"], [], true, true), [1]);
  assert.deepEqual(ids([], null, true, true), []);
  assert.deepEqual(ids(["unassigned"], null, true, true), [6]);
});
