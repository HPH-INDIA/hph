import type { ManagerCoderOption, ManagerDashboardQuery } from "@/api/types";
import { defaultLeadFilters, leadDashboardQuery, leadFilterError, type LeadFilters } from "./leadFilters";

export type ManagerView = "teams" | "coders" | "leads" | "both";
export interface ManagerFilters extends LeadFilters {
  leadId: "ALL" | number;
  cohortId: "ALL" | number;
  program: "ALL" | "PVP" | "FOUNDATION";
}
export function defaultManagerFilters(today: string): ManagerFilters {
  return { ...defaultLeadFilters(today), leadId: "ALL", cohortId: "ALL", program: "ALL" };
}
export function managerDashboardQuery(filters: ManagerFilters, today: string): ManagerDashboardQuery {
  return { ...leadDashboardQuery(filters, today),
    ...(filters.leadId !== "ALL" ? { leadId: filters.leadId } : {}),
    ...(filters.cohortId !== "ALL" ? { cohortId: filters.cohortId } : {}),
    ...(filters.program !== "ALL" ? { program: filters.program } : {}),
  };
}
export function matchingCoders(options: ManagerCoderOption[], filters: ManagerFilters) {
  return options.filter((coder) => (filters.leadId === "ALL" || coder.leadId === filters.leadId)
    && (filters.cohortId === "ALL" || coder.cohortId === filters.cohortId));
}
export function changeManagerScope(filters: ManagerFilters, change: Partial<ManagerFilters>, options: ManagerCoderOption[]): ManagerFilters {
  const next = { ...filters, ...change };
  if (next.coderId !== "ALL" && !matchingCoders(options, next).some((coder) => coder.userId === next.coderId)) next.coderId = "ALL";
  return next;
}
export function managerFilterError(filters: ManagerFilters, today: string) {
  return leadFilterError(filters, today)
    ?? ([filters.leadId, filters.cohortId].some((id) => id !== "ALL" && (!Number.isInteger(id) || id < 1)) ? "Choose a valid lead and cohort." : null);
}
