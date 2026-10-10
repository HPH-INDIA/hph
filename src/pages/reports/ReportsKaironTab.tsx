import type { ManualReportWindow } from "./manualReportSummary";
import { useAuth } from "@/features/auth/useAuth";

import { Link } from "react-router-dom";
import { KaironManagerReport } from "./KaironManagerReport";
import { KaironGlobalReport } from "./KaironGlobalReport";
import { KaironCoderReport, KaironLeadReport } from "./KaironRoleReports";

export function ReportsKaironTab({ window }: { window: ManualReportWindow }) {
  const { hasRoleType } = useAuth();
  const report = hasRoleType("lead") ? <KaironLeadReport window={window} />
    : hasRoleType("employee") ? <KaironCoderReport window={window} />
    : hasRoleType("manager") ? <KaironManagerReport window={window} />
    : <KaironGlobalReport window={window} />;
  return <div className="source-tab flex min-w-0 flex-col gap-3">{!hasRoleType("manager") && <div className="flex justify-end"><Link className="text-xs text-brand-700 underline" to="/reports/chart-holds?source=kairon&view=all">View chart holds</Link></div>}{report}</div>;
}
