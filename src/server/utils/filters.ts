
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
  
  // Add values for a *public* facet key (e.g., "language").
  // - Looks up the corresponding internal Solr field via PUBLIC_TO_INTERNAL
  // - Merges with any existing values in `out[internal]`
  // - De-duplicates using a Set
  const add = (pubKey: PublicKey, vals: string[]) => {
    const internal = PUBLIC_TO_INTERNAL[pubKey];
    if (!internal || vals.length === 0) return;
    out[internal] = Array.from(new Set([...(out[internal] ?? []), ...vals]));
  };


  // Legacy → public-key mapping

  // partOf => in (listed_in_ss)
  if (q.partOf) add("in", splitCsv(q.partOf));
  
  // languages => language (languages_ss)
  if (q.languages) add("language", splitCsv(q.languages));

  // type => type (type_uri)
  if (q.type) add("type", splitCsv(q.type));

  // country => country (address_country_s)
  if (q.country) add("country", splitCsv(q.country));


  // Porblematic / unimplemented legacy keys: license

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