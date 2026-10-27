import config from "../conf/conf";
import type { SolrDocument, SolrSearchResponse } from "../types/solr";
import { SolrClient } from "./SolrClient";
import { LuceneQuery } from "./search/LuceneQuery";
import { SearchFilter } from "./search/SearchFilter";

// Keep URLs manageable: 120 distinct parents require two requests (100 + 20).
const BATCH_SIZE = 100;

// Return URI -> title for edition parents, even if they do not match the search.
export async function getParentTitles(resultDocs: SolrDocument[]): Promise<Record<string, string>> {
  // Example: { "http://bartoc.org/en/node/21146": "Thesaurus for the Social Sciences" }.
  const parentTitles: Record<string, string> = {};
  // Ignore records without a parent; several editions of one parent need only one lookup.
  const parentUris = [...new Set(resultDocs
    .map(doc => doc.version_of_s || "")
    .filter(Boolean))];

  try {
    // With no parent URIs this loop is skipped, so Solr is not queried.
    for (let offset = 0; offset < parentUris.length; offset += BATCH_SIZE) {
      const uriBatch = parentUris.slice(offset, offset + BATCH_SIZE);
      // Match exact parent IDs without the user's search text or facet filters.
      const response = await new SolrClient().searchOperation
        .prepareSelect(config.solr.coreName)
        .for(new LuceneQuery())
        .filter(new SearchFilter("id").raw(`{!terms f=id}${uriBatch.join(",")}`))
        .field("id,title_en,title_sort") // Fetch labels only, not full JSKOS records.
        .limit(uriBatch.length)
        .execute<SolrSearchResponse>();

      for (const doc of response.response.docs) {
        // Prefer English, then the indexed fallback title. Leave missing titles out.
        const title = doc.title_en || doc.title_sort;
        if (title) parentTitles[doc.id] = title;
      }
    }
  } catch (error) {
    // Keep titles already collected. The card uses BARTOC <id> for unresolved parents.
    config.warn?.("Parent title lookup failed:", error);
  }

  return parentTitles;
}
