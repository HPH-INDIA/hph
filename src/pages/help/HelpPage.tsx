import { useState } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { PerformanceTabs } from "@/pages/performance/PerformanceTabs";

type Guide = "manager" | "lead" | "coder" | "formulas";
type Article = { title: string; text: string; formula?: string };
const guides: Record<Guide, Article[]> = {
  manager: [
    { title: "Choose your reporting scope", text: "Use Filters to choose the reporting dates and available scope options. Overview brings QA and coders together; Coders and QA let you review each group separately. QA means the leads’ own records, while coder results cover their reporting coders." },
    { title: "Select teams and people", text: "Choose a lead / team, then use the Coders selector to select one or more people. Search names, select all, or clear the selection. User selectors inside a table narrow that table, its totals, and its export; they do not change the summary cards above it." },
    { title: "Explore performance", text: "People compares users. Daily groups results by date; expand a date to inspect its contributors. Goal & rates shows calendar goals, efficiency, and CPD. Trends shows changes over time. Select a person’s name to open their details rather than adding a filter." },
    { title: "Understand team membership", text: "Teams follow current reporting assignments. Inactive people can remain available for periods through their last working day. QA and coder sections maintain separate goals, counts, and rates. Program filters change completed chart counts; stage targets and recorded hours remain shared across programs." },
    { title: "Manage your workspace", text: "Use Team and Users when your permissions allow it. Coding project managers can open Color theme above their profile in the sidebar, paste a hex color code or use a color picker, and save. The saved project theme is shared with Coding managers, leads, and coders across browsers. Line patterns and marker shapes remain consistent." },
  ],
  lead: [
    { title: "Switch between QA and your coders", text: "QA · your performance shows only your own QA records. Coders under you shows your direct reports. Coder selections affect the coder section, not your own QA results." },
    { title: "Review a period or person", text: "Use Filters to set the reporting period. Use the coder selector to narrow the available people. People compares coders, Daily groups their results by date, Goal & rates shows goals and rates, and Trends shows changes over time. Click a person’s name to inspect their details." },
    { title: "Read daily results", text: "Daily totals use available records. Expand a date where available to see contributors. Mixed stages means contributors had different stages on that date. All coders combines counts and targets, while rates are calculated from combined hours and capacity." },
    { title: "Compare and export", text: "Use Efficiency filters to compare Kairon or Manual performance bands. These filters affect matching table rows, totals, and CSV exports. Use Reports to compare sources and inspect available Kairon and Manual records. Actions depend on your assigned permissions." },
  ],
  coder: [
    { title: "Review your dashboard", text: "Overview combines your monthly goal, efficiency, charts per day, and daily records. Use the month selector to change the reporting month. Trends shows your production, CPD, and lost hours over time." },
    { title: "Read your goal and daily table", text: "The monthly goal covers the full month, while the daily table covers recorded dates. Their adjusted totals can differ. Chart shortfall / surplus compares Kairon charts completed with the adjusted monthly goal. Efficiency and CPD describe your recorded performance, not progress against the entire month." },
    { title: "Use reports and chart holds", text: "Open Reports to inspect available Kairon charts and saved Manual records. Apply the shared reporting filters before comparing sources. Chart holds shows held inventory. In a user details screen, held charts are current inventory across all dates, independent of the completed-record date range." },
    { title: "Filter and export daily records", text: "Efficiency filters narrow daily records by source and performance band. Export CSV includes all matching records and a Total row, even when a table has multiple pages. Numeric values with no data export as 0; on-screen unavailable rates may show a dash." },
  ],
  formulas: [
    { title: "Kairon and Manual charts completed", text: "Kairon counts completed charts from its source records. Manual counts saved manual production. Counts are added across the selected people and dates. Difference compares the two sources.", formula: "Difference = Kairon charts completed − Manual charts completed" },
    { title: "Adjusted Targets and Adjusted Target CPD", text: "Adjusted Targets adds saved manual daily targets. Adjusted Target CPD averages these targets per recorded coder-day; it is not the total number of charts. Available manual hours start at 8 and deduct downtime, idle / no-inventory time, leave, and meetings other than Huddle, including one-on-ones. Hours cannot fall below zero. The value updates when the manual record is saved.", formula: "Daily adjusted target = stage target × available manual hours ÷ 8\nAdjusted Target CPD = sum of saved daily adjusted targets ÷ recorded coder-days" },
    { title: "Actual charts per day (CPD)", text: "Kairon and Manual CPD normalize charts to an 8-hour day using Daily Refresh effective hours. Those hours deduct downtime, idle time, all meetings, and leave. Team and period CPD use combined source charts and hours, rather than adding individual CPD values. A missing or zero denominator gives an unavailable rate.", formula: "Actual CPD = completed charts × 8 ÷ effective hours" },
    { title: "Target CPD and graph averages", text: "Target CPD represents the expected daily rate. Combined table rates use effective target capacity and hours. In trends, Target CPD and Adjusted CPD are averages of the underlying recorded coder-day values for each plotted period, not sums of every person’s rate. These averages can differ from an hours-weighted table rate.", formula: "Combined Target CPD = effective target capacity × 8 ÷ effective hours" },
    { title: "Efficiency", text: "Each source’s charts are compared with the target capacity for its effective hours. Combined efficiency uses the combined eligible charts and capacity, not an average of displayed percentages. Values are capped at 120%. Saved manual adjusted targets and Daily Refresh effective target capacity use different meeting deductions.", formula: "Efficiency = min(120%, completed charts ÷ effective target capacity × 100)" },
    { title: "Target goal and Adjusted goal", text: "Calendar goals use stage targets for eligible workdays, excluding weekends, office holidays, and full-leave days. Saved manual adjustments reduce eligible targets. Month mode uses the full month; other date modes use the selected dates. A full-month goal includes eligible dates that may not yet have daily records." },
    { title: "Chart shortfall / surplus", text: "A negative number means below goal, zero means at goal, and a positive number means above goal. This is a chart count, not a percentage.", formula: "Chart shortfall / surplus = Kairon charts completed − Adjusted goal" },
    { title: "Totals, missing data, and rounding", text: "The Total row uses all matching rows. Chart counts and targets are added; CPD and efficiency are recalculated using available source hours, targets, and recorded-day counts. Counts and percentages display rounded whole numbers; CPD displays up to two decimals. Calculations use underlying values before display rounding. A dash indicates an unavailable value; CSV numeric blanks are exported as 0." },
    { title: "Dates, filters, and graph markers", text: "Weekends and office holidays are hidden in trends only when neither source has production. Dates with production remain visible. Kairon uses a thick solid line with circles, Manual a dashed line with hollow squares, Adjusted a dash-dot line with diamonds, and Target a dotted line with triangles. Table efficiency filters affect table totals and exports; reporting-period filters control the broader reporting scope." },
  ],
};

export function HelpPage() {
  const { user } = useAuth();
  const role = user?.role.roleType;
  const [guide, setGuide] = useState<Guide>(role === "manager" || role === "lead" ? role : "coder");
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const articles = guides[guide].filter(article => `${article.title} ${article.text} ${article.formula ?? ""}`.toLowerCase().includes(query));
  return <div className="mx-auto max-w-screen-xl space-y-4 text-content-primary">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-2xl font-semibold">Help & guides</h1><p className="mt-1 text-sm text-content-secondary">How to use your workspace and understand its numbers.</p></div>
      <label className="block w-full sm:w-72"><span className="sr-only">Search this guide</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search this guide" className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-brand-500" /></label>
    </header>
    <PerformanceTabs value={guide} onChange={setGuide} label="Help guides" items={[{value:"manager",label:"Manager"},{value:"lead",label:"Lead"},{value:"coder",label:"Coder"},{value:"formulas",label:"Formulas & definitions"}]} />
    <p className="text-xs text-content-secondary">Guides describe available workflows. Your role and permissions determine the screens and actions you can access.</p>
    <section aria-label="Guide articles" className="grid gap-3 lg:grid-cols-2">
      {articles.map(article => <article key={article.title} className="rounded-lg border border-border bg-surface p-5"><h2 className="text-base font-semibold">{article.title}</h2>{article.formula && <p className="mt-3 whitespace-pre-line rounded-md bg-surface-muted p-3 text-sm font-medium leading-relaxed">{article.formula}</p>}<p className="mt-3 text-sm leading-relaxed text-content-secondary">{article.text}</p></article>)}
    </section>
    {!articles.length && <p role="status" className="rounded-lg border border-border bg-surface p-6 text-sm text-content-secondary">No matching topics in this guide. Try another search or switch guides.</p>}
  </div>;
}
