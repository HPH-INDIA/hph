import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getErrorMessage } from "@/api/apiError";
import { useChangeFoundationTargetMutation, useChangeStageTargetMutation, useListFoundationTargetRulesQuery, useListStageTargetRulesQuery } from "@/api/cohortsApi";
import type { FoundationStageCode, StageTargetRule, TargetApplyFrom, TargetStageCode } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { inputClasses } from "@/components/ui/FormField";
import { ErrorState, LoadingState } from "@/components/ui/StateViews";

type EditTarget = { foundation: boolean; stage: TargetStageCode | FoundationStageCode; current: number };
const MAIN_STAGES: TargetStageCode[] = ["M1", "M2", "M3", "M4", "Steady State"];
const FOUNDATION_STAGES: FoundationStageCode[] = ["W1", "W2", "W3", "W4", "Steady State"];

export function StageTargetsPage() {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => { pageRef.current?.scrollIntoView({ block: "start" }); }, []);
  const main = useListStageTargetRulesQuery();
  const foundation = useListFoundationTargetRulesQuery();
  const [changeMain, mainState] = useChangeStageTargetMutation();
  const [changeFoundation, foundationState] = useChangeFoundationTargetMutation();
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [target, setTarget] = useState(0);
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applyFrom, setApplyFrom] = useState<TargetApplyFrom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const saving = mainState.isLoading || foundationState.isLoading;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const title = editing ? `${editing.foundation ? "Foundation" : "Main"} ${editing.stage}` : "";
  const beginChange = (next: EditTarget) => {
    setEditing(next); setTarget(next.current); setReason(""); setError(null); setSuccess(null); setApplyFrom(null);
  };
  const review = (event: FormEvent) => {
    event.preventDefault();
    if (!Number.isInteger(target) || target < 0) return;
    setError(null); setApplyFrom(null); setConfirmOpen(true);
  };
  const save = async () => {
    if (!editing || !applyFrom || saving) return;
    const common = { dailyTarget: target, applyFrom, reason: reason.trim() || null };
    const result = editing.foundation
      ? await changeFoundation({ ...common, stageCode: editing.stage as FoundationStageCode })
      : await changeMain({ ...common, stageCode: editing.stage as TargetStageCode });
    if ("error" in result) { setError(getErrorMessage(result.error)); return; }
    setSuccess(`${title} target saved: ${target} charts/day. ${result.data.recalculatedRecords} daily record(s) recalculated.`);
    setConfirmOpen(false); setEditing(null);
  };
  const targetTable = (isFoundation: boolean, rules: StageTargetRule[]) => <section className="min-w-0 rounded-lg border border-border bg-surface p-4 sm:p-5">
    <h2 className="mb-3 font-semibold text-content-primary">{isFoundation ? "Foundation targets" : "Main stage targets"}</h2>
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-muted text-xs text-content-muted"><tr>
          <th className="px-2 py-3 sm:px-3">Stage</th><th className="px-2 py-3 sm:px-3">Charts/day</th><th className="px-2 py-3 sm:px-3">Effective from</th><th><span className="sr-only">Action</span></th>
        </tr></thead>
        <tbody className="divide-y divide-border">{(isFoundation ? FOUNDATION_STAGES : MAIN_STAGES).map((code) => {
          const current = rules.find((r) => r.stage_code === code && r.effective_from <= today && (!r.effective_to || today < r.effective_to));
          const scheduled = rules.filter((r) => r.stage_code === code && r.effective_from > today).sort((a, b) => a.effective_from.localeCompare(b.effective_from))[0];
          return <tr key={code}>
            <th scope="row" className="px-2 py-3 sm:px-3 font-medium">{code}</th>
            <td className="px-2 py-3 sm:px-3">{current?.daily_target ?? "—"}{scheduled && <div className="mt-1 text-xs text-content-muted">{scheduled.daily_target} from {scheduled.effective_from}</div>}</td>
            <td className="px-2 py-3 sm:px-3 text-content-muted">{current?.effective_from === "1900-01-01" ? "Program start" : current?.effective_from ?? "—"}</td>
            <td className="px-2 py-3 sm:px-3 text-right"><Button variant="secondary" aria-label={`Change ${isFoundation ? "Foundation" : "Main"} ${code} target`} onClick={() => beginChange({ foundation: isFoundation, stage: code, current: current?.daily_target ?? 0 })}>Change</Button></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </section>;
  return <>
    <div ref={pageRef} className="mx-auto flex min-w-0 scroll-mt-8 max-w-screen-2xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-content-primary">Stage targets</h1>
          <p className="mt-1 text-sm text-content-muted">Targets apply to all CODING employees. Main and Foundation stages progress separately.</p>
        </div>
        <Button variant="secondary" disabled={saving || confirmOpen} onClick={() => navigate("/team")}>
          <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7M5 12h14" /></svg>
          Back to Teams
        </Button>
      </header>
      {success && <p role="status" className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-700">{success}</p>}
      {editing ? <form onSubmit={review} className="flex w-full max-w-xl flex-col gap-5 rounded-lg border border-border bg-surface p-4 sm:p-6">
        <h2 className="font-semibold text-content-primary">Change {title} target</h2>
        <p className="text-sm text-content-secondary">Current target: {editing.current} charts/day</p>
        <label className="flex flex-col gap-2 text-sm font-medium">New daily target
          <input className={inputClasses} type="number" min={0} max={2147483647} step={1} required value={target} disabled={saving} onChange={(e) => setTarget(Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">Reason (optional)
          <input className={inputClasses} value={reason} maxLength={1000} disabled={saving} onChange={(e) => setReason(e.target.value)} />
        </label>
        <p className="text-sm text-content-muted">You’ll choose when this change applies before confirming.</p>
        <div className="flex gap-2"><Button type="submit" disabled={saving}>Review change</Button><Button variant="ghost" disabled={saving} onClick={() => setEditing(null)}>Back to targets</Button></div>
      </form> : main.isLoading || foundation.isLoading ? <LoadingState label="Loading stage targets…" />
        : main.error || foundation.error ? <ErrorState message={getErrorMessage(main.error || foundation.error)} onRetry={() => { void main.refetch(); void foundation.refetch(); }} />
        : <>
          <div className="grid min-w-0 items-start gap-6 xl:grid-cols-2">
            {targetTable(false, main.data ?? [])}
            {targetTable(true, foundation.data ?? [])}
          </div>
          <section aria-labelledby="target-information-title" className="rounded-lg border border-border bg-surface p-4 text-sm text-content-secondary">
            <h2 id="target-information-title" className="mb-2 font-semibold text-content-primary">How targets apply</h2>
            <p>PVP uses the main target; eligible Foundation work uses its weekly or Foundation Steady State target. Combined adjusted charts/day is weighted by the completed chart mix, then reduced for recorded time deductions. With different rates and no completions, the combined count remains unknown.</p>
          </section>
        </>}
    </div>
    <ConfirmDialog open={confirmOpen} title="When should this target apply?" description={`${title}: ${editing?.current} → ${target} charts/day.`}
      confirmLabel={applyFrom === "program_start" ? "Apply and recalculate history" : "Apply target"} confirmDisabled={!applyFrom} isLoading={saving}
      onCancel={() => { if (!saving) setConfirmOpen(false); }} onConfirm={() => { void save(); }}>
      <fieldset disabled={saving} className="mt-4 space-y-3 text-sm">
        <legend className="sr-only">Apply target from</legend>
        <label className="flex cursor-pointer gap-3 rounded-lg border border-border p-3">
          <input type="radio" name="target-scope" value="today" checked={applyFrom === "today"} onChange={() => setApplyFrom("today")} />
          <span><strong>From today</strong><span className="mt-1 block text-content-muted">Apply from {today} (IST). Recalculate affected daily records from today onward; earlier records keep their targets.</span></span>
        </label>
        <label className="flex cursor-pointer gap-3 rounded-lg border border-border p-3">
          <input type="radio" name="target-scope" value="program_start" checked={applyFrom === "program_start"} onChange={() => setApplyFrom("program_start")} />
          <span><strong>From the start of the program</strong><span className="mt-1 block text-content-muted">Apply to this stage across its full history. Recalculate all affected saved adjusted charts/day, including former employees.</span></span>
        </label>
      </fieldset>
      <p className="mt-3 text-xs text-content-muted">This replaces scheduled changes for this stage from the chosen start. Previous target settings are retained in the audit record.</p>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    </ConfirmDialog>
  </>;
}
