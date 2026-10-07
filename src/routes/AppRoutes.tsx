import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/layout/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { SetPasswordPage } from "@/pages/SetPasswordPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { AccountSessionsPage } from "@/pages/account/AccountSessionsPage";
import { ProjectsPage } from "@/pages/admin/projects/ProjectsPage";
import { UsersListPage } from "@/pages/admin/users/UsersListPage";
import { UserFormPage } from "@/pages/admin/users/UserFormPage";
import { RolesListPage } from "@/pages/admin/roles/RolesListPage";
import { FeaturesListPage } from "@/pages/admin/features/FeaturesListPage";
import { FeatureEditorDrawerPage, RoleEditorDrawerPage } from "@/pages/admin/AdminEditorDrawers";
import { ReportsPage } from "@/pages/reports/ReportsPage";
import { TeamManagementPage } from "@/pages/team/TeamManagementPage";
import { LoginHoursPage } from "@/pages/loginHours/LoginHoursPage";

import { RequireAuth } from "./RequireAuth";
import { RequireFirstLoginComplete } from "./RequireFirstLoginComplete";
import { RequireFeature } from "./RequireFeature";
import { RequireRoleType } from "./RequireRoleType";
import { useAuth } from "@/features/auth/useAuth";
import { NAV_ITEMS } from "@/layout/navConfig";

function HomePage() {
  const { user, hasFeature } = useAuth();
  if (!hasFeature("dashboard")) {
    const destination = NAV_ITEMS.find((item) => item.to !== "/" && hasFeature(item.feature)
      && (!item.roleTypes || item.roleTypes.includes(user?.role.roleType ?? "employee")));
    if (destination) return <Navigate to={destination.to} replace />;
  }
  return <RequireFeature codename="dashboard"><DashboardPage /></RequireFeature>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        {/* Deliberately NOT wrapped in RequireFirstLoginComplete — it's that guard's own destination. */}
        <Route path="/set-password" element={<SetPasswordPage />} />

        <Route element={<RequireFirstLoginComplete />}>
          <Route element={<AppShell />}>
            <Route
              path="/"
              element={
                <HomePage />
              }
            />
            <Route path="/admin/projects" element={<RequireFeature codename="project_management"><ProjectsPage /></RequireFeature>} />
            <Route path="/account" element={<AccountSessionsPage />} />
            <Route path="/input-data" element={<Navigate to="/reports" replace />} />

            {/* Personal Reports view (Reports doc §3) — its own `reports`
                feature, granted to every starter role at launch but kept
                distinct from "dashboard" per the doc's §2. */}
            <Route
              path="/reports"
              element={
                <RequireFeature codename="reports">
                  <ReportsPage />
                </RequireFeature>
              }
            />

            <Route path="/coding" element={<Navigate to="/" replace />} />

            <Route path="/kairon/*" element={<Navigate to="/reports" replace />} />
            <Route path="/manual-daily-records" element={<Navigate to="/reports" replace />} />

            <Route
              path="/login-hours"
              element={
                <RequireFeature codename="login_hours">
                  <LoginHoursPage />
                </RequireFeature>
              }
            />

            <Route
              path="/team"
              element={
                <RequireFeature codename="user_management">
                  <RequireRoleType code="manager">
                    <TeamManagementPage />
                  </RequireRoleType>
                </RequireFeature>
              }
            />

            <Route
              path="/admin/users"
              element={
                <RequireFeature codename="user_management">
                  <UsersListPage />
                </RequireFeature>
              }
            />
            <Route
              path="/admin/users/new"
              element={
                <RequireFeature codename="user_management" access="write">
                  <UserFormPage />
                </RequireFeature>
              }
            />
            <Route
              path="/admin/users/:id"
              element={
                <RequireFeature codename="user_management" access="write">
                  <UserFormPage />
                </RequireFeature>
              }
            />

            <Route
              path="/admin/roles"
              element={
                <RequireFeature codename="role_management">
                  <RolesListPage />
                </RequireFeature>
              }
            />
            <Route
              path="/admin/roles/new"
              element={
                <RequireFeature codename="role_management" access="write">
                  <RoleEditorDrawerPage />
                </RequireFeature>
              }
            />
            <Route
              path="/admin/roles/:id"
              element={
                <RequireFeature codename="role_management" access="write">
                  <RoleEditorDrawerPage />
                </RequireFeature>
              }
            />

            <Route
              path="/admin/features"
              element={
                <RequireFeature codename="role_management">
                  <FeaturesListPage />
                </RequireFeature>
              }
            />
            <Route
              path="/admin/features/new"
              element={
                <RequireFeature codename="role_management" access="write">
                  <RequireRoleType code="super_admin">
                    <FeatureEditorDrawerPage />
                  </RequireRoleType>
                </RequireFeature>
              }
            />
            <Route
              path="/admin/features/:id"
              element={
                <RequireFeature codename="role_management" access="write">
                  <RequireRoleType code="super_admin">
                    <FeatureEditorDrawerPage />
                  </RequireRoleType>
                </RequireFeature>
              }
            />

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
