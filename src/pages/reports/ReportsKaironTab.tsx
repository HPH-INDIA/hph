import { useAuth } from "@/features/auth/useAuth";

import { KaironManagerReport } from "./KaironManagerReport";
import { KaironGlobalReport } from "./KaironGlobalReport";
import { KaironCoderReport, KaironLeadReport } from "./KaironRoleReports";

export function ReportsKaironTab() {
  const { hasRoleType } = useAuth();
  if (hasRoleType("lead")) return <KaironLeadReport />;
  if (hasRoleType("employee")) return <KaironCoderReport />;
  if (hasRoleType("manager")) return <KaironManagerReport />;
  return <KaironGlobalReport />;
}
