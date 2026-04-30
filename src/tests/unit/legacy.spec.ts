import { describe, it, expect } from "vitest"

// @ts-ignore - JS client utility has no TypeScript declaration
import { splitSubjectParam } from "../../client/utils/legacy"

describe("splitSubjectParam", () => {
  it("maps DDC subject URIs to DDC root notation", () => {
    expect(splitSubjectParam("http://dewey.info/class/577/e23/")).toEqual({
      ddc: ["5"],
      subjectUris: [],
    })
  })

  it("keeps non-DDC subject URIs as subjectUris", () => {
    expect(
      splitSubjectParam("http://uri.gbv.de/terminology/bk/42.90"),
    ).toEqual({
      ddc: [],
      subjectUris: ["http://uri.gbv.de/terminology/bk/42.90"],
    })
  })

  it("splits mixed subject parameters", () => {
    expect(
      splitSubjectParam(
        "http://dewey.info/class/577/e23/|http://uri.gbv.de/terminology/bk/42.90",
      ),
    ).toEqual({
      ddc: ["5"],
      subjectUris: ["http://uri.gbv.de/terminology/bk/42.90"],
    })
  })

  it("deduplicates repeated values", () => {
    expect(
      splitSubjectParam(
        "http://dewey.info/class/577/e23/|http://dewey.info/class/577/e23/",
      ),
    ).toEqual({
      ddc: ["5"],
      subjectUris: [],
    })
  })
})