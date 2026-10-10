import { ProjectMetricTheme } from "@/features/metricTheme/ProjectMetricTheme";
import { MetricThemeSettings } from "@/features/metricTheme/MetricThemeSettings";
import { canConfigureMetricTheme } from "@/features/metricTheme/metricTheme";
import { type ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { HphLogo } from "@/components/brand/HphLogo";
import { useAuth } from "@/features/auth/useAuth";
import { useLogoutHandler } from "@/features/auth/useLogoutHandler";

import { NAV_ITEMS } from "./navConfig";
import { SessionFooter } from "./SessionFooter";

type IconName = (typeof NAV_ITEMS)[number]["icon"] | "logout" | "pin" | "unpin" | "help";

function SidebarIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    reports: <><path d="M5 20V10" /><path d="M12 20V4" /><path d="M19 20v-7" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    team: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3.5 20c.4-4 2.3-6 5.5-6s5.1 2 5.5 6" /><path d="M14 15c3.6-.8 6 1 6.5 4" /></>,
    users: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21c.5-5 3-7.5 7.5-7.5s7 2.5 7.5 7.5" /></>,
    roles: <><path d="M12 3 4.5 6v5c0 4.8 2.9 8.2 7.5 10 4.6-1.8 7.5-5.2 7.5-10V6L12 3Z" /><path d="m9 12 2 2 4-4" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4" /><path d="M12 17h.01" /></>,
    logout: <><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5" /><path d="M14 8l4 4-4 4" /><path d="M8 12h10" /></>,
    pin: <><path d="m15 4 5 5-3 1-4 4-1 5-2-2-4 4-1-1 4-4-2-2 5-1 4-4 1-3Z" /></>,
    unpin: <><path d="m15 4 5 5-3 1-4 4-1 5-2-2-4 4-1-1 4-4-2-2 5-1 4-4 1-3Z" /><path d="M3 3l18 18" /></>,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

export function AppShell() {
  const { user, hasFeature } = useAuth();
  const { handleLogout, isLoggingOut } = useLogoutHandler();
  const items = NAV_ITEMS.filter((item) => hasFeature(item.feature) && (!item.roleTypes || item.roleTypes.includes(user?.role.roleType ?? "employee")));
  return <div className="live-redesign app-frame">
    <ProjectMetricTheme />
    <a href="#workspace-main" className="skip-content">Skip to content</a>
    <aside className="app-navigation" aria-label="Application sidebar">
      <NavLink to="/" className="app-brand"><HphLogo /><span><strong>HPH</strong><small>INHOUSE OPERATIONS</small></span></NavLink>
      <p className="nav-section-label">Workspace</p>
      <nav aria-label="Primary navigation" className="app-nav-links">
        {items.map((item) => <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => `app-nav-link ${isActive ? "is-active" : ""}`}><SidebarIcon name={item.icon} /><span>{item.label}</span></NavLink>)}
        {hasFeature("reports") && <NavLink to="/reports/chart-holds" className={({ isActive }) => `app-nav-link ${isActive ? "is-active" : ""}`}><SidebarIcon name="reports" /><span>Chart holds</span></NavLink>}
        <NavLink to="/help" className={({ isActive }) => `app-nav-link ${isActive ? "is-active" : ""}`}><SidebarIcon name="help" /><span>Help & guides</span></NavLink>
        <NavLink to="/account" className={({ isActive }) => `app-nav-link mobile-account ${isActive ? "is-active" : ""}`}><SidebarIcon name="users" /><span>Account</span></NavLink>
        <button className="app-nav-link mobile-account" type="button" disabled={isLoggingOut} onClick={handleLogout}><SidebarIcon name="logout" /><span>{isLoggingOut ? "Signing out…" : "Sign out"}</span></button>
      </nav>
      <div className="app-nav-bottom">
        {user && canConfigureMetricTheme(user) && <div className="sidebar-theme"><MetricThemeSettings key={user.id} userId={user.id} /></div>}
        <NavLink to="/account" className="app-profile"><span className="app-avatar">{user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}</span><span><strong>{user?.firstName} {user?.lastName}</strong><small>{user?.role.title}</small></span></NavLink>
        <button className="app-nav-link w-full" type="button" disabled={isLoggingOut} onClick={handleLogout}><SidebarIcon name="logout" /><span>{isLoggingOut ? "Signing out…" : "Sign out"}</span></button>
      </div>
    </aside>
    <div className="app-workspace">
      <main id="workspace-main" tabIndex={-1} className="app-main"><Outlet /></main>
      <div id="action-screen-root" className="app-main" style={{ display: "none" }} />
      <SessionFooter />
    </div>
  </div>;
}
