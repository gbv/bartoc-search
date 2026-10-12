import { describe, expect, it } from "vitest"
import type { ConceptSchemeDocument } from "../../server/types/jskos"
import { transformConceptSchemeToSolr } from "../../server/solr/solr"

describe("transformConceptSchemeToSolr", () => {
  it("indexes the direct main-record URI", () => {
    const edition: ConceptSchemeDocument = {
      "@context": "https://gbv.github.io/jskos/context.json",
      uri: "http://bartoc.org/en/node/10001",
      created: "2026-01-01",
      modified: "2026-01-01",
      startDate: "2020-05-01",
      prefLabel: { en: "Example edition" },
      type: [
        "http://www.w3.org/2004/02/skos/core#ConceptScheme",
      ],
      versionOf: [
        { uri: "http://bartoc.org/en/node/20002" },
      ],
    }

    const result = transformConceptSchemeToSolr(edition, [])

    expect(result.version_of_s)
      .toBe("http://bartoc.org/en/node/20002")
    expect(result.start_date_sort_s).toBe("2020-05-01")
    expect(JSON.parse(result.fullrecord)).toEqual(edition)
  })
})