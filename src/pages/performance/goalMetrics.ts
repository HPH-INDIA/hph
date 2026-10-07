/** Signed distance from the adjusted goal, using Kairon completions. */
export function chartsToGoal(completed: number | null | undefined, adjustedTarget: string | null | undefined): number | null {
  if (completed == null || adjustedTarget == null || adjustedTarget.trim() === "") return null;
  const target = Number(adjustedTarget);
  if (!Number.isFinite(completed) || !Number.isFinite(target)) return null;
  // Targets are stored to two decimal places. Keep exact attainment at zero.
  return (Math.round(completed * 100) - Math.round(target * 100)) / 100;
}
