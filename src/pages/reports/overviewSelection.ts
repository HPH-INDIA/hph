import type { CodingDashboardCard, ManagerPerformanceMember } from "@/api/types";

type Member = Pick<ManagerPerformanceMember, "userId" | "roleType" | "leadId">;
/** QA follows selected teams; the coder picker affects coders only. */
export function selectOverviewCards<T extends Pick<CodingDashboardCard, "userId">>(
  cards: T[], members: Member[], teams: string[] | null, coders: string[] | null,
  groups: { qa: boolean; coders: boolean },
): T[] {
  const byId = new Map(members.map(member => [member.userId, member]));
  return cards.filter(card => {
    const member = byId.get(card.userId);
    if (!member) return false;
    const team = member.leadId === null ? "unassigned" : `lead-${member.leadId}`;
    if (teams !== null && !teams.includes(team)) return false;
    return member.roleType === "lead" ? groups.qa
      : groups.coders && (coders === null || coders.includes(String(member.userId)));
  });
}
