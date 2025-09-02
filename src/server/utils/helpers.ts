import fs from "node:fs/promises";


/** Utility: measure how long an async function takes and log the result */
export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  const res = await fn();
  const ms = Date.now() - t0;
  console.log(`${label}: ${ms} ms`);
  return res;
}

/** Normalize unknown | T | T[] into a T[] safely */
export const toArr = <T,>(x: T | T[] | undefined | null): T[] =>
    x == null ? [] : Array.isArray(x) ? x : [x];

export const asArr = (x: unknown) => (x == null ? [] : Array.isArray(x) ? x : [x]);

export const normalize = (u: string) => u.trim().replace(/\/+$/, ""); // drop trailing slash

// language preference for labels
export const KEEP_LANGS = (process.env.KEEP_LANGS ?? "en,de")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);


/** Keep only http/https identifiers and deduplicate them */
export const filterHttp = (ids: string[]) =>
  Array.from(new Set(ids.filter((u) => /^https?:\/\//i.test(u))));

export function sanitizeETagHeader(raw: unknown): string {
  // Convert to string and normalize
  let etag = String(raw ?? "");

  // Turn weak validator prefix W/"foo" into a safe W-foo
  etag = etag.replace(/^W\/"?/i, "W-"); // case-insensitive, removes W/" or W/
  // Drop any remaining quotes
  etag = etag.replace(/"/g, "");
  // Keep only filename-safe chars (letters, digits, dot, underscore, dash)
  etag = etag.replace(/[^A-Za-z0-9._-]+/g, "-");
  // Collapse multiple dashes and trim
  etag = etag.replace(/-+/g, "-").replace(/^-|-$/g, "");
  return etag || "noetag";
}

export async function fileSize(p: string) {
  try { return (await fs.stat(p)).size; } catch { return null; }
}
