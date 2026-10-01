// Run: node_modules/.bin/esbuild src/api/manualTeamRange.test.ts --bundle --platform=node --format=esm --outfile=/tmp/hph-manual-team-range-tests.mjs && node --test /tmp/hph-manual-team-range-tests.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import type { ApiErrorShape } from "./apiError";
import type { ApiRequestArgs } from "./baseQuery";
import { loadManualTeamDay } from "./manualTeamDay";
import { loadManualTeamRange } from "./manualTeamRange";
import type { AdminUser, ManualDailyRecord, PaginatedResult, RoleTypeCode } from "./types";

const fromDate = "2026-09-28";
const toDate = "2026-09-30";
const dates = [fromDate, "2026-09-29", toDate];
const args = { fromDate, toDate, viewerId: 1, viewerRole: "manager" as const };
type Response = { data: unknown; error?: undefined } | { error: ApiErrorShape; data?: undefined };
const failure = (status: number): Response => ({ error: { status, message: `HTTP ${status}`, data: null } });

function user(id: number, roleType: RoleTypeCode, reportsTo: number | null, changes: Partial<AdminUser> = {}): AdminUser {
  return {
    id, first_name: `Person ${id}`, last_name: "Test", email: `${id}@example.test`, emp_id: `EMP${id}`,
    role_id: id, project_id: 1, reports_to_id: reportsTo, first_login: false, is_active: true,
    last_working_day: null, created_at: "2026-01-01", updated_at: "2026-01-01",
    role: { id, title: roleType, roleType, sessionTimeoutMinutes: 30, features: ["user_management", "reports"] },
    ...changes,
  };
}

function record(userId: number, date = fromDate, changes: Partial<ManualDailyRecord> = {}): ManualDailyRecord {
  return {
    id: userId * 100 + Number(date.slice(-2)), userId, date, productionCount: 10, pvpCount: 6, foundationCount: 4,
    techIssuesDowntimeHours: "0", noInventoryIdleTimeHours: "0", leaveHours: "0", meetingEngagementHours: "1",
    meetingType: null, status: "pending", reviewedById: null, reviewedAt: null, rejectionReason: null,
    createdAt: date, updatedAt: date, ...changes,
  };
}

function harness({
  users = [user(1, "manager", null), user(2, "lead", 1), user(3, "employee", 2)],
  records = [record(2, fromDate, { status: "approved" }), record(3)],
  native = failure(404),
  range = { fromDate, toDate },
  override,
}: {
  users?: AdminUser[];
  records?: ManualDailyRecord[];
  native?: Response;
  range?: { fromDate: string; toDate: string };
  override?: (url: URL) => Response | undefined;
} = {}) {
  const calls: ApiRequestArgs[] = [];
  const query = async (request: ApiRequestArgs): Promise<Response> => {
    calls.push(request);
    assert.ok(!request.method || request.method === "GET", "loading must only read data");
    const url = new URL(request.url, "https://test.example");
    const replacement = override?.(url);
    if (replacement) return replacement;
    if (url.pathname === "/reports/manual/team-range") {
      assert.equal(url.searchParams.get("fromDate"), range.fromDate);
      assert.equal(url.searchParams.get("toDate"), range.toDate);
      assert.equal(url.searchParams.get("viewerId"), null);
      assert.equal(url.searchParams.get("viewerRole"), null);
      return native;
    }
    if (url.pathname === "/reports/manual/team-day") {
      assert.equal(url.searchParams.get("date"), range.fromDate);
      return native;
    }
    if (url.pathname === "/users") return { data: users };
    if (url.pathname === "/users/filter") {
      assert.deepEqual(url.searchParams.getAll("projectIds"), ["1"]);
      return { data: users };
    }
    if (url.pathname === "/manual-daily-records") {
      assert.equal(url.searchParams.get("fromDate"), range.fromDate);
      assert.equal(url.searchParams.get("toDate"), range.toDate);
      return { data: records };
    }
    if (url.pathname === "/reports/manual/reviews") {
      assert.equal(url.searchParams.get("fromDate"), range.fromDate);
      assert.equal(url.searchParams.get("toDate"), range.toDate);
      assert.equal(url.searchParams.get("status"), null, "all review statuses must remain visible");
      const page = Number(url.searchParams.get("page"));
      const pageSize = Number(url.searchParams.get("pageSize"));
      assert.ok(Number.isInteger(page) && page > 0);
      assert.equal(pageSize, 100);
      const data: PaginatedResult<ManualDailyRecord> = {
        items: records.slice((page - 1) * pageSize, page * pageSize),
        page, pageSize, total: records.length, totalPages: Math.ceil(records.length / pageSize),
      };
      return { data };
    }
    assert.fail(`Unexpected request: ${request.url}`);
  };
  return { query, calls };
}

test("prefers the native range endpoint and sends only the requested interval", async () => {
  const data = { fromDate, toDate, teams: [] };
  for (const viewerRole of ["manager", "lead"] as const) {
    const { query, calls } = harness({ native: { data } });
    const result = await loadManualTeamRange({ ...args, viewerRole }, query);
    assert.deepEqual(result.data, data);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.startsWith("/reports/manual/team-range?"));
  }
});

test("rejects invalid or reversed calendar intervals before making any request", async () => {
  const invalidRanges = [
    { fromDate: "2026-02-29", toDate: "2026-03-01" },
    { fromDate: "2026-04-30", toDate: "2026-04-31" },
    { fromDate: "2026-00-01", toDate },
    { fromDate, toDate: "2026-13-01" },
    { fromDate: "2026-09-00", toDate },
    { fromDate: "2026-9-28", toDate },
    { fromDate: "2026-09-28T00:00:00Z", toDate },
    { fromDate: "", toDate },
    { fromDate: toDate, toDate: fromDate },
  ];
  for (const range of invalidRanges) {
    const { query, calls } = harness({ range });
    const result = await loadManualTeamRange({ ...args, ...range }, query);
    assert.equal(result.error?.status, 422, JSON.stringify(range));
    assert.equal(result.data, undefined);
    assert.equal(calls.length, 0, JSON.stringify(range));
  }
});

test("accepts an inclusive single-day interval and real leap-day and year boundaries", async () => {
  for (const range of [
    { fromDate, toDate: fromDate },
    { fromDate: "2024-02-29", toDate: "2024-03-01" },
    { fromDate: "2025-12-31", toDate: "2026-01-01" },
  ]) {
    const data = { ...range, teams: [] };
    const { query, calls } = harness({ range, native: { data } });
    const result = await loadManualTeamRange({ ...args, ...range }, query);
    assert.deepEqual(result.data, data);
    assert.equal(calls.length, 1);
  }
});

test("permits compatibility only for a manager or lead receiving a native 404", async () => {
  for (const viewerRole of ["manager", "lead", "employee", "admin", "super_admin", null] as const) {
    for (const status of [0, 401, 403, 404, 422, 500]) {
      if ((viewerRole === "manager" || viewerRole === "lead") && status === 404) continue;
      const native = failure(status);
      const { query, calls } = harness({ native });
      const result = await loadManualTeamRange({ ...args, viewerRole }, query);
      assert.equal(result.error?.status, status);
      if (status !== 404) assert.deepEqual(result, native);
      assert.equal(result.data, undefined);
      assert.equal(calls.length, 1);
    }
  }
});

test("lead compatibility groups only their own record and direct coders across the selected range", async () => {
  const users = [user(1, "manager", null), user(2, "lead", 1), user(3, "employee", 2),
    user(4, "employee", 2, { is_active: false, last_working_day: "2026-09-29" }),
    user(5, "employee", 7), user(7, "lead", 1)];
  const records = [record(2, fromDate, { status: "approved" }), record(3, fromDate),
    record(3, "2026-09-29", { status: "approved" }), record(4, fromDate)];
  const { query, calls } = harness({ users, records, override: (url) => url.pathname === "/users" ? { data: [users[1]] } : undefined });
  const result = await loadManualTeamRange({ ...args, viewerId: 2, viewerRole: "lead" }, query);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.data?.teams.map((team) => [team.lead?.id, team.leadRecords.length, team.coders.map(({ user, records: entries }) => [user.id, entries.length])]),
    [[2, 1, [[3, 2], [4, 1]]]]);
  assert.ok(calls.some(({ url }) => url.startsWith("/users/filter?")));
  assert.ok(calls.some(({ url }) => url.startsWith("/manual-daily-records?")));
});

test("lead compatibility rejects out-of-team records and incomplete roster reads", async () => {
  const users = [user(2, "lead", 1), user(3, "employee", 2), user(4, "employee", 9)];
  for (const records of [[record(4)], [record(3, "2026-10-01")], [record(3), record(3, fromDate, { id: 999 })]]) {
    const result = await loadManualTeamRange({ ...args, viewerId: 2, viewerRole: "lead" }, harness({ users, records }).query);
    assert.equal(result.data, undefined);
    assert.ok(result.error);
  }
  const denied = await loadManualTeamRange({ ...args, viewerId: 2, viewerRole: "lead" },
    harness({ users, override: (url) => url.pathname === "/users/filter" ? failure(503) : undefined }).query);
  assert.equal(denied.error?.status, 503);
});

test("collects every page and every day while keeping lead records and coder records separate", async () => {
  const coders = Array.from({ length: 55 }, (_, index) => user(index + 10, "employee", index < 30 ? 2 : 3));
  const users = [user(1, "manager", null), user(2, "lead", 1), user(3, "lead", 1), ...coders,
    user(200, "employee", 3)];
  const records = [2, 3, ...coders.map(({ id }) => id)].flatMap((id) => dates.map((date, index) => record(id, date, {
    status: (["pending", "approved", "rejected"] as const)[index],
  })));
  const { query, calls } = harness({ users, records });
  const result = await loadManualTeamRange(args, query);
  assert.equal(result.error, undefined);
  assert.equal(result.data?.fromDate, fromDate);
  assert.equal(result.data?.toDate, toDate);
  const teams = result.data!.teams;
  assert.deepEqual(teams.map((team) => [team.lead?.id, team.leadRecords.length, team.coders.length]), [[2, 3, 30], [3, 3, 26]]);
  for (const team of teams) {
    assert.deepEqual(new Set(team.leadRecords.map(({ userId }) => userId)), new Set([team.lead!.id]));
    for (const coder of team.coders) {
      assert.equal(coder.records.length, coder.user.id === 200 ? 0 : 3);
      assert.ok(coder.records.every(({ userId }) => userId === coder.user.id));
      assert.ok(coder.user.id !== team.lead?.id);
    }
  }
  const rendered = teams.flatMap((team) => [...team.leadRecords, ...team.coders.flatMap(({ records }) => records)]);
  assert.equal(rendered.length, records.length);
  assert.deepEqual(new Set(rendered.map(({ id }) => id)), new Set(records.map(({ id }) => id)));
  assert.equal(calls.filter(({ url }) => url.startsWith("/reports/manual/reviews?")).length, 2);
});

test("includes eligible historical members and cuts each person's records off at their last working day", async () => {
  const users = [user(1, "manager", null),
    user(2, "lead", 1, { is_active: false, last_working_day: "2026-09-29" }),
    user(3, "employee", 2, { is_active: false, last_working_day: fromDate }),
    user(4, "employee", 2, { is_active: false, last_working_day: "2026-09-27" }),
    user(5, "employee", 2, { is_active: false }),
    user(6, "employee", 2, { is_active: false }),
    user(7, "employee", 2, { is_active: false, last_working_day: "2026-10-01" }),
    user(8, "employee", 2),
    user(9, "employee", 2, { last_working_day: fromDate }),
  ];
  const records = [2, 3, 4, 9].flatMap((id) => dates.map((date) => record(id, date)));
  records.push(record(5, toDate));
  const result = await loadManualTeamRange(args, harness({ users, records }).query);
  assert.equal(result.error, undefined);
  assert.equal(result.data?.teams.length, 1);
  const team = result.data!.teams[0];
  assert.deepEqual(team.leadRecords.map(({ date }) => date), [fromDate, "2026-09-29"]);
  assert.deepEqual(team.coders.map(({ user }) => user.id), [3, 5, 7, 8, 9]);
  assert.deepEqual(team.coders.map(({ user, records }) => [user.id, records.map(({ date }) => date)]), [
    [3, [fromDate]], [5, [toDate]], [7, []], [8, []], [9, [fromDate]],
  ]);
});

test("retains eligible coders beneath a lead whose last working day precedes the range", async () => {
  const users = [user(1, "manager", null),
    user(2, "lead", 1, { is_active: false, last_working_day: "2026-09-27" }),
    user(3, "employee", 2)];
  const result = await loadManualTeamRange(args, harness({ users, records: [record(2), record(3)] }).query);
  assert.equal(result.error, undefined);
  assert.equal(result.data?.teams[0].lead?.id, 2);
  assert.deepEqual(result.data?.teams[0].leadRecords, []);
  assert.equal(result.data?.teams[0].coders[0].records[0].userId, 3);
});

test("isolates other managers and projects and applies the sole-project-manager rule to unassigned coders", async () => {
  const users = [user(1, "manager", null), user(2, "lead", 1), user(3, "employee", 2),
    user(4, "employee", null), user(5, "manager", null, { project_id: 2 }),
    user(6, "lead", 5, { project_id: 2 }), user(7, "employee", 6, { project_id: 2 }),
    user(8, "employee", null, { project_id: 2 })];
  const soleManager = await loadManualTeamRange(args, harness({ users, records: [] }).query);
  assert.equal(soleManager.error, undefined);
  assert.deepEqual(soleManager.data?.teams.map((team) => [team.lead?.id ?? null, team.coders.map(({ user }) => user.id)]), [[2, [3]], [null, [4]]]);
  users.push(user(9, "manager", null));
  const sharedProject = await loadManualTeamRange(args, harness({ users, records: [] }).query);
  assert.equal(sharedProject.error, undefined);
  assert.deepEqual(sharedProject.data?.teams.map((team) => [team.lead?.id, team.coders.map(({ user }) => user.id)]), [[2, [3]]]);
});

test("propagates roster and later-page errors without returning partial teams", async () => {
  const users = [user(1, "manager", null), user(2, "lead", 1),
    ...Array.from({ length: 55 }, (_, index) => user(index + 10, "employee", 2))];
  const records = users.slice(2).flatMap(({ id }) => dates.map((date) => record(id, date)));
  for (const path of ["/users", "/reports/manual/reviews"]) {
    const expected = failure(503);
    const { query } = harness({ users, records, override: (url) => (
      url.pathname === path && (path === "/users" || url.searchParams.get("page") === "2") ? expected : undefined
    ) });
    const result = await loadManualTeamRange(args, query);
    assert.deepEqual(result, expected);
    assert.equal(result.data, undefined);
  }
});

test("does not infer an empty team from a missing viewer, wrong role, denied roster, or duplicate profile", async () => {
  const manager = user(1, "manager", null);
  const invalidRosters = [
    [user(2, "lead", 1), user(3, "employee", 2)],
    [user(1, "employee", null)],
    [user(1, "manager", null, { role: { ...manager.role, features: ["reports"] } })],
    [user(1, "manager", null, { role: { ...manager.role, featurePermissions: [{ codename: "user_management", canRead: false, canWrite: false }] } })],
    [manager, manager, user(2, "lead", 1)],
  ];
  for (const users of invalidRosters) {
    const result = await loadManualTeamRange(args, harness({ users, records: [] }).query);
    assert.ok(result.error);
    assert.equal(result.data, undefined);
  }
});

test("rejects malformed or non-array roster responses", async () => {
  for (const roster of [{ items: [] }, null, [user(1, "manager", null), { id: 3 }]]) {
    const result = await loadManualTeamRange(args, harness({ override: (url) => (
      url.pathname === "/users" ? { data: roster } : undefined
    ) }).query);
    assert.ok(result.error);
    assert.equal(result.data, undefined);
  }
});

test("rejects records missing a profile, outside the interval, or belonging to another manager", async () => {
  const users = [user(1, "manager", null), user(2, "lead", 1), user(3, "employee", 2),
    user(5, "manager", null), user(6, "lead", 5), user(7, "employee", 6)];
  for (const invalidRecord of [
    record(900), record(3, "2026-09-27"), record(3, "2026-10-01"),
    record(3, "2026-09-29T00:00:00Z"), record(7), record(1),
  ]) {
    const result = await loadManualTeamRange(args, harness({ users, records: [invalidRecord] }).query);
    assert.ok(result.error, JSON.stringify(invalidRecord));
    assert.equal(result.data, undefined);
  }
});

test("rejects duplicate record ids and duplicate user/date pairs but accepts the same user on different days", async () => {
  for (const records of [
    [record(3), record(3, toDate, { id: record(3).id })],
    [record(3), record(3, fromDate, { id: 999 })],
  ]) {
    const result = await loadManualTeamRange(args, harness({ records }).query);
    assert.ok(result.error);
    assert.equal(result.data, undefined);
  }
  const result = await loadManualTeamRange(args, harness({ records: dates.map((date) => record(3, date)) }).query);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.data?.teams[0].coders[0].records.map(({ date }) => date), dates);
});

test("rejects inconsistent pagination instead of exposing an incomplete range", async () => {
  const users = [user(1, "manager", null), user(2, "lead", 1),
    ...Array.from({ length: 55 }, (_, index) => user(index + 10, "employee", 2))];
  const records = users.slice(2).flatMap(({ id }) => dates.map((date) => record(id, date)));
  const pageTwo: PaginatedResult<ManualDailyRecord> = {
    items: records.slice(100), page: 2, pageSize: 100, total: records.length, totalPages: 2,
  };
  for (const malformed of [
    { ...pageTwo, total: records.length + 1 },
    { ...pageTwo, page: 1 },
    { ...pageTwo, items: pageTwo.items.slice(1) },
    { ...pageTwo, totalPages: 3 },
    { ...pageTwo, pageSize: 50 },
    { ...pageTwo, items: [records[0], ...pageTwo.items.slice(1)] },
  ]) {
    const result = await loadManualTeamRange(args, harness({ users, records, override: (url) => (
      url.pathname === "/reports/manual/reviews" && url.searchParams.get("page") === "2" ? { data: malformed } : undefined
    ) }).query);
    assert.ok(result.error);
    assert.equal(result.data, undefined);
  }
});

test("an empty range response retains every eligible team member with empty record arrays", async () => {
  const result = await loadManualTeamRange(args, harness({ records: [] }).query);
  assert.equal(result.error, undefined);
  assert.equal(result.data?.teams.length, 1);
  assert.deepEqual(result.data?.teams[0].leadRecords, []);
  assert.equal(result.data?.teams[0].coders.length, 1);
  assert.deepEqual(result.data?.teams[0].coders[0].records, []);
});

test("single-day range fallback agrees with the existing day loader and leaves its endpoint unchanged", async () => {
  const range = { fromDate, toDate: fromDate };
  const users = [user(1, "manager", null), user(2, "lead", 1), user(3, "employee", 2), user(4, "employee", 2)];
  const rangeHarness = harness({ range, users });
  const dayHarness = harness({ range, users });
  const rangeResult = await loadManualTeamRange({ ...args, ...range }, rangeHarness.query);
  const dayResult = await loadManualTeamDay({ date: fromDate, viewerId: args.viewerId, viewerRole: args.viewerRole }, dayHarness.query);
  assert.equal(rangeResult.error, undefined);
  assert.equal(dayResult.error, undefined);
  assert.ok(dayHarness.calls[0].url.startsWith("/reports/manual/team-day?"));
  assert.deepEqual({
    date: rangeResult.data!.fromDate,
    teams: rangeResult.data!.teams.map((team) => ({
      lead: team.lead,
      leadRecord: team.leadRecords[0] ?? null,
      coders: team.coders.map((coder) => ({ user: coder.user, record: coder.records[0] ?? null })),
    })),
  }, dayResult.data);
});
