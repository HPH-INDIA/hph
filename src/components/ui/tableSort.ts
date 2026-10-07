export type SortDirection = "asc" | "desc";
export interface TableSort { key: string; direction: SortDirection }
export interface SortColumn<T> {
  key: string;
  label: string;
  value: (row: T) => string | number | null | undefined;
  defaultDirection?: SortDirection;
}

export function numericSortValue(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Sort a copy, preserving ties and keeping unavailable values last in either direction. */
export function sortTableRows<T>(rows: readonly T[], columns: readonly SortColumn<T>[], sort: TableSort): T[] {
  const column = columns.find((candidate) => candidate.key === sort.key);
  if (!column) return [...rows];
  return [...rows].sort((a, b) => {
    const left = column.value(a), right = column.value(b);
    const missingLeft = left == null || (typeof left === "number" && !Number.isFinite(left));
    const missingRight = right == null || (typeof right === "number" && !Number.isFinite(right));
    if (missingLeft || missingRight) return Number(missingLeft) - Number(missingRight);
    const comparison = typeof left === "number" && typeof right === "number"
      ? left - right : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
    return sort.direction === "asc" ? comparison : -comparison;
  });
}

export function nextTableSort<T>(current: TableSort, column: SortColumn<T>): TableSort {
  return { key: column.key, direction: current.key === column.key ? (current.direction === "asc" ? "desc" : "asc") : column.defaultDirection ?? "asc" };
}
