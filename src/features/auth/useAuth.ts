import { useAppSelector } from "@/app/hooks";
import type { RoleTypeCode } from "@/api/types";

import { canManageRoleType } from "./hierarchy";

// Derived helpers used by nav/guards **for UX only** — the backend is
// always the real authority (require_feature/require_role run on every
// request regardless of what the UI shows or hides).
export function useAuth() {
  const user = useAppSelector((state) => state.auth.user);
  const status = useAppSelector((state) => state.auth.status);

  const hasFeature = (codename: string, access: "read" | "write" = "read") => {
    const permissions = user?.role.featurePermissions;
    if (permissions) {
      const permission = permissions.find((item) => item.codename === codename);
      if (!permission) return false;
      return access === "write" ? permission.canWrite : permission.canRead || permission.canWrite;
    }

    // Compatibility with sessions created before featurePermissions shipped:
    // the former boolean grant represented full access.
    return Boolean(user?.role.features.includes(codename));
  };

  return {
    user,
    isLoading: status === "idle" || status === "loading",
    isAuthenticated: status === "authenticated" && user !== null,
    hasFeature,
    canReadFeature: (codename: string) => hasFeature(codename, "read"),
    canWriteFeature: (codename: string) => hasFeature(codename, "write"),
    canManageUserIdentity: user?.role.roleType === "super_admin" || user?.role.roleType === "admin",
    hasRoleType: (code: RoleTypeCode) => user?.role.roleType === code,
    canManageRoleType: (targetRoleType: RoleTypeCode) => canManageRoleType(user?.role.roleType, targetRoleType),
  };
}
