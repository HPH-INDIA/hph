import assert from "node:assert/strict";
import test from "node:test";
import { holdAgeGroup } from "./chartHoldAge";
import { holdDateError, holdLink, holdSearch, readHoldSearch, updateHoldFilters } from "./chartHoldsView";

test("hold filters survive a URL round trip including special practice names", () => {
  const query = { view: "coders" as const, userId: 12, leadId: "3", createdFrom: "2026-09-01", createdTo: "2026-10-07", practice: "A&B / 100% Care", page: 3, pageSize: 50 };
  const params = holdSearch(query, "kairon");
  assert.equal(params.get("source"), "kairon");
  assert.deepEqual(readHoldSearch(params, "manager"), { ...query, withoutPractice: undefined, ageBucket: undefined, sortBy: "created", sortDirection: "desc" });
  assert.equal(holdLink("leads", "kairon"), "/reports/chart-holds?source=kairon&view=leads");
});

test("role defaults and page limits recover safely from invalid links", () => {
  const params = new URLSearchParams("view=unknown&page=-4&pageSize=999&userId=bad&leadId=other");
  assert.equal(readHoldSearch(params, "manager").view, "all");
  assert.equal(readHoldSearch(params, "lead").view, "coders");
  assert.equal(readHoldSearch(params, "employee").view, "all");
  assert.equal(readHoldSearch(params, "manager").page, 1);
  assert.equal(readHoldSearch(params, "manager").pageSize, 25);
  const self = readHoldSearch(new URLSearchParams("view=leads&userId=99&leadId=12"), "employee");
  assert.equal(self.userId, undefined);
  assert.equal(self.leadId, undefined);
  assert.equal(self.view, "all");
  assert.equal(readHoldSearch(new URLSearchParams("view=leads&leadId=12"), "manager").leadId, undefined);
});

test("switching team or view clears dependent selections and resets pagination", () => {
  const query = { view: "all" as const, userId: 12, leadId: "3", practice: "North", page: 4, pageSize: 50 };
  const team = updateHoldFilters(query, { leadId: "9" });
  assert.equal(team.userId, undefined);
  assert.equal(team.leadId, "9");
  assert.equal(team.page, 1);
  const view = updateHoldFilters(query, { view: "leads" });
  assert.equal(view.userId, undefined);
  assert.equal(view.leadId, undefined);
  assert.equal(view.practice, "North");
  assert.equal(view.pageSize, 50);
  assert.equal(updateHoldFilters(query, { createdFrom: "2026-10-01" }).page, 1);
});

test("missing-practice links are mutually exclusive with named practices", () => {
  const query = readHoldSearch(new URLSearchParams("practice=North&withoutPractice=true&leadId=unassigned"), "manager");
  assert.equal(query.practice, undefined);
  assert.equal(query.withoutPractice, true);
  assert.equal(query.leadId, "unassigned");
});

test("date validation accepts inclusive ranges and rejects impossible or reversed dates", () => {
  assert.equal(holdDateError({ createdFrom: "2026-10-07", createdTo: "2026-10-07" }), undefined);
  assert.equal(holdDateError({ createdFrom: "2024-02-29" }), undefined);
  assert.equal(holdDateError({}), undefined);
  assert.ok(holdDateError({ createdFrom: "2026-10-07", createdTo: "2026-09-01" }));
  assert.ok(holdDateError({ createdFrom: "2026-02-30" }));
  assert.ok(holdDateError({ createdTo: "invalid" }));
});


test("age groups and sorting persist together and reset pagination", () => {
  const query = { view: "all" as const, ageBucket: "priority" as const, sortBy: "age" as const, sortDirection: "desc" as const, page: 3 };
  const parsed = readHoldSearch(holdSearch(query, "dashboard"), "manager");
  assert.equal(parsed.ageBucket, "priority");
  assert.equal(parsed.sortBy, "age");
  assert.equal(parsed.sortDirection, "desc");
  assert.equal(updateHoldFilters(parsed, { ageBucket: "monitor" }).page, 1);
  assert.equal(updateHoldFilters(parsed, { sortBy: "practice", sortDirection: "asc" }).page, 1);
  assert.equal(updateHoldFilters(parsed, { sortBy: "practice" }).ageBucket, "priority");
  const invalid = readHoldSearch(new URLSearchParams("ageBucket=bad&sortBy=bad&sortDirection=bad"), "manager");
  assert.equal(invalid.ageBucket, undefined);
  assert.equal(invalid.sortBy, "created");
  assert.equal(invalid.sortDirection, "desc");
});

test("age badges match the API's inclusive buckets", () => {
  for (const [age, key] of [[0,"on_track"],[10,"on_track"],[11,"monitor"],[20,"monitor"],[21,"attention"],[30,"attention"],[31,"priority"],[100,"priority"],[null,"unknown"],[-1,"unknown"]] as const) {
    assert.equal(holdAgeGroup(age).key, key);
  }
});
