import type { ManualReportWindow } from "./manualReportSummary";
import { useAuth } from "@/features/auth/useAuth";

import { KaironManagerReport } from "./KaironManagerReport";
import { KaironGlobalReport } from "./KaironGlobalReport";
import { KaironCoderReport, KaironLeadReport } from "./KaironRoleReports";

export function ReportsKaironTab({ window }: { window: ManualReportWindow }) {
  const { hasRoleType } = useAuth();
  if (hasRoleType("lead")) return <KaironLeadReport window={window} />;
  if (hasRoleType("employee")) return <KaironCoderReport window={window} />;
  if (hasRoleType("manager")) return <KaironManagerReport window={window} />;
  return <KaironGlobalReport window={window} />;
}
