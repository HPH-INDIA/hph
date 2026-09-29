import { useState, type FocusEvent, type ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { HphLogo } from "@/components/brand/HphLogo";
import { useAuth } from "@/features/auth/useAuth";
import { useLogoutHandler } from "@/features/auth/useLogoutHandler";

import { NAV_ITEMS } from "./navConfig";
import { SessionFooter } from "./SessionFooter";

type IconName = (typeof NAV_ITEMS)[number]["icon"] | "logout" | "pin" | "unpin";

function SidebarIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    reports: <><path d="M5 20V10" /><path d="M12 20V4" /><path d="M19 20v-7" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    team: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3.5 20c.4-4 2.3-6 5.5-6s5.1 2 5.5 6" /><path d="M14 15c3.6-.8 6 1 6.5 4" /></>,
    users: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21c.5-5 3-7.5 7.5-7.5s7 2.5 7.5 7.5" /></>,
    roles: <><path d="M12 3 4.5 6v5c0 4.8 2.9 8.2 7.5 10 4.6-1.8 7.5-5.2 7.5-10V6L12 3Z" /><path d="m9 12 2 2 4-4" /></>,
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
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const isExpanded = isPinned || isHovered || hasFocus;

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => hasFeature(item.feature) && (!item.roleTypes || item.roleTypes.includes(user?.role.roleType ?? "employee")),
  );

  const handleSidebarBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHasFocus(false);
  };

  const navLinks = (expanded: boolean) => visibleNavItems.map((item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === "/"}
      title={expanded ? undefined : item.label}
      aria-label={item.label}
      className={({ isActive }) =>
        `relative flex h-11 items-center rounded-lg text-sm font-medium transition-colors ${expanded ? "gap-3 px-3.5" : "justify-center px-0"} ${
          isActive
            ? "bg-white text-hph-blue shadow-sm before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r-full before:bg-hph-magenta"
            : "text-white/70 hover:bg-white/10 hover:text-white"
        }`
      }
    >
      <SidebarIcon name={item.icon} />
      <span className={`whitespace-nowrap transition-all duration-200 ${expanded ? "max-w-48 opacity-100" : "max-w-0 overflow-hidden opacity-0"}`}>
        {item.label}
      </span>
    </NavLink>
  ));

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-transparent lg:flex-row">
      <div className="shrink-0 bg-hph-blue text-white lg:hidden">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <HphLogo />
          <span>
            <span className="block text-base font-semibold tracking-tight">HPH Inhouse</span>
            <span className="block text-[11px] uppercase tracking-[0.2em] text-white/55">Operations</span>
          </span>
        </div>
        <nav aria-label="Primary navigation" className="flex gap-1 overflow-x-auto px-3 py-2">
          {navLinks(true)}
        </nav>
      </div>

      <div className="relative z-40 hidden h-screen w-[76px] shrink-0 lg:block">
        <aside
          aria-label="Application sidebar"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onFocusCapture={() => setHasFocus(true)}
          onBlurCapture={handleSidebarBlur}
          className={`absolute inset-y-0 left-0 flex flex-col overflow-hidden bg-hph-blue text-white shadow-popover transition-[width] duration-200 ease-out ${isExpanded ? "w-72" : "w-[76px]"}`}
        >
          <div className={`relative flex h-[88px] shrink-0 items-center border-b border-white/10 ${isExpanded ? "gap-3 px-4" : "justify-center px-3"}`}>
            <HphLogo />
            <span className={`min-w-0 whitespace-nowrap transition-all duration-200 ${isExpanded ? "max-w-40 opacity-100" : "max-w-0 overflow-hidden opacity-0"}`}>
              <span className="block text-base font-semibold tracking-tight">HPH Inhouse</span>
              <span className="block text-[11px] uppercase tracking-[0.2em] text-white/55">Operations</span>
            </span>
            <button
              type="button"
              onClick={() => setIsPinned((current) => !current)}
              className={`ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/60 transition hover:bg-white/10 hover:text-white ${isExpanded ? "opacity-100" : "pointer-events-none w-0 opacity-0"}`}
              aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar open"}
              title={isPinned ? "Unpin sidebar" : "Pin sidebar open"}
            >
              <SidebarIcon name={isPinned ? "unpin" : "pin"} />
            </button>
          </div>

          <nav aria-label="Primary navigation" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-5">
            {visibleNavItems.length === 0 ? (
              <p className={`px-2 py-2 text-xs text-white/55 ${isExpanded ? "block" : "hidden"}`}>No sections available for your role.</p>
            ) : navLinks(isExpanded)}
          </nav>

          <div className="border-t border-white/10 px-3 py-3">
          <NavLink
            to="/account"
            title={isExpanded ? undefined : `${user?.firstName} ${user?.lastName}`}
            aria-label="Account settings"
            className={`flex h-12 items-center rounded-lg transition-colors hover:bg-white/10 ${isExpanded ? "gap-3 px-2" : "justify-center"}`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white ring-1 ring-white/20">
              {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
            </span>
            <span className={`min-w-0 whitespace-nowrap transition-all duration-200 ${isExpanded ? "max-w-44 opacity-100" : "max-w-0 overflow-hidden opacity-0"}`}>
              <span className="block truncate text-sm font-medium text-white">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="block truncate text-xs text-white/55">{user?.role.title}</span>
            </span>
          </NavLink>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            title={isExpanded ? undefined : "Log out"}
            aria-label="Log out"
            className={`mt-2 flex h-10 w-full items-center rounded-lg border border-white/15 text-sm font-medium text-white/70 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white disabled:opacity-60 ${isExpanded ? "gap-3 px-3" : "justify-center px-0"}`}
          >
            <SidebarIcon name="logout" />
            <span className={`whitespace-nowrap transition-all duration-200 ${isExpanded ? "max-w-36 opacity-100" : "max-w-0 overflow-hidden opacity-0"}`}>{isLoggingOut ? "Logging out…" : "Log out"}</span>
          </button>
        </div>
        </aside>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <div className="animate-[page-enter_240ms_ease-out]"><Outlet /></div>
        </main>

        <SessionFooter />
      </div>
    </div>
  );
}
