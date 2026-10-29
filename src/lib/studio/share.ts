import type { ConflictPolicy } from "@/lib/engine";

/**
 * Shareable snapshots are plain data (no code): a versioned JSON object,
 * UTF-8 encoded as base64url and placed in the URL fragment so it never
 * reaches a server. Decoding validates every field and rejects anything else.
 */
export interface Snapshot {
  v: 1;
  name: string;
  source: string;
  input: string;
  start: string;
  policy: ConflictPolicy;
}

const MAX_ENCODED = 60_000;

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function encodeSnapshot(s: Omit<Snapshot, "v">): string {
  const json = JSON.stringify({ v: 1, ...s });
  return toBase64Url(new TextEncoder().encode(json));
}

export function decodeSnapshot(encoded: string): Snapshot | null {
  if (!encoded || encoded.length > MAX_ENCODED || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  try {
    const obj: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded)));
    if (typeof obj !== "object" || obj === null) return null;
    const o = obj as Record<string, unknown>;
    if (o.v !== 1) return null;
    const str = (x: unknown, max: number) => (typeof x === "string" && x.length <= max ? x : null);
    const name = str(o.name, 120);
    const source = str(o.source, 40_000);
    const input = str(o.input, 4_000) ?? "";
    const start = str(o.start, 120) ?? "";
    const policy: ConflictPolicy = o.policy === "prefer-shift" ? "prefer-shift" : "halt";
    if (name === null || source === null) return null;
    return { v: 1, name, source, input, start, policy };
  } catch {
    return null;
  }
}

export const SHARE_PARAM = "s";
