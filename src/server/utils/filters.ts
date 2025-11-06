import { splitMulti, mapUriToGroups, uniq } from "../utils/utils";
import { toDdcRoot, DDC_URI_RE } from "./ddc";
import { LICENSE_GROUPS } from "../solr/solr";

type PublicKey =
  | "type" | "ddc" | "language" | "in" | "api"
  | "access" | "license" | "format" | "country" | "publisher";


// Default mapping for *most* public keys → internal Solr fields.
// Note: "ddc" is handled specially and bypasses this table below.
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

  return out;
}

/**
 * Parse repeatable ?filter=key:a,b parameters into a map of internal Solr fields → values.
 * - Accepts multiple ?filter=... entries.
 * - Each entry must be "key:values", where values can be comma-separated or empty.
 * - Values are deduped per field.
 *
 * DDC is special-cased:
 *   - We normalize URI inputs and route each value to the most appropriate DDC field(s).
 */
export function parseRepeatableFilters(
  raw: string | string[] | undefined
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!raw) return out;

  // Support both ?filter=a and ?filter=a&filter=b forms.
  const arr = Array.isArray(raw) ? raw : [raw];

  for (const item of arr) {
    const idx = item.indexOf(":");
    if (idx <= 0) continue; // malformed, no colon or key missing
    const key = item.slice(0, idx).trim() as PublicKey;
    const internal = PUBLIC_TO_INTERNAL[key];
    if (!internal) continue;

    // Parse "values" part; allow empty after ":" to mean “no-op” for that key.
    const valuesRaw = item.slice(idx + 1);
    const vals = valuesRaw.trim() === "" ? [] : splitMulti(valuesRaw);


    // -----------------------------
    // SPECIAL CASE: DDC SMART ROUTE
    // -----------------------------
    if (key === "ddc") {
      // For each provided value, decide which Solr field to target by inspecting its shape.
      // We accept both plain notations ("4", "42", "420", "32.1") and DDC URIs.
      const roots: string[] = [];     // single digit 0..9 → ddc_root_ss
      const ancestors: string[] = []; // two digits or ≥3 digits integer → ddc_ancestors_ss
      const exact: string[] = [];     // decimal forms (e.g., "32.1") → ddc_ss

      for (const v of vals) {
        const m = DDC_URI_RE.exec(v);
        const notation = m ? m[1] : v;

        if (!/^\d+(\.\d+)?$/.test(notation)) continue;

        if (/^\d$/.test(notation)) {
          roots.push(notation);
        } else if (/^\d{2}$/.test(notation)) {
          ancestors.push(notation);
        } else if (/^\d{3,}$/.test(notation)) {
          ancestors.push(notation);
        } else if (/^\d+\.\d+$/.test(notation)) {
          exact.push(notation);
        }
      }

      // dedupe and merge
      out["ddc_root_ss"] = Array.from(new Set([...(out["ddc_root_ss"] ?? []), ...roots]));
      out["ddc_ancestors_ss"] = Array.from(new Set([...(out["ddc_ancestors_ss"] ?? []), ...ancestors]));
      out["ddc_ss"] = Array.from(new Set([...(out["ddc_ss"] ?? []), ...exact]));

      continue;
    }


    // --------------------------------
    // GENERIC HANDLING FOR OTHER KEYS
    // --------------------------------
    out[internal] = Array.from(new Set([...(out[internal] ?? []), ...vals]));

  }
  return out;
}