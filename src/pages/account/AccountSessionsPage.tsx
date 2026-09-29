import { useState } from "react";
import { Form, Formik } from "formik";
import * as Yup from "yup";

import { getErrorMessage, getFieldErrors, toFormikErrors } from "@/api/apiError";
import { useSetPasswordMutation } from "@/api/authApi";
import { useMyActiveSessionsQuery, useRevokeSessionMutation } from "@/api/sessionsApi";
import type { SetPasswordPayload } from "@/api/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { useAuth } from "@/features/auth/useAuth";
import { useLogoutHandler } from "@/features/auth/useLogoutHandler";
import { formatDateTime } from "@/lib/format";

const initialPasswordValues: SetPasswordPayload = {
  current_password: "",
  new_password: "",
  new_password_confirm: "",
};

const passwordValidationSchema = Yup.object({
  current_password: Yup.string().required("Current password is required"),
  new_password: Yup.string().required("New password is required").min(8, "Must be at least 8 characters"),
  new_password_confirm: Yup.string()
    .required("Please confirm your new password")
    .oneOf([Yup.ref("new_password")], "Passwords do not match"),
});

export function AccountSessionsPage() {
  const { user } = useAuth();
  const { data: sessions, isLoading, isError, refetch } = useMyActiveSessionsQuery();
  const [revokeSession, { isLoading: isRevoking }] = useRevokeSessionMutation();
  const [setPassword] = useSetPasswordMutation();
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const { handleLogout, isLoggingOut } = useLogoutHandler();

  // onQueryStarted (sessionsApi.ts) already toasts the backend's message.
  const handleRevoke = (sessionId: number) => {
    void revokeSession(sessionId);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-content-primary">Profile &amp; security</h1>
        <p className="text-sm text-content-muted">Manage your profile, password, and active sessions.</p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="font-semibold text-content-primary">Profile</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-content-muted">Name</dt>
              <dd className="mt-1 font-medium text-content-primary">{user?.firstName} {user?.lastName}</dd>
            </div>
            <div>
              <dt className="text-content-muted">Email</dt>
              <dd className="mt-1 font-medium text-content-primary">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-content-muted">Employee ID</dt>
              <dd className="mt-1 font-medium text-content-primary">{user?.empId}</dd>
            </div>
            <div>
              <dt className="text-content-muted">Role</dt>
              <dd className="mt-1 font-medium text-content-primary">{user?.role.title}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="font-semibold text-content-primary">Reset password</h2>
          <p className="mt-1 text-sm text-content-muted">Enter your current password before choosing a new one.</p>
          <Formik
            initialValues={initialPasswordValues}
            validationSchema={passwordValidationSchema}
            onSubmit={async (values, helpers) => {
              setPasswordError(null);
              const result = await setPassword(values);
              if ("error" in result) {
                const fieldErrors = getFieldErrors(result.error);
                if (fieldErrors) helpers.setErrors(toFormikErrors(fieldErrors));
                setPasswordError(getErrorMessage(result.error));
                helpers.setSubmitting(false);
                return;
              }
              helpers.resetForm();
            }}
          >
            {({ isSubmitting }) => (
              <Form className="mt-5 flex flex-col gap-4">
                <TextField label="Current password" name="current_password" type="password" autoComplete="current-password" />
                <TextField label="New password" name="new_password" type="password" autoComplete="new-password" />
                <TextField label="Confirm new password" name="new_password_confirm" type="password" autoComplete="new-password" />
                {passwordError && <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{passwordError}</p>}
                <Button type="submit" isLoading={isSubmitting} className="self-start">Reset password</Button>
              </Form>
            )}
          </Formik>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-semibold text-content-primary">Active sessions</h2>
          <p className="text-sm text-content-muted">Devices and browsers currently signed in to your account.</p>
        </div>
        {isLoading && <LoadingState label="Loading sessions…" />}
        {isError && <ErrorState message="Couldn't load your sessions." onRetry={refetch} />}
        {!isLoading && !isError && sessions && sessions.length === 0 && (
          <EmptyState title="No active sessions" />
        )}

        {!isLoading && !isError && sessions && sessions.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Device</th>
                  <th className="px-4 py-3 font-medium">IP address</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Last seen</th>
                  <th className="px-4 py-3 font-medium">Expires</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="max-w-xs truncate text-content-primary">
                          {session.userAgent ?? "Unknown device"}
                        </span>
                        {session.isCurrent && <Badge tone="brand">This device</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-content-secondary">{session.ipAddress ?? "—"}</td>
                    <td className="px-4 py-3 text-content-secondary">{formatDateTime(session.createdAt)}</td>
                    <td className="px-4 py-3 text-content-secondary">{formatDateTime(session.lastSeenAt)}</td>
                    <td className="px-4 py-3 text-content-secondary">{formatDateTime(session.expiresAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {session.isCurrent ? (
                        <Button variant="secondary" onClick={handleLogout} isLoading={isLoggingOut}>
                          Log out
                        </Button>
                      ) : (
                        <Button variant="danger" onClick={() => handleRevoke(session.id)} isLoading={isRevoking}>
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
