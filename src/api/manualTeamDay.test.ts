// Run: node_modules/.bin/esbuild src/api/manualTeamDay.test.ts --bundle --platform=node --format=esm --outfile=/tmp/hph-manual-team-tests.mjs && node --test /tmp/hph-manual-team-tests.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import type { ApiErrorShape } from "./apiError";
import type { ApiRequestArgs } from "./baseQuery";
import { loadManualTeamDay } from "./manualTeamDay";
import type { AdminUser, ManualDailyRecord, ManualTeamDay, PaginatedResult, RoleTypeCode } from "./types";

const date = "2026-09-28";
const args = { date, viewerId: 1, viewerRole: "manager" as const };
type Response = { data: unknown } | { error: ApiErrorShape };
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

function record(userId: number, changes: Partial<ManualDailyRecord> = {}): ManualDailyRecord {
  return {
    id: userId, userId, date, productionCount: 10, pvpCount: 6, foundationCount: 4,
    techIssuesDowntimeHours: "0", noInventoryIdleTimeHours: "0", leaveHours: "0", meetingEngagementHours: "1",
    meetingType: null, status: "pending", reviewedById: null, reviewedAt: null, rejectionReason: null,
    createdAt: date, updatedAt: date, ...changes,
  };
}

function harness({
  users = [user(1, "manager", null), user(2, "lead", 1), user(3, "employee", 2)],
  records = [record(2, { status: "approved" }), record(3)],
  native = failure(404),
  override,
}: {
  users?: AdminUser[];
  records?: ManualDailyRecord[];
  native?: Response;
  override?: (url: URL) => Response | undefined;
} = {}) {
  const calls: ApiRequestArgs[] = [];
  const query = async (request: ApiRequestArgs): Promise<Response> => {
    calls.push(request);
    assert.ok(!request.method || request.method === "GET", "fallback must only read data");
    const url = new URL(request.url, "https://test.example");
    const replacement = override?.(url);
    if (replacement) return replacement;
    if (url.pathname === "/reports/manual/team-day") return native;
    if (url.pathname === "/users") return { data: users };
    if (url.pathname === "/reports/manual/reviews") {
      assert.equal(url.searchParams.get("fromDate"), date);
      assert.equal(url.searchParams.get("toDate"), date);
      assert.equal(url.searchParams.get("status"), null, "all statuses must remain visible");
      const page = Number(url.searchParams.get("page"));
      const pageSize = Number(url.searchParams.get("pageSize"));
      assert.ok(page > 0 && pageSize > 0 && pageSize <= 100);
      const data: PaginatedResult<ManualDailyRecord> = {
        items: records.slice((page - 1) * pageSize, page * pageSize),
        page, pageSize, total: records.length, totalPages: Math.ceil(records.length / pageSize),
      };
      return { data };
    }
    assert.fail(`Unexpected fallback request: ${request.url}`);
  };
  return { query, calls };
}

test("uses the native day endpoint without legacy reads when available", async () => {
  const data: ManualTeamDay = { date, teams: [] };
  const { query, calls } = harness({ native: { data } });
  assert.deepEqual((await loadManualTeamDay(args, query)).data, data);
  assert.equal(calls.length, 1);
});

test("never falls back for leads or for authorization/server/network failures", async () => {
  for (const viewerRole of ["lead", "manager"] as const) {
    for (const status of [0, 401, 403, 404, 500]) {
      if (viewerRole === "manager" && status === 404) continue;
      const { query, calls } = harness({ native: failure(status) });
      const result = await loadManualTeamDay({ ...args, viewerRole }, query);
      assert.equal(result.error?.status, status);
      assert.equal(calls.length, 1);
    }
  }
});

test("groups separate lead rows and every coder across multiple review pages", async () => {
  const coders = Array.from({ length: 125 }, (_, i) => user(i + 10, "employee", i < 70 ? 2 : 3));
  const records = [record(2, { status: "approved" }), record(3), ...coders.map((coder) => record(coder.id))];
  const users = [user(1, "manager", null), user(2, "lead", 1), user(3, "lead", 1), ...coders];
  const { query, calls } = harness({ users, records });
  const result = await loadManualTeamDay(args, query);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.data?.teams.map((team) => [team.lead?.id, team.leadRecord?.userId, team.coders.length]), [[2, 2, 70], [3, 3, 55]]);
  const renderedIds = result.data!.teams.flatMap((team) => team.coders.map((coder) => coder.record!.id));
  assert.equal(new Set(renderedIds).size, 125);
  assert.ok(renderedIds.includes(134));
  assert.equal(calls.filter(({ url }) => url.startsWith("/reports/manual/reviews?")).length, 2);
});

test("keeps historical members through their last working day and no-date leavers with records", async () => {
  const users = [user(1, "manager", null), user(2, "lead", 1),
    user(3, "employee", 2, { is_active: false, last_working_day: date }),
    user(4, "employee", 2, { is_active: false, last_working_day: "2026-09-27" }),
    user(5, "employee", 2, { is_active: false }), user(6, "employee", 2, { is_active: false }),
    user(7, "lead", 1, { is_active: false, last_working_day: date }),
    user(8, "employee", 7, { is_active: false, last_working_day: date }),
  ];
  const { query } = harness({ users, records: [record(5)] });
  const result = await loadManualTeamDay(args, query);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.data?.teams.map((team) => [team.lead?.id, team.coders.map(({ user }) => user.id)]), [[2, [3, 5]], [7, [8]]]);
  assert.equal(result.data?.teams[0].coders[0].record, null);
});

test("excludes other managers' teams and only includes unassigned coders for a sole project manager", async () => {
  const users = [user(1, "manager", null), user(2, "lead", 1), user(3, "employee", 2),
    user(4, "employee", null), user(5, "manager", null, { project_id: 2 }),
    user(6, "lead", 5, { project_id: 2 }), user(7, "employee", 6, { project_id: 2 }),
    user(8, "employee", null, { project_id: 2 }),
  ];
  const soleManager = await loadManualTeamDay(args, harness({ users, records: [] }).query);
  assert.deepEqual(soleManager.data?.teams.map((team) => [team.lead?.id ?? null, team.coders.map(({ user }) => user.id)]), [[2, [3]], [null, [4]]]);
  users.push(user(9, "manager", null));
  const sharedProject = await loadManualTeamDay(args, harness({ users, records: [] }).query);
  assert.deepEqual(sharedProject.data?.teams.map((team) => team.lead?.id), [2]);
});

test("fails visibly if a later page or profile request fails instead of returning partial teams", async () => {
  const users = [user(1, "manager", null), user(2, "lead", 1), ...Array.from({ length: 110 }, (_, i) => user(i + 10, "employee", 2))];
  for (const path of ["/users", "/reports/manual/reviews"]) {
    const { query } = harness({ users, records: users.slice(2).map((coder) => record(coder.id)), override: (url) => (
      url.pathname === path && (path === "/users" || url.searchParams.get("page") === "2") ? failure(503) : undefined
    ) });
    const result = await loadManualTeamDay(args, query);
    assert.equal(result.error?.status, 503);
    assert.equal(result.data, undefined);
  }
});

test("does not treat a self-only or explicitly denied user directory as an empty team", async () => {
  for (const role of [
    { ...user(1, "manager", null).role, features: ["reports"] },
    { ...user(1, "manager", null).role, featurePermissions: [{ codename: "user_management", canRead: false, canWrite: false }] },
  ]) {
    const { query } = harness({ users: [user(1, "manager", null, { role })], records: [] });
    const result = await loadManualTeamDay(args, query);
    assert.ok(result.error);
    assert.equal(result.data, undefined);
  }
});

test("rejects unresolvable, wrong-day, or out-of-team rows rather than leaking or dropping them", async () => {
  for (const invalidRecord of [record(900), record(3, { date: "2026-09-29" }), record(7)]) {
    const users = [user(1, "manager", null), user(2, "lead", 1), user(3, "employee", 2),
      user(5, "manager", null), user(6, "lead", 5), user(7, "employee", 6)];
    const result = await loadManualTeamDay(args, harness({ users, records: [invalidRecord] }).query);
    assert.ok(result.error);
    assert.equal(result.data, undefined);
  }
});

test("an empty review page still shows eligible teams as not submitted", async () => {
  const result = await loadManualTeamDay(args, harness({ records: [] }).query);
  assert.equal(result.error, undefined);
  assert.equal(result.data?.teams[0].leadRecord, null);
  assert.equal(result.data?.teams[0].coders[0].record, null);
});
