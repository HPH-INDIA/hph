const normalize = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const required = ["date", "employee", "firstin", "lastout", "totalinside", "totaloutside", "totalspan"];
export async function parseAttendance(file: File) {
  const XLSX = await import("@e965/xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const names = [...new Set(["03_All_Employees", "Coding", ...workbook.SheetNames])];
  for (const name of names) {
    if (!workbook.Sheets[name]) continue;
    const table = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, raw: true, defval: null });
    const index = table.slice(0, 15).findIndex((row) => required.every((key) => row.map(normalize).includes(key)));
    if (index < 0) continue;
    const headers = table[index].map((v) => String(v ?? ""));
    const dateIndex = headers.map(normalize).indexOf("date");
    const rows = table.slice(index + 1).filter((row) => row.some((v) => v !== null && v !== ""));
    if (workbook.Workbook?.WBProps?.date1904) {
      for (const row of rows) if (typeof row[dateIndex] === "number") row[dateIndex] = (row[dateIndex] as number) + 1462;
    }
    if (!rows.length) throw new Error("The attendance table has no day records.");
    return { headers, rows, sourceFormat: name === "03_All_Employees" ? "Office attendance dashboard" : name === "Coding" ? "Employee-wise attendance" : "Attendance workbook" };
  }
  throw new Error("The workbook does not contain a supported attendance table.");
}
