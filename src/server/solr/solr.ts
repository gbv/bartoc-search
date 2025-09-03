// solr.ts - Handles Solr initialization and connection state
import axios from "axios";
import config from "../conf/conf";
import { SolrClient } from "./SolrClient";
import { ContributorOut, CreatorOut, PingResponse, SolrDocument } from "../types/solr";
import { ConceptZodType } from "../validation/concept";
import {
  SolrResponse,
  SolrSearchResponse,
  SolrErrorResponse,
} from "../types/solr";
import { AxiosError } from "axios";
import { createReadStream, existsSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ConceptSchemeDocument, GroupEntry } from "../types/jskos";
import { sleep, loadJSONFile, mapUriToGroups, extractGroups, applyAgents, 
  applyDistributions, applyPrefLabel, applyPublishers, applySubjectOf, applySubject, pickTitleSort } from "../utils/utils";
import readline from "readline";
import { extractDdc } from "../utils/ddc";
import { applyLangMap } from "../utils/utils";
import { getNkosConcepts, loadNkosConcepts } from "../utils/nskosService";
import { ensureSnapshotForIndexing } from "../utils/updateFromBartoc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LAST_INDEX_FILE = join(__dirname, "../../../data/lastIndexedAt.txt");
const LICENSE_GROUPS: GroupEntry[] = await loadJSONFile<GroupEntry[]>("/data/license-groups.json");
const FORMAT_GROUPS: GroupEntry[] = await loadJSONFile<GroupEntry[]>("data/format-groups.json");

await loadNkosConcepts();
const nKosConceptsDocs = getNkosConcepts();

const solr = new SolrClient();

export async function connectToSolr(): Promise<void> {
  let pingOk = false;
  // 1) Ping Solr to check if it is reachable and healthy

  const MAX_RETRIES = config.solr.pingRetries ?? 5;
  const RETRY_INTERVAL = config.solr.pingRetryDelay ?? 2000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await solr.collectionOperation
        .preparePing(config.solr.coreName)
        .execute<PingResponse>();

      if (resp) {
        pingOk = true;
        config.log?.(`✅ Solr is up (attempt ${attempt}/${MAX_RETRIES})`);
        break;
      }
    } catch (err) {
      // If SolrCore is loading (503), swallow and retry
      const message = err instanceof AxiosError ? err.message : String(err);
      const code = err instanceof AxiosError ? err.code : String(err);

      if (code === "503" && message.includes("SolrCore is loading")) {
        config.warn?.(
          `⏳ Core "${config.solr.coreName}" is still loading (attempt ${attempt}/${MAX_RETRIES})`,
        );
      } else {
        // Some other error: break out and treat as fatal
        config.error?.(
          `❌ Unexpected error pinging Solr (attempt ${attempt}): ${message}`,
        );
      }
    }

    await sleep(RETRY_INTERVAL);
  }

  if (config.indexDataAtBoot && pingOk) {
    try {
      bootstrapIndexSolr();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      config.error?.("❌ Failed to index data in Solr at startup:", message);
    }
  }
}

// Initializes the Solr core with daily dump data from Database even if that is not empty
export async function bootstrapIndexSolr() {
  config.log?.("📦 Proceeding with initial indexing...");
  const REMOTE_URL = "https://bartoc.org/data/dumps/latest.ndjson";

  // 1) Pick input stream: local snapshot (preferred) or remote fallback
  let input: NodeJS.ReadableStream;
  let source: string;

  try {
      const meta = await ensureSnapshotForIndexing(); // returns { snapshotPath, ... } or throws
      if (meta?.snapshotPath && existsSync(meta.snapshotPath)) {
        source = meta.snapshotPath;
        input = createReadStream(meta.snapshotPath);
        config.log?.(`📄 Using local snapshot: ${source}`);
      } else {
        throw new Error("No local snapshot available.");
      }
    } catch {
    // Fallback: stream from remote
    const res = await axios.get(REMOTE_URL, {
      responseType: "stream",
      headers: { "User-Agent": "bartoc-solr-bootstrap/1.0", Connection: "close" },
    });
    input = res.data as NodeJS.ReadableStream;
    source = REMOTE_URL;
    config.log?.(`Using remote NDJSON: ${REMOTE_URL}`);
  }
   
  // 2) Stream line-by-line → transform → batch to Solr
  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  const BATCH_SIZE = config.solr.batchSize ?? 500;
  let buffer: SolrDocument[] = [];
  let total = 0;

  async function flush() {
    if (buffer.length === 0) return;
    await addDocuments(config.solr.coreName, buffer);
    total += buffer.length;
    buffer = [];
    if (total % (BATCH_SIZE * 4) === 0) config.log?.(`Indexed ${total} documents so far`);
  }

  for await (const line of rl) {
    const t = line.trim();
    if (!t) continue;

    let obj: ConceptSchemeDocument;
    try {
      obj = JSON.parse(t);
    } catch {
      console.warn("Skipping invalid JSON line");
      continue;
    }

    const solrDoc = transformConceptSchemeToSolr(obj, nKosConceptsDocs);
    buffer.push(solrDoc);

    if (buffer.length >= BATCH_SIZE) {
      await flush();
    }
  }
  await flush();
  rl.close();

  config.log?.(`✅ Indexed ${total} documents from ${source}`);
}

export async function solrStatus(): Promise<SolrResponse> {
  try {
    const solrClient = new SolrClient();

    const solrQuery = solrClient.searchOperation
      .prepareSelect(config.solr.coreName)
      .limit(0)
      .stats(true)
      .statsField("modified_dt")
      .for({ toString: () => "*:*", getDefType: () => "lucene" });

    const result = await solrQuery.execute<SolrSearchResponse>();
    return result;
  } catch (error: unknown) {
    // If it's an AxiosError with a SolrErrorResponse payload, return it
    if (error instanceof AxiosError && error.response?.data) {
      return error.response.data as SolrErrorResponse;
    }

    // Otherwise wrap any other failure in a minimal SolrErrorResponse
    const msg = error instanceof Error ? error.message : String(error);
    const fallback: SolrErrorResponse = {
      responseHeader: {
        status: 500,
        QTime: 0,
        params: {},
      },
      error: {
        metadata: [],
        msg,
        code: 500,
      },
    };
    return fallback;
  }
}

export function transformConceptSchemeToSolr(
  doc: ConceptSchemeDocument,
  nKosConceptsDocs: ConceptZodType[],
): SolrDocument {
  const solrDoc: Partial<SolrDocument> = {
    access_type_ss: doc.ACCESS?.map(a => a.uri) || [],
    address_code_s: doc.ADDRESS?.code,
    address_country_s: doc.ADDRESS?.country,
    address_locality_s: doc.ADDRESS?.locality,
    address_region_s: doc.ADDRESS?.region,
    address_street_s: doc.ADDRESS?.street,
    api_type_ss: doc.API?.map(a => a.type),
    api_url_ss:  doc.API?.map(a => a.url),
    contact_email_s: doc.CONTACT,
    display_hideNotation_b: doc.DISPLAY?.hideNotation,
    display_numericalNotation_b: doc.DISPLAY?.numericalNotation,
    examples_ss: doc.EXAMPLES?.map(s => (typeof s === "string" ? s.trim() : "")).filter(Boolean) ?? [],
    extent_s: doc.extent,
    ddc_ss: extractDdc(doc.subject, { rootLevel: false }),
    ddc_root_ss: extractDdc(doc.subject, { rootLevel: true }),
    format_type_ss: doc.FORMAT?.map(f => f.uri) || [],
    created_dt: doc.created,
    id: doc.uri,
    identifier_ss: doc.identifier?.filter((id): id is string => id !== null),
    languages_ss: doc.languages || [],
    license_type_ss: doc.license?.map(lt => lt.uri) || [],
    listed_in_ss: doc.partOf?.map(l => l.uri) || [],        
    modified_dt: doc.modified,
    namespace_s: doc.namespace,
    notation_ss: doc.notation ?? [],
    notation_examples_ss: doc.notationExamples ?? [],
    notation_pattern_s: doc.notationPattern,
    start_date_i: doc.startDate ? parseInt(doc.startDate) : undefined, 
    type_uri: doc.type,
    url_s: doc.url,
  };

  // Extracting License groups
  extractGroups(solrDoc, "license_type_ss", "license_group_ss", LICENSE_GROUPS, mapUriToGroups);
  
  // Extracting Format groups
  extractGroups(solrDoc, "format_type_ss",  "format_group_ss",  FORMAT_GROUPS,  mapUriToGroups);

  // Adding altLabel data to solr
  if (doc.altLabel) {
   applyLangMap(doc.altLabel ?? {}, solrDoc, "alt_label", "alt_labels_ss");
  }

  // Adding contributor data to solr
  if (doc.contributor) {
    // applyContributors(doc, solrDoc);
    applyAgents(doc.contributor, solrDoc as ContributorOut, "contributor", "contributor_ss", "contributor_uri_ss");
  }

  // Adding creator data to solr
  if (doc.creator) {
    // applyContributors(doc, solrDoc);
    applyAgents(doc.creator, solrDoc as CreatorOut, "creator", "creator_ss", "creator_uri_ss");
  }

  // Adding definition data to solr
  if (doc.definition) {
   applyLangMap(doc.definition ?? {}, solrDoc, "definition", "definition_ss");
  }

  if (doc.distributions) {
    applyDistributions(doc, solrDoc);
  }

  if (doc.prefLabel) {
    applyPrefLabel(doc, solrDoc);
  }

  if (doc.publisher) {
    applyPublishers(doc, solrDoc);
  }

  if (doc.subjectOf) {
    applySubjectOf(doc, solrDoc);
  }

  if (doc.subject) {
    applySubject(doc, solrDoc);
  }

  // Adding definition data to solr
  if (doc.definition) {
   applyLangMap(doc.definition ?? {}, solrDoc, "definition", "definition_ss");
  }

  // type solr fields for labels are to be addressed separately as currently the soruce is a ndJson file
  const nKosConceptsDoc = nKosConceptsDocs.find(
    (nKos) => nKos.uri === solrDoc.type_uri?.[1],
  );
  
  // type_label, we consider prelabel present in the source file
  if (nKosConceptsDoc) {
    for (const label of Object.keys(nKosConceptsDoc.prefLabel)) {
      solrDoc[`type_label_${label}`] = nKosConceptsDoc.prefLabel?.[label];
    }
  }

  // Adding title_en, title_de based on actually indexed prefLabels
  if (doc.prefLabel) {
    for (const label of Object.keys(doc.prefLabel)) {
       solrDoc[`title_${label}`] = doc.prefLabel[label];
    }
  }

  const picked = pickTitleSort(doc.prefLabel, doc.altLabel);
  if (picked) {
    solrDoc.title_sort = picked.value;              // single value → stable sorting
  } else {
    // Final fallback to ensure the field exists (avoid nulls in sort)
    solrDoc.title_sort = doc.uri ?? "";
  }

  // Full record as JSON string. This is useful for displaying the full record in the UI
  // and for debugging purposes. It should not be used for searching or filtering. It is 
  // not indexed, just stored.
  solrDoc.fullrecord = JSON.stringify(doc);

  return solrDoc as SolrDocument;
}


// TODO better this with OOP approach in SolrClient.ts, this is minimal and not well done
export async function addDocuments(coreName: string, docs: SolrDocument[]) {
  const url = `${config.solr.url}/${coreName}/update?commit=true`;

  try {
    const response = await axios.post(url, docs, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    config.log?.(`✅ Indexed ${docs.length} documents to Solr.`);
    if (response.data?.error) {
      config.warn?.("⚠️ Solr responded with error:", response.data.error);
    }
  } catch (error) {
    config.error?.(
      "❌ Error while adding documents to Solr:",
      (error as Error).message,
    );
    throw error;
  }

  // After everything is committed:
  const now = new Date().toISOString();
  writeFileSync(LAST_INDEX_FILE, now, "utf-8");
  config.log?.(`✅ Wrote lastIndexedAt = ${now}`);
}

/**
 * Delete one or more documents by id, then commit.
 */
export async function deleteDocuments(
  coreName: string,
  ids: string[],
): Promise<void> {
  const url = `${config.solr.url}/${coreName}/update?commit=true`;

  // Solr’s JSON delete format:
  const payload = { delete: ids.map((id) => ({ id })) };

  try {
    const response = await axios.post(url, payload, {
      headers: { "Content-Type": "application/json" },
    });

    config.log?.(`✅ Deleted ${ids.length} documents from Solr.`);
    if (response.data?.error) {
      config.warn?.(
        "⚠️ Solr responded with error on delete:",
        response.data.error,
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    config.error?.("❌ Error while deleting documents in Solr:", msg);
    throw err;
  }
}
