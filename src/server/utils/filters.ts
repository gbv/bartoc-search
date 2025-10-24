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

function splitCsv(v: unknown): string[] {
  if (Array.isArray(v)) return v.flatMap(splitCsv);
  if (typeof v !== "string") return [];
  return v.split(",").map(s => s.trim()).filter(Boolean);
}


export function legacyFiltersFromQuery(q: Record<string, unknown>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const add = (pubKey: PublicKey, vals: string[]) => {
    const internal = PUBLIC_TO_INTERNAL[pubKey];
    if (!internal || vals.length === 0) return;
    out[internal] = Array.from(new Set([...(out[internal] ?? []), ...vals]));
  };

  // Legacy → public-key mapping
  // partOf => in (listed_in_ss)
  if (q.partOf) add("in", splitCsv(q.partOf));

  // add more legacy keys from old BARTOC here if needed:
  // if (q.language) add("language", splitCsv(q.language));
  // if (q.type)     add("type",     splitCsv(q.type));
  // if (q.license)  add("license",  splitCsv(q.license));
  // if (q.format)   add("format",   splitCsv(q.format));
  // if (q.access)   add("access",   splitCsv(q.access));
  // if (q.api)      add("api",      splitCsv(q.api));
  // if (q.country)  add("country",  splitCsv(q.country));
  // if (q.publisher) add("publisher", splitCsv(q.publisher));
  // if (q.ddc)      add("ddc",      splitCsv(q.ddc));

  return out;
}

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