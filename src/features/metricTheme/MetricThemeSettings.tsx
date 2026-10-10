import { useGetMetricThemeQuery, useSaveMetricThemeMutation } from "./metricThemeApi";
import { useState } from "react";
import { ActionScreen } from "@/components/ui/ActionScreen";
import { Button } from "@/components/ui/Button";
import { defaultMetricTheme, loadMetricTheme, metricStyles, validMetricTheme, type MetricTheme } from "./metricTheme";

export function MetricThemeSettings({ userId }: { userId: number }) {
  const { currentData, isLoading, isError } = useGetMetricThemeQuery(String(userId));
  const [saveTheme, {isLoading: saving}] = useSaveMetricThemeMutation();
  const theme = currentData?.configured ? currentData.theme : loadMetricTheme(userId);
  const [draft, setDraft] = useState<MetricTheme>(theme);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    if (!validMetricTheme(draft)) return;
    setError("");
    try { await saveTheme(draft).unwrap(); setOpen(false); }
    catch { setError("Could not save the project theme. Please retry; your changes have not been saved."); }
  };
  return <>
    <button type="button" className="app-nav-link w-full" onClick={() => { setDraft({...theme}); setError(""); setOpen(true); }}>Color theme</button>
    <ActionScreen open={open} onClose={() => setOpen(false)} title="Metric color theme" description="Choose colors for Kairon, Manual, Adjusted and Target throughout your workspace.">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <p className="text-sm text-content-secondary">Colors are saved for the Coding project and shared with managers, leads, and coders across browsers. Line patterns and shapes remain consistent across all themes.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {metricStyles.map(item => <section key={item.key} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="font-semibold">{item.label}</h2><label className="flex items-center gap-3 text-xs"><span className="sr-only">{item.label} color</span><input type="color" aria-label={`${item.label} color`} className="h-10 w-14 cursor-pointer rounded border border-border" value={/^#[0-9a-f]{6}$/i.test(draft[item.key]) ? draft[item.key] : item.color} onChange={event => setDraft({...draft, [item.key]:event.target.value})} /><input type="text" aria-label={`${item.label} hex code`} aria-invalid={!/^#[0-9a-f]{6}$/i.test(draft[item.key])} aria-describedby={`${item.key}-hex-help`} className="h-10 w-28 rounded-md border border-border bg-surface px-3 font-mono text-sm text-content-primary focus-visible:ring-2 focus-visible:ring-brand-500" value={draft[item.key]} placeholder="#312E81" autoComplete="off" spellCheck={false} onChange={event => {
              const raw = event.target.value.trim();
              const hex = raw.replace(/^#/, "");
              setDraft({...draft, [item.key]: /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toUpperCase()}` : raw});
            }} onBlur={() => {
              const hex = draft[item.key].replace(/^#/, "");
              if (/^[0-9a-f]{3}$/i.test(hex)) setDraft({...draft, [item.key]: `#${hex.split("").map(char => char + char).join("").toUpperCase()}`});
            }} /></label></div>
            <p id={`${item.key}-hex-help`} className={`mt-2 text-xs ${/^#[0-9a-f]{6}$/i.test(draft[item.key]) ? "text-content-secondary" : "text-danger"}`}>{/^#[0-9a-f]{6}$/i.test(draft[item.key]) ? "Paste a hex code, with or without #." : "Enter a valid hex color, for example #312E81."}</p>
            <p className="mt-2 text-xs text-content-secondary">{item.pattern}</p>
            <svg className="mt-4 h-12 w-full" viewBox="0 0 260 48" role="img" aria-label={`${item.label} line preview`}>
              <path d="M8 32 85 15 170 29 252 10" fill="none" stroke={/^#[0-9a-f]{6}$/i.test(draft[item.key]) ? draft[item.key] : item.color} strokeWidth={item.width} strokeDasharray={item.dash}/>
              {item.key === "kairon" ? <circle cx="85" cy="15" r="5" fill={/^#[0-9a-f]{6}$/i.test(draft[item.key]) ? draft[item.key] : item.color}/> : item.key === "manual" ? <rect x="79" y="9" width="12" height="12" fill="none" stroke={/^#[0-9a-f]{6}$/i.test(draft[item.key]) ? draft[item.key] : item.color} strokeWidth="2.5"/> : <path d={item.key === "adjusted" ? "M85 9 91 15 85 21 79 15Z" : "M85 9 91 20 79 20Z"} fill="white" stroke={/^#[0-9a-f]{6}$/i.test(draft[item.key]) ? draft[item.key] : item.color} strokeWidth="2"/>}
            </svg>
            <div className="mt-3 rounded-md px-4 py-3 text-center font-semibold" style={{color:/^#[0-9a-f]{6}$/i.test(draft[item.key]) ? draft[item.key] : item.color,background:`${/^#[0-9a-f]{6}$/i.test(draft[item.key]) ? draft[item.key] : item.color}12`}}>{item.label} · 28.12</div>
          </section>)}
        </div>
        <p className="text-xs text-content-muted">Choose dark, distinct colors for readable values on white backgrounds. Defaults use indigo, orange, teal and purple.</p>
        {isError && <p role="alert" className="text-sm text-danger">Project theme could not be loaded. Check the backend connection and reopen this screen.</p>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-4"><Button variant="ghost" onClick={() => setDraft({...defaultMetricTheme})}>Reset to defaults</Button><div className="flex gap-3"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!validMetricTheme(draft) || saving || isLoading || isError} onClick={save}>{saving ? "Saving…" : "Save project theme"}</Button></div></div>
      </div>
    </ActionScreen>
  </>;
}
