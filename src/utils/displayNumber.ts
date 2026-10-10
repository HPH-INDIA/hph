/** Presentation only: calculations, sorting and saved values retain their precision. */
export function displayNumber(value: number | string | null | undefined, decimals = 0): string {
  if (value == null || value === "" || !Number.isFinite(Number(value))) return "—";
  const number = Number(Number(value).toFixed(decimals));
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(Object.is(number, -0) ? 0 : number);
}

export const displayCpd = (value: number | string | null | undefined) => displayNumber(value, 2);
