import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";

import { getErrorMessage } from "@/api/apiError";
import {
  useChangeStageTargetMutation,
  useCreateTeamCohortMutation,
  useGetTeamCoderOverviewQuery,
  useListEligibleCohortMembersQuery,
  useListStageTargetRulesQuery,
  useListTeamCohortsQuery,
} from "@/api/cohortsApi";
import type { CoderStageFilter, StageTargetRule, TargetStageCode, TeamLeadSummary } from "@/api/types";
import { useAssignManagerTeamMutation, useGetMyManagerTeamQuery } from "@/api/usersApi";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { inputClasses } from "@/components/ui/FormField";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { useAuth } from "@/features/auth/useAuth";

type AssignmentView = "list" | "leads";
type TeamSection = "overview" | "assignments" | "cohorts" | "targets";

export function TeamManagementPage() {
  const { canWriteFeature } = useAuth();
  const canManageTeam = canWriteFeature("user_management");
  const [section, setSection] = useState<TeamSection>("overview");
  const [view, setView] = useState<AssignmentView>("list");
  const [page, setPage] = useState(1);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCoderIds, setSelectedCoderIds] = useState<Set<number>>(new Set());
  const [destinationLeadId, setDestinationLeadId] = useState("");
  const [movingCoderId, setMovingCoderId] = useState<number | null>(null);

  const { data, isLoading, isFetching, isError, refetch } = useGetMyManagerTeamQuery({
    page,
    pageSize: 25,
    search: search || null,
    leadId,
  });
  const [assignTeam, { isLoading: isAssigning }] = useAssignManagerTeamMutation();

  const coders = data?.coders.items ?? [];
  const leads = data?.leads ?? [];

  useEffect(() => {
    setSelectedCoderIds(new Set());
  }, [leadId, page, search]);

  const applySearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const chooseLeadFilter = (nextLeadId: number | null) => {
    setLeadId(nextLeadId);
    setPage(1);
    setView("list");
  };

  const assignCoders = async (coderIds: number[], nextLeadId: number) => {
    const result = await assignTeam({ coderIds, leadId: nextLeadId });
    if ("error" in result) return false;
    setSelectedCoderIds(new Set());
    return true;
  };

  const moveOneCoder = async (coderId: number, nextLeadId: number) => {
    setMovingCoderId(coderId);
    try {
      await assignCoders([coderId], nextLeadId);
    } finally {
      setMovingCoderId(null);
    }
  };

  const moveSelected = async () => {
    const nextLeadId = Number(destinationLeadId);
    if (!nextLeadId || selectedCoderIds.size === 0) return;
    const succeeded = await assignCoders(Array.from(selectedCoderIds), nextLeadId);
    if (succeeded) setDestinationLeadId("");
  };

  const toggleCoder = (coderId: number) => {
    setSelectedCoderIds((current) => {
      const next = new Set(current);
      if (next.has(coderId)) next.delete(coderId);
      else next.add(coderId);
      return next;
    });
  };

  const allPageSelected = coders.length > 0 && coders.every((coder) => selectedCoderIds.has(coder.id));
  const togglePage = () => {
    setSelectedCoderIds((current) => {
      const next = new Set(current);
      for (const coder of coders) {
        if (allPageSelected) next.delete(coder.id);
        else next.add(coder.id);
      }
      return next;
    });
  };

  if (isLoading) return <LoadingState label="Loading your team…" />;
  if (isError) return <ErrorState message="Couldn't load your team." onRetry={refetch} />;
  if (!data) return <ErrorState message="Your team could not be loaded." />;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-content-primary">Team management</h1>
        <p className="text-sm text-content-muted">
          Manage reporting assignments, cohorts, stage progression, and effective-dated targets.
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        <ViewButton active={section === "overview"} onClick={() => setSection("overview")}>Overview</ViewButton>
        {canManageTeam && (
          <>
            <ViewButton active={section === "assignments"} onClick={() => setSection("assignments")}>Assignments</ViewButton>
            <ViewButton active={section === "cohorts"} onClick={() => setSection("cohorts")}>Cohorts</ViewButton>
            <ViewButton active={section === "targets"} onClick={() => setSection("targets")}>Stage targets</ViewButton>
          </>
        )}
      </div>

      {section === "overview" ? (
        <CoderOverviewPanel leads={leads} />
      ) : section === "cohorts" ? (
        <CohortsPanel />
      ) : section === "targets" ? (
        <StageTargetsPanel />
      ) : (
        <>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Leads" value={leads.length} />
        <SummaryCard label="Coders" value={data.totalCoders} />
        <SummaryCard label="Unassigned coders" value={data.unassignedCount} attention={data.unassignedCount > 0} />
      </div>

      <div className="flex gap-1 border-b border-border">
        <ViewButton active={view === "list"} onClick={() => setView("list")}>Coder list</ViewButton>
        <ViewButton active={view === "leads"} onClick={() => setView("leads")}>By lead</ViewButton>
      </div>

      {leads.length === 0 ? (
        <EmptyState title="No users with the Lead role type are assigned to your team" />
      ) : view === "leads" ? (
        <LeadSummaryView
          leads={leads}
          unassignedCount={data.unassignedCount}
          onChooseLead={chooseLeadFilter}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 lg:grid-cols-[1fr_260px]">
            <form className="flex gap-2" onSubmit={applySearch}>
              <input
                className={`${inputClasses} min-w-0 flex-1`}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by name"
              />
              <Button type="submit" variant="secondary">Search</Button>
              {search && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                    setPage(1);
                  }}
                >
                  Clear
                </Button>
              )}
            </form>
            <select
              aria-label="Filter by lead"
              className={inputClasses}
              value={leadId ?? "all"}
              onChange={(event) => {
                const value = event.target.value;
                chooseLeadFilter(value === "all" ? null : Number(value));
              }}
            >
              <option value="all">All coders</option>
              <option value="0">Unassigned ({data.unassignedCount})</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.firstName} {lead.lastName} ({lead.coderCount})
                </option>
              ))}
            </select>
          </div>

          {selectedCoderIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
              <span className="text-sm font-medium text-brand-700">{selectedCoderIds.size} coder(s) selected</span>
              <select
                aria-label="Move selected coders to lead"
                className={`${inputClasses} min-w-56`}
                value={destinationLeadId}
                onChange={(event) => setDestinationLeadId(event.target.value)}
              >
                <option value="">Choose destination lead…</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>{lead.firstName} {lead.lastName}</option>
                ))}
              </select>
              <Button disabled={!destinationLeadId} isLoading={isAssigning} onClick={moveSelected}>
                Move selected
              </Button>
              <Button variant="ghost" onClick={() => setSelectedCoderIds(new Set())}>Clear selection</Button>
            </div>
          )}

          {isFetching && <div className="text-sm text-content-muted">Updating list…</div>}
          {!isFetching && coders.length === 0 ? (
            <EmptyState title="No coders match these filters" />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
                    <tr>
                      <th className="w-12 px-4 py-3">
                        <input type="checkbox" aria-label="Select this page" checked={allPageSelected} onChange={togglePage} />
                      </th>
                      <th className="px-4 py-3 font-medium">Coder</th>
                      <th className="px-4 py-3 font-medium">Current lead</th>
                      <th className="px-4 py-3 font-medium">Assign or move to</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {coders.map((coder) => {
                      const currentLead = leads.find((lead) => lead.id === coder.reports_to_id);
                      return (
                        <tr key={coder.id}>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              aria-label={`Select ${coder.first_name} ${coder.last_name}`}
                              checked={selectedCoderIds.has(coder.id)}
                              onChange={() => toggleCoder(coder.id)}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-content-primary">{coder.first_name} {coder.last_name}</div>
                          </td>
                          <td className="px-4 py-3 text-content-secondary">
                            {currentLead ? `${currentLead.firstName} ${currentLead.lastName}` : "Unassigned"}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              aria-label={`Assign ${coder.first_name} ${coder.last_name} to lead`}
                              className={`${inputClasses} min-w-56`}
                              value={coder.reports_to_id ?? ""}
                              disabled={movingCoderId === coder.id || isAssigning}
                              onChange={(event) => {
                                const nextLeadId = Number(event.target.value);
                                if (nextLeadId) void moveOneCoder(coder.id, nextLeadId);
                              }}
                            >
                              <option value="" disabled>Select a lead…</option>
                              {leads.map((lead) => (
                                <option key={lead.id} value={lead.id}>{lead.firstName} {lead.lastName}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                page={data.coders.page}
                pageSize={data.coders.pageSize}
                total={data.coders.total}
                totalPages={data.coders.totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
}

const CODER_STAGES: CoderStageFilter[] = ["Training", "M1", "M2", "M3", "M4", "Steady State", "Unassigned"];

function CoderOverviewPanel({ leads }: { leads: TeamLeadSummary[] }) {
  const [page, setPage] = useState(1);
  const [cohortId, setCohortId] = useState<number | null>(null);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [stageCode, setStageCode] = useState<CoderStageFilter | null>(null);
  const cohorts = useListTeamCohortsQuery();
  const overview = useGetTeamCoderOverviewQuery({ page, pageSize: 25, cohortId, leadId, stageCode });

  const updateCohort = (value: string) => {
    setCohortId(value === "ALL" ? null : Number(value));
    setPage(1);
  };
  const updateLead = (value: string) => {
    setLeadId(value === "ALL" ? null : Number(value));
    setPage(1);
  };
  const updateStage = (value: string) => {
    setStageCode(value === "ALL" ? null : value as CoderStageFilter);
    setPage(1);
  };

  if (overview.isLoading || cohorts.isLoading) return <LoadingState label="Loading coder overview…" />;
  if (overview.error) return <ErrorState message={getErrorMessage(overview.error)} onRetry={overview.refetch} />;
  if (cohorts.error) return <ErrorState message={getErrorMessage(cohorts.error)} onRetry={cohorts.refetch} />;

  const result = overview.data;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-content-primary">Coder overview</h2>
          <p className="text-sm text-content-muted">Current cohort, stage, target, and reporting lead for every coder.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-content-secondary">
            Cohort
            <select className={inputClasses} value={cohortId ?? "ALL"} onChange={(event) => updateCohort(event.target.value)}>
              <option value="ALL">All cohorts</option>
              <option value={0}>Unassigned / BAU</option>
              {(cohorts.data ?? []).map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-content-secondary">
            Lead
            <select className={inputClasses} value={leadId ?? "ALL"} onChange={(event) => updateLead(event.target.value)}>
              <option value="ALL">All leads</option>
              <option value={0}>Unassigned</option>
              {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.firstName} {lead.lastName}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-content-secondary">
            Stage
            <select className={inputClasses} value={stageCode ?? "ALL"} onChange={(event) => updateStage(event.target.value)}>
              <option value="ALL">All stages</option>
              {CODER_STAGES.map((stage) => <option key={stage} value={stage}>{stage === "Unassigned" ? "No current stage" : stage}</option>)}
            </select>
          </label>
        </div>
      </div>

      {!result || result.items.length === 0 ? (
        <EmptyState title="No coders match these filters" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Coder</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Cohort</th>
                  <th className="px-4 py-3 font-medium">Current stage</th>
                  <th className="px-4 py-3 font-medium">Daily target goal</th>
                  <th className="px-4 py-3 font-medium">Lead</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.items.map((row) => (
                  <tr key={row.coder.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-content-primary">{row.coder.firstName} {row.coder.lastName}</div>
                    </td>
                    <td className="px-4 py-3 capitalize text-content-secondary">{row.coder.roleType}</td>
                    <td className="px-4 py-3 text-content-secondary">{row.cohort?.label ?? "Unassigned / BAU"}</td>
                    <td className="px-4 py-3 text-content-secondary">{row.currentStage ?? "No current stage"}</td>
                    <td className="px-4 py-3 text-content-secondary">{row.dailyTarget == null ? "—" : `${row.dailyTarget} charts/day`}</td>
                    <td className="px-4 py-3 text-content-secondary">
                      {row.lead ? `${row.lead.firstName} ${row.lead.lastName}` : "Unassigned"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            totalPages={result.totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function CohortsPanel() {
  const cohorts = useListTeamCohortsQuery();
  const eligible = useListEligibleCohortMembersQuery();
  const [createCohort, createState] = useCreateTeamCohortMutation();
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [windowStart, setWindowStart] = useState(localDateValue());
  const [memberIds, setMemberIds] = useState<Set<number>>(new Set());
  const [expandedCohortId, setExpandedCohortId] = useState<number | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await createCohort({ label: label.trim(), windowStart, memberIds: [...memberIds] });
    if ("error" in result) return;
    setLabel("");
    setWindowStart(localDateValue());
    setMemberIds(new Set());
    setShowForm(false);
  };

  if (cohorts.isLoading || eligible.isLoading) return <LoadingState label="Loading cohorts…" />;
  if (cohorts.error) return <ErrorState message={getErrorMessage(cohorts.error)} onRetry={cohorts.refetch} />;
  if (eligible.error) return <ErrorState message={getErrorMessage(eligible.error)} onRetry={eligible.refetch} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-content-primary">Cohorts</h2>
          <p className="text-sm text-content-muted">Create a batch and assign active CODING leads and employees.</p>
        </div>
        <Button onClick={() => setShowForm(true)}>Create cohort</Button>
      </div>

      <Drawer
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Create cohort"
        description="Create a new batch and select its CODING leads and employees."
        widthClass="max-w-2xl"
      >
        <form onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-content-secondary">
              Cohort name
              <input className={inputClasses} required value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Cohort 4" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-content-secondary">
              Batch start date
              <input className={inputClasses} type="date" required value={windowStart} onChange={(event) => setWindowStart(event.target.value)} />
            </label>
          </div>
          <div className="mt-5">
            <div className="mb-2 text-sm font-medium text-content-secondary">Members</div>
            {(eligible.data ?? []).length === 0 ? (
              <p className="text-sm text-content-muted">No unassigned CODING leads or employees are available.</p>
            ) : (
              <div className="grid max-h-72 gap-2 overflow-y-auto rounded-md border border-border p-3 md:grid-cols-2">
                {(eligible.data ?? []).map((user) => (
                  <label key={user.id} className="flex items-start gap-3 rounded-md p-2 hover:bg-surface-muted">
                    <input
                      className="mt-1 h-4 w-4"
                      type="checkbox"
                      checked={memberIds.has(user.id)}
                      onChange={() => setMemberIds((current) => {
                        const next = new Set(current);
                        if (next.has(user.id)) next.delete(user.id); else next.add(user.id);
                        return next;
                      })}
                    />
                    <span>
                      <span className="block text-sm font-medium text-content-primary">{user.firstName} {user.lastName}</span>
                      <span className="block text-xs text-content-muted">{user.roleType}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="mt-5 flex items-center gap-3">
            <Button type="submit" isLoading={createState.isLoading} disabled={!label.trim() || !windowStart || memberIds.size === 0}>
              Create cohort with {memberIds.size} member(s)
            </Button>
            <span className="text-xs text-content-muted">Members begin Training on the batch start date.</span>
          </div>
        </form>
      </Drawer>

      {(cohorts.data ?? []).length === 0 ? (
        <EmptyState title="No cohorts have been created" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Cohort</th>
                  <th className="px-4 py-3 font-medium">Batch start</th>
                  <th className="px-4 py-3 font-medium">Enrollment</th>
                  <th className="px-4 py-3 font-medium">Members</th>
                  <th className="px-4 py-3 font-medium">Current stages</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(cohorts.data ?? []).map((cohort) => {
                  const distribution = cohort.members.reduce<Record<string, number>>((counts, member) => {
                    const stage = member.currentStage ?? "Not started";
                    counts[stage] = (counts[stage] ?? 0) + 1;
                    return counts;
                  }, {});
                  const expanded = expandedCohortId === cohort.id;
                  return (
                    <Fragment key={cohort.id}>
                      <tr>
                        <td className="px-4 py-3 font-medium text-content-primary">{cohort.label}</td>
                        <td className="px-4 py-3 text-content-secondary">{cohort.windowStart}</td>
                        <td className="px-4 py-3 text-content-secondary">{cohort.windowEnd ? `Closed ${cohort.windowEnd}` : "Open"}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="font-medium text-brand-700 hover:underline disabled:text-content-muted disabled:no-underline"
                            disabled={cohort.memberCount === 0}
                            onClick={() => setExpandedCohortId(expanded ? null : cohort.id)}
                            aria-expanded={expanded}
                          >
                            {cohort.memberCount} {cohort.memberCount === 1 ? "member" : "members"} {cohort.memberCount > 0 ? (expanded ? "▴" : "▾") : ""}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-content-secondary">
                          {Object.entries(distribution).map(([stage, count]) => `${stage}: ${count}`).join(", ") || "—"}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-surface-muted/50">
                          <td colSpan={5} className="px-6 py-4">
                            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                              {cohort.members.map((member) => (
                                <div key={member.user.id} className="rounded-md border border-border bg-surface px-3 py-2">
                                  <div className="text-sm font-medium text-content-primary">
                                    {member.user.firstName} {member.user.lastName}
                                  </div>
                                  <div className="mt-0.5 text-xs text-content-muted">
                                    {member.user.roleType} · {member.currentStage ?? "Stage not started"}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const TARGET_STAGES: TargetStageCode[] = ["M1", "M2", "M3", "M4", "Steady State"];

function StageTargetsPanel() {
  const rules = useListStageTargetRulesQuery();
  const [changeTarget, changeState] = useChangeStageTargetMutation();
  const [stage, setStage] = useState<TargetStageCode>("M1");
  const [target, setTarget] = useState(10);
  const [effectiveFrom, setEffectiveFrom] = useState(localDateValue());
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState(false);

  const today = localDateValue();
  const { currentByStage, scheduledByStage } = useMemo(() => {
    const current = new Map<string, StageTargetRule>();
    const scheduled = new Map<string, StageTargetRule>();
    for (const rule of rules.data ?? []) {
      if (rule.effective_from <= today && (!rule.effective_to || today < rule.effective_to)) {
        current.set(rule.stage_code, rule);
      } else if (rule.effective_from > today) {
        scheduled.set(rule.stage_code, rule);
      }
    }
    return { currentByStage: current, scheduledByStage: scheduled };
  }, [rules.data, today]);

  const beginChange = (nextStage: TargetStageCode) => {
    setStage(nextStage);
    setTarget(currentByStage.get(nextStage)?.daily_target ?? 0);
    setEffectiveFrom(localDateValue());
    setReason("");
    setEditing(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await changeTarget({ stageCode: stage, effectiveFrom, dailyTarget: target, reason: reason.trim() || null });
    if ("error" in result) return;
    setEditing(false);
  };

  if (rules.isLoading) return <LoadingState label="Loading stage targets…" />;
  if (rules.error) return <ErrorState message={getErrorMessage(rules.error)} onRetry={rules.refetch} />;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-content-primary">Stage targets</h2>
        <p className="text-sm text-content-muted">Changes apply from their effective date; historical evaluations keep their original target.</p>
      </div>

      <Drawer
        open={editing}
        onClose={() => setEditing(false)}
        title={`Change ${stage} target`}
        description="Schedule an effective-dated target without changing historical evaluations."
      >
        <form onSubmit={submit}>
          <div className="grid gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-content-secondary">
              New daily target
              <input className={inputClasses} type="number" min={0} required value={target} onChange={(event) => setTarget(Number(event.target.value))} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-content-secondary">
              Effective from
              <input className={inputClasses} type="date" min={localDateValue()} required value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-content-secondary">
              Reason (optional)
              <input className={inputClasses} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Operational target update" />
            </label>
          </div>
          <p className="mt-3 text-xs text-content-muted">
            The current {stage} target of {currentByStage.get(stage)?.daily_target ?? "—"} remains valid before {effectiveFrom}.
          </p>
          <div className="mt-4 flex gap-2">
            <Button type="submit" isLoading={changeState.isLoading}>Save effective-dated target</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </form>
      </Drawer>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Current target</th>
              <th className="px-4 py-3 font-medium">Effective from</th>
              <th className="px-4 py-3 font-medium">Scheduled change</th>
              <th className="px-4 py-3 font-medium">History</th>
              <th className="px-4 py-3 font-medium"><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {TARGET_STAGES.map((code) => {
              const current = currentByStage.get(code);
              const scheduled = scheduledByStage.get(code);
              const historyCount = (rules.data ?? []).filter((rule) => rule.stage_code === code).length;
              return (
                <tr key={code}>
                  <td className="px-4 py-3 font-medium text-content-primary">{code}</td>
                  <td className="px-4 py-3 text-content-secondary">{current?.daily_target ?? "—"} charts/day</td>
                  <td className="px-4 py-3 text-content-secondary">{current?.effective_from ?? "—"}</td>
                  <td className="px-4 py-3 text-content-secondary">
                    {scheduled ? `${scheduled.daily_target} from ${scheduled.effective_from}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-content-secondary">{historyCount} version(s)</td>
                  <td className="px-4 py-3 text-right"><Button variant="secondary" onClick={() => beginChange(code)}>Change target</Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ViewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium ${
        active ? "border-b-2 border-brand-600 text-brand-700" : "text-content-muted hover:text-content-secondary"
      }`}
    >
      {children}
    </button>
  );
}

function LeadSummaryView({
  leads,
  unassignedCount,
  onChooseLead,
}: {
  leads: TeamLeadSummary[];
  unassignedCount: number;
  onChooseLead: (leadId: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <LeadCard
        name="Unassigned"
        detail="Coders awaiting a lead"
        count={unassignedCount}
        attention={unassignedCount > 0}
        onClick={() => onChooseLead(0)}
      />
      {leads.map((lead) => (
        <LeadCard
          key={lead.id}
          name={`${lead.firstName} ${lead.lastName}`}
          count={lead.coderCount}
          onClick={() => onChooseLead(lead.id)}
        />
      ))}
    </div>
  );
}

function LeadCard({ name, detail, count, attention = false, onClick }: { name: string; detail?: string; count: number; attention?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border p-4 text-left transition-colors hover:bg-surface-muted ${
        attention ? "border-warning bg-warning-bg" : "border-border bg-surface"
      }`}
    >
      <div className="font-medium text-content-primary">{name}</div>
      {detail && <div className="text-xs text-content-muted">{detail}</div>}
      <div className="mt-4 flex items-end justify-between">
        <span className="text-2xl font-semibold text-content-primary">{count}</span>
        <span className="text-sm font-medium text-brand-700">View coders →</span>
      </div>
    </button>
  );
}

function SummaryCard({ label, value, attention = false }: { label: string; value: number; attention?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${attention ? "border-warning bg-warning-bg" : "border-border bg-surface"}`}>
      <div className="text-sm text-content-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-content-primary">{value}</div>
    </div>
  );
}
