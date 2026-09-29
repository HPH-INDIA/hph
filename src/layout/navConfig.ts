import type { RoleTypeCode } from "@/api/types";

export interface NavItem {
  label: string;
  to: string;
  feature: string;
  icon: "dashboard" | "reports" | "clock" | "team" | "users" | "roles";
  roleTypes?: RoleTypeCode[];
}

// Kairon and Manual reporting/input live together under Reports.
//
// Dashboard is one role-aware destination: managers/admins see team metrics,
// while leads/employees see their personal performance. Kairon and Manual
// reporting/input live together under the Reports feature.
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/", feature: "dashboard", icon: "dashboard" },
  { label: "Reports", to: "/reports", feature: "reports", icon: "reports" },
  { label: "Login Hours", to: "/login-hours", feature: "login_hours", icon: "clock" },
  { label: "Team", to: "/team", feature: "user_management", icon: "team", roleTypes: ["manager"] },
  { label: "Users", to: "/admin/users", feature: "user_management", icon: "users" },
  { label: "Roles & Features", to: "/admin/roles", feature: "role_management", icon: "roles" },
];
