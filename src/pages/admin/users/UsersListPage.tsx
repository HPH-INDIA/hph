import { SearchableMultiSelect } from "@/components/ui/SearchableMultiSelect";
import { useState } from "react";
import { Link } from "react-router-dom";

import { useDeactivateUserMutation, useListUsersQuery, type UserStatusFilter } from "@/api/usersApi";
import { type AdminUser } from "@/api/types";
import { useProjectOptionsQuery } from "@/api/projectsApi";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { useAuth } from "@/features/auth/useAuth";

const TABS: { key: UserStatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
];



function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function UsersListPage() {
  const { data: projects = [] } = useProjectOptionsQuery();
  const projectName = (id: number | null) => projects.find((p) => p.id === id)?.name ?? "—";
  const [statusTab, setStatusTab] = useState<UserStatusFilter>("all");
  const { data: fetchedUsers, isLoading, isError, refetch } = useListUsersQuery(statusTab);
  const availableUsers = fetchedUsers?.filter((user) => user.role.roleType !== "super_admin");
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const users = selectedIds === null ? availableUsers : availableUsers?.filter(user => selectedIds.includes(String(user.id)));
  const { canManageRoleType, canWriteFeature, canManageUserIdentity } = useAuth();
  const canWriteUsers = canWriteFeature("user_management");

  const [deactivateUser, { isLoading: isDeactivating }] = useDeactivateUserMutation();
  const [pendingDeactivate, setPendingDeactivate] = useState<AdminUser | null>(null);
  const [lastWorkingDay, setLastWorkingDay] = useState(localDateValue());
  const userNameById = new Map(availableUsers?.map((user) => [user.id, `${user.first_name} ${user.last_name}`]));

  const handleDeactivate = async () => {
    if (!pendingDeactivate || !lastWorkingDay) return;
    // onQueryStarted (usersApi.ts) already toasts the backend's message.
    try {
      await deactivateUser({ id: pendingDeactivate.id, lastWorkingDay }).unwrap();
      setPendingDeactivate(null);
    } catch {
      // The shared API notification keeps the dialog open and explains the failure.
    }
  };

  const openDeactivateDialog = (user: AdminUser) => {
    setLastWorkingDay(localDateValue());
    setPendingDeactivate(user);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-content-primary">Users</h1>
          <p className="text-sm text-content-muted">Everyone with an account in this system.</p>
        </div>
        {canWriteUsers && canManageUserIdentity && (
          <Link to="/admin/users/new">
            <Button>New user</Button>
          </Link>
        )}
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {setStatusTab(tab.key);setSelectedIds(null);}}
            className={`px-3 py-2 text-sm font-medium ${
              statusTab === tab.key
                ? "border-b-2 border-brand-600 text-brand-700"
                : "text-content-muted hover:text-content-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <SearchableMultiSelect label="Users" noun="users" value={selectedIds ?? (availableUsers ?? []).map(user => String(user.id))} onChange={setSelectedIds}
        options={(availableUsers ?? []).map(user => ({value:String(user.id),label:`${user.first_name} ${user.last_name}`}))} />
      {isLoading && <LoadingState label="Loading users…" />}
      {isError && <ErrorState message="Couldn't load users." onRetry={refetch} />}
      {!isLoading && !isError && users && users.length === 0 && <EmptyState title="No users in this view" />}

      {!isLoading && !isError && users && users.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Reports to</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last working day</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => {
                const canManage = canWriteUsers && canManageRoleType(user.role.roleType);
                return (
                  <tr key={user.id}>
                    <td className="px-4 py-3 text-content-primary">
                      <div className="flex items-center gap-2">
                        <span>
                          {user.first_name} {user.last_name}
                        </span>
                        {user.first_login && <Badge tone="warning">First login</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-content-primary">{user.role.title}</span>
                        <Badge tone="brand">{user.role.roleType}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-content-secondary">{projectName(user.project_id)}</td>
                    <td className="px-4 py-3 text-content-secondary">
                      {user.reports_to_id ? userNameById.get(user.reports_to_id) ?? "Unknown user" : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={user.is_active ? "success" : "neutral"}>
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-content-secondary">{user.last_working_day ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {canManage && (
                          <Link to={`/admin/users/${user.id}`}>
                            <Button variant="secondary">Edit</Button>
                          </Link>
                        )}
                        {user.is_active && canManage && (
                          <Button variant="danger" onClick={() => openDeactivateDialog(user)}>
                            Deactivate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={pendingDeactivate !== null}
        title="Deactivate this user?"
        description={`${pendingDeactivate?.first_name} ${pendingDeactivate?.last_name} will no longer be able to sign in.`}
        confirmLabel="Deactivate"
        variant="danger"
        isLoading={isDeactivating}
        confirmDisabled={!lastWorkingDay}
        onConfirm={handleDeactivate}
        onCancel={() => setPendingDeactivate(null)}
      >
        <label className="mt-4 flex flex-col gap-1.5 text-sm font-medium text-content-secondary">
          Last working day
          <input
            type="date"
            required
            value={lastWorkingDay}
            max={localDateValue()}
            onChange={(event) => setLastWorkingDay(event.target.value)}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-content-primary outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>
      </ConfirmDialog>
    </div>
  );
}
