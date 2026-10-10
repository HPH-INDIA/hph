// Domain types mirror the actual wire format of backend/app/**/schemas.py
// field-for-field (including casing) rather than normalizing everything to
// camelCase. The backend is inconsistent here — UserProfileSchema/RoleType
// use explicit `data_key`s (camelCase), but the admin UserSchema/RoleSchema
// have none, so those responses are genuinely snake_case on the wire. Mirroring
// it exactly means `ApiError.data.errors` keys line up with these same field
// names, so validation errors map onto Formik fields with no translation step.

export type RoleTypeCode = "super_admin" | "admin" | "manager" | "lead" | "employee";

// Nested "role" shape (RoleProfileSchema) — used both inside the auth user
// (login/whoami/set-password) and inside the admin User resource. Always
// camelCase, regardless of which parent embeds it.
export interface RoleProfile {
  id: number;
  title: string;
  roleType: RoleTypeCode;
  sessionTimeoutMinutes: number;
  features: string[]; // active feature codenames the role grants
  featurePermissions?: FeaturePermission[];
}

export interface FeaturePermission {
  codename: string;
  canRead: boolean;
  canWrite: boolean;
}

// GET /sessions/whoami, POST /sessions/login, POST /users/set-password
// all respond with { user: AuthUser } (UserProfileSchema) — camelCase.
export interface AuthUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  empId: string;
  firstLogin: boolean;
  isActive: boolean;
  project: string | null;
  role: RoleProfile;
}

// GET/POST/PATCH /users, /users/active, /users/inactive, /users/<id>,
// /users/<id>/resend-temporary-password (UserSchema) — snake_case.
export interface AdminUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  emp_id: string;
  role_id: number;
  role: RoleProfile;
  project_id: number | null;
  reports_to_id: number | null;
  first_login: boolean;
  is_active: boolean;
  join_date: string | null;
  last_working_day: string | null;
  created_at: string;
  updated_at: string;
}

// POST /users body, and PATCH /users/<id> body (all fields optional there).
export interface UserCreatePayload {
  email: string;
  first_name: string;
  last_name: string;
  emp_id: string;
  role_id: number;
  project_id?: number | null;
  reports_to_id?: number | null;
  join_date?: string | null;
}
export type UserUpdatePayload = Partial<UserCreatePayload>;

export interface TeamLeadSummary {
  id: number;
  firstName: string;
  lastName: string;
  empId: string;
  coderCount: number;
}

export interface ManagerTeam {
  leads: TeamLeadSummary[];
  coders: PaginatedResult<AdminUser>;
  totalCoders: number;
  unassignedCount: number;
}

export type CodingRoleType = "lead" | "employee";

export interface CodingUserSummary {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  empId: string;
  roleType: CodingRoleType;
  joinDate: string | null;
  isActive: boolean;
  lastWorkingDay: string | null;
}

export interface CohortMember {
  user: CodingUserSummary;
  joinedOn: string;
  currentStage: string | null;
}

export interface TeamCohort {
  id: number;
  sequenceNo: number;
  label: string;
  windowStart: string;
  windowEnd: string | null;
  createdAt: string;
  memberCount: number;
  members: CohortMember[];
}

export type CoderStageFilter = "Training" | "M1" | "M2" | "M3" | "M4" | "Steady State" | "Unassigned";

export type FoundationStageCode = "W1" | "W2" | "W3" | "W4" | "Steady State";
export interface StagePeriod {
  stageCode: string;
  startDate: string;
  endDate: string | null;
  source: string;
}
export interface FoundationProgress {
  eligibility: "eligible" | "awaiting_foundation" | "foundation_first" | "same_day_unknown";
  firstPvpCompleted: string | null;
  firstFoundationCompleted: string | null;
  currentStage: FoundationStageCode | null;
  dailyTarget: number | null;
  periods: StagePeriod[];
}
export interface TeamCoderOverviewItem {
  joinedOn: string | null;
  stageAsOf: string;
  firstCompleted: string | null;
  refreshedAt: string | null;
  dataIssue: string | null;
  periods: StagePeriod[];
  foundation: FoundationProgress;
  coder: CodingUserSummary;
  cohort: Pick<TeamCohort, "id" | "label"> | null;
  currentStage: string | null;
  dailyTarget: number | null;
  lead: CodingUserSummary | null;
}

export interface TeamCoderOverviewQuery {
  page: number;
  pageSize: number;
  cohortId?: number | null;
  leadId?: number | null;
  stageCode?: CoderStageFilter | null;
}

export interface CreateTeamCohortPayload {
  label: string;
  windowStart: string;
  windowEnd?: string | null;
  memberIds: number[];
}

export type TargetStageCode = "M1" | "M2" | "M3" | "M4" | "Steady State";

export interface StageTargetRule {
  id: number;
  stage_code: string;
  effective_from: string;
  effective_to: string | null;
  daily_target: number;
  created_by_id: number;
  reason: string | null;
  created_at: string;
}

export type TargetApplyFrom = "today" | "program_start";

export interface StageTargetChangeResult extends StageTargetRule {
  recalculatedRecords: number;
  applyFrom: TargetApplyFrom;
}

export interface ChangeStageTargetPayload {
  stageCode: TargetStageCode;
  applyFrom: TargetApplyFrom;
  dailyTarget: number;
  reason?: string | null;
}

export interface LoginHoursUploadPayload {
  sourceFilename: string;
  fileBase64: string;
}

export interface LoginHoursUploadBatch {
  id: number;
  sourceFilename: string;
  sourceFormat: string;
  uploadedById: number;
  uploadedAt: string;
  rowCount: number;
  matchedCount: number;
  unmatchedCount: number;
  unmatchedNames?: string[];
}

export interface LoginHourRecord {
  projectName?: string | null;
  id: number;
  batchId: number;
  userId: number;
  userName: string;
  date: string;
  employeeNameRaw: string;
  personnelId: string | null;
  department: string | null;
  firstIn: string | null;
  lastOut: string | null;
  totalInsideMinutes: number;
  totalOutsideMinutes: number;
  totalSpanMinutes: number;
  entries: number;
  exits: number;
  status: string | null;
  anomalies: number;
}

export interface LoginHourRecordQuery extends PaginationQuery {
  userIds?: number[];
  projectId?: number | null;
  from?: string | null;
  to?: string | null;
  userId?: number | null;
  leadId?: number | null;
  cohortId?: number | null;
}

export interface LoginHourFilterOption {
  projectId?: number | null;
  id: number;
  label: string;
}

export interface LoginHourRecordPage extends PaginatedResult<LoginHourRecord> {
  averageInsideMinutes: number | null;
  filterOptions: {
    projects?: LoginHourFilterOption[];
    users: LoginHourFilterOption[];
    leads: LoginHourFilterOption[];
    cohorts: LoginHourFilterOption[];
  };
}

// GET/POST/PATCH /roles (RoleSchema) — snake_case; `features` is feature ids.
export interface AdminRole {
  id: number;
  title: string;
  role_type_id: number;
  is_active: boolean;
  features: number[];
  feature_permissions?: RoleFeaturePermission[];
  created_at: string;
  updated_at: string;
}

export interface RoleFeaturePermission {
  feature_id: number;
  can_read: boolean;
  can_write: boolean;
}

export interface RolePayload {
  title: string;
  role_type_id: number;
  is_active?: boolean;
  features?: number[];
  feature_permissions?: RoleFeaturePermission[];
}

// GET /role-types (RoleTypeSchema) — camelCase, read-only fixed seed data.
export interface RoleType {
  id: number;
  code: RoleTypeCode;
  label: string;
  hierarchyRank: number;
  sessionTimeoutMinutes: number;
}

// GET/PATCH /role-types/<id>/session-timeout (SessionTimeoutSchema).
export interface SessionTimeout {
  roleTypeId: number;
  sessionTimeoutMinutes: number;
}

// GET/POST/PATCH/DELETE /features (FeatureSchema).
export interface Feature {
  id: number;
  codename: string;
  title: string;
  description: string | null;
  active: boolean;
}

export interface FeaturePayload {
  codename: string;
  title: string;
  description?: string | null;
  active?: boolean;
}

// GET /sessions/me (SessionSchema) — camelCase.
export interface SessionRow {
  id: number;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SetPasswordPayload {
  current_password: string;
  new_password: string;
  new_password_confirm: string;
}

// Legacy Kairon reporting uses these seeded project identities.
// User assignment and project management load current projects through projectsApi.
export const PROJECTS: ReadonlyArray<{ id: number; name: string }> = [
  { id: 1, name: "RCM" },
  { id: 2, name: "CODING" },
];

export const PROJECT_REQUIRED_ROLE_TYPES: ReadonlySet<RoleTypeCode> = new Set(["manager", "lead", "employee"]);
export const PROJECT_FORBIDDEN_ROLE_TYPES: ReadonlySet<RoleTypeCode> = new Set(["admin", "super_admin"]);

// --- Kairon chart records (backend/app/kairon) — every schema there uses
// explicit camelCase data_keys, so (unlike AdminUser above) these mirror the
// wire format directly with no snake_case leftovers.

export const KAIRON_LEVELS = ["1LR", "2LR", "3LR"] as const;
export type KaironLevel = (typeof KAIRON_LEVELS)[number];

export const KAIRON_STATUSES = ["Active", "On Hold", "Completed"] as const;
export type KaironStatus = (typeof KAIRON_STATUSES)[number];

// GET /kairon/charts (KaironChartRecordSchema).
export interface KaironChartRecord {
  id: number;
  batchId: number;
  program: string;
  level: KaironLevel;
  status: KaironStatus;
  userId: number | null;
  codingAnalyst: string;
  actions: number;
  lastAction: string | null;
  created: string;
  completed: string | null;
  tat: number | null;
  age: number | null;
  practice: string | null;
}

export interface KaironChartQuery {
  status?: KaironStatus | null;
  level?: KaironLevel | null;
  userId?: number | null;
  userIds?: number[] | null;
  asOfDate?: string | null;
}

// One cumulative import row. Patient is stripped in the browser. MBI is
// request-only: the backend fingerprints it and never persists the raw value.
export interface KaironChartRowInput {
  mbi: string;
  program: string;
  level: KaironLevel;
  status: KaironStatus;
  codingAnalyst: string;
  actions: number;
  lastAction: string | null;
  created: string;
  completed: string | null;
  tat: number | null;
  age: number | null;
  practice: string | null;
}

export interface KaironImportProgress {
  id: number;
  status: "pending" | "uploading" | "completed" | "failed";
  sourceFilename: string | null;
  totalRows: number;
  processedCount: number;
  insertedCount: number;
  updatedCount: number;
  unchangedCount: number;
  rejectedCount: number;
  unmatchedCount: number;
  uploadedAt: string;
  completedAt: string | null;
}

export interface KaironImportStartPayload {
  sourceFilename: string;
  fileChecksum: string;
  totalRows: number;
}

export interface KaironImportChunkPayload {
  importId: number;
  chunkNumber: number;
  checksum: string;
  rows: KaironChartRowInput[];
}

// GET/POST /kairon/uploads (KaironUploadBatchSchema).
export interface KaironUploadBatch {
  id: number;
  asOfDate: string | null;
  sourceFilename: string | null;
  uploadedById: number;
  uploadedAt: string;
  rowCount: number;
  matchedCount: number;
  unmatchedCount: number;
  supersededAt: string | null;
}

export type KaironAnalystReviewStatus = "pending" | "resolved";

// GET /kairon/analyst-reviews (KaironAnalystReviewSchema).
export interface KaironAnalystReview {
  id: number;
  chartRecordId: number;
  rawName: string;
  status: KaironAnalystReviewStatus;
  resolvedUserId: number | null;
  resolvedById: number | null;
  resolvedAt: string | null;
  createdAt: string;
}

// --- Manual daily records (backend/app/manual_daily_records) — also all
// explicit camelCase data_keys.

export type ManualDailyRecordStatus = "pending" | "approved" | "rejected";

export const MANUAL_DAILY_RECORD_MAX_HOURS = 10;

export const MANUAL_MEETING_TYPES = [
  "Assessment",
  "One-O-One",
  "Meeting",
  "Training",
  "Huddle",
  "PKT",
  "Others",
] as const;

export type ManualMeetingType = (typeof MANUAL_MEETING_TYPES)[number];

export interface ManualMeeting {
  type: ManualMeetingType | null;
  hours: string;
}

// GET /manual-daily-records, POST /manual-daily-records response
// (ManualDailyRecordSchema). The four hour fields come back as strings
// (as_string=True on the backend's Decimal field).
export interface ManualDailyRecord {
  pvpDailyTarget?: number | null;
  foundationDailyTarget?: number | null;
  dailyTarget?: number | null;
  adjustedCpd?: string | null;
  id: number;
  userId: number;
  date: string;
  productionCount: number;
  pvpCount: number;
  foundationCount: number;
  techIssuesDowntimeHours: string;
  noInventoryIdleTimeHours: string;
  leaveHours: string;
  meetingEngagementHours: string;
  meetingType: ManualMeetingType | null;
  meetings?: ManualMeeting[];
  status: ManualDailyRecordStatus;
  reviewedById: number | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ManualTeamUser {
  id: number;
  firstName: string;
  lastName: string;
  empId: string;
}

export interface ManualTeamDayEntry {
  user: ManualTeamUser;
  record: ManualDailyRecord | null;
}

export interface ManualTeamDayGroup {
  lead: ManualTeamUser | null;
  leadRecord: ManualDailyRecord | null;
  coders: ManualTeamDayEntry[];
}

export interface ManualTeamDay {
  date: string;
  teams: ManualTeamDayGroup[];
}

export interface ManualTeamRangeEntry {
  user: ManualTeamUser;
  records: ManualDailyRecord[];
}

export interface ManualTeamRangeGroup {
  lead: ManualTeamUser | null;
  leadRecords: ManualDailyRecord[];
  coders: ManualTeamRangeEntry[];
}

export interface ManualTeamRange {
  fromDate: string;
  toDate: string;
  teams: ManualTeamRangeGroup[];
}

// POST /manual-daily-records body (ManualDailyRecordUpsertSchema) — no user
// field; the record is always saved against whoever is logged in.
export interface ManualDailyRecordUpsertPayload {
  date: string;
  pvpCount: number;
  foundationCount: number;
  techIssuesDowntimeHours: number;
  noInventoryIdleTimeHours: number;
  leaveHours: number;
  meetingEngagementHours: number;
  meetingType?: ManualMeetingType | null;
  meetings?: { type: ManualMeetingType; hours: number }[];
}

export interface ManualBulkUploadPayload {
  recordDate: string;
  sourceFilename: string;
  fileBase64: string;
}

export interface ManualBulkUploadResult {
  recordDate: string;
  sourceFilename: string;
  sheetName: string;
  rowCount: number;
  importedCount: number;
  createdCount: number;
  updatedCount: number;
}

export interface ManualBulkUploadRowError {
  row: number;
  email?: string;
  name?: string;
  date?: string;
  message: string;
}

export interface ManualImportRow {
  userId: number;
  date: string;
  productionCount: number;
  techIssuesDowntimeHours: number;
  noInventoryIdleTimeHours: number;
  leaveHours: number;
  meetingEngagementHours: number;
}

export interface ManualImportStartPayload {
  sourceFilename: string;
  fileChecksum: string;
  totalRows: number;
}

export interface ManualImportProgress {
  id: number;
  status: "uploading" | "completed";
  sourceFilename: string;
  totalRows: number;
  processedCount: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  uploadedAt: string;
  completedAt: string | null;
}

export interface ManualImportChunkPayload {
  importId: number;
  chunkNumber: number;
  checksum: string;
  rows: ManualImportRow[];
}

export interface ManualDailyRecordQuery {
  fromDate?: string | null;
  toDate?: string | null;
  userId?: number | null;
  userIds?: number[] | null;
  excludeUserIds?: number[] | null;
  leadId?: number | null;
  status?: ManualDailyRecordStatus | null;
  page?: number;
  pageSize?: number;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface KaironCompletedDailyCount {
  date: string;
  count: number;
}

export interface KaironChartSummary {
  pvp: number;
  foundation: number;
  onHold: number;
  total: number;
}

export interface KaironLeadTeamRange {
  fromDate: string;
  toDate: string;
  lead: ManualTeamUser;
  leadDays: KaironCompletedDailyCount[];
  leadSummary: KaironChartSummary;
  coders: Array<{
    user: ManualTeamUser;
    days: KaironCompletedDailyCount[];
    count: number;
    summary: KaironChartSummary;
  }>;
}

export interface KaironManagerTeamRange {
  fromDate: string;
  toDate: string;
  teams: Array<{
    lead: ManualTeamUser | null;
    leadSummary: KaironChartSummary;
    coders: Array<{ user: ManualTeamUser; summary: KaironChartSummary }>;
  }>;
}

export interface KaironCompletedUserSummary {
  userId: number;
  firstName: string;
  lastName: string;
  count: number;
}

export interface KaironCompletedUserQuery extends PaginationQuery {
  completedDate: string;
  analyst?: string | null;
}

export interface KaironCompletedRecordQuery extends PaginationQuery {
  completedDate: string;
  userId: number;
}

export interface KaironTeamRecordQuery extends PaginationQuery {
  fromDate: string;
  toDate: string;
  userId: number;
}

// --- Reports (backend/app/reports) — the personal "own data" view and its
// manager-only bulk review actions. No new source tables; everything here
// reads/updates Kairon chart records or Manual daily records.

// GET /reports/kairon query — deliberately has no user_id/user_ids field;
// this endpoint is always scoped server-side to the caller.
export interface SelfKaironChartQuery extends PaginationQuery {
  status?: KaironStatus | null;
  level?: KaironLevel | null;
  asOfDate?: string | null;
}

// POST /reports/manual/reviews/bulk-reject body item — one reason per
// record, never one shared reason for the whole batch (§3.3).
export interface BulkRejectItem {
  id: number;
  reason?: string | null;
}

export interface BulkReviewSkip {
  id: number;
  reason: string;
}

export interface BulkApproveResult {
  approved: number[];
  skipped: BulkReviewSkip[];
}

export interface BulkRejectResult {
  rejected: number[];
  skipped: BulkReviewSkip[];
}

// GET /dashboards/coding query — an explicit from/to range wins, then a
// single `date`, then a `month` or `year` shorthand, then the default
// (1st of the current month through today) when none are given. See
// backend/app/reports/services.py's resolve_dashboard_window().
export interface CodingDashboardQuery {
  from?: string | null;
  to?: string | null;
  date?: string | null;
  month?: string | null;
  year?: number | null;
  program?: "PVP" | "FOUNDATION" | null;
  leadId?: number | null;
  cohortId?: number | null;
  includeDaily?: boolean;
}

export interface CodingDashboardKaironSummary {
  active: number;
  onHold: number;
  completed: number;
}

export interface CodingDashboardManualSummary {
  productionCount: number;
  pvpCount: number;
  foundationCount: number;
  techIssuesDowntimeHours: string;
  noInventoryIdleTimeHours: string;
  leaveHours: string;
  meetingEngagementHours: string;
  pendingCount: number;
  recordCount: number;
}

export interface DailyEfficiency {
  date: string;
  stage: string | null;
  dailyTarget: number | null;
  manualCharts: number;
  kaironCharts: number;
  insideMinutes: number | null;
  downtimeMinutes: number;
  idleMinutes: number;
  leaveMinutes: number;
  meetingMinutes: number;
  excludedMinutes: number;
  productiveMinutes: number | null;
  targetMinutes: number | null;
  adjustedTarget: string | null;
  adjustedCpd?: string | null;
  manualEfficiencyPercent: string | null;
  kaironEfficiencyPercent: string | null;
  manualCpd: string | null;
  kaironCpd: string | null;
  targetCpd: string | null;
  manualStatus: "pending" | "approved" | "rejected" | null;
}

export interface EfficiencySummary {
  from: string;
  to: string;
  manualCharts: number;
  kaironCharts: number;
  adjustedTarget: string;
  // Sum of saved manual adjusted targets for the selected reporting period.
  adjustedCpd?: string | null;
  insideMinutes: number;
  loginDays: number;
  productiveMinutes: number;
  targetMinutes: number;
  calculatedDays: number;
  manualEfficiencyPercent: string | null;
  kaironEfficiencyPercent: string | null;
  manualCpd: string | null;
  kaironCpd: string | null;
  targetCpd: string | null;
  daily: DailyEfficiency[];
}

export interface MonthlyGoalSummary {
  manualCharts?: number;
  adjustedTargetCharts?: string;
  // Adjusted monthly target minus manual charts.
  adjustedDifference?: string;
  users?: {
    userId: number;
    name: string;
    manualCharts: number;
    completedCharts: number;
    targetCharts: number;
    difference: number;
    adjustedTargetCharts?: string;
    adjustedDifference?: string;
  }[];
  month: string;
  scope: "self" | "team";
  userCount: number;
  completedCharts: number;
  targetCharts: number;
  difference: number;
  calendarWorkingDays: number;
  eligibleDays: number;
  holidayCount: number;
  leaveDaysExcluded: number;
}

// GET /dashboards/coding response item — one card per user eligible for the
// selected period, including inactive users through their last working day.
export interface CodingDashboardCard {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  lastWorkingDay: string | null;
  leadId: number | null;
  kairon: CodingDashboardKaironSummary;
  manual: CodingDashboardManualSummary;
  efficiency: EfficiencySummary;
}


export type LeadDashboardQuery = Pick<CodingDashboardQuery, "from" | "to" | "date" | "month" | "year"> & { coderId?: number };

export interface PeriodGoalSummary extends MonthlyGoalSummary {
  from: string;
  to: string;
}

export interface LeadPerformanceSection {
  goal: PeriodGoalSummary;
  efficiency: EfficiencySummary;
}

export interface LeadDashboardSummary {
  from: string;
  to: string;
  selectedCoderId: number | null;
  coderOptions: { userId: number; name: string; isActive: boolean }[];
  qa: LeadPerformanceSection;
  coders: LeadPerformanceSection;
}


export type ManagerDashboardQuery = LeadDashboardQuery & Pick<CodingDashboardQuery, "leadId" | "cohortId" | "program">;
export interface ManagerCoderOption {
  userId: number; name: string; isActive: boolean; leadId: number | null; cohortId: number | null;
}
export interface ManagerPerformanceMember {
  userId: number; name: string; isActive: boolean; leadId: number | null; empId: string | null;
  roleType: "lead" | "employee";
  efficiency: Omit<EfficiencySummary, "daily">;
}
export interface ManagerPerformanceTeam {
  key: string;
  lead: { userId: number; name: string; isActive: boolean } | null;
  qa: LeadPerformanceSection;
  coders: LeadPerformanceSection;
}
export interface ManagerDashboardSummary {
  from: string; to: string;
  leadOptions: { userId: number; name: string; isActive: boolean }[];
  coderOptions: ManagerCoderOption[];
  cohortOptions: { id: number; label: string }[];
  overall: Omit<EfficiencySummary, "daily">;
  qa: LeadPerformanceSection;
  coders: LeadPerformanceSection;
  teams: ManagerPerformanceTeam[];
  members: ManagerPerformanceMember[];
}

export type KaironHoldView = "all" | "coders" | "leads";

export type KaironHoldAgeBucket = "on_track" | "monitor" | "attention" | "priority" | "unknown";
export type KaironHoldSort = "id" | "user" | "program" | "created" | "practice" | "lastAction" | "age" | "tat";

export interface KaironHoldQuery extends PaginationQuery {
  ageBucket?: KaironHoldAgeBucket;
  sortBy?: KaironHoldSort;
  sortDirection?: "asc" | "desc";
  view?: KaironHoldView;
  userId?: number;
  leadId?: string;
  createdFrom?: string;
  createdTo?: string;
  practice?: string;
  withoutPractice?: boolean;
}

export interface KaironHoldSummary {
  ageBuckets: Record<KaironHoldAgeBucket, number>;
  total: number;
  coderCount: number;
  leadCount: number;
  users: { id: number; name: string; roleType: "employee" | "lead"; leadId: number | null; count: number }[];
  practices: string[];
}

export interface ChangeFoundationTargetPayload extends Omit<ChangeStageTargetPayload, "stageCode"> {
  stageCode: FoundationStageCode;
}
