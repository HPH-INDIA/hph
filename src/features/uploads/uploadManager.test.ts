import assert from "node:assert/strict";
import { test } from "node:test";
import type { FileImportProgress, PreparedFileImport } from "@/api/fileImportsApi";
import { UploadManager, type UploadTransport, type UploadInput } from "./uploadManager";
import { buildImportFile, uploadImportFile } from "./importFile";

function progress(id: string, status: FileImportProgress["status"] = "queued", totalRows = 1): FileImportProgress {
  return { id, kind: "kairon", sourceFilename: "test.csv", status, totalRows, processedCount: status === "completed" ? totalRows : 0,
    insertedCount: 0, createdCount: 0, updatedCount: 0, unchangedCount: 0, rejectedCount: 0, unmatchedCount: 0,
    error: null, createdAt: "2026-10-03", completedAt: null };
}
function input(count = 1): UploadInput {
  return { kind: "kairon", fileName: "test.csv", fileChecksum: "a".repeat(64), rows: Array.from({ length: count }, (_, index) => ({
    mbi: `synthetic-${index}`, program: "PVP", level: "1LR", status: "Active", codingAnalyst: "Test Analyst", actions: 0,
    lastAction: null, created: "2026-10-03", completed: null, tat: null, age: null, practice: null,
  })) };
}
async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) { if (check()) return; await new Promise<void>((resolve) => setImmediate(resolve)); }
  assert.fail("Expected state was not reached");
}
function harness(overrides: Partial<UploadTransport> = {}) {
  const calls: string[] = [];
  let prepared: PreparedFileImport;
  const transport: UploadTransport = {
    async prepare(body) { calls.push("prepare"); prepared = { ...progress(body.requestId, "uploading", body.totalRows),
      signedUrl: "https://test.supabase.co/upload", encryptionKey: btoa("x".repeat(32)), maxFileBytes: 50_000_000 }; return prepared; },
    async upload() { calls.push("upload"); },
    async complete(body) { calls.push("complete"); return progress(body.id, "queued", prepared.totalRows); },
    async get(id) { calls.push("get"); return progress(id, "completed", prepared?.totalRows ?? 1); },
    async list() { return []; },
    async retry(id) { calls.push("retry"); return progress(id); },
    async abandon(id) { calls.push("abandon"); return progress(id, "abandoned"); },
    invalidate() { calls.push("invalidate"); }, ...overrides,
  };
  const files: Blob[] = [];
  const manager = new UploadManager(transport, async (_id, _key, rows) => {
    const blob = new Blob([JSON.stringify(rows)]); files.push(blob); return { blob, checksum: "b".repeat(64) };
  }, async () => {});
  return { manager, calls, transport, files };
}

test("50,000 rows transfer as one file, then queue and poll", async () => {
  const { manager, calls, files } = harness(); manager.start(input(50_000));
  await until(() => manager.getSnapshot()[0].status === "completed");
  assert.deepEqual(calls, ["prepare", "upload", "complete", "get", "invalidate"]);
  assert.equal(files.length, 1); assert.equal(manager.getSnapshot()[0].processedCount, 50_000);
});

test("a lost completion response retries confirmation without repeating the transfer", async () => {
  const { manager, transport, calls } = harness(); const complete = transport.complete; let failed = false;
  transport.complete = async (body, signal) => { if (!failed) { failed = true; throw new Error("Response lost"); } return complete(body, signal); };
  const id = manager.start(input()); await until(() => manager.getSnapshot()[0].status === "failed");
  manager.retry(id); manager.retry(id);
  await until(() => manager.getSnapshot()[0].status === "completed");
  assert.equal(calls.filter((call) => call === "upload").length, 1);
  assert.equal(calls.filter((call) => call === "prepare").length, 1);
});

test("transfer retries retain exactly the same encrypted file", async () => {
  const { manager, transport, files } = harness(); let attempts = 0; const seen: Blob[] = [];
  transport.get = async (id) => progress(id, attempts < 2 ? "uploading" : "completed");
  transport.upload = async (_url, blob) => { seen.push(blob); if (++attempts === 1) throw new Error("Network interruption"); };
  const id = manager.start(input()); await until(() => manager.getSnapshot()[0].status === "failed");
  manager.retry(id); await until(() => manager.getSnapshot()[0].status === "completed");
  assert.equal(files.length, 1); assert.equal(seen[0], seen[1]);
});

test("login recovers a queued server import without uploading again", async () => {
  const { manager, calls } = harness({ async list() { return [progress("existing")]; } });
  manager.setSession(1); await until(() => manager.getSnapshot()[0]?.status === "completed");
  assert.deepEqual(calls, ["get", "invalidate"]);
});

test("logout aborts the transfer and late responses do not restore cleared jobs", async () => {
  let resolve!: () => void; let signal!: AbortSignal;
  const { manager, calls } = harness({ upload: async (_url, _blob, _transfer, requestSignal) => {
    signal = requestSignal; await new Promise<void>((res) => { resolve = res; });
  } });
  manager.start(input()); await until(() => Boolean(resolve)); manager.clear(); assert.equal(signal.aborted, true);
  resolve(); await new Promise<void>((res) => setImmediate(res)); assert.deepEqual(manager.getSnapshot(), []);
  assert.equal(calls.includes("complete"), false);
});

test("encrypted file blocks decrypt with the import ID and do not contain raw identifiers", async () => {
  const rows = input(1001).rows; const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const keyString = btoa(String.fromCharCode(...keyBytes)); const id = crypto.randomUUID();
  const { blob } = await buildImportFile(id, keyString, rows, 50_000_000, new AbortController().signal);
  const text = await blob.text(); assert.equal(text.includes("synthetic-"), false);
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const blocks = text.trim().split("\n"); assert.equal(blocks.length, 2);
  const decoded: unknown[] = [];
  for (const [index, line] of blocks.entries()) {
    const bytes = Uint8Array.from(atob(line), (c) => c.charCodeAt(0));
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12),
      additionalData: new TextEncoder().encode(`hph-import:v1:${id}:${index}`) }, key, bytes.slice(12));
    decoded.push(...JSON.parse(new TextDecoder().decode(plain)));
    await assert.rejects(crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12),
      additionalData: new TextEncoder().encode(`hph-import:v1:wrong:${index}`) }, key, bytes.slice(12)));
  }
  assert.deepEqual(decoded, rows);
});

test("TUS resumes from the server offset instead of restarting the file", async () => {
  const original = globalThis.fetch; const requests: { method: string; offset: string | null; size: number }[] = [];
  globalThis.fetch = async (_url, init) => {
    const headers = new Headers(init?.headers);
    requests.push({ method: init!.method!, offset: headers.get("Upload-Offset"), size: (init?.body as Blob)?.size ?? 0 });
    return new Response(null, { status: 204, headers: { "Upload-Offset": init?.method === "HEAD" ? "4" : "10" } });
  };
  try {
    const transfer = { url: "https://test.storage.supabase.co/storage/v1/upload/resumable/session" };
    await uploadImportFile("https://test.supabase.co/storage/v1/object/upload/sign/hph-imports/kairon/test.hph-import?token=token",
      new Blob(["0123456789"]), transfer, new AbortController().signal, () => {});
    assert.deepEqual(requests, [{ method: "HEAD", offset: null, size: 0 }, { method: "PATCH", offset: "4", size: 6 }]);
  } finally { globalThis.fetch = original; }
});


test("signed TUS creation uses the signed endpoint and upload content type", async () => {
  const original = globalThis.fetch;
  let created = false;
  globalThis.fetch = async (url, init) => {
    if (init?.method === "POST") {
      assert.equal(String(url), "https://test.storage.supabase.co/storage/v1/upload/resumable/sign");
      const headers = new Headers(init.headers);
      assert.equal(headers.get("Content-Type"), "application/offset+octet-stream");
      assert.equal(headers.get("x-signature"), "token");
      created = true;
      return new Response(null, { status: 201, headers: { Location: "https://test.storage.supabase.co/storage/v1/upload/resumable/sign/session" } });
    }
    return new Response(null, { status: 204, headers: { "Upload-Offset": init?.method === "HEAD" ? "0" : "4" } });
  };
  try {
    await uploadImportFile("https://test.supabase.co/storage/v1/object/upload/sign/hph-imports/kairon/test.hph-import?token=token",
      new Blob(["test"]), {}, new AbortController().signal, () => {});
    assert.equal(created, true);
  } finally { globalThis.fetch = original; }
});
