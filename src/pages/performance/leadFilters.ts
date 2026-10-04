import type { LeadDashboardQuery } from "@/api/types";

export type LeadDateMode = "from_start" | "day" | "month" | "year" | "range";
export interface LeadFilters {
  dateMode: LeadDateMode;
  day: string;
  month: string;
  year: number;
  rangeStart: string;
  rangeEnd: string;
  coderId: "ALL" | number;
}

export function localDayValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function defaultLeadFilters(today: string): LeadFilters {
  return { dateMode: "month", day: today, month: today.slice(0, 7), year: Number(today.slice(0, 4)), rangeStart: `${today.slice(0, 7)}-01`, rangeEnd: today, coderId: "ALL" };
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function leadFilterError(filters: LeadFilters, today: string) {
  const validPastDate = (value: string) => validDate(value) && value >= "2000-01-01" && value <= today;
  if (!["from_start", "day", "month", "year", "range"].includes(filters.dateMode)) return "Choose a reporting period.";
  if (filters.dateMode === "day" && !validPastDate(filters.day)) return "Choose a valid day on or before today.";
  if (filters.dateMode === "month" && (!/^\d{4}-\d{2}$/.test(filters.month) || !validPastDate(`${filters.month}-01`))) return "Choose a valid month on or before this month.";
  if (filters.dateMode === "year" && (!Number.isInteger(filters.year) || filters.year < 2000 || filters.year > Number(today.slice(0, 4)))) return "Choose a year from 2000 through the current year.";
  if (filters.dateMode === "range") {
    if (!validPastDate(filters.rangeStart) || !validPastDate(filters.rangeEnd)) return "Choose valid start and end dates on or before today.";
    if (filters.rangeStart > filters.rangeEnd) return "The start date must be on or before the end date.";
  }
  if (filters.coderId !== "ALL" && (!Number.isInteger(filters.coderId) || filters.coderId < 1)) return "Choose a coder from your team.";
  return null;
}

export function leadDashboardQuery(filters: LeadFilters, today: string): LeadDashboardQuery {
  const query: LeadDashboardQuery = {};
  if (filters.dateMode === "day") query.date = filters.day;
  if (filters.dateMode === "month") query.month = filters.month;
  if (filters.dateMode === "year") query.year = filters.year;
  if (filters.dateMode === "range") { query.from = filters.rangeStart; query.to = filters.rangeEnd; }
  if (filters.dateMode === "from_start") {
    const year = Number(today.slice(0, 4));
    query.from = `${Number(today.slice(5, 7)) >= 4 ? year : year - 1}-04-01`;
    query.to = today;
  }
  if (filters.coderId !== "ALL") query.coderId = filters.coderId;
  return query;
}

export function dateRangeLabel(from: string, to: string) {
  const format = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return from === to ? format(from) : `${format(from)} – ${format(to)}`;
}

export function leadPeriodLabel(filters: LeadFilters, today: string) {
  if (filters.dateMode === "month") return new Date(`${filters.month}-01T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  if (filters.dateMode === "year") return String(filters.year);
  const query = leadDashboardQuery(filters, today);
  return dateRangeLabel(query.date ?? query.from!, query.date ?? query.to!);
}

export function loadLeadFilters(key: string, today: string): LeadFilters {
  const defaults = defaultLeadFilters(today);
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) ?? "null");
    const filters = { ...defaults, ...stored, coderId: "ALL" as const };
    return leadFilterError(filters, today) ? defaults : filters;
  } catch { return defaults; }
}

export function saveLeadFilters(key: string, filters: LeadFilters) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ ...filters, coderId: undefined }));
  } catch { /* Period selection still works when browser storage is unavailable. */ }
}
