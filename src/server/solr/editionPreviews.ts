import config from "../conf/conf";
import type { SolrDocument } from "../types/solr";
import { isBartocUri } from "../utils/uri";
import { LuceneQuery } from "./search/LuceneQuery";
import { SearchFilter } from "./search/SearchFilter";
import { SolrClient } from "./SolrClient";

interface EditionPreview {
  uri: string;
  title: string;
  startDate?: string;
}

interface EditionGroup {
  total: number;
  items: EditionPreview[];
}

type EditionsByMain = Record<string, EditionGroup>;

type EditionDoc = Pick<SolrDocument, "id" | "fullrecord" | "title_sort"> & { title_en?: string };

// In a Solr group, groupValue is the main URI and numFound counts all its editions.
interface GroupedEditionResponse {
  grouped?: {
    version_of_s?: {
      groups?: Array<{
        groupValue: string;
        doclist: { numFound: number; docs: EditionDoc[] };
      }>;
    };
  };
}

/** 230 main URIs become three requests: 100 + 100 + 30. */
const BATCH_SIZE = 100;

/** A family with five editions returns three links but still reports total: 5. */
const PREVIEW_LIMIT = 3;

/** Pick English first, then another nonempty label; { en: "Thesaurus" } -> "Thesaurus". */
function getLocalTitle(labels: unknown): string | undefined {
  if (!labels || typeof labels !== "object" || Array.isArray(labels)) return undefined;
  const values = labels as Record<string, unknown>;
  const title = [values.en, ...Object.values(values)].find(
    value => typeof value === "string" && value.trim(),
  );
  return typeof title === "string" ? title.trim() : undefined;
}

/**
 * Turn one Solr document into a link for the result card.
 * Example: no own label, version "1.0", main title "Thesaurus"
 * becomes { uri: doc.id, title: "Thesaurus 1.0" }.
 */
function toEditionPreview(doc: EditionDoc, mainUri: string, mainTitle?: string): EditionPreview {
  let title = doc.title_en || doc.title_sort || doc.id;
  let startDate: string | undefined;

  try {
    const record = JSON.parse(doc.fullrecord) as {
      prefLabel?: unknown;
      version?: unknown;
      startDate?: unknown;
    } | null;
    if (typeof record?.startDate === "string") startDate = record.startDate;

    const ownTitle = getLocalTitle(record?.prefLabel);
    const version = typeof record?.version === "string" ? record.version.trim() : "";
    // Follow bartoc.org: derive a title only when the edition has no own title.
    if (ownTitle) title = ownTitle;
    else if (version && mainTitle && mainTitle !== mainUri) title = `${mainTitle} ${version}`;
  } catch {
    // Keep the indexed title and URI if fullrecord is malformed.
  }

  return { uri: doc.id, title, ...(startDate ? { startDate } : {}) };
}

/**
 * Check displayed records as possible main records and fetch their editions.
 * Example: result 21133 has five editions -> { ".../21133": { total: 5, items: [three oldest] } }.
 */
export async function getEditionPreviews(resultDocs: SolrDocument[]): Promise<EditionsByMain> {
  const editionsByMain: EditionsByMain = {};
  const candidateMainUris = [...new Set(resultDocs.map(doc => doc.id).filter(isBartocUri))];
  // An untitled edition can use its main title plus its version number.
  const titlesByUri = new Map(resultDocs.map(doc => [
    doc.id,
    doc.title_en || doc.title_sort || "",
  ]));

  // Limit the URI list per request so large result pages do not create huge URLs.
  for (let offset = 0; offset < candidateMainUris.length; offset += BATCH_SIZE) {
    const uriBatch = candidateMainUris.slice(offset, offset + BATCH_SIZE);
    const response = await new SolrClient().searchOperation
      .prepareSelect(config.solr.coreName)
      // An empty LuceneQuery matches all; the filter selects this batch's editions.
      .for(new LuceneQuery())
      .filter(new SearchFilter("version_of_s").raw(
        `{!terms f=version_of_s}${uriBatch.join(",")}`,
      ))
      // rows limits groups; group.limit limits editions within each group.
      .groupBy("version_of_s", PREVIEW_LIMIT, "start_date_sort_s asc,id asc")
      .limit(uriBatch.length)
      .field("id,title_en,title_sort,fullrecord")
      .execute<GroupedEditionResponse>();

    for (const group of response.grouped?.version_of_s?.groups ?? []) {
      editionsByMain[group.groupValue] = {
        total: group.doclist.numFound,
        items: group.doclist.docs.map(doc =>
          toEditionPreview(doc, group.groupValue, titlesByUri.get(group.groupValue))),
      };
    }
  }

  return editionsByMain;
}
