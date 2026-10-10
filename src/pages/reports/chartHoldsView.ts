import type { KaironHoldQuery, KaironHoldSummary, KaironHoldView, KaironHoldSort } from "@/api/types";

import { holdAgeGroups } from "./chartHoldAge";

export const holdSortColumns: { key: KaironHoldSort; label: string }[] = [
  { key: "id", label: "Chart" }, { key: "user", label: "User" }, { key: "program", label: "Program / level" },
  { key: "created", label: "Created" }, { key: "practice", label: "Practice" }, { key: "lastAction", label: "Last action" },
  { key: "age", label: "Age (days)" }, { key: "tat", label: "TAT (days)" },
];

export type HoldRole = "employee" | "lead" | "manager";
export type HoldSource = "dashboard" | "kairon";
export const holdFocus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2";

export function holdViews(role: HoldRole, summary?: KaironHoldSummary) {
  if (role === "employee") return [{ value: "all" as const, label: "My holds", description: "Charts assigned to you", count: summary?.total }];
  const views = [
    { value: "coders" as const, label: role === "manager" ? "Leads holds" : "Coder holds", description: role === "manager" ? "Coders reporting to your leads" : "Your assigned coders", count: summary?.coderCount },
    { value: "leads" as const, label: role === "manager" ? "QA holds" : "My QA holds", description: role === "manager" ? "Leads’ own QA charts" : "Your own QA charts", count: summary?.leadCount },
  ];
  return role === "manager" ? [{ value: "all" as const, label: "Total holds", description: "All lead teams and QA", count: summary?.total }, ...views] : views;
}

function positiveId(value: string | null) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

export function readHoldSearch(params: URLSearchParams, role: HoldRole): KaironHoldQuery {
  const view = holdViews(role).find((option) => option.value === params.get("view"))?.value ?? holdViews(role)[0].value;
  const lead = params.get("leadId");
  const withoutPractice = params.get("withoutPractice") === "true";
  const pageSize = Number(params.get("pageSize"));
  return {
    view,
    ageBucket: holdAgeGroups.find((group) => group.key === params.get("ageBucket"))?.key,
    sortBy: holdSortColumns.find((column) => column.key === params.get("sortBy"))?.key ?? "created",
    sortDirection: params.get("sortDirection") === "asc" ? "asc" : "desc",
    createdFrom: params.get("createdFrom") || undefined,
    createdTo: params.get("createdTo") || undefined,
    userId: role === "employee" ? undefined : positiveId(params.get("userId")),
    leadId: role === "manager" && view !== "leads" && (lead === "unassigned" || positiveId(lead)) ? lead! : undefined,
    practice: withoutPractice ? undefined : params.get("practice") || undefined,
    withoutPractice: withoutPractice || undefined,
    page: positiveId(params.get("page")) ?? 1,
    pageSize: [25, 50, 100].includes(pageSize) ? pageSize : 25,
  };
}

export function holdSearch(query: KaironHoldQuery, source: HoldSource) {
  const params = new URLSearchParams();
  if (source === "kairon") params.set("source", source);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === false || value === "" || (key === "page" && value === 1) || (key === "pageSize" && value === 25)) continue;
    params.set(key, String(value));
  }
  return params;
}

export function updateHoldFilters(query: KaironHoldQuery, patch: Partial<KaironHoldQuery>): KaironHoldQuery {
  const next = { ...query, ...patch, page: 1 };
  if ("view" in patch && patch.view !== query.view) {
    next.userId = undefined;
    next.leadId = undefined;
  } else if ("leadId" in patch && patch.leadId !== query.leadId) {
    next.userId = undefined;
  }
  return next;
}

export function holdDateError(query: KaironHoldQuery) {
  for (const value of [query.createdFrom, query.createdTo]) {
    if (!value) continue;
    const date = new Date(`${value}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return "Enter valid creation dates.";
  }
  return query.createdFrom && query.createdTo && query.createdFrom > query.createdTo
    ? "Created to must be on or after created from." : undefined;
}

export function holdLink(view: KaironHoldView, source: HoldSource) {
  return `/reports/chart-holds?${holdSearch({ view }, source)}`;
}
