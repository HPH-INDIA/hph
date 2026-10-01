// Run: node_modules/.bin/esbuild src/features/uploads/uploadManager.test.ts --bundle --platform=node --format=esm --tsconfig=tsconfig.app.json --outfile=/tmp/hph-upload-tests.mjs && node --test /tmp/hph-upload-tests.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  KaironChartRowInput,
  KaironImportChunkPayload,
  KaironImportProgress,
  ManualDailyRecord,
  ManualImportProgress,
  ManualImportRow,
} from "@/api/types";
import { IMPORT_CHUNK_SIZE } from "@/lib/imports";

import { UploadManager, type UploadInput, type UploadTransport } from "./uploadManager";

const manualRow = (userId = 1): ManualImportRow => ({
  userId, date: "2026-09-30", productionCount: 4, techIssuesDowntimeHours: 1,
  noInventoryIdleTimeHours: 2, leaveHours: 3, meetingEngagementHours: 4,
});
const chartRow = (): KaironChartRowInput => ({
  mbi: "test-identifier", program: "test", level: "1LR",
  status: "Completed", codingAnalyst: "Test Analyst",
  actions: 1, lastAction: null, created: "2026-09-30", completed: null, tat: null, age: null, practice: null,
});
function manual(rows = [manualRow()], checksum = "manual-checksum"): UploadInput {
  return { kind: "manual", fileName: `${checksum}.xlsx`, fileChecksum: checksum, rows, minDate: "2026-09-30", maxDate: "2026-09-30" };
}
function kairon(count = 1, checksum = "kairon-checksum"): UploadInput {
  return { kind: "kairon", fileName: "charts.csv", fileChecksum: checksum, rows: Array.from({ length: count }, chartRow) };
}
function progress(id: number, totalRows: number, processedCount = 0): KaironImportProgress {
  return {
    id, totalRows, processedCount, status: "uploading", sourceFilename: "test.csv",
    insertedCount: 0, updatedCount: 0, unchangedCount: 0, rejectedCount: 0, unmatchedCount: 0,
    uploadedAt: "2026-10-01", completedAt: null,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (check()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  assert.fail("Upload did not reach the expected state");
}

function harness(overrides: Partial<UploadTransport> = {}) {
  let nextId = 0;
  const imports = new Map<number, KaironImportProgress>();
  const calls = { start: [] as string[], chunks: [] as KaironImportChunkPayload[], complete: [] as number[], compare: 0 };
  const transport: UploadTransport = {
    async listManualRecords() { calls.compare++; return []; },
    async startKairon(payload) {
      calls.start.push(payload.fileChecksum);
      const started = progress(++nextId, payload.totalRows);
      imports.set(started.id, started);
      return started;
    },
    async uploadKairon(payload) {
      calls.chunks.push(payload);
      const current = imports.get(payload.importId)!;
      const next = { ...current, processedCount: current.processedCount + payload.rows.length };
      imports.set(next.id, next);
      return next;
    },
    async completeKairon(id) {
      calls.complete.push(id);
      return { ...imports.get(id)!, status: "completed" };
    },
    async startManual(payload, signal) {
      const started = await transport.startKairon(payload, signal);
      return { ...started, sourceFilename: payload.sourceFilename, status: "uploading", createdCount: 0 };
    },
    async uploadManual(payload, signal) {
      const next = await transport.uploadKairon(payload as unknown as KaironImportChunkPayload, signal);
      return { ...next, sourceFilename: "test.xlsx", status: "uploading", createdCount: 0 };
    },
    async completeManual(id, signal) {
      const completed = await transport.completeKairon(id, signal);
      return { ...completed, sourceFilename: "test.xlsx", status: "completed", createdCount: 0 };
    },
    ...overrides,
  };
  let hashes = 0;
  const manager = new UploadManager(transport, async () => `checksum-${++hashes}`);
  return { manager, transport, calls, hashes: () => hashes };
}

test("registers before comparison and runs Kairon/manual independently after all listeners unmount", async () => {
  const comparison = deferred<ManualDailyRecord[]>();
  const { manager, calls } = harness({ listManualRecords: () => comparison.promise });
  const unsubscribe = manager.subscribe(() => {});
  const manualId = manager.start(manual());
  assert.equal(manager.getSnapshot()[0].status, "preparing");
  assert.deepEqual(calls.start, []);
  const kaironId = manager.start(kairon());
  unsubscribe(); // Closing a drawer / navigating has no influence on the runner.
  await until(() => manager.getSnapshot().find((job) => job.id === kaironId)?.status === "completed");
  assert.equal(manager.getSnapshot().find((job) => job.id === manualId)?.status, "preparing");
  comparison.resolve([]);
  await until(() => manager.getSnapshot().every((job) => job.status === "completed"));
  assert.equal(calls.complete.length, 2);
});

test("two different manual files keep distinct imports and completion state", async () => {
  const first = deferred<ManualImportProgress>();
  const { manager, transport, calls } = harness();
  const upload = transport.uploadManual;
  transport.uploadManual = async (payload, signal) => {
    const result = await upload(payload, signal);
    return payload.rows[0].userId === 1 ? first.promise : result;
  };
  const firstId = manager.start(manual([manualRow(1)], "first"));
  const secondId = manager.start(manual([manualRow(2)], "second"));
  assert.notEqual(firstId, secondId);
  await until(() => manager.getSnapshot().find((job) => job.id === secondId)?.status === "completed");
  assert.equal(manager.getSnapshot().find((job) => job.id === firstId)?.status, "uploading");
  const firstImportId = calls.chunks.find((chunk) => (chunk.rows as unknown as ManualImportRow[])[0].userId === 1)!.importId;
  first.resolve({ ...progress(firstImportId, 1, 1), sourceFilename: "first.xlsx", status: "uploading", createdCount: 1 });
  await until(() => manager.getSnapshot().every((job) => job.status === "completed"));
  assert.equal(new Set(calls.complete).size, 2);
});

test("retries only the failed chunk with exactly the same rows/checksum and guards double Retry", async () => {
  const { manager, transport, calls, hashes } = harness();
  const original = transport.uploadKairon;
  const attempts: KaironImportChunkPayload[] = [];
  let failed = false;
  transport.uploadKairon = async (payload, signal) => {
    attempts.push(payload);
    if (payload.chunkNumber === 1 && !failed) { failed = true; throw new Error("Temporary failure"); }
    return original(payload, signal);
  };
  const input = kairon(IMPORT_CHUNK_SIZE * 2 + 1);
  const id = manager.start(input);
  input.rows[0] = chartRow();
  (input.rows[0] as KaironChartRowInput).mbi = "changed-after-submit";
  await until(() => manager.getSnapshot()[0].status === "failed");
  assert.equal(manager.getSnapshot()[0].processedCount, IMPORT_CHUNK_SIZE);
  assert.equal(manager.getSnapshot()[0].error, "Temporary failure");
  assert.equal(attempts[0].rows[0].mbi, "test-identifier");
  manager.retry(id);
  manager.retry(id);
  await until(() => manager.getSnapshot()[0].status === "completed");
  assert.deepEqual(attempts.map((chunk) => chunk.chunkNumber), [0, 1, 1, 2]);
  assert.deepEqual(attempts[1], attempts[2]);
  assert.equal(hashes(), 3);
  assert.equal(calls.start.length, 1);
});

test("retries completion without repeating acknowledged chunks", async () => {
  const { manager, transport, calls } = harness();
  const complete = transport.completeKairon;
  let attempts = 0;
  transport.completeKairon = (id, signal) => {
    if (++attempts === 1) return Promise.reject(new Error("Completion response lost"));
    return complete(id, signal);
  };
  const id = manager.start(kairon());
  await until(() => manager.getSnapshot()[0].status === "failed");
  manager.retry(id);
  await until(() => manager.getSnapshot()[0].status === "completed");
  assert.equal(attempts, 2);
  assert.equal(calls.chunks.length, 1);
  assert.equal(calls.start.length, 1);
});

test("an incomplete acknowledgement preserves the original chunk for retry", async () => {
  const { manager, transport } = harness();
  const attempts: KaironImportChunkPayload[] = [];
  transport.uploadKairon = async (payload) => {
    attempts.push(payload);
    return progress(payload.importId, 2, attempts.length === 1 ? 1 : 2);
  };
  transport.completeKairon = async (id) => ({ ...progress(id, 2, 2), status: "completed" });
  const id = manager.start(kairon(2));
  await until(() => manager.getSnapshot()[0].status === "failed");
  manager.retry(id);
  await until(() => manager.getSnapshot()[0].status === "completed");
  assert.deepEqual(attempts[0], attempts[1]);
  assert.equal(attempts.length, 2);
});

test("manual comparison checks all five fields once and retains candidates after a start failure", async () => {
  const same = manualRow(1);
  const changed = manualRow(2);
  const record = (row: ManualImportRow) => ({
    ...row, techIssuesDowntimeHours: `${row.techIssuesDowntimeHours}.00`,
    noInventoryIdleTimeHours: String(row.noInventoryIdleTimeHours), leaveHours: String(row.leaveHours),
    meetingEngagementHours: String(row.meetingEngagementHours),
  }) as ManualDailyRecord;
  let comparisons = 0;
  const { manager, transport, calls } = harness({
    async listManualRecords() { comparisons++; return [record(same), { ...record(changed), meetingEngagementHours: "4.5" }]; },
  });
  const start = transport.startManual;
  let attempts = 0;
  transport.startManual = (payload, signal) => ++attempts === 1
    ? Promise.reject(new Error("Start unavailable")) : start(payload, signal);
  const id = manager.start(manual([same, changed, manualRow(3)]));
  await until(() => manager.getSnapshot()[0].status === "failed");
  assert.deepEqual(manager.getSnapshot()[0].comparison, { newCount: 1, modifiedCount: 1, unchangedCount: 1 });
  manager.retry(id);
  await until(() => manager.getSnapshot()[0].status === "completed");
  assert.equal(comparisons, 1);
  assert.equal(manager.getSnapshot()[0].totalRows, 2);
  assert.deepEqual((calls.chunks[0].rows as unknown as ManualImportRow[]).map((row) => row.userId), [2, 3]);
});

test("all unchanged manual records finish without creating an import", async () => {
  const row = manualRow();
  const { manager, calls } = harness({
    async listManualRecords() { return [{ ...row } as unknown as ManualDailyRecord]; },
  });
  manager.start(manual([row]));
  await until(() => manager.getSnapshot()[0].status === "completed");
  assert.deepEqual(manager.getSnapshot()[0].comparison, { newCount: 0, modifiedCount: 0, unchangedCount: 1 });
  assert.equal(calls.start.length, 0);
  assert.equal(calls.chunks.length, 0);
  assert.equal(calls.complete.length, 0);
});

test("resumes a backend import from acknowledged rows and skips a backend-completed import", async () => {
  const { manager, transport, calls } = harness();
  transport.startKairon = async () => progress(99, IMPORT_CHUNK_SIZE + 1, IMPORT_CHUNK_SIZE);
  transport.uploadKairon = async (payload) => {
    calls.chunks.push(payload);
    return progress(99, IMPORT_CHUNK_SIZE + 1, IMPORT_CHUNK_SIZE + 1);
  };
  transport.completeKairon = async () => ({ ...progress(99, IMPORT_CHUNK_SIZE + 1, IMPORT_CHUNK_SIZE + 1), status: "completed" });
  manager.start(kairon(IMPORT_CHUNK_SIZE + 1));
  await until(() => manager.getSnapshot()[0].status === "completed");
  assert.equal(calls.chunks[0].chunkNumber, 1);
  assert.equal(calls.chunks[0].rows.length, 1);
  transport.startKairon = async () => ({ ...progress(100, 1, 1), status: "completed" });
  manager.start(kairon(1, "already-completed"));
  await until(() => manager.getSnapshot().every((job) => job.status === "completed"));
  assert.equal(calls.chunks.length, 1);
});

test("a failed backend import does not send chunks or complete", async () => {
  const { manager, calls } = harness({ startKairon: async () => ({ ...progress(1, 1), status: "failed" }) });
  const id = manager.start(kairon());
  await until(() => manager.getSnapshot()[0].status === "failed");
  manager.retry(id);
  await until(() => manager.getSnapshot()[0].status === "failed");
  assert.match(manager.getSnapshot()[0].error!, /server marked this import as failed/);
  assert.equal(calls.chunks.length, 0);
  assert.equal(calls.complete.length, 0);
});

test("same type and checksum deduplicate active/failed work; dismiss releases failed work", async () => {
  const failure = deferred<KaironImportProgress>();
  const { manager } = harness({ startKairon: () => failure.promise });
  const id = manager.start(kairon());
  assert.equal(manager.start(kairon()), id);
  manager.dismiss(id);
  assert.equal(manager.getSnapshot().length, 1);
  failure.reject(new Error("Offline"));
  await until(() => manager.getSnapshot()[0].status === "failed");
  assert.equal(manager.start(kairon()), id);
  manager.dismiss(id);
  assert.equal(manager.getSnapshot().length, 0);
  assert.notEqual(manager.start(kairon()), id);
  await until(() => manager.getSnapshot()[0].status === "failed");
});

test("clear aborts an in-flight chunk, prevents later chunks, and ignores a late response", async () => {
  const pending = deferred<KaironImportProgress>();
  let requestSignal: AbortSignal | undefined;
  const { manager, transport, calls } = harness();
  transport.uploadKairon = async (payload, signal) => { calls.chunks.push(payload); requestSignal = signal; return pending.promise; };
  manager.start(kairon(IMPORT_CHUNK_SIZE + 1));
  await until(() => calls.chunks.length === 1);
  manager.clear();
  assert.equal(requestSignal?.aborted, true);
  const emptySnapshot = manager.getSnapshot();
  pending.resolve(progress(1, IMPORT_CHUNK_SIZE + 1, IMPORT_CHUNK_SIZE));
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(manager.getSnapshot(), emptySnapshot);
  assert.equal(manager.getSnapshot().length, 0);
  assert.equal(calls.chunks.length, 1);
  assert.equal(calls.complete.length, 0);
});

test("clearing during comparison prevents starting any import", async () => {
  const pending = deferred<ManualDailyRecord[]>();
  const { manager, calls } = harness({ listManualRecords: () => pending.promise });
  manager.start(manual());
  manager.clear();
  pending.resolve([]);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(manager.getSnapshot(), []);
  assert.equal(calls.start.length, 0);
});

test("session refresh retains uploads; switching user or losing authentication clears them", async () => {
  const pending = deferred<KaironImportProgress>();
  const { manager, calls } = harness({ startKairon: () => pending.promise });
  manager.setSession(1);
  manager.start(kairon());
  const current = manager.getSnapshot();
  manager.setSession(1); // whoami loading retains the current user's id.
  assert.equal(manager.getSnapshot(), current);
  manager.setSession(2);
  assert.deepEqual(manager.getSnapshot(), []);
  pending.resolve(progress(1, 1));
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(calls.chunks.length, 0);
  manager.start(kairon());
  manager.setSession(null); // logout or whoami rejected.
  assert.deepEqual(manager.getSnapshot(), []);
});

test("snapshot identity is stable between state changes and completed jobs can be dismissed", async () => {
  const { manager } = harness();
  assert.equal(manager.getSnapshot(), manager.getSnapshot());
  const id = manager.start(kairon());
  await until(() => manager.getSnapshot()[0].status === "completed");
  const completed = manager.getSnapshot();
  assert.equal(manager.getSnapshot(), completed);
  manager.retry(id);
  assert.equal(manager.getSnapshot(), completed);
  manager.dismiss(id);
  assert.deepEqual(manager.getSnapshot(), []);
});
