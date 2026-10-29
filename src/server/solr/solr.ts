// solr.ts - Handles Solr initialization and connection state
import axios from "axios";
import config from "../conf/conf";
import { SolrClient } from "./SolrClient";
import { ContributorOut, CreatorOut, PingResponse, SolrDocument } from "../types/solr";
import {
  SolrResponse,
  SolrSearchResponse,
  SolrErrorResponse,
} from "../types/solr";
import { AxiosError } from "axios";
import fs from "node:fs/promises";
import { createReadStream, writeFileSync, constants as FS } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ConceptSchemeDocument, GroupEntry } from "../types/jskos";
import { sleep, mapUriToGroups, extractGroups, applyAgents, 
  applyDistributions, applyPrefLabel, applyPublishers, applySubjectOf, applySubject, pickTitleSort, 
  loadJSONFileSafe, extractBartocId } from "../utils/utils";
import readline from "readline";
import { extractDdc, buildDdcAncestorsFromSubjects } from "../utils/ddc";
import { applyLangMap } from "../utils/utils";
import { getNkosConcepts, loadNkosConcepts } from "../utils/nskosService";
import { ensureSnapshotForIndexing } from "../utils/updateFromBartoc";
import { getDirectVersionOfUri } from "../utils/editions";
import { LuceneQuery } from "./search/LuceneQuery";
import { SearchFilter } from "./search/SearchFilter";


// DDC enricher: loads the precomputed DDC snapshot once at startup.
// If it fails (e.g. file missing in development), we keep running
// without enrichment and fall back to the legacy numeric expansion.
import { DdcEnricher } from "../ddc/index";  

let ddcEnricher: DdcEnricher | null = null;
try {
  ddcEnricher = await DdcEnricher.create();
 
} catch (e) {
  config.warn?.(`⚠️ Could not load  ${e}`);
  // fallback: ddcEnricher stays null, old utils/ddc.ts still usable if desired
}


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LAST_INDEX_FILE = join(__dirname, "../../../data/lastIndexedAt.txt");


export const LICENSE_GROUPS: GroupEntry[] =
  await loadJSONFileSafe<GroupEntry[]>("data/license-groups.json", []);

export const FORMAT_GROUPS: GroupEntry[] =
  await loadJSONFileSafe<GroupEntry[]>("data/format-groups.json", []);

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
  config.log?.("Proceeding with initial indexing...");

  // 1) Pick input stream: local snapshot (preferred) or remote fallback
  let input: NodeJS.ReadableStream;
  let source: string;

  try {
    const localPath = await ensureSnapshotForIndexing(); // e.g. ".../artifacts/current/vocs.enriched.ndjson"
    await fs.access(localPath, FS.R_OK); // explicit readability check
    input = createReadStream(localPath);
    source = localPath;
    config?.log?.(`Using local vocs snapshot: ${source}`);
  } catch {
    source = config.BARTOC_DUMP;
    const res = await axios.get(source, {
      responseType: "stream",
      headers: { "User-Agent": "bartoc-solr-bootstrap/1.0", Connection: "close" },
    });
    input = res.data as NodeJS.ReadableStream;
    config.log?.(`Using remote NDJSON vocs: ${source}`);
  }

  // 2) Stream line-by-line → transform → batch to Solr
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  const BATCH_SIZE = config.solr.batchSize ?? 500;
  let documentsToIndex: SolrDocument[] = [];
  let indexedCount = 0;
  // Keep record titles as we read the dump. Editions may refer to these later.
  const recordTitlesByUri = new Map<string, Record<string, string>>();
  // Wait to index untitled editions until we have seen their main records.
  const editionsMissingTitle: Array<{ record: ConceptSchemeDocument; mainRecordUri: string }> = [];

  async function flushDocuments() {
    if (documentsToIndex.length === 0) return;
    await addDocuments(config.solr.coreName, documentsToIndex);
    indexedCount += documentsToIndex.length;
    documentsToIndex = [];
    if (indexedCount % (BATCH_SIZE * 4) === 0) config.log?.(`Indexed ${indexedCount} documents so far`);
  }

  for await (const line of lines) {
    const lineText = line.trim();
    if (!lineText) continue;

    let record: ConceptSchemeDocument;
    try {
      record = JSON.parse(lineText);
    } catch {
      console.warn("Skipping invalid JSON line");
      continue;
    }

    // Save a readable title for any record that an edition may refer to.
    if (record.uri && record.prefLabel && pickTitleSort(record.prefLabel)) {
      recordTitlesByUri.set(record.uri, record.prefLabel);
    }
    // An edition can appear before its parent in the dump. Defer only editions
    // without their own title; all other records can be indexed now.
    const mainRecordUri = mainRecordUriForUntitledEdition(record);
    if (mainRecordUri) {
      editionsMissingTitle.push({ record, mainRecordUri });
      continue;
    }

    documentsToIndex.push(transformConceptSchemeToSolr(record, nKosConceptsDocs));
    if (documentsToIndex.length >= BATCH_SIZE) await flushDocuments();
  }

  // Now every main-record title in the dump is available, regardless of order.
  // If a main record is missing, the normal title fallback still applies.
  for (const { record, mainRecordUri } of editionsMissingTitle) {
    const mainRecordTitles = recordTitlesByUri.get(mainRecordUri);
    documentsToIndex.push(transformConceptSchemeToSolr(record, nKosConceptsDocs, mainRecordTitles));
    if (documentsToIndex.length >= BATCH_SIZE) await flushDocuments();
  }
  await flushDocuments();
  lines.close();

  config.log?.(`✅ Indexed ${indexedCount} documents from ${source}`);
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

// Only editions without their own title can borrow their main record's title.
function mainRecordUriForUntitledEdition(edition: ConceptSchemeDocument): string | undefined {
  if (pickTitleSort(edition.prefLabel)) return undefined;
  return getDirectVersionOfUri(edition);
}

// Build search titles for an edition with no title of its own.
// Add its version when available, e.g. "European Science Vocabulary 1.3".
function titleLabelsForIndex(
  record: ConceptSchemeDocument,
  mainRecordTitles?: Record<string, string>,
): Record<string, string> | undefined {
  // A record's own title always takes precedence over an inherited one.
  if (pickTitleSort(record.prefLabel)) return record.prefLabel;

  // Callers provide mainRecordTitles only for an untitled edition.
  if (!mainRecordTitles) return undefined;
  const editionVersion = typeof record.version === "string" ? record.version.trim() : "";
  const versionSuffix = editionVersion ? ` ${editionVersion}` : "";

  const titlesByLanguage: Record<string, string> = {};
  for (const [language, mainRecordTitle] of Object.entries(mainRecordTitles)) {
    if (typeof mainRecordTitle === "string" && mainRecordTitle.trim()) {
      titlesByLanguage[language] = `${mainRecordTitle.trim()}${versionSuffix}`;
    }
  }
  return Object.keys(titlesByLanguage).length ? titlesByLanguage : undefined;
}

// The queue handles one record at a time, so it cannot use the dump's title map.
// Look up the main record in Solr only when this edition needs its title.
export async function getMainRecordTitlesForEdition(
  edition: ConceptSchemeDocument,
): Promise<Record<string, string> | undefined> {
  const mainRecordUri = mainRecordUriForUntitledEdition(edition);
  if (!mainRecordUri) return undefined;

  const searchResult = await solr.searchOperation
    .prepareSelect(config.solr.coreName)
    .for(new LuceneQuery())
    .filter(new SearchFilter("id").equals(mainRecordUri))
    .field("fullrecord")
    .limit(1)
    .execute<SolrSearchResponse>();
  const mainRecordJson = searchResult.response.docs[0]?.fullrecord;
  if (!mainRecordJson) return undefined;
  const mainRecord = JSON.parse(mainRecordJson) as ConceptSchemeDocument;
  return mainRecord.prefLabel;
}

// This transforms JSKOS records into Solr documents for the "terminologies" core.
export function transformConceptSchemeToSolr(
  doc: ConceptSchemeDocument,
  nKosConceptsDocs: ReturnType<typeof getNkosConcepts>,
  mainRecordTitles?: Record<string, string>,
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
    format_type_ss: doc.FORMAT?.map(f => f.uri) || [],
    created_dt: doc.created,
    id: doc.uri,
    bartoc_id_s: extractBartocId(doc.uri),
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
    start_date_sort_s: doc.startDate?.trim() || undefined,
    type_uri: doc.type,
    url_s: doc.url,
    version_of_s: getDirectVersionOfUri(doc),
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
  if (nKosConceptsDoc?.prefLabel) {
    for (const label of Object.keys(nKosConceptsDoc.prefLabel)) {
      solrDoc[`type_label_${label}`] = nKosConceptsDoc.prefLabel?.[label];
    }
  }

  // Search and sorting use the derived title, if one was needed. The local
  // pref_label_* fields and fullrecord below still contain the original JSKOS data.
  const searchTitles = titleLabelsForIndex(doc, mainRecordTitles);
  if (searchTitles) {
    for (const [language, title] of Object.entries(searchTitles)) {
      solrDoc[`title_${language}`] = title;
    }
  }

  const preferredTitle = pickTitleSort(searchTitles, doc.altLabel);
  if (preferredTitle) {
    solrDoc.title_sort = preferredTitle.value;              // single value → stable sorting
  } else {
    // Final fallback to ensure the field exists (avoid nulls in sort)
    solrDoc.title_sort = doc.uri ?? "";
  }

  // Full record as JSON string. This is useful for displaying the full record in the UI
  // and for debugging purposes. It should not be used for searching or filtering. It is 
  // not indexed, just stored.
  solrDoc.fullrecord = JSON.stringify(doc);

  // Collect all DDC subject URIs from JSKOS (only dewey.info/class/...).
  // Example subject:
  //   { uri: "http://dewey.info/class/971/e23/", notation: ["971"], ... }
  const ddcUris = (doc.subject ?? [])
  .map(s => s?.uri)
  .filter((u: unknown): u is string =>
    typeof u === "string" && /http?:\/\/dewey\.info\/class\//.test(u)
  );

  if (ddcEnricher && ddcUris.length) {
    const e = ddcEnricher.expandUris(ddcUris);

    // Facet fields: root, ancestor and exact notations.
    solrDoc.ddc_root_ss = e.roots;
    solrDoc.ddc_ancestors_ss = e.ancestors;
    solrDoc.ddc_ss = e.exact;

    // Ranked text fields for scoring/UX (see schema.xml for *_t fields).
    // Example buckets:
    //   rank1: main class labels          (e.g. "Canada")
    //   rank2: immediate ancestor + parts (e.g. "History of North America")
    //   rank3: root ancestor labels       (e.g. "History & geography")
    solrDoc.ddc_label_rank1_t = e.labels.rank1;
    solrDoc.ddc_label_rank2_t = e.labels.rank2;
    solrDoc.ddc_label_rank3_t = e.labels.rank3;

  } else {
    // Fallback: keep the old numeric-only behaviour if the DDC snapshot
    // could not be loaded. This only derives roots/ancestors from the
    // notation itself (e.g. "440" → root "4", ancestor "44").    
    // solrDoc.ddc_ss = extractDdc(doc.subject, { rootLevel: false });
    solrDoc.ddc_root_ss = extractDdc(doc.subject, { rootLevel: true });
    solrDoc.ddc_ancestors_ss = buildDdcAncestorsFromSubjects(doc.subject);
  }
    
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
