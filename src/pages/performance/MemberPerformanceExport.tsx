import type { CoderPerformanceMember } from "@/api/coderPerformance";
import { Button } from "@/components/ui/Button";
import { memberCsv } from "./performanceView";

export function MemberPerformanceExport({ members, exportName, nameLabel = "Coder" }: {
  members: CoderPerformanceMember[];
  exportName: string;
  nameLabel?: "Coder" | "Lead";
}) {
  function download() {
    const blob = new Blob(["\uFEFF", memberCsv(members, nameLabel)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${exportName}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <Button type="button" variant="secondary" onClick={download} disabled={!members.length}
    aria-label={`Export ${nameLabel === "Lead" ? "QA" : "coder"} performance CSV`}>
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 2v10m-4-4 4 4 4-4M3 13v4h14v-4" /></svg>
    Export CSV
  </Button>;
}
