// Both KaironImportChunkSchema and ManualImportChunkSchema accept 2,000 rows.
// Keep batches sequential and the size fixed throughout an upload so retries
// reuse the same chunk number, rows, and checksum.
export const IMPORT_CHUNK_SIZE = 2_000;

export async function sha256(value: string | ArrayBuffer) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
