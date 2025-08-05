// solr.ts - Handles Solr initialization and connection state
import axios from "axios";
import config from "../conf/conf";
import { SolrClient } from "./SolrClient";
import { PingResponse, SolrDocument } from "../types/solr";
import { SupportedLang } from "../types/lang";
import { ConceptZodType } from "../validation/concept";
import {
  SolrResponse,
  SolrSearchResponse,
  SolrErrorResponse,
} from "../types/solr";
import { AxiosError } from "axios";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ConceptSchemeDocument, GroupEntry } from "../types/jskos";
import { sleep, loadJSONFile, mapUriToGroups, extractGroups } from "../utils/utils";
import readline from "readline";
import { extractDdc } from "../utils/ddc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LAST_INDEX_FILE = join(__dirname, "../../../data/lastIndexedAt.txt");
const LICENSE_GROUPS: GroupEntry[] = await loadJSONFile<GroupEntry[]>("/data/license-groups.json");
const FORMAT_GROUPS: GroupEntry[] = await loadJSONFile<GroupEntry[]>("/data/format-groups.json");


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

  const url = "https://bartoc.org/data/dumps/latest.ndjson";

  // 1) Fetch the NDJSON as a stream
  const response = await axios.get(url, { responseType: "stream" });
  const stream = response.data as NodeJS.ReadableStream;

  // 2) Read it line-by-line
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  const docs: SolrDocument[] = [];

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }
    let obj: ConceptSchemeDocument;
    try {
      obj = JSON.parse(line);
    } catch (e) {
      console.warn("Skipping invalid JSON line:", e);
      continue;
    }
    // 3) Transform into Solr shape
    const solrDoc = transformConceptSchemeToSolr(obj, []);
    docs.push(solrDoc);
  }

  config.log?.(`📦 Read ${docs.length} documents from the stream.`);

  // 4) Add to Solr
  const BATCH_SIZE = config.solr.batchSize ?? 500;
  if (docs.length > 0) {
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE);
      await addDocuments(config.solr.coreName, batch);
    }
  }

  config.log?.(`✅ Bootstrapped ${docs.length} documents from ${url}`);
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
    address_country_s: doc.ADDRESS?.country, 
    alt_labels_ss: doc.altLabel?.und || [],
    api_type_ss: doc.API?.map(a => a.type),
    api_url_ss:  doc.API?.map(a => a.url),
    ddc_ss: extractDdc(doc.subject, { rootLevel: false }),
    ddc_root_ss: extractDdc(doc.subject, { rootLevel: true }),
    format_type_ss: doc.FORMAT?.map(f => f.uri) || [],
    created_dt: doc.created,
    id: doc.uri,
    languages_ss: doc.languages || [],
    license_type_ss: doc.license?.map(lt => lt.uri) || [],
    listed_in_ss: doc.partOf?.map(l => l.uri) || [],        
    modified_dt: doc.modified,
    publisher_id: doc.publisher?.[0]?.uri,
    publisher_label: doc.publisher?.[0]?.prefLabel?.en,
    start_year_i: doc.startDate ? parseInt(doc.startDate) : undefined,
    subject_uri: doc.subject?.map((s) => s.uri) || [],
    subject_notation: doc.subject?.flatMap((s) => s.notation || []) || [],
    subject_scheme:
      doc.subject?.flatMap((s) => s.inScheme?.map((i) => i.uri) || []) || [],
    type_uri: doc.type,
    url_s: doc.url,
  };

  // Extracting License groups
  extractGroups(solrDoc, "license_type_ss", "license_group_ss", LICENSE_GROUPS, mapUriToGroups);
  // Extracting Format groups
  extractGroups(solrDoc, "format_type_ss",  "format_group_ss",  FORMAT_GROUPS,  mapUriToGroups);


  // type solr fields for labels are to be addressed separately as currently the soruce is a ndJson file
  const nKosConceptsDoc = nKosConceptsDocs.find(
    (nKos) => nKos.uri === solrDoc.type_uri?.[1],
  );

  // Dynamic fields for title, description, type_label
  for (const lang of Object.values(SupportedLang)) {
    // title
    const title = doc.prefLabel?.[lang];
    if (title) {
      solrDoc[`title_${lang}` as `title_${SupportedLang}`] = title;
    }

    // title_sort,
    // TODO Find a better approach, order might be affected if there is no
    // title_en and it could return a bad UX
    solrDoc.title_sort = solrDoc.title_en ?? "";

    // description
    const description = doc.definition?.[lang];
    if (description) {
      solrDoc[`description_${lang}` as `description_${SupportedLang}`] =
        description[0];
    }

    // type_label
    const type_label = nKosConceptsDoc && nKosConceptsDoc.prefLabel?.[lang];
    if (type_label) {
      solrDoc[`type_label_${lang}` as `type_label_${SupportedLang}`] =
        type_label;
    }

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
