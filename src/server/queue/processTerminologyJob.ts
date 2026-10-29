import config from "../conf/conf";
import type {
  SolrDocument,
  SolrJobPayload,
  SolrDeletePayload,
  SolrUpsertPayload,
} from "../types/solr";
import { OperationType } from "../types/wsNormalized";
import {
  addDocuments,
  deleteDocuments,
  getMainRecordTitlesForEdition,
  transformConceptSchemeToSolr,
} from "../solr/solr";
import { getNkosConcepts } from "../utils/nskosService";

/**
 * Processes one terminology queue payload and applies it to Solr.
 *
 * This function is intentionally independent from BullMQ. The worker owns queue
 * lifecycle, retries, and Redis connection details; this handler owns only the
 * operation contract: delete jobs remove a Solr document, and upsert jobs
 * transform a JSKOS ConceptScheme before indexing it.
 */
export async function processTerminologyJob(data: SolrJobPayload): Promise<void> {
  const { operation, id } = data as SolrUpsertPayload | SolrDeletePayload;

  switch (operation) {
    case OperationType.Delete:
      // Delete jobs do not need a JSKOS document; the Solr id is enough.
      config.log?.(`[Worker] Deleting ${id} from Solr…`);
      await deleteDocuments(config.solr.coreName, [id]);
      config.log?.(`[Worker] delete completed for id=${id}`);
      break;
    case OperationType.Create:
    case OperationType.Update:
    case OperationType.Replace: {
      const upsert = data as SolrUpsertPayload;
      // Upsert operations must carry the source document that will be transformed.
      if (!upsert.document) {
        throw new Error(`Missing document for ${operation} ${id}`);
      }
      config.log?.(`[Worker] ${operation} ${id} in Solr…`);
      const nKosConcepts = getNkosConcepts();
      // The dump builds a title map, but a live update has only this document.
      // Fetch its main record title before transforming an untitled edition.
      const mainRecordTitles = await getMainRecordTitlesForEdition(upsert.document);
      const solrDocument: SolrDocument = transformConceptSchemeToSolr(
        upsert.document,
        nKosConcepts,
        mainRecordTitles,
      );
      await addDocuments(config.solr.coreName, [solrDocument]);
      config.log?.(`[Worker] ${operation} completed for id=${id}`);
      break;
    }
    default:
      throw new Error(`Unsupported operation: ${operation}`);
  }
}
