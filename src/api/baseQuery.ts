import type { BaseQueryFn } from "@reduxjs/toolkit/query";

import { decryptResponseBody, encryptRequestBody, isEncryptionExempt } from "./crypto";
import type { ApiErrorShape } from "./apiError";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export interface ApiRequestArgs {
  url: string;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
}

export interface ApiResponseMeta {
  // The envelope's own `message` — every mutation surfaces this directly as
  // a toast/banner per the doc's cross-cutting conventions; the frontend
  // never re-derives copy the backend already wrote.
  message?: string;
}

interface Envelope {
  status: number;
  message: string;
  data: unknown;
  code?: string;
}

// The single `apiRequest`-equivalent used by every RTK Query endpoint (see
// PHASE2_FRONTEND_FOUNDATION.md §2). Unwraps the backend's uniform
// {status, message, data} envelope so call sites only ever see `data`, and
// throws an ApiErrorShape-compatible `error` on non-2xx responses. Bodies
// are encrypted/decrypted transparently (see crypto.ts) for every endpoint
// except the two §4b exempts login and key exchange.
export const apiBaseQuery: BaseQueryFn<ApiRequestArgs, unknown, ApiErrorShape, object, ApiResponseMeta> = async (
  { url, method = "GET", body },
  { signal },
) => {
  const exempt = isEncryptionExempt(method, url);
  const headers: Record<string, string> = {};

  let requestBody: BodyInit | undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    if (exempt) {
      requestBody = JSON.stringify(body);
    } else {
      const encrypted = await encryptRequestBody(body);
      headers["X-Encryption-Key-Version"] = String(encrypted.keyVersion);
      requestBody = encrypted.bytes;
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${url}`, {
      method,
      credentials: "include",
      headers,
      body: requestBody,
      signal,
    });
  } catch {
    return {
      error: {
        status: 0,
        message: "Could not reach the server. Check your connection and try again.",
        data: undefined,
      },
    };
  }

  let envelope: Envelope | null = null;
  try {
    if (exempt) {
      envelope = (await response.json()) as Envelope;
    } else {
      const encryptedBytes = new Uint8Array(await response.arrayBuffer());
      const keyVersionHeader = response.headers.get("X-Encryption-Key-Version");
      envelope = (await decryptResponseBody(encryptedBytes, keyVersionHeader)) as Envelope;
    }
  } catch {
    envelope = null;
  }

  const data = envelope?.data;

  if (!response.ok) {
    return {
      error: {
        status: response.status,
        message: envelope?.message ?? response.statusText,
        data,
        code: envelope?.code,
      },
      meta: { message: envelope?.message },
    };
  }

  return { data, meta: { message: envelope?.message } };
};
