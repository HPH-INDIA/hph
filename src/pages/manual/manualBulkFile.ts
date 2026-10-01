import type { AdminUser, ManualBulkUploadRowError, ManualImportRow } from "@/api/types";

export const MANUAL_MTD_HEADERS = [
  "Date",
  "Coder",
  "Production count today",
  "Tech Issues/Downtime (in hrs)",
  "No Inventory/Idle Time (in hrs)",
  "Leave (L) (in hrs)",
  "Meeting/Huddles/Employee Engagement activities (in hrs)",
  "Holiday (H) (in hrs)",
] as const;

export interface ManualBulkFileResult {
  rows: ManualImportRow[];
  rowErrors: ManualBulkUploadRowError[];
  fileErrors: string[];
  sheetName: string | null;
  minDate: string | null;
  maxDate: string | null;
  skippedAfterLastWorkingDay: number;
}

function normalizeHeader(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeName(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function nameTokens(value: unknown) {
  return new Set(normalizeName(value).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean));
}

function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function parseDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return isoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  let match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) return isoDate(Number(match[3]), Number(match[1]), Number(match[2]));
  return null;
}

function readNumber(value: unknown, label: string, options: { integer?: boolean; max?: number } = {}) {
  const raw = String(value ?? "").trim();
  const number = raw === "" ? 0 : Number(raw);
  if (!Number.isFinite(number) || number < 0) return { error: `${label} must be a non-negative number` };
  if (options.integer && !Number.isInteger(number)) return { error: `${label} must be a whole number` };
  if (options.max !== undefined && number > options.max) return { error: `${label} cannot exceed ${options.max}` };
  return { value: number };
}

export async function parseManualBulkFile(
  file: File,
  users: AdminUser[],
  contents?: ArrayBuffer,
): Promise<ManualBulkFileResult> {
  const empty: ManualBulkFileResult = {
    rows: [], rowErrors: [], fileErrors: [], sheetName: null, minDate: null, maxDate: null,
    skippedAfterLastWorkingDay: 0,
  };
  try {
    const XLSX = await import("@e965/xlsx");
    const workbook = XLSX.read(contents ?? (await file.arrayBuffer()), { type: "array", cellDates: true, dense: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { ...empty, fileErrors: ["The workbook does not contain a worksheet."] };
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1, raw: true, defval: "", blankrows: false,
    });
    if (matrix.length < 2) return { ...empty, sheetName, fileErrors: ["The first worksheet has no data rows."] };

    const headers = matrix[0].map(normalizeHeader);
    const indexes = new Map(headers.map((header, index) => [header, index]));
    const missing = MANUAL_MTD_HEADERS.filter((header) => !indexes.has(normalizeHeader(header)));
    if (missing.length > 0) {
      return { ...empty, sheetName, fileErrors: [`Missing required column(s): ${missing.join(", ")}.`] };
    }

    const matchesByName = new Map<string, AdminUser[]>();
    const flexibleCandidates: { user: AdminUser; tokens: string[] }[] = [];
    for (const user of users) {
      if (!["lead", "employee"].includes(user.role.roleType)) continue;
      const fullName = `${user.first_name} ${user.last_name}`;
      const name = normalizeName(fullName);
      matchesByName.set(name, [...(matchesByName.get(name) ?? []), user]);
      const tokens = [...nameTokens(fullName)];
      if (tokens.length >= 2) flexibleCandidates.push({ user, tokens });
    }

    // Exact names are already indexed; resolve each other name once per workbook.
    const matchesForName = (rawName: string) => {
      const name = normalizeName(rawName);
      const cached = matchesByName.get(name);
      if (cached) return cached;
      const suppliedTokens = nameTokens(rawName);
      const matches = flexibleCandidates
        .filter(({ tokens }) => tokens.every((token) => suppliedTokens.has(token)))
        .map(({ user }) => user);
      matchesByName.set(name, matches);
      return matches;
    };

    const at = (values: unknown[], header: (typeof MANUAL_MTD_HEADERS)[number]) =>
      values[indexes.get(normalizeHeader(header)) as number];
    const rows: ManualImportRow[] = [];
    const rowErrors: ManualBulkUploadRowError[] = [];
    const seen = new Set<string>();
    let skippedAfterLastWorkingDay = 0;

    matrix.slice(1).forEach((values, offset) => {
      const rowNumber = offset + 2;
      const rawName = String(at(values, "Coder") ?? "").trim();
      const date = parseDate(at(values, "Date"));
      const errors: string[] = [];
      if (!rawName) errors.push("Coder name is required");
      const matches = matchesForName(rawName);
      if (rawName && matches.length === 0) errors.push(`No user matches coder name "${rawName}"`);
      if (matches.length > 1) errors.push(`Coder name "${rawName}" matches multiple users`);
      if (!date) errors.push("Date is not recognized");
      const user = matches.length === 1 ? matches[0] : null;
      if (user && !user.is_active && user.last_working_day && date && date > user.last_working_day) {
        skippedAfterLastWorkingDay += 1;
        return;
      }
      if (user && !user.is_active && !user.last_working_day) {
        errors.push(`${rawName} is inactive and has no recorded last working day`);
      }

      const production = readNumber(at(values, "Production count today"), "Production count", { integer: true });
      const downtime = readNumber(at(values, "Tech Issues/Downtime (in hrs)"), "Downtime", { max: 10 });
      const idle = readNumber(at(values, "No Inventory/Idle Time (in hrs)"), "Idle time", { max: 10 });
      const leave = readNumber(at(values, "Leave (L) (in hrs)"), "Leave", { max: 10 });
      const meeting = readNumber(at(values, "Meeting/Huddles/Employee Engagement activities (in hrs)"), "Meeting time", { max: 10 });
      const holiday = readNumber(at(values, "Holiday (H) (in hrs)"), "Holiday", { max: 10 });
      for (const parsed of [production, downtime, idle, leave, meeting, holiday]) if (parsed.error) errors.push(parsed.error);
      if (holiday.value && holiday.value !== 0) errors.push("Holiday must be 0; holiday hours are not imported");

      if (user && date) {
        const key = `${user.id}|${date}`;
        if (seen.has(key)) errors.push(`Duplicate row for ${rawName} on ${date}`);
        seen.add(key);
      }
      if (errors.length > 0 || !user || !date) {
        rowErrors.push({ row: rowNumber, name: rawName || undefined, date: date ?? undefined, message: errors.join("; ") });
        return;
      }
      rows.push({
        userId: user.id,
        date,
        productionCount: production.value as number,
        techIssuesDowntimeHours: downtime.value as number,
        noInventoryIdleTimeHours: idle.value as number,
        leaveHours: leave.value as number,
        meetingEngagementHours: meeting.value as number,
      });
    });

    const dates = rows.map((row) => row.date).sort();
    return {
      rows,
      rowErrors,
      fileErrors: [],
      sheetName,
      minDate: dates[0] ?? null,
      maxDate: dates.at(-1) ?? null,
      skippedAfterLastWorkingDay,
    };
  } catch {
    return { ...empty, fileErrors: ["This workbook could not be read. Upload a valid XLSX file."] };
  }
}
