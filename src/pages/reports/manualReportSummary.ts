import { displayNumber } from "@/utils/displayNumber";
import type { ManualDailyRecord, ManualTeamRangeGroup } from "@/api/types";

export interface ManualReportWindow {
  fromDate: string;
  toDate: string;
}

export function reportToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isReportDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isReportWindow(window: ManualReportWindow) {
  return isReportDate(window.fromDate) && isReportDate(window.toDate) && window.fromDate <= window.toDate;
}

export function shiftReportDay(value: string, offset: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function shiftReportMonth(value: string, offset: number) {
  const date = new Date(`${value}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export function monthReportWindow(month: string): ManualReportWindow {
  return { fromDate: `${month}-01`, toDate: shiftReportDay(`${shiftReportMonth(month, 1)}-01`, -1) };
}

export function sumManualProduction(records: ManualDailyRecord[]) {
  return records.reduce((total, record) => ({
    production: total.production + record.productionCount,
    pvp: total.pvp + record.pvpCount,
    foundation: total.foundation + record.foundationCount,
  }), { production: 0, pvp: 0, foundation: 0 });
}

export function manualTeamProduction(teams: ManualTeamRangeGroup[], status?: ManualDailyRecord["status"]) {
  const included = (records: ManualDailyRecord[]) => status ? records.filter((record) => record.status === status) : records;
  return {
    coders: sumManualProduction(teams.flatMap((team) => team.coders.flatMap((coder) => included(coder.records)))),
    qa: sumManualProduction(teams.flatMap((team) => included(team.leadRecords))),
  };
}

type HoursField = "techIssuesDowntimeHours" | "noInventoryIdleTimeHours" | "leaveHours" | "meetingEngagementHours";

export function sumManualHours(records: ManualDailyRecord[], field: HoursField) {
  return (records.reduce((total, record) => total + Math.round(Number(record[field]) * 100), 0) / 100).toFixed(2);
}

export function formatManualMeetings(records: ManualDailyRecord[]) {
  if (records.length === 1) {
    const record = records[0];
    const meetings = record.meetings?.length
      ? record.meetings
      : Number(record.meetingEngagementHours) > 0
        ? [{ type: record.meetingType, hours: record.meetingEngagementHours }]
        : [];
    return meetings.map((meeting) => `${meeting.type ?? "Unspecified"} (${displayNumber(meeting.hours)}h)`).join(", ") || "—";
  }
  const byType = new Map<string, number>();
  for (const record of records) {
    const meetings = record.meetings?.length
      ? record.meetings
      : Number(record.meetingEngagementHours) > 0
        ? [{ type: record.meetingType, hours: record.meetingEngagementHours }]
        : [];
    for (const meeting of meetings) {
      const type = meeting.type ?? "Unspecified";
      byType.set(type, (byType.get(type) ?? 0) + Math.round(Number(meeting.hours) * 100));
    }
  }
  return [...byType].map(([type, hundredths]) => `${type} (${displayNumber(hundredths / 100)}h)`).join(", ") || "—";
}
