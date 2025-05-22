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
import { NkosZodTypeConcept, nKosTypeConceptSchema } from "./nkosValidation";
import readAndValidateNdjson from "../utils/loadNdJson";
import {
  SolrResponse,
  SolrSearchResponse,
  SolrErrorResponse,
} from "../types/solr";
import { AxiosError } from "axios";

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

        // TODO Do it BETTER, this is a very rudimental solution!
        // nkos should be part of MongoDB and retrieved consequentely as for terminologies table?
        const nKosConcepts: NkosZodTypeConcept[] = await readAndValidateNdjson(
          "./data/nkostype.concepts.ndjson",
          nKosTypeConceptSchema,
        );

        config.log?.(`${JSON.stringify(nKosConcepts[0])}`);

        await extractAllAndSendToSolr(terminologies, nKosConcepts);
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

export async function solrStatus(): Promise<SolrResponse> {
  try {
    const solrClient = new SolrClient(config.solr.version);

    const solrQuery = solrClient.searchOperation
      .prepareSelect("bartoc")
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

export async function extractAllAndSendToSolr(
  terminologies: TerminologyDocument[],
  nKosConcepts: NkosZodTypeConcept[],
): Promise<void> {
  config.log?.(`collection length ${terminologies.length}`);

  let success = 0;
  let failed = 0;
  const solrDocuments: SolrDocument[] = [];

  // this block takes care of transforming terminology documents
  for (const terminology of terminologies) {
    const plainTerminologyDoc = terminology.toObject(); // remove moongose metadata
    const terminologyValidated =
      terminologyZodSchema.safeParse(plainTerminologyDoc);

    if (!terminologyValidated.success) {
      config.warn?.(
        `❌ Invalid document skipped: ${terminologyValidated.error.format()}`,
      );
      failed++;
      continue;
    }

    try {
      const validTerminologyDoc: TerminologyZodType = terminologyValidated.data;
      const solrDoc = transformToSolr(validTerminologyDoc, nKosConcepts);
      solrDocuments.push(solrDoc);
      success++;
    } catch (error) {
      config.error?.("❌ Transformation error:", (error as Error).message);
      failed++;
    }
  }

  config.log?.(
    `✅ Transformed ${success} terminology documents, ${failed} skipped.`,
  );

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

export function transformToSolr(
  terminologyDoc: TerminologyZodType,
  nKosConceptsDocs: NkosZodTypeConcept[],
): SolrDocument {
  const solrDoc: Partial<SolrDocument> = {
    alt_labels_ss: terminologyDoc.altLabel?.und || [],
    created_dt: terminologyDoc.created,
    ddc_ss: terminologyDoc.subject?.flatMap((s) => s.notation || []) || [],
    id: terminologyDoc.uri,
    languages_ss: terminologyDoc.languages || [],
    modified_dt: terminologyDoc.modified,
    publisher_id: terminologyDoc.publisher?.[0]?.uri,
    publisher_label: terminologyDoc.publisher?.[0]?.prefLabel?.en || "",
    start_year_i: terminologyDoc.startDate
      ? parseInt(terminologyDoc.startDate)
      : undefined,
    subject_uri: terminologyDoc.subject?.map((s) => s.uri) || [],
    subject_notation:
      terminologyDoc.subject?.flatMap((s) => s.notation || []) || [],
    subject_scheme:
      terminologyDoc.subject?.flatMap(
        (s) => s.inScheme?.map((i) => i.uri) || [],
      ) || [],
    type_uri: terminologyDoc.type,
    url_s: terminologyDoc.url,
  };

  // type solr fields for labels are to be addressed separately as currently the soruce is a ndJson file

  const nKosConceptsDoc = nKosConceptsDocs.find(
    (nKos) => nKos.uri === solrDoc.type_uri?.[1],
  );

  // Dynamic fields for title, description, type_label
  for (const lang of Object.values(SupportedLang)) {
    // title
    const title = terminologyDoc.prefLabel?.[lang];
    if (title) {
      solrDoc[`title_${lang}` as `title_${SupportedLang}`] = title;
    }

    // description
    const description = terminologyDoc.definition?.[lang];
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
}
