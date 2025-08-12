# Data folder

All files use UTF-8.  
**JSON** = single JSON document. **NDJSON** = one JSON object per line.

```
data/
├── access_type.json
├── bartoc-access.concepts.ndjson
├── bartoc-api-types.concepts.ndjson
├── bartoc-api-types-labels.json
├── ddc100.concepts.ndjson
├── ddc-labels.json
├── format-groups.json
├── lastIndexedAt.txt
├── latest.ndjson
├── license-groups.json
├── listedIn.json
├── namespaces_entries.json
├── nkostype.concepts.ndjson
├── registries.ndjson
└── supported_languages.json
```

## `access_type.json`

**Purpose:** Local mapping for BARTOC “Access” types (e.g., Free, Restricted).  
**Format:** JSON object (string → string).  
**Shape:**

```json
{
  "http://bartoc.org/en/Access/Free": "Freely available",
}
```

**Used by:** Facets/labels for access types.

---

## `bartoc-access.concepts.ndjson`

**Purpose:** Access concept records from BARTOC (as JSKOS Concepts).  
**Format:** NDJSON 
**Typical fields per line:** `uri`, `prefLabel`, `notation?`, `inScheme`.  
**Example:**

```json
{"uri":"http://bartoc.org/en/Access/Free","notation":["Free"],"inScheme":[{"uri":"http://bartoc.org/en/node/20001"}],"prefLabel":{"en":"freely available"},"topConceptOf":[{"uri":"http://bartoc.org/en/node/20001"}]}
```

---

## `bartoc-api-types.concepts.ndjson`

**Purpose:** API type concepts (e.g., JSKOS API, webservice).  
**Format:** NDJSON.  
**Typical fields per line:** `uri`, `prefLabel`, `notation`, `inScheme`, `scopeNote`, `topConceptOf`.  
**Example:**

```json
{"uri":"http://bartoc.org/api-type/jskos","notation":["jskos"],"inScheme":[{"uri":"http://bartoc.org/en/node/20002"}],"prefLabel":{"en":"JSKOS API"},"scopeNote":{"en":["Base URL of a JSKOS Server instance or another service following its semantics"]},"topConceptOf":[{"uri":"http://bartoc.org/en/node/20002"}]}
```

**Used by:** “API type” facet / display.

---

## `bartoc-api-types-labels.json`

**Purpose:** Quick label map for API types.  
**Format:** JSON object (URI → Display name).  
**Example:**

```json
 "http://bartoc.org/api-type/jskos": "JSKOS API",
```

---

## `ddc100.concepts.ndjson`

**Purpose:** Subset of DDC (top 100 classes or core set) as Concepts.  
**Format:** NDJSON.  
**Example:**

```json
{"uri":"http://dewey.info/class/0/e23/","notation":["0"],"inScheme":[{"uri":"http://bartoc.org/en/node/241"}],"prefLabel":{"en":"Computer science, information & general works"},"topConceptOf":[{"uri":"http://bartoc.org/en/node/241"}]}
```

**Used by:** Subject hints/mapping.

---

## `ddc-labels.json`

**Purpose:** Label lookup for top-level DDC classes (0–9). .  
**Format:**JSON object mapping a single digit (as a string) to its English label. 
**Example:**

```json
 "0": "Computer science, information & general works",
```

---

## `format-groups.json`

**Purpose:** **Purpose:** Normalize raw format URIs into UI-friendly buckets (e.g., “Online”, “PDF”, “SKOS”). 
**Format:** JSON **array** of objects.
**Example:**

```json
[
  {
    "key": "online",
    "label": "Online",
    "uris": ["http://bartoc.org/en/Format/Online"]
  },
  {
    "key": "pdf",
    "label": "PDF",
    "uris": ["http://bartoc.org/en/Format/PDF"]
  },
  ...
]
```

---

## `latest.ndjson`

**Purpose:** Database dump of Concept Schemes (BARTOC) used for indexing purposes.  
**Format:** NDJSON (one JSKOS **ConceptScheme** per line).  
**Typical fields:** `uri`, `prefLabel`, `namespace`, `notationPattern?`, `identifier?`, `languages`, `publisher?`, `subject?`, `startDate?`, `modified?`, `API?`, `ACCESS?`, `FORMAT?`, `license?`, `partOf?`, `url?`.  
**Example (abridged):**

```json
{"type":["http://www.w3.org/2004/02/skos/core#ConceptScheme"],
 "uri":"http://bartoc.org/en/node/18785",
 "namespace":"http://uri.gbv.de/terminology/bk/",
 "prefLabel":{"en":"Basic Classification","de":"Basisklassifikation"}}
```

---

## `license-groups.json`

**Purpose:** Normalize raw license URIs into UI-friendly buckets (e.g., “CC BY”, “CC BY-SA”).
**Format:** JSON **array** of objects.
**Shape / Example:**
```json
[
  {
    "key": "cc_by",
    "label": "CC BY",
    "uris": [
      "http://creativecommons.org/licenses/by/3.0/",
      "http://creativecommons.org/licenses/by/4.0/"
    ]
  },
  {
    "key": "cc_by_nd",
    "label": "CC BY-ND",
    "uris": [
      "http://creativecommons.org/licenses/by-nd/3.0/",
      "http://creativecommons.org/licenses/by-nd/4.0/"
    ]
  },
  {
    "key": "cc_by_sa",
    "label": "CC BY-SA",
    "uris": [
      "http://creativecommons.org/licenses/by-sa/3.0/",
      "http://creativecommons.org/licenses/by-sa/4.0/"
    ]
  }
]
```

---

## `listedIn.json`

**Purpose:** Lookup table for registry/collection names by their BARTOC node URI (used to render “Listed in …” badges).
**Format:** JSON object mapping,  registry URI → label (string).

**Example (array of objects):**

```json
[
  {
  "http://bartoc.org/en/node/18927": "VEST Registry",
  "http://bartoc.org/en/node/18926": "coli-conc KOS Registry",
  "http://bartoc.org/en/node/19999": "DANTE",
  ...
}
]
```

---

## `namespaces_entries.json`

**Purpose:** Prebuilt entries to power client-side URI detection (e.g., with `namespace-lookup`). Each item ties a Concept Scheme (`uri`) to its namespace prefix and labels. 

**Format:** JSON array of objects.
**Shape:**

```json
[
  {
    "uri": "http://bartoc.org/en/node/1031",
    "namespace": "http://uri.gbv.de/terminology/kab/",
    "prefLabel": {
      "de": "Klassifikation für Allgemeinbibliotheken",
      "en": "Classification for general libraries"
    }
  },
  {
    "uri": "http://bartoc.org/en/node/1042",
    "namespace": "http://bartoc.org/en/node/1042/",
    "prefLabel": { "en": "Field of Science and Technology Classification" }
  },
  ...
]
```

**Used by:** Client-side detection: “It is likely a URI from …”.

---

## `nkostype.concepts.ndjson`

**Purpose:** NKOS Type Vocabulary as JSKOS Concept (e.g., thesaurus, classification schema, gazetteer).  
**Format:** NDJSON, one JSKOS Concept per line.
**Key fields:** `uri`, `type`, `notation`, `prefLabel`, `altLabel?`, `scopeNote?`, `inScheme`, `topConceptOf?`.
**Example:**

```json
{"uri":"http://w3id.org/nkos/nkostype#gazetteer",
 "type":["http://www.w3.org/2004/02/skos/core#Concept"],
 "@context":"https://gbv.github.io/jskos/context.json",
 "inScheme":[{"uri":"http://w3id.org/nkos/nkostype",
              "prefLabel":{"de":"KOS Typ Vokabular","en":"KOS Type Vocabulary"},
              "type":["http://www.w3.org/2004/02/skos/core#ConceptScheme","http://w3id.org/nkos/nkostype#list"]}],
 "publisher":[{"prefLabel":{"de":"DCMI/NKOS Task Group"}}],
 "notation":["gazetteer"],
 "prefLabel":{"en":"Gazetteer","de":"Gazetteer"},
 "altLabel":{"de":["Ortsverzeichnis","Ortslexikon"]},
 "scopeNote":{"en":["geospatial dictionary of named and typed places"]},
 "topConceptOf":[{"uri":"http://w3id.org/nkos/nkostype"}]}
```
---

## `registries.ndjson`

**Purpose:** Registry/collection records (things a scheme can be “listed in”), used for badges and links in the UI.
**Format:** NDJSON  — one object per line.
**Key fields:**  
- `uri` — canonical BARTOC node URI for the registry  
- `prefLabel` — language map with the registry’s name  
- `definition?` — short description (lang map, arrays of strings)  
- `url?` — external website of the registry  
- `type` — usually `http://purl.org/cld/cdtype/CatalogueOrIndex`

**Example:**

```json
{"definition":{"en":["This Agrisemantics Map of Data Standards is the continuation of the VEST Registry started on the FAO AIMS website (now superseded by tis Map) and it includes metadata from the AgroPortal ontology repository managed by University of Montpelier and Stanford University.\n"]},"prefLabel":{"en":"VEST Registry"},"type":["http://purl.org/cld/cdtype/CatalogueOrIndex"],"uri":"http://bartoc.org/en/node/18927","url":"http://aims.fao.org/vest-registry"}
```

---

## `supported_languages.json`

**Purpose:** Map language codes to display names used in the UI (filters, labels, i18n hints).
**Format:** JSON **object** mapping language code → English name.  
**Notes:** Mostly ISO 639-1 (2-letter) codes; some entries may use 3-letter codes where no 2-letter exists (TODO) (e.g., `ceb`).

**Shape / Example:**
```json
{
  "af": "Afrikaans",
  "ar": "Arabic",
  "az": "Azerbaijani",
  "be": "Belarusian",
  "bg": "Bulgarian",
```

---
