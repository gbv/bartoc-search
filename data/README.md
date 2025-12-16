# Data folder

### Purpose

- Download BARTOC NDJSON (`latest.ndjson`) with **ETag/Last-Modified** to leverage `304 Not Modified`.
- Build derived artifacts **streaming** (e.g., `lookup_entries.json`).
- **Publish atomically** to `data/artifacts/current/`.

### Rationale

* Canonical snapshots feed all artifacts.
* No data in Git—only scripts/docs.
* Atomic rename prevents serving **partial files**.

### Environment variables (optional)

* `BARTOC_DUMP` — default: `https://bartoc.org/data/dumps/latest.ndjson`
* `DATA_DIR` — default: `data` (root for snapshots/artifacts)


All files use UTF-8.  
**JSON** = single JSON document. **NDJSON** = one JSON object per line.

```
data/
├── artifacts
│   ├── accessTypes.last.json
│   ├── apiTypes.last.json
│   ├── current
│   │   ├── access_type.json
│   │   ├── artifacts.meta.json
│   │   ├── bartoc-api-types-labels.json
│   │   ├── ddc-labels.json
│   │   ├── listed_in.json
│   │   └── lookup_entries.json
│   ├── ddcConcepts.last.json
│   ├── formats.last.json
│   ├── registries.last.json
│   └── vocs.last.json
├── license-groups.json
├── format-groups.json
├── nkostype.concepts.ndjson
├── README.md
├── snapshots
│   ├── accessTypes
│   │   ├── 2025-09-01_noetag_4da288051e9c.json
│   │   └── 2025-09-02_noetag_4da288051e9c.json
│   ├── apiTypes
│   │   ├── 2025-09-01_noetag_86ca48db1cf3.json
│   │   └── 2025-09-02_noetag_86ca48db1cf3.json
│   ├── ddcConcepts
│   │   ├── 2025-09-01_noetag_025dbe41a62f.json
│   │   ├── 2025-09-01_noetag_ebf3a904e967.json
│   │   └── 2025-09-02_noetag_ebf3a904e967.json
│   ├── registries
│   │   └── 2025-09-01_W-289a7-o7JZIkS1ruxmbGhHhwmNx8zBspw_6497d5f035b0.json
│   └── vocs
│       ├── 2025-09-01_W-7787db-199036e97b5_a912b74760d9.ndjson
│       └── 2025-09-02_W-7787db-1990894f5de_a912b74760d9.ndjson
└── supported_languages.json

```

## How the updater works

1. **Fetch sources** with conditional GET (ETag + Last-Modified).
   Each response is saved versioned as:

   ```
   data/snapshots/<source>/YYYY-MM-DD_<etagOrNoetag>_<sha12>.(ndjson|json)
   ```

2. **Enrich (optional):**

   * If the **vocs** snapshot changed, run `jskos-enrich` (local binary) to produce

     ```
     data/artifacts/<version>__tmp/vocs.enriched.ndjson
     ```

     using your schemes config (e.g., `config/enrich.schemes.json`) and selected properties (e.g., `subject`).
   * If **vocs** did not change, keep the previously published `vocs.enriched.ndjson`.

3. **Build artifacts** into the same temp dir (streaming):

   * `lookup_entries.json` (uri, identifier[], prefLabel{…}, namespace)
   * `access_type.json`
   * `ddc-labels.json`
   * `listed_in.json`
   * `bartoc-api-types-labels.json`
   * `artifacts.meta.json` (timestamps, keep-langs, source metadata)

4. **Atomic publish**: rename `<version>__tmp` → `artifacts/current/`.

### Notes

* If a server returns **304 Not Modified**, the previous snapshot is reused.
* Enrichment only runs when **vocs** changed; otherwise the last enriched file remains in `artifacts/current/`.
* Indexing prefers the **enriched** NDJSON if present.

---

### Indexing

* One-shot indexing:

  ```bash
  npm run reindex
  ```

  Internally, the indexer chooses the input via:

  * `data/artifacts/current/vocs.enriched.ndjson` (preferred)
  * else the latest `vocs` NDJSON snapshot
  * else remote `BARTOC_DUMP` (streamed)

---

### Automation (cron in Docker)

Mount your cron file and config directory:

```yaml
volumes:
  - $CONFIGS/bartoc-search-dev:/config:ro
environment:
  - CONFIG_FILE=/config/config.json
  - TZ=Europe/Berlin
```

`/config/cron` example (run every **6 hours**, update → reindex):

```cron
CRON_TZ=Europe/Berlin

0 */6 * * * cd /usr/src/app && /usr/local/bin/npm run update-data >> /proc/1/fd/1 2>&1 && /usr/local/bin/npm run reindex >> /proc/1/fd/1 2>&1
```

> The container entrypoint installs `/config/cron` and starts `crond`; all job output goes to `docker logs`.

**Verify:**

```bash
docker compose logs -f bartoc-search
docker compose exec bartoc-search sh -lc 'crontab -l; ps aux | grep [c]rond'
```

---

### Troubleshooting

* **Permissions**: ensure the container user can write under `DATA_DIR` (bind mounts can inherit host perms).
* **Enrichment config**: if `jskos-enrich` complains about missing config, point `--schemes` to your file (e.g., `/config/enrich.schemes.json`).
* **cocoda-sdk missing**: install `jskos-cli` (dev dep) and make sure `node_modules/.bin/jskos-enrich` exists.
* **Solr connectivity**: in Docker, use `SOLR_URL=http://solr:8983/solr` and ensure the `solr` service is healthy.
* **Time zone**: set `TZ` and install `tzdata` in the image if you need local times in cron.

---

### CLI

Run the updater locally:

```bash
npm run update-data
```

Run the indexer locally:

```bash
npm run reindex
```

### Snapshots

#### `vocs`

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

#### `registries`

**Purpose:** Registry/collection records (things a scheme can be “Register”), used for badges and links in the UI.  
**Format:** JSON.  
**Key fields:**

- `uri` — canonical BARTOC node URI for the registry
- `prefLabel` — language map with the registry’s name
- `definition?` — short description (lang map, arrays of strings)
- `url?` — external website of the registry
- `type` — usually `http://www.w3.org/ns/dcat#Catalog`

**Example:**

```json
{"http://bartoc.org/en/node/18927": {
    "definition": {
      "en": [
        "This Agrisemantics Map of Data Standards is the continuation of the VEST Registry started on the FAO AIMS website (now superseded by tis Map) and it includes metadata from the AgroPortal ontology repository managed by University of Montpelier and Stanford University.\n"
      ]
    },
    "prefLabel": {
      "en": "VEST Registry"
    },
    "type": [
      "http://www.w3.org/ns/dcat#Catalog"
    ],
    "uri": "http://bartoc.org/en/node/18927",
    "url": "http://aims.fao.org/vest-registry"
  },}
```

#### `accessTypes`

**Purpose:** Access concept records from BARTOC (as JSKOS Concepts).  
**Format:** NDJSON  
**Typical fields per line:** `uri`, `prefLabel`, `notation?`, `inScheme`.  
**Example:**

```json
{ "uri": "http://bartoc.org/en/Access/Free",
    "notation": [
      "Free"
    ],
    "inScheme": [
      {
        "uri": "http://bartoc.org/en/node/20001"
      }
    ],
    "prefLabel": {
      "en": "freely available"
    },
    "topConceptOf": [
      {
        "uri": "http://bartoc.org/en/node/20001"
      }
    ],
    "narrower": [],
    "@context": "https://gbv.github.io/jskos/context.json",
    "type": [
      "http://www.w3.org/2004/02/skos/core#Concept"
    ]}
```

---

#### `apiTypes`

**Purpose:** API type concepts (e.g., JSKOS API, webservice).  
**Format:** NDJSON.  
**Typical fields per line:** `uri`, `prefLabel`, `notation`, `inScheme`, `scopeNote`, `topConceptOf`.  
**Example:**

```json
{"uri": "http://bartoc.org/api-type/jskos",
    "notation": [
      "jskos"
    ],
    "inScheme": [
      {
        "uri": "http://bartoc.org/en/node/20002"
      }
    ],
    "prefLabel": {
      "en": "JSKOS API"
    },
    "scopeNote": {
      "en": [
        "Base URL of a JSKOS Server instance or another service following its semantics"
      ]
    },
    "topConceptOf": [
      {
        "uri": "http://bartoc.org/en/node/20002"
      }
    ],
    "narrower": [],
    "@context": "https://gbv.github.io/jskos/context.json",
    "type": [
      "http://www.w3.org/2004/02/skos/core#Concept"
    ]}
```

**Used by:** “API type” facet / display.

---

### `ddcConcepts`

**Purpose:** Subset of DDC (top 100 classes or core set) as Concepts.  
**Format:** NDJSON.  
**Example:**

```json
 "uri": "http://dewey.info/class/0/e23/",
    "notation": [
      "0"
    ],
    "inScheme": [
      {
        "uri": "http://bartoc.org/en/node/241"
      }
    ],
    "prefLabel": {
      "en": "Computer science, information & general works"
    },
    "topConceptOf": [
      {
        "uri": "http://bartoc.org/en/node/241"
      }
    ],
    "narrower": [
      null
    ],
    "@context": "https://gbv.github.io/jskos/context.json",
    "type": [
      "http://www.w3.org/2004/02/skos/core#Concept"
    ]}
```

**Used by:** Subject hints/mapping.

---


### `formats`

**Purpose:** Format types as Concepts.  
**Format:** JSON.  
**Example:**

```json
{"uri": "http://bartoc.org/en/Format/Online",
    "notation": [
      "Online"
    ],
    "inScheme": [
      {
        "uri": "http://bartoc.org/en/node/20000"
      }
    ],
    "prefLabel": {
      "en": "Online"
    },
    "topConceptOf": [
      {
        "uri": "http://bartoc.org/en/node/20000"
      }
    ],
    "narrower": [],
    "@context": "https://gbv.github.io/jskos/context.json",
    "type": [
      "http://www.w3.org/2004/02/skos/core#Concept"
    ]
    ...}
```

**Used by:** Subject hints/mapping.


### Artifacts

#### `access_type.json`

**Purpose:** Local mapping for BARTOC “Access” types (e.g., Free, Restricted).  
**Format:** JSON object (string → string).  
**Shape:**

```json
{
  "http://bartoc.org/en/Access/Free": "Freely available",
  "http://bartoc.org/en/Access/Registered": "Registration required",
  "http://bartoc.org/en/Access/Licensed": "License required"
}
```

**Used by:** Facets/labels for access types.

---

#### `bartoc-api-types-labels.json`

**Purpose:** Quick label map for API types.  
**Format:** JSON object (URI → Display name).  
**Example:**

```json
{
  "http://bartoc.org/api-type/jskos": "JSKOS API",
  "http://bartoc.org/api-type/skosmos": "Skosmos API",
  "http://bartoc.org/api-type/reconciliation": "Reconciliation",
  "http://bartoc.org/api-type/loc": "Library of Congress",
  "http://bartoc.org/api-type/lod": "Linked Open Data (LOD)",
  "http://bartoc.org/api-type/skohub": "Skohub",
  "http://bartoc.org/api-type/sparql": "SPARQL endpoint",
  "http://bartoc.org/api-type/tematres": "TemaTres API",
  "http://bartoc.org/api-type/ols": "Ontology Lookup Service (OLS)",
  "http://bartoc.org/api-type/ontoportal": "OntoPortal",
  "http://bartoc.org/api-type/opentheso": "Opentheso",
  "http://bartoc.org/api-type/sru": "Search/Retrieve via URL (SRU)",
  "http://bartoc.org/api-type/oaipmh": "OAI-PMH",
  "http://bartoc.org/api-type/rss": "RSS",
  "http://bartoc.org/api-type/mycore": "MyCoRE Classification API",
  "http://bartoc.org/api-type/graphql": "GraphQL",
  "http://bartoc.org/api-type/noterms": "Network of Terms",
  "http://bartoc.org/api-type/lobid-gnd": "Lobid GND API",
  "http://bartoc.org/api-type/webservice": "Unspecified Webservice",
  "http://bartoc.org/api-type/xtree": "xTree API"
}
```

---

### `ddc-labels.json`

**Purpose:** Label lookup for top-level DDC classes (0–9).  
**Format:** JSON object mapping a single digit (as a string) to its English label.  
**Example:**

```json
{
  "0": "Computer science, information & general works",
  "1": "Philosophy & psychology",
  "2": "Religion",
  "3": "Social sciences",
  "4": "Language",
  "5": "Science",
  "6": "Technology",
  "7": "Arts & recreation",
  "8": "Literature",
  "9": "History & geography",
  "10": "Philosophy",
  ...
}
```

---

### `listed_in.json`

**Purpose:** Lookup table for registry/collection names by their BARTOC node URI (used to render “Register …” badges).  
**Format:** JSON object mapping, registry URI → label (string).  
**Example:**

```json
{
  "http://bartoc.org/en/node/18927": "VEST Registry",
  "http://bartoc.org/en/node/18926": "coli-conc KOS Registry",
  "http://bartoc.org/en/node/19999": "DANTE",
  "http://bartoc.org/en/node/18925": "FAIRSharing",
  "http://bartoc.org/en/node/1737": "The OBO Foundry",
  "http://bartoc.org/en/node/18923": "Getty Vocabularies",
  "http://bartoc.org/en/node/18922": "EU Vocabularies",
  "http://bartoc.org/en/node/18921": "Conservation controlled vocabularies",
  "http://bartoc.org/en/node/18784": "European Register of Marine Species (ERMS)",
  "http://bartoc.org/en/node/18735": "Metadata registry of the German Network for Educational Research Data",
  "http://bartoc.org/en/node/18714": "onomy.org",
  "http://bartoc.org/en/node/18696": "Loterre",
  "http://bartoc.org/en/node/18669": "PoolParty Vocabulary Hub",
  "http://bartoc.org/en/node/18662": "legivoc",
  "http://bartoc.org/en/node/18629": "SIFR BioPortal",
  "http://bartoc.org/en/node/18616": "Linked ISPRA",
}
```

---

### `lookup_entries.json`

**Purpose:** Prebuilt entries to power client-side URI detection (e.g., with `namespace-lookup`). Each item ties a Concept Scheme (`uri`) to its namespace prefix, labels and identifiers.  
**Format:** JSON array of objects.  
**Shape:**

```json
[
  {
    "uri": "http://bartoc.org/en/node/18514",
    "identifier": [
      "http://purl.org/heritagedata/schemes/eh_period",
      "http://purl.org/heritagedata/schemes/eh_period/concepts/"
    ],
    "prefLabel": { "en": "Historic England Periods Authority File" },
    "namespace": "http://purl.org/heritagedata/schemes/eh_period/"
  }
]
```

**Used by:** Client-side detection: “It is likely a URI from …”.



### Static files 

#### `supported_languages.json`

**Purpose:** Map language codes to display names used in the UI (filters, labels, i18n hints).  
**Format:** JSON object mapping language code → English name.  
**Notes:** Mostly ISO 639-1 (2-letter) codes; some entries may use 3-letter codes where no 2-letter exists (TODO) (e.g., `ceb`).

**Shape / Example:**

```json
{
  "af": "Afrikaans",
  "ar": "Arabic",
  "az": "Azerbaijani",
  "be": "Belarusian",
  "bg": "Bulgarian",
  ...
}
```

---

#### `license-groups.json`

**Purpose:** Normalize raw license URIs into UI-friendly buckets (e.g., “CC BY”, “CC BY-SA”).  
**Format:** JSON array of objects.  
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
  },
  ...
]
```

---

### `format-groups.json`

**Purpose:** Normalize raw format URIs into UI-friendly buckets (e.g., “Online”, “PDF”, “SKOS”).  
**Format:** JSON array of objects.  
**Shape / Example:**

```json
[
  { "key": "online", "label": "Online", "uris": ["http://bartoc.org/en/Format/Online"] },
  { "key": "pdf", "label": "PDF", "uris": ["http://bartoc.org/en/Format/PDF"] },
  {
    "key": "rdf",
    "label": "RDF",
    "uris": [
      "http://bartoc.org/en/Format/RDF",
      "http://bartoc.org/en/Format/Turtle",
      "http://bartoc.org/en/Format/N-Quads",
      "http://bartoc.org/en/Format/N-Triples",
      "http://bartoc.org/en/Format/N3",
      "http://bartoc.org/en/Format/TriX",
      "http://bartoc.org/en/Format/TriG"
    ]
  }
]
```

---

#### `nkostype.concepts.ndjson`

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

### CLI

Run the updater directly locally:

```bash
npm run update-data
```
