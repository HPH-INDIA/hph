import { useEffect } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { defaultMetricTheme, metricStyles, validMetricTheme } from "./metricTheme";
import { useGetMetricThemeQuery } from "./metricThemeApi";

/** Application belongs to every Coding role; editing remains manager-only. */
export function ProjectMetricTheme() {
  const {user} = useAuth();
  const enabled = user?.isActive && user.project?.trim().toUpperCase() === "CODING";
  const {currentData} = useGetMetricThemeQuery(String(user?.id), {skip:!enabled, pollingInterval:15000, refetchOnMountOrArgChange:true, refetchOnFocus:true});
  const theme = enabled && validMetricTheme(currentData?.theme) ? currentData.theme : defaultMetricTheme;
  useEffect(() => {
    for(const {key} of metricStyles) document.documentElement.style.setProperty(`--color-metric-${key}`,theme[key]);
    return () => {for(const {key} of metricStyles) document.documentElement.style.removeProperty(`--color-metric-${key}`);};
  }, [theme]);
  return null;
}
