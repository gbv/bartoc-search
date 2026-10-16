// @vitest-environment happy-dom

import { mount } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import VocabularyCard from "../../client/components/VocabularyCard.vue"
// @ts-ignore - JS client utility has no TypeScript declaration
import * as kosTypeDefinitions from "../../client/constants/kosTypeDefinitions"

const {
  resetKosTypeDefinitions,
  setKosTypeDefinitions,
} = kosTypeDefinitions

const fontAwesomeIconStub = {
  props: ["icon", "size"],
  template: "<span class=\"icon-stub\" />",
}

function mountVocabularyCard(doc = {}, editions?: object, parentTitle?: string) {
  return mount(VocabularyCard, {
    props: {
      doc: {
        id: "http://bartoc.org/en/node/1",
        title_en: "Example vocabulary",
        definition_en: ["A short description."],
        languages_ss: ["en"],
        ...doc,
      },
      lang: "en",
      editions,
      parentTitle,
    },
    global: {
      stubs: {
        "font-awesome-icon": fontAwesomeIconStub,
      },
    },
  })
}

beforeEach(() => {
  setKosTypeDefinitions({})
})

afterEach(() => {
  resetKosTypeDefinitions()
})

describe("VocabularyCard", () => {
  it.each([
    ["1056", "fr", "Plan de Classification des Documents", "Description française."],
    ["1061", "de", "Musteraktenplan für Schulgemeinden", "Deutsche Beschreibung."],
  ])("shows the %s JSKOS label and definition when English is absent", (id, lang, label, definition) => {
    const uri = `http://bartoc.org/en/node/${id}`
    const wrapper = mountVocabularyCard({
      id: uri,
      fullrecord: JSON.stringify({
        uri,
        prefLabel: { [lang]: label },
        definition: { [lang]: [definition] },
      }),
    })

    expect(wrapper.get(".result-title a").text()).toBe(label)
    expect(wrapper.get(".result-description").text()).toBe(definition)
  })

  it("omits the description when the JSKOS record has none", () => {
    const uri = "http://bartoc.org/en/node/1"
    const wrapper = mountVocabularyCard({
      fullrecord: JSON.stringify({ uri, prefLabel: { en: "Basic Classification" }, notation: ["BK"] }),
    })

    expect(wrapper.get(".result-title a").text()).toBe("Basic Classification (BK)")
    expect(wrapper.find(".result-description").exists()).toBe(false)
  })

  it.each([
    [{ en: "Basic Classification (BK)" }, undefined, "Basic Classification (BK)"],
    [{ en: "Basic Classification" }, { hideNotation: true }, "Basic Classification"],
  ])("does not repeat or reveal hidden notation", (prefLabel, display, expected) => {
    const wrapper = mountVocabularyCard({
      fullrecord: JSON.stringify({
        uri: "http://bartoc.org/en/node/1",
        prefLabel,
        notation: ["BK"],
        DISPLAY: display,
      }),
    })

    expect(wrapper.get(".result-title a").text()).toBe(expected)
  })

  it("shows JSKOS language names and unknown language codes", () => {
    const wrapper = mountVocabularyCard({
      languages_ss: ["de"],
      fullrecord: JSON.stringify({
        uri: "http://bartoc.org/en/node/1",
        prefLabel: { en: "Example vocabulary" },
        languages: ["en", "fr", "xyz"],
      }),
    })

    expect(wrapper.text()).toContain("Languages: English, French, xyz")
    expect(wrapper.text()).not.toContain("Language: German")
  })

  it("uses the singular language label and Solr fallback when fullrecord is unavailable", () => {
    const wrapper = mountVocabularyCard({ fullrecord: "{", languages_ss: ["it"] })

    expect(wrapper.text()).toContain("Language: Italian")
  })

  it("shows publisher names from JSKOS ahead of Solr labels", () => {
    const wrapper = mountVocabularyCard({
      publisher_labels_ss: ["Stale publisher"],
      fullrecord: JSON.stringify({
        uri: "http://bartoc.org/en/node/1",
        prefLabel: { en: "Example vocabulary" },
        publisher: [
          { prefLabel: { en: "First publisher" } },
          { prefLabel: { en: "Second publisher" } },
        ],
      }),
    })

    expect(wrapper.text()).toContain("Published by First publisher, Second publisher")
    expect(wrapper.text()).not.toContain("Stale publisher")
  })

  it.each(["{}", "{"])("uses Solr fields when fullrecord is unusable: %s", (fullrecord) => {
    const wrapper = mountVocabularyCard({ fullrecord, publisher_labels_ss: ["Solr publisher"] })

    expect(wrapper.get(".result-title a").text()).toBe("Example vocabulary")
    expect(wrapper.get(".result-description").text()).toBe("A short description.")
    expect(wrapper.text()).toContain("Published by Solr publisher")
  })

  it("updates the Solr title fallback when the document changes", async () => {
    const wrapper = mountVocabularyCard({ fullrecord: "{}" })

    await wrapper.setProps({
      doc: {
        id: "http://bartoc.org/en/node/2",
        title_en: "Updated vocabulary",
        definition_en: ["Updated description."],
        fullrecord: "{}",
      },
    })

    expect(wrapper.get(".result-title a").text()).toBe("Updated vocabulary")
    expect(wrapper.get(".result-description").text()).toBe("Updated description.")
  })

  it("shows edition links and a link to the full list", () => {
    const wrapper = mountVocabularyCard({}, {
      total: 4,
      items: [
        { uri: "http://bartoc.org/en/node/2", title: "First edition", startDate: "2018" },
        { uri: "http://bartoc.org/en/node/3", title: "Second edition" },
        { uri: "http://bartoc.org/en/node/4", title: "Third edition" },
      ],
    })

    expect(wrapper.text()).toContain("Editions (4)")
    expect(wrapper.get('a[href="http://dev.bartoc.org/en/node/2"]').text())
      .toBe("First edition (2018)")
    expect(wrapper.text()).toContain("Third edition")
    expect(wrapper.get('a[href="http://dev.bartoc.org/en/node/1#editions"]').text())
      .toBe("View all 4 editions")
  })

  it("omits the full-list link when all editions are shown", () => {
    const wrapper = mountVocabularyCard({}, {
      total: 1,
      items: [{ uri: "http://bartoc.org/en/node/2", title: "Only edition" }],
    })
    expect(wrapper.text()).not.toContain("View all")
  })

  it("links an edition to its main record", () => {
    const wrapper = mountVocabularyCard({
      version_of_s: "http://bartoc.org/en/node/10",
    }, undefined, "Example main")

    expect(wrapper.text()).toContain("Edition of:")
    expect(wrapper.get('a[href="http://dev.bartoc.org/en/node/10"]').text())
      .toBe("Example main")
  })

  it("shows NKOS type tooltips from JSKOS concept data", () => {
    setKosTypeDefinitions({
      "http://w3id.org/nkos/nkostype#thesaurus": {
        prefLabel: {
          en: "Thesaurus",
          de: "Thesaurus",
        },
        definition: {
          en: [
            "A system of terms with hierarchical, associative, and synonymous relationships.",
          ],
          de: [
            "Ein Begriffssystem mit hierarchischen, assoziativen und synonymen Beziehungen.",
          ],
        },
      },
    })

    const wrapper = mountVocabularyCard({
      type_uri: [
        "http://www.w3.org/2004/02/skos/core#ConceptScheme",
        "http://w3id.org/nkos/nkostype#thesaurus",
      ],
    })

    const tooltip = wrapper.get(".kos-type-info")

    expect(wrapper.text()).toContain("Thesaurus")
    expect(wrapper.text()).not.toContain("Concept Scheme")
    expect(tooltip.attributes("title")).toContain(
      "hierarchical, associative, and synonymous relationships",
    )
    expect(tooltip.attributes("aria-label")).toContain("Thesaurus")
  })

  it("keeps rendering legacy type labels when type URIs are absent", () => {
    setKosTypeDefinitions({})

    const wrapper = mountVocabularyCard({
      type_label_en: ["Thesaurus"],
    })

    expect(wrapper.text()).toContain("Thesaurus")
    expect(wrapper.find(".kos-type-info").exists()).toBe(false)
  })
})
