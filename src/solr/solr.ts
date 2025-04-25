// solr.ts - Handles Solr initialization and connection state
import axios from "axios";
import config from "../conf/conf";
import { SolrClient } from "./SolrClient";
import { PingResponse, SolrDocument } from "../types/solr";
import { SupportedLang } from "../types/lang";
import { SolrPingError } from "../errors/errors";
import { connection } from "../mongo/mongo";
import { TerminologyDocument } from "../types/terminology";
import { Terminology } from "../models/terminology";
import {
  terminologyZodSchema,
  TerminologyZodType,
} from "../mongo/terminologySchemaValidation";

let initialized = false;
const solr = new SolrClient(config.solr.version);

export async function connectToSolr(): Promise<void> {
  try {
    const pingOk = await solr.collectionOperation
      .preparePing("bartoc")
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

    initialized = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    config.error?.("❌ Failed to initialize Solr:", message);
  }
}

export async function indexDataAtBoot(): Promise<void> {
  try {
    config.log?.(`indexDataAtBoot() function`);

    config.log?.(`📦 Checking terminologies collection...`);

    if (connection.db) {
      const count = await connection.db
        .collection("terminologies")
        .countDocuments();

      config.log?.(`📊 Terminologies in DB: ${count}`);

      if (count > 0) {
        config.log?.(`Ready to extract ${count} terminology documents`);
        const terminologies = await Terminology.find({});

        await extractAllAndSendToSolr(terminologies);
      } else {
        config.warn?.("No terminologies found. Skipping extract.");
      }
    }
  } catch (error) {
    config.error?.(
      "❌ Error during initial extract:",
      (error as Error).message,
    );
  }
}

export function isSolrReady(): boolean {
  return initialized;
}

export async function extractAllAndSendToSolr(
  collection: TerminologyDocument[],
): Promise<void> {
  config.log?.(`collection length ${collection.length}`);

  let success = 0;
  let failed = 0;
  const solrDocuments: SolrDocument[] = [];

  for (const doc of collection) {
    const plainDoc = doc.toObject(); // remove moongose metadata
    const validation = terminologyZodSchema.safeParse(plainDoc);

    if (!validation.success) {
      config.warn?.(
        `❌ Invalid document skipped: ${validation.error.format()}`,
      );
      failed++;
      continue;
    }

    try {
      const validDoc: TerminologyZodType = validation.data;
      const solrDoc = transformToSolr(validDoc);
      solrDocuments.push(solrDoc);
      success++;
    } catch (error) {
      config.error?.("❌ Transformation error:", (error as Error).message);
      failed++;
    }
  }

  config.log?.(`✅ Transformed ${success} documents, ${failed} skipped.`);

  if (solrDocuments.length === 0) {
    config.warn?.("No documents to send to Solr.");
    return;
  }

  const { batch_size } = config.solr;
  const totalBatches = Math.ceil(solrDocuments.length / batch_size);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * batch_size;
    const end = start + batch_size;
    const batch = solrDocuments.slice(start, end);

    config.log?.(`📦 Sending batch ${batchIndex + 1} of ${totalBatches}`);

    try {
      await addDocuments("bartoc", batch);
      config.log?.(`📤 Successfully sent ${batch.length} documents to Solr.`);
    } catch (error) {
      config.error?.(
        "❌ Failed to send documents to Solr:",
        (error as Error).message,
      );
    }
  }
}

export function transformToSolr(doc: TerminologyZodType): SolrDocument {
  const solrDoc: Partial<SolrDocument> = {
    id: doc.uri,
    languages_ss: doc.languages || [],
    publisher_label: doc.publisher?.[0]?.prefLabel?.en || "",
    publisher_id: doc.publisher?.[0]?.uri,
    alt_labels_ss: doc.altLabel?.und || [],
    ddc_ss: doc.subject?.flatMap((s) => s.notation || []) || [],
    created_dt: doc.created,
    modified_dt: doc.modified,
    start_year_i: doc.startDate ? parseInt(doc.startDate) : undefined,
    url_s: doc.url,
    type_ss: doc.type || [],
  };

  // Dynamic fields titles, description
  for (const lang of Object.values(SupportedLang)) {
    const title = doc.prefLabel?.[lang];
    const description = doc.definition?.[lang];

    if (title) {
      solrDoc[`title_${lang}` as `title_${SupportedLang}`] = title;
    }

    if (description) {
      solrDoc[`description_${lang}` as `description_${SupportedLang}`] =
        description[0];
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
}
