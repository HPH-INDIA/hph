// Run: node_modules/.bin/esbuild src/pages/reports/manualReportSummary.test.ts --bundle --platform=node --format=esm --outfile=/tmp/hph-manual-report-summary-tests.mjs && node --test /tmp/hph-manual-report-summary-tests.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import type { ManualDailyRecord, ManualTeamRangeGroup, ManualTeamUser } from "../../api/types";
import {
  formatManualMeetings,
  isReportDate,
  isReportWindow,
  manualTeamProduction,
  monthReportWindow,
  reportToday,
  shiftReportDay,
  shiftReportMonth,
  sumManualHours,
  sumManualProduction,
} from "./manualReportSummary";

function person(id: number): ManualTeamUser {
  return { id, firstName: `Person ${id}`, lastName: "Test", empId: `EMP${id}` };
}

function record(userId: number, changes: Partial<ManualDailyRecord> = {}): ManualDailyRecord {
  return {
    id: userId, userId, date: "2026-09-28", productionCount: 0, pvpCount: 0, foundationCount: 0,
    techIssuesDowntimeHours: "0", noInventoryIdleTimeHours: "0", leaveHours: "0", meetingEngagementHours: "0",
    meetingType: null, status: "pending", reviewedById: null, reviewedAt: null, rejectionReason: null,
    createdAt: "2026-09-28", updatedAt: "2026-09-28", ...changes,
  };
}

test("production sums use the stored production count independently of PVP and foundation counts", () => {
  const records = [
    record(1, { productionCount: 100, pvpCount: 2, foundationCount: 3 }),
    record(1, { id: 2, date: "2026-09-29", productionCount: 27, pvpCount: 11, foundationCount: 5 }),
    record(2, { productionCount: 0, pvpCount: 4, foundationCount: 6 }),
  ];
  assert.deepEqual(sumManualProduction(records), { production: 127, pvp: 17, foundation: 14 });
  assert.deepEqual(sumManualProduction([]), { production: 0, pvp: 0, foundation: 0 });
});

test("global and per-team totals keep lead QA production separate from coder production", () => {
  const teams: ManualTeamRangeGroup[] = [
    {
      lead: person(1),
      leadRecords: [
        record(1, { productionCount: 700, pvpCount: 20, foundationCount: 30 }),
        record(1, { id: 11, date: "2026-09-29", productionCount: 80, pvpCount: 4, foundationCount: 5 }),
      ],
      coders: [
        { user: person(2), records: [record(2, { productionCount: 12, pvpCount: 2, foundationCount: 3 })] },
        { user: person(3), records: [record(3, { productionCount: 8, pvpCount: 1, foundationCount: 4 })] },
        { user: person(4), records: [] },
      ],
    },
    {
      lead: person(5),
      leadRecords: [record(5, { productionCount: 90, pvpCount: 6, foundationCount: 7 })],
      coders: [{ user: person(6), records: [
        record(6, { productionCount: 13, pvpCount: 5, foundationCount: 1 }),
        record(6, { id: 61, date: "2026-09-29", productionCount: 7, pvpCount: 3, foundationCount: 2 }),
      ] }],
    },
    {
      lead: null,
      leadRecords: [],
      coders: [{ user: person(7), records: [record(7, { productionCount: 9, pvpCount: 4, foundationCount: 5 })] }],
    },
  ];
  assert.deepEqual(manualTeamProduction([teams[0]]), {
    qa: { production: 780, pvp: 24, foundation: 35 },
    coders: { production: 20, pvp: 3, foundation: 7 },
  });
  assert.deepEqual(manualTeamProduction([teams[1]]), {
    qa: { production: 90, pvp: 6, foundation: 7 },
    coders: { production: 20, pvp: 8, foundation: 3 },
  });
  assert.deepEqual(manualTeamProduction([teams[2]]), {
    qa: { production: 0, pvp: 0, foundation: 0 },
    coders: { production: 9, pvp: 4, foundation: 5 },
  });
  assert.deepEqual(manualTeamProduction(teams), {
    qa: { production: 870, pvp: 30, foundation: 42 },
    coders: { production: 49, pvp: 15, foundation: 15 },
  });
});

test("an empty roster and members with no records have zero QA and coder totals", () => {
  const expected = {
    qa: { production: 0, pvp: 0, foundation: 0 },
    coders: { production: 0, pvp: 0, foundation: 0 },
  };
  assert.deepEqual(manualTeamProduction([]), expected);
  assert.deepEqual(manualTeamProduction([{ lead: person(1), leadRecords: [], coders: [{ user: person(2), records: [] }] }]), expected);
});

test("approved chart totals exclude pending and rejected coder and QA records across teams", () => {
  const teams: ManualTeamRangeGroup[] = [
    {
      lead: person(1),
      leadRecords: [
        record(1, { status: "approved", productionCount: 11, pvpCount: 9, foundationCount: 2 }),
        record(1, { id: 12, status: "pending", productionCount: 100, pvpCount: 90, foundationCount: 10 }),
      ],
      coders: [{ user: person(2), records: [
        record(2, { status: "approved", productionCount: 13, pvpCount: 10, foundationCount: 3 }),
        record(2, { id: 22, status: "rejected", productionCount: 200, pvpCount: 180, foundationCount: 20 }),
      ] }],
    },
    {
      lead: person(3),
      leadRecords: [record(3, { status: "approved", productionCount: 7, pvpCount: 5, foundationCount: 2 })],
      coders: [{ user: person(4), records: [record(4, { status: "approved", productionCount: 5, pvpCount: 4, foundationCount: 1 })] }],
    },
  ];
  assert.deepEqual(manualTeamProduction(teams, "approved"), {
    qa: { production: 18, pvp: 14, foundation: 4 },
    coders: { production: 18, pvp: 14, foundation: 4 },
  });
  assert.deepEqual(manualTeamProduction([teams[0]], "approved"), {
    qa: { production: 11, pvp: 9, foundation: 2 },
    coders: { production: 13, pvp: 10, foundation: 3 },
  });
});

test("production totals include each submitted record across all review statuses and dates", () => {
  const records = (["pending", "approved", "rejected"] as const).map((status, index) => record(1, {
    id: index + 1, date: `2026-09-${28 + index}`, status,
    productionCount: (index + 1) * 10, pvpCount: index + 1, foundationCount: 1,
  }));
  assert.deepEqual(sumManualProduction(records), { production: 60, pvp: 6, foundation: 3 });
});

test("hour totals preserve hundredth-hour precision and keep the four hour fields independent", () => {
  const records = [
    record(1, { techIssuesDowntimeHours: "0.10", noInventoryIdleTimeHours: "1.05", leaveHours: "0.25", meetingEngagementHours: "1.10" }),
    record(1, { id: 2, date: "2026-09-29", techIssuesDowntimeHours: "0.20", noInventoryIdleTimeHours: "2.20", leaveHours: "0.75", meetingEngagementHours: "2.20" }),
    record(2, { techIssuesDowntimeHours: "0.35", noInventoryIdleTimeHours: "0.05", leaveHours: "1.50", meetingEngagementHours: "0.05" }),
  ];
  assert.equal(sumManualHours(records, "techIssuesDowntimeHours"), "0.65");
  assert.equal(sumManualHours(records, "noInventoryIdleTimeHours"), "3.30");
  assert.equal(sumManualHours(records, "leaveHours"), "2.50");
  assert.equal(sumManualHours(records, "meetingEngagementHours"), "3.35");
  assert.equal(sumManualHours([], "meetingEngagementHours"), "0.00");
  assert.equal(sumManualHours(Array.from({ length: 1000 }, (_, id) => record(id, { meetingEngagementHours: "0.01" })), "meetingEngagementHours"), "10.00");
});

test("meeting breakdowns include every meeting and retain legacy untyped hours", () => {
  const records = [
    record(1, { meetingEngagementHours: "0.75", meetings: [
      { type: "Huddle", hours: "0.25" }, { type: "Training", hours: "0.50" },
    ] }),
    record(1, { id: 2, meetingEngagementHours: "0.25", meetings: [{ type: "Huddle", hours: "0.25" }] }),
    record(2, { meetingEngagementHours: "0.50", meetingType: null }),
  ];
  assert.equal(formatManualMeetings(records), "Huddle (1h), Training (1h), Unspecified (1h)");
  assert.equal(formatManualMeetings([record(1, { meetingEngagementHours: "0.75", meetings: [
    { type: "Huddle", hours: "0.25" }, { type: "Huddle", hours: "0.50" },
  ] })]), "Huddle (0h), Huddle (1h)");
  assert.equal(formatManualMeetings([record(1)]), "—");
});

test("report dates require exact ISO calendar dates and reject year zero and invalid leap days", () => {
  for (const value of ["2026-01-01", "2026-12-31", "2024-02-29", "2000-02-29", "0001-01-01"]) {
    assert.equal(isReportDate(value), true, value);
  }
  for (const value of ["", "2026-2-01", "2026-02-1", "2026-02-29", "1900-02-29", "2026-04-31",
    "2026-00-01", "2026-13-01", "2026-09-00", "0000-01-01", "2026-09-30T00:00:00Z", " 2026-09-30"]) {
    assert.equal(isReportDate(value), false, value);
  }
});

test("report windows allow inclusive same-day and cross-year ranges and reject malformed or reversed dates", () => {
  assert.equal(isReportWindow({ fromDate: "2026-09-30", toDate: "2026-09-30" }), true);
  assert.equal(isReportWindow({ fromDate: "2025-12-31", toDate: "2026-01-01" }), true);
  assert.equal(isReportWindow({ fromDate: "2024-02-29", toDate: "2024-03-01" }), true);
  assert.equal(isReportWindow({ fromDate: "2026-10-01", toDate: "2026-09-30" }), false);
  assert.equal(isReportWindow({ fromDate: "2026-02-29", toDate: "2026-03-01" }), false);
  assert.equal(isReportWindow({ fromDate: "2026-02-01", toDate: "2026-02-30" }), false);
  assert.equal(isReportWindow({ fromDate: "", toDate: "2026-09-30" }), false);
});

test("day navigation handles leap days and month and year boundaries in both directions", () => {
  assert.equal(shiftReportDay("2024-02-28", 1), "2024-02-29");
  assert.equal(shiftReportDay("2024-02-29", 1), "2024-03-01");
  assert.equal(shiftReportDay("2024-03-01", -1), "2024-02-29");
  assert.equal(shiftReportDay("2026-02-28", 1), "2026-03-01");
  assert.equal(shiftReportDay("2026-04-30", 1), "2026-05-01");
  assert.equal(shiftReportDay("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftReportDay("2027-01-01", -1), "2026-12-31");
  assert.equal(shiftReportDay("2026-09-30", 0), "2026-09-30");
});

test("month navigation crosses years and supports offsets in either direction", () => {
  assert.equal(shiftReportMonth("2026-12", 1), "2027-01");
  assert.equal(shiftReportMonth("2026-01", -1), "2025-12");
  assert.equal(shiftReportMonth("2024-02", 1), "2024-03");
  assert.equal(shiftReportMonth("2026-11", 3), "2027-02");
  assert.equal(shiftReportMonth("2026-02", -3), "2025-11");
  assert.equal(shiftReportMonth("2026-09", 0), "2026-09");
});

test("month windows contain the exact first and last days including leap and century rules", () => {
  for (const [month, lastDay] of [
    ["2024-02", "29"], ["2026-02", "28"], ["2000-02", "29"], ["1900-02", "28"],
    ["2026-04", "30"], ["2026-01", "31"], ["2026-12", "31"],
  ]) {
    const window = monthReportWindow(month);
    assert.deepEqual(window, { fromDate: `${month}-01`, toDate: `${month}-${lastDay}` });
    assert.equal(isReportWindow(window), true);
  }
});

test("today uses the user's local calendar date and pads one-digit month and day values", (context) => {
  context.mock.method(Date.prototype, "getFullYear", () => 2027);
  context.mock.method(Date.prototype, "getMonth", () => 0);
  context.mock.method(Date.prototype, "getDate", () => 2);
  context.mock.method(Date.prototype, "getUTCFullYear", () => 2026);
  context.mock.method(Date.prototype, "getUTCMonth", () => 11);
  context.mock.method(Date.prototype, "getUTCDate", () => 31);
  assert.equal(reportToday(), "2027-01-02");
});
