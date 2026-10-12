import type { ConceptSchemeDocument } from "../../server/types/jskos"
import { getDirectVersionOfUri } from "../../server/utils/editions"

const editionUri = "http://bartoc.org/en/node/10001"
const mainUri = "http://bartoc.org/en/node/20002"

function edition(
  versionOf?: ConceptSchemeDocument["versionOf"],
): Partial<ConceptSchemeDocument> {
  return { uri: editionUri, versionOf }
}

describe("getDirectVersionOfUri", () => {
  it("returns the only canonical BARTOC main-record URI", () => {
    expect(getDirectVersionOfUri(edition([{ uri: mainUri }]))).toBe(mainUri)
  })

  it("requires exactly one versionOf reference", () => {
    expect(getDirectVersionOfUri(edition())).toBeUndefined()
    expect(getDirectVersionOfUri(edition([]))).toBeUndefined()
    expect(getDirectVersionOfUri(edition([
      { uri: mainUri },
      { uri: "http://bartoc.org/en/node/30003" },
    ]))).toBeUndefined()
  })

  it("rejects external and self references", () => {
    expect(getDirectVersionOfUri(edition([
      { uri: "https://example.org/terminology/1" },
    ]))).toBeUndefined()
    expect(getDirectVersionOfUri(edition([
      { uri: editionUri },
    ]))).toBeUndefined()
  })

  it("trims the record and main-record URIs", () => {
    const record = {
      uri: ` ${editionUri} `,
      versionOf: [{ uri: ` ${mainUri} ` }],
    }

    expect(getDirectVersionOfUri(record)).toBe(mainUri)
  })
})
