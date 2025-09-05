type PublicKey =
  | "type" | "ddc" | "language" | "in" | "api"
  | "access" | "license" | "format" | "country" | "publisher";

const PUBLIC_TO_INTERNAL: Record<PublicKey, string> = {
  type: "type_uri",
  ddc: "ddc_root_ss",
  language: "languages_ss",
  in: "listed_in_ss",
  api: "api_type_ss",
  access: "access_type_ss",
  license: "license_group_ss",
  format: "format_group_ss",
  country: "address_country_s",
  publisher: "publisher_labels_ss",
};

const splitCsv = (s: string) =>
  s.split(",").map(t => t.trim()).filter(Boolean);

/** Parse repeatable ?filter=key:a,b (accept empty after ':') */
export function parseRepeatableFilters(
  raw: string | string[] | undefined
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!raw) return out;
  const arr = Array.isArray(raw) ? raw : [raw];

  for (const item of arr) {
    const idx = item.indexOf(":");
    if (idx <= 0) continue; // malformed, no colon or key missing
    const key = item.slice(0, idx).trim() as PublicKey;
    const internal = PUBLIC_TO_INTERNAL[key];
    if (!internal) continue;

    const valuesRaw = item.slice(idx + 1);
    const vals = valuesRaw.trim() === "" ? [] : splitCsv(valuesRaw);
    // dedupe (also for the non-empty case)
    out[internal] = Array.from(new Set([...(out[internal] ?? []), ...vals]));
  }
  return out;
}