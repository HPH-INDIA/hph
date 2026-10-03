import { sha256 } from "@/lib/imports";

const BLOCK_ROWS = 1000;
function base64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

/** Only the browser parser's allowlisted rows enter storage, never the original workbook. */
export async function buildImportFile(id: string, keyBase64: string, rows: unknown[], maxBytes: number, signal: AbortSignal) {
  const key = await crypto.subtle.importKey("raw", Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0)), "AES-GCM", false, ["encrypt"]);
  const lines: string[] = [];
  let size = 0;
  for (let offset = 0; offset < rows.length; offset += BLOCK_ROWS) {
    signal.throwIfAborted();
    const index = offset / BLOCK_ROWS;
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(rows.slice(offset, offset + BLOCK_ROWS)));
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce,
      additionalData: new TextEncoder().encode(`hph-import:v1:${id}:${index}`) }, key, plaintext));
    const combined = new Uint8Array(nonce.length + ciphertext.length);
    combined.set(nonce); combined.set(ciphertext, nonce.length);
    const line = base64(combined) + "\n";
    size += line.length;
    if (size > maxBytes) throw new Error(`The prepared file exceeds the ${(maxBytes / 1_000_000).toFixed(0)} MB upload limit.`);
    lines.push(line);
  }
  const blob = new Blob(lines, { type: "application/octet-stream" });
  return { blob, checksum: await sha256(await blob.arrayBuffer()) };
}

interface Transfer { url?: string }

/** TUS transfer retries resume from Supabase's authoritative byte offset. */
export async function uploadImportFile(signedUrl: string, blob: Blob, transfer: Transfer, signal: AbortSignal, onProgress: (percent: number) => void) {
  const signed = new URL(signedUrl);
  const token = signed.searchParams.get("token");
  const marker = "/storage/v1/object/upload/sign/";
  const object = signed.pathname.split(marker)[1];
  if (!token || !object) throw new Error("The server returned an invalid storage upload URL.");
  const slash = object.indexOf("/");
  const bucket = decodeURIComponent(object.slice(0, slash));
  const objectName = decodeURIComponent(object.slice(slash + 1));
  const hostname = signed.hostname.endsWith(".supabase.co")
    ? signed.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co") : signed.hostname;
  const origin = `${signed.protocol}//${hostname}${signed.port ? `:${signed.port}` : ""}`;
  const headers = { "Tus-Resumable": "1.0.0", "x-signature": token };
  if (!transfer.url) {
    const response = await fetch(`${origin}/storage/v1/upload/resumable/sign`, { method: "POST", signal,
      headers: { ...headers, "Content-Type": "application/offset+octet-stream", "Upload-Length": String(blob.size),
        "Upload-Metadata": `bucketName ${btoa(bucket)},objectName ${btoa(objectName)},contentType ${btoa("application/octet-stream")}` },
    });
    if (!response.ok) throw new Error(`Storage could not start the upload (${response.status}). Retry to continue.`);
    const location = response.headers.get("Location");
    if (!location) throw new Error("Storage did not return a resumable upload location.");
    const locationUrl = new URL(location, origin);
    if (locationUrl.origin !== origin) throw new Error("Unexpected storage upload location.");
    transfer.url = locationUrl.href;
  }
  const head = await fetch(transfer.url, { method: "HEAD", headers, signal });
  if (head.status === 404 || head.status === 410) {
    transfer.url = undefined;
    throw new Error("Upload session expired. Retry to start a new transfer.");
  }
  if (!head.ok) throw new Error(`Could not check upload progress (${head.status}). Retry to continue.`);
  let offset = Number(head.headers.get("Upload-Offset"));
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > blob.size) throw new Error("Storage returned an invalid upload offset.");
  const chunkBytes = 6 * 1024 * 1024; // Supabase requires 6 MiB TUS chunks.
  onProgress(Math.round(offset / blob.size * 100));
  while (offset < blob.size) {
    const part = blob.slice(offset, offset + chunkBytes);
    const response = await fetch(transfer.url, { method: "PATCH", signal,
      headers: { ...headers, "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream" }, body: part });
    if (!response.ok) throw new Error(`Storage upload was interrupted (${response.status}). Retry to resume.`);
    const next = Number(response.headers.get("Upload-Offset"));
    if (next !== offset + part.size) throw new Error("Storage did not acknowledge the uploaded bytes. Retry to resume.");
    offset = next;
    onProgress(Math.round(offset / blob.size * 100));
  }
}
