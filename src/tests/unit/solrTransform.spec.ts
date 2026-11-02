import { describe, expect, it } from "vitest"
import type { ConceptSchemeDocument } from "../../server/types/jskos"
import { applyQualityErrorCodes, transformConceptSchemeToSolr } from "../../server/solr/solr"
import type { SolrDocument } from "../../server/types/solr"

it("clears quality codes missing from the next indexed report", () => {
  const doc = { id: "http://bartoc.org/en/node/1" } as SolrDocument
  applyQualityErrorCodes(doc, doc.id, { [doc.id]: ["no-kos-type"] })
  expect(doc.quality_error_ss).toEqual(["no-kos-type"])

  applyQualityErrorCodes(doc, doc.id, {})
  expect(doc.quality_error_ss).toEqual([])
})

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

    const result = transformConceptSchemeToSolr(edition, [], { en: "Main title" })

    expect(result.version_of_s)
      .toBe("http://bartoc.org/en/node/20002")
    expect(result.start_date_sort_s).toBe("2020-05-01")
    expect(result.title_en).toBe("Example edition")
    expect(JSON.parse(result.fullrecord)).toEqual(edition)
  })

  it("indexes the main title for an untitled edition", () => {
    const edition: ConceptSchemeDocument = {
      "@context": "https://gbv.github.io/jskos/context.json",
      uri: "http://bartoc.org/en/node/10001",
      created: "2026-01-01",
      modified: "2026-01-01",
      type: ["http://www.w3.org/2004/02/skos/core#ConceptScheme"],
      versionOf: [{ uri: "http://bartoc.org/en/node/20002" }],
      version: "1.3",
    }

    const indexed = transformConceptSchemeToSolr(edition, [], { en: "Main title" })
    expect(indexed.title_en).toBe("Main title 1.3")
    expect(JSON.parse(indexed.fullrecord)).toEqual(edition)

    const withoutVersion = transformConceptSchemeToSolr({ ...edition, version: undefined }, [], { en: "Main title" })
    expect(withoutVersion.title_en).toBe("Main title")

    const withoutMainTitle = transformConceptSchemeToSolr(edition, [])
    expect(withoutMainTitle.title_sort).toBe(edition.uri)
  })
})
