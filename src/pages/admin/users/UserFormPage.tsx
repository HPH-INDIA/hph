import { Form, Formik } from "formik";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import * as Yup from "yup";

import {
  useCreateUserMutation,
  useGetUserQuery,
  useListUsersQuery,
  useResendTemporaryPasswordMutation,
  useUpdateUserMutation,
} from "@/api/usersApi";
import { useListRolesQuery, useListRoleTypesQuery } from "@/api/rolesApi";
import { getFieldErrors, toFormikErrors } from "@/api/apiError";
import {
  PROJECT_FORBIDDEN_ROLE_TYPES,
  PROJECT_REQUIRED_ROLE_TYPES,
  type RoleTypeCode,
  type UserCreatePayload,
} from "@/api/types";
import { useProjectOptionsQuery } from "@/api/projectsApi";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/FormField";
import { ErrorState, LoadingState } from "@/components/ui/StateViews";
import { useAuth } from "@/features/auth/useAuth";
import { useToast } from "@/features/ui/useToast";

interface UserFormValues {
  email: string;
  first_name: string;
  last_name: string;
  emp_id: string;
  role_id: string;
  project_id: string;
  reports_to_id: string;
}

const DEV_ONLY_TEMP_PASSWORD_NOTE =
  "DEV-ONLY: the temporary password isn't emailed yet — it's only visible in the backend server log. " +
  "Replace this once the mailing system ships.";

export function UserFormPage() {
  const { id } = useParams<{ id: string }>();
  const userId = id ? Number(id) : undefined;
  const isEditMode = userId !== undefined;

  const {
    data: user,
    isLoading: isLoadingUser,
    isError: isUserError,
    refetch: refetchUser,
  } = useGetUserQuery(userId as number, { skip: !isEditMode });
  const { data: projects = [], isLoading: isLoadingProjects, isError: isProjectsError, refetch: refetchProjects } = useProjectOptionsQuery();
  const { data: roles, isLoading: isLoadingRoles } = useListRolesQuery();
  const { data: roleTypes, isLoading: isLoadingRoleTypes } = useListRoleTypesQuery();
  const { data: activeUsers, isLoading: isLoadingActiveUsers } = useListUsersQuery("active");

  const [createUser] = useCreateUserMutation();
  const [updateUser] = useUpdateUserMutation();
  const [resendTemporaryPassword, { isLoading: isResending }] = useResendTemporaryPasswordMutation();
  const navigate = useNavigate();
  const { notifyInfo } = useToast();
  const { canManageRoleType, canManageUserIdentity, user: currentUser } = useAuth();

  // Creating an account requires identity fields reserved for administrators.
  if (!isEditMode && !canManageUserIdentity) return <Navigate to="/admin/users" replace />;

  const isLoading = isLoadingProjects || isLoadingRoles || isLoadingRoleTypes || isLoadingActiveUsers || (isEditMode && isLoadingUser);
  if (isLoading) return <LoadingState label="Loading…" />;
  if (isProjectsError) return <ErrorState message="Couldn’t load projects." onRetry={refetchProjects} />;
  if (isEditMode && isUserError) return <ErrorState message="Couldn't load this user." onRetry={refetchUser} />;
  if (isEditMode && !user) return <ErrorState message="That user could not be found." />;

  const roleTypeCodeByRoleTypeId = new Map((roleTypes ?? []).map((rt) => [rt.id, rt.code]));
  const roleTypeCodeByRoleId = new Map(
    (roles ?? []).map((role) => [role.id, roleTypeCodeByRoleTypeId.get(role.role_type_id)]),
  );

  // §2's project rule, client-mirrored purely for instant feedback — the
  // backend (validate_project_for_role) is what actually enforces it.
  const projectRuleFor = (roleId: string): "required" | "forbidden" | "unknown" => {
    const code = roleTypeCodeByRoleId.get(Number(roleId));
    if (!code) return "unknown";
    if (PROJECT_REQUIRED_ROLE_TYPES.has(code)) return "required";
    if (PROJECT_FORBIDDEN_ROLE_TYPES.has(code)) return "forbidden";
    return "unknown";
  };

  // Only roles whose role type the current actor may create/manage, per
  // hierarchy.ts — a UX filter; the backend re-checks regardless.
  const assignableRoles = (roles ?? []).filter((role) => {
    const code = roleTypeCodeByRoleTypeId.get(role.role_type_id);
    return role.is_active && code !== undefined && canManageRoleType(code as RoleTypeCode);
  });

  const initialValues: UserFormValues = {
    email: canManageUserIdentity ? user?.email ?? "" : "",
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    emp_id: canManageUserIdentity ? user?.emp_id ?? "" : "",
    role_id: user ? String(user.role_id) : "",
    project_id: user?.project_id != null ? String(user.project_id) : "",
    reports_to_id: user?.reports_to_id != null ? String(user.reports_to_id) : "",
  };

  const validationSchema = Yup.object({
    email: canManageUserIdentity ? Yup.string().required("Email is required").email("Enter a valid email address") : Yup.string(),
    first_name: Yup.string().required("First name is required").max(128),
    last_name: Yup.string().required("Last name is required").max(128),
    emp_id: canManageUserIdentity ? Yup.string().required("Employee ID is required").max(64) : Yup.string(),
    role_id: Yup.string().required("Role is required"),
    project_id: Yup.string().when("role_id", {
      is: (roleId: string) => projectRuleFor(roleId) === "required",
      then: (schema) => schema.required("Project is required for this role"),
      otherwise: (schema) => schema.notRequired(),
    }),
    reports_to_id: Yup.string().when("role_id", {
      is: (roleId: string) => {
        const code = roleTypeCodeByRoleId.get(Number(roleId));
        return code === "lead" || code === "employee";
      },
      then: (schema) => schema.required("Reporting parent is required"),
      otherwise: (schema) => schema.notRequired(),
    }),
  });

  const handleSubmit = async (
    values: UserFormValues,
    helpers: { setSubmitting: (v: boolean) => void; setErrors: (errors: Record<string, string>) => void },
  ) => {
    const rule = projectRuleFor(values.role_id);
    const selectedRoleType = roleTypeCodeByRoleId.get(Number(values.role_id));
    const payload: Omit<UserCreatePayload, "email" | "emp_id"> = {
      first_name: values.first_name,
      last_name: values.last_name,
      role_id: Number(values.role_id),
      project_id: rule === "required" && values.project_id ? Number(values.project_id) : null,
      reports_to_id:
        (selectedRoleType === "lead" || selectedRoleType === "employee") && values.reports_to_id
          ? Number(values.reports_to_id)
          : null,
    };

    const identity = canManageUserIdentity ? { email: values.email, emp_id: values.emp_id } : {};
    const result = isEditMode
      ? await updateUser({ id: userId as number, body: { ...payload, ...identity } })
      : await createUser({ ...payload, email: values.email, emp_id: values.emp_id });

    if ("error" in result) {
      // onQueryStarted already toasted the backend's message; field-level
      // 422 errors additionally map onto the form here.
      const fieldErrors = getFieldErrors(result.error);
      if (fieldErrors) helpers.setErrors(toFormikErrors(fieldErrors));
      helpers.setSubmitting(false);
      return;
    }

    if (!isEditMode) {
      notifyInfo(`A temporary password was generated for this account. ${DEV_ONLY_TEMP_PASSWORD_NOTE}`);
    }
    navigate("/admin/users");
  };

  const handleResend = async () => {
    if (userId === undefined) return;
    const result = await resendTemporaryPassword(userId);
    if ("error" in result) return;
    notifyInfo(DEV_ONLY_TEMP_PASSWORD_NOTE);
  };

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-content-primary">{isEditMode ? "Edit user" : "New user"}</h1>
        {isEditMode && (
          <Button variant="secondary" onClick={handleResend} isLoading={isResending}>
            Resend temporary password
          </Button>
        )}
      </div>

      {!isEditMode && (
        <p className="mt-3 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-700">
          A temporary password will be generated automatically — there's no password field here. {DEV_ONLY_TEMP_PASSWORD_NOTE}
        </p>
      )}

      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        enableReinitialize
        onSubmit={handleSubmit}
      >
        {({ isSubmitting, values }) => {
          const rule = projectRuleFor(values.role_id);
          const selectedRoleType = roleTypeCodeByRoleId.get(Number(values.role_id));
          const parentRoleType = selectedRoleType === "lead" ? "manager" : selectedRoleType === "employee" ? "lead" : null;
          const reportingCandidates = (activeUsers ?? []).filter(
            (candidate) => {
              if (
                candidate.id === userId ||
                candidate.role.roleType !== parentRoleType ||
                candidate.project_id !== Number(values.project_id)
              ) {
                return false;
              }
              if (currentUser?.role.roleType !== "manager") return true;
              if (parentRoleType === "manager") return candidate.id === currentUser.id;
              return candidate.reports_to_id === currentUser.id;
            },
          );
          return (
            <Form className="mt-6 flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
              {canManageUserIdentity && <TextField label="Email" name="email" type="email" />}
              <TextField label="First name" name="first_name" />
              <TextField label="Last name" name="last_name" />
              {canManageUserIdentity && <TextField label="Employee ID" name="emp_id" />}
              <SelectField label="Role" name="role_id" placeholder="Select a role…">
                {assignableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.title}
                  </option>
                ))}
              </SelectField>
              {rule !== "forbidden" && (
                <SelectField label="Project" name="project_id" placeholder="Select a project…">
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </SelectField>
              )}
              {parentRoleType && (
                <SelectField
                  label={parentRoleType === "manager" ? "Manager" : "Lead"}
                  name="reports_to_id"
                  placeholder={`Select a ${parentRoleType}…`}
                >
                  {reportingCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.first_name} {candidate.last_name}
                    </option>
                  ))}
                </SelectField>
              )}

              <div className="mt-2 flex gap-2">
                <Button type="submit" isLoading={isSubmitting}>
                  Save
                </Button>
                <Button type="button" variant="secondary" onClick={() => navigate("/admin/users")}>
                  Cancel
                </Button>
              </div>
            </Form>
          );
        }}
      </Formik>
    </div>
  );
}
