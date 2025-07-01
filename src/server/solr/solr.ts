// solr.ts - Handles Solr initialization and connection state
import axios from "axios";
import config from "../conf/conf";
import { SolrClient } from "./SolrClient";
import { PingResponse, SolrDocument } from "../types/solr";
import { SupportedLang } from "../types/lang";
import { SolrPingError } from "../errors/errors";
import { conceptSchemeZodSchema } from "../validation/conceptScheme";
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
import { ConceptSchemeDocument } from "../types/jskos";
import readAndValidateNdjson from "../utils/loadNdJson";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LAST_INDEX_FILE = join(__dirname, "../../../data/lastIndexedAt.txt");

const solr = new SolrClient(config.solr.version);

export async function connectToSolr(): Promise<void> {
  try {
    const pingOk = await solr.collectionOperation
      .preparePing(config.solr.coreName)
      .execute<PingResponse>();

    if (!pingOk) {
      config.warn?.(
        "⚠️ Solr server is reachable but not healthy (ping failed). Skipping initialization.",
      );
      throw new Error() as SolrPingError;
    }

    config.log?.("✅ Connected to Solr and ping successful.");

    //TODO List available cores?

    //TODO Optional: Check configsets (advanced)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    config.error?.("❌ Failed to initialize Solr:", message);
  }

  if (config.indexDataAtBoot) {
    try {
      maybeBootstrapSolr();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      config.error?.("❌ Failed to index data in Solr at startup:", message);
    }
  }
}

export async function maybeBootstrapSolr() {
  const status = (await solrStatus()) as SolrSearchResponse;
  const numDocs = status.response?.numFound ?? 0;

  if (numDocs === 0) {
    config.log?.("📦 Solr core is empty. Proceeding with initial indexing...");

    const ndjsonPath = config.ndJsonDataPath ?? "./data/terminologies.ndjson";
    const docs = await readAndValidateNdjson(
      ndjsonPath,
      conceptSchemeZodSchema,
    );

    const solrDocs = docs.map((doc) => transformConceptSchemeToSolr(doc, []));
    await addDocuments(config.solr.coreName, solrDocs);
  } else {
    config.log?.(
      `ℹ️ Solr core already has ${numDocs} documents. Skipping initial indexing.`,
    );
  }
}

export async function solrStatus(): Promise<SolrResponse> {
  try {
    const solrClient = new SolrClient(config.solr.version);

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
    alt_labels_ss: doc.altLabel?.und || [],
    created_dt: doc.created,
    ddc_ss: doc.subject?.flatMap((s) => s.notation || []) || [],
    id: doc.uri,
    languages_ss: doc.languages || [],
    modified_dt: doc.modified,
    publisher_id: doc.publisher?.[0]?.uri,
    publisher_label: doc.publisher?.[0]?.prefLabel?.en || "",
    start_year_i: doc.startDate ? parseInt(doc.startDate) : undefined,
    subject_uri: doc.subject?.map((s) => s.uri) || [],
    subject_notation: doc.subject?.flatMap((s) => s.notation || []) || [],
    subject_scheme:
      doc.subject?.flatMap((s) => s.inScheme?.map((i) => i.uri) || []) || [],
    type_uri: doc.type,
    url_s: doc.url,
  };

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
