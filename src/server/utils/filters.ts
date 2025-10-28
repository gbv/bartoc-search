import { splitMulti, mapUriToGroups, uniq } from "../utils/utils";
import { toDdcRoot } from "./ddc";
import { LICENSE_GROUPS } from "../solr/solr";


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
  if (q.partOf) add("in", splitMulti(q.partOf));
  
  // languages => language (languages_ss)
  if (q.languages) add("language", splitMulti(q.languages));

  // type => type (type_uri)
  if (q.type) add("type", splitMulti(q.type));

  // country => country (address_country_s)
  if (q.country) add("country", splitMulti(q.country));

  // access => access (access_type_ss)
  if (q.access) add("access", splitMulti(q.access));

  // subject => ddc (ddc_root_ss)
  if (q.subject) {
    const uris = splitMulti(q.subject);
    const ddcs = Array.from(new Set(
      uris.map(toDdcRoot).filter((x): x is string => !!x)
    ));
    if (ddcs.length) add("ddc", ddcs);
  }

  // license => license (license_group_ss)
  if (q.license) {
    const uris = splitMulti(q.license);
    if (uris.length !== 0 && LICENSE_GROUPS) {
      const groups = uniq(uris.flatMap(u => mapUriToGroups(u, LICENSE_GROUPS))).filter(Boolean);
      if (groups.length) add("license", groups.map(g => g.label));
    }
  } 

  // Problematic / unimplemented legacy keys: format

  // if (q.format)   add("format",   splitCsv(q.format));
  // if (q.api)      add("api",      splitCsv(q.api));
  // if (q.publisher) add("publisher", splitCsv(q.publisher));

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
    const vals = valuesRaw.trim() === "" ? [] : splitMulti(valuesRaw);
    // dedupe (also for the non-empty case)
    out[internal] = Array.from(new Set([...(out[internal] ?? []), ...vals]));
  }
  return out;
}