# Solr Index Schema

This is the human-readable documentation for the BARTOC Search Solr index. Keep field descriptions and public facet mappings here instead of repeating them in the README.

The runtime Solr configuration lives in `docker/solr-config/terminologies-configset/conf/schema.xml`. The indexing implementation lives in `src/server/solr/solr.ts`, with the TypeScript document shape in `src/server/types/solr.ts`.

This document explains the design decisions and structure of the Solr schema used in the bartoc-search project. The schema balances flexibility, multilingual content handling, and optimized full-text search across structured and unstructured data.

## Public Facet Keys

Use these public keys in the API `filter` parameter. The server maps them to Solr fields:

| Public key | Solr field | Notes |
| --- | --- | --- |
| `type` | `type_uri` | KOS Type URIs |
| `ddc` | `ddc_root_ss` | DDC root notations |
| `language` | `languages_ss` | ISO codes |
| `in` | `listed_in_ss` | Registry URIs |
| `api` | `api_type_ss` | API protocol identifiers |
| `access` | `access_type_ss` | Access policy |
| `license` | `license_group_ss` | Canonical license groups |
| `format` | `format_group_ss` | Canonical format groups |
| `country` | `address_country_s` | Country |
| `publisher` | `publisher_labels_ss` | Publisher display label |

## Field Types


| Name     | Class                 | Description                                                                                                                                                |
| -------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `string` | `solr.StrField`       | Non-tokenized strings for IDs, exact keywords, and URIs.|
| `boolean` | `solr.BoolField` | True/false flag. |
| `lc_keyword` | `solr.TextField`   | Case-insensitive keyword using KeywordTokenizer + LowerCaseFilter. |
| `long`   | `solr.LongPointField` | 64-bit integers (used for internal versioning `_version_`).|
| `text`   | `solr.TextField`      | Full-text fields with custom analyzers for English: specials folding, word-delimiter, unicode folding, synonym expansion, stemming, and duplicate removal.|
| `pdate`  | `solr.TrieDateField`  | ISO 8601 date fields. (*Note: currently `TrieDateField`; consider moving to `DatePointField` in a future Solr major release.*)|
| `pint`   | `solr.TrieIntField`   | 32-bit integer fields. (*Note: currently `TrieIntField`; consider `IntPointField` later.*)|
| `text_trigram` | `solr.TextField` | Character trigram text field used for typo-tolerant fallback matching. |


## Field Definitions
Each field is configured with `indexed`, `stored`, and `multiValued` attributes to match our data model and search requirements:
| Field              | Type     | Indexed | Stored | MultiValued | Description                                                 |
| -----------------  | -------- | :-----: | :----: | :---------: | ----------------------------------------------------------- |
| `_version_`        | `long`   |    ✓    |    ✓   |      x     | Solr internal version for optimistic concurrency.           |
| `id`               | `string` |    ✓    |    ✓   |      x     | Unique document identifier (URI).                           |
| `bartoc_id_s`      | `string` |    ✓    |    ✓   |      x     | Numeric BARTOC node id extracted from the URI, e.g. `20541` from `http://bartoc.org/en/node/20541`. Copied to `allfields` for direct search. |
| `access_type_ss`   | `string` |    ✓    |    ✓   |      ✓    | URIs denoting the resource’s access policy (e.g. Freely available, Registration required, License required )|
| `address_code_s`   | `lc_keyword` |    ✓    |    ✓   |      x     | Postal/ZIP code (e.g., 00165) |
| `address_country_s`| `lc_keyword` |    ✓    |    ✓   |      x     | Country name (verbatim; case-insensitive match) (e.g., Italy) |
| `address_locality_s`  | `lc_keyword` |    ✓    |    ✓   |      x     | City / locality (e.g., Rome) |
| `address_region_s`    | `lc_keyword` |    ✓    |    ✓   |      x     | Region / state / province (e.g., Lazio) |
| `address_street_s`    | `lc_keyword` |    ✓    |    ✓   |      x     | Street address line (e.g., via Monte del Gallo 47) |
| `api_type_ss`      | `string` |    ✓    |    ✓   |     ✓     | One or more API-type identifiers (e.g. jskos, skosmos, sparql) denoting the service/interface protocols supported by the record.|
| `api_url_ss`       | `string` |    x    |    ✓   |     ✓     | One or more fully qualified endpoint URLs corresponding to each api_type_ss entry.|
| `contact_email_s`  | `lc_keyword` |    ✓    |    ✓   |     x     | Email address of anyone in charge of the vocabulary |
| `display_hideNotation_b`  | `boolean` |    ✓    |    ✓   |     x     | Hide notation it is only used as internal identifier  |
| `display_numericalNotation_b`  | `boolean` |    ✓    |    ✓   |     x     | Numerical notation concepts of the vocabulary will be sorted numerically when displayed as a list  |
| `examples_ss`      | `lc_keyword` | ✓ | ✓ | ✓ | Example sentences/snippets from JSKOS EXAMPLES field; |
| `format_type_ss`   | `string`  |    ✓    |    ✓   |     ✓     | Machine-readable format identifiers (URIs) describing the available resource formats. |
| `format_group_ss`  | `string`  |    ✓    |    ✓   |     ✓     | Canonical format category labels (e.g. “PDF”, “HTML”, “Spreadsheet”) derived by mapping individual format URIs to standardized groups. |
| `alt_labels_ss`    | `string`  |    ✓    |    ✓   |     ✓     | Language-agnostic aggregate of all altLabel values. Trimmed and de-duplicated across languages.|
| `contributor_uri_ss` | `string`  |    ✓    |    ✓   |     ✓    | Aggregate of all contributor URIs. |
| `contributor_ss`   | `string`  |    ✓    |    ✓   |     ✓  | Language-agnostic aggregate of all contributor values. Trimmed and de-duplicated across languages.|
| `created_dt`       | `pdate`  |    ✓    |    ✓   |      x     | Document creation timestamp (ISO 8601).                     |
| `creator_uri_ss`   | `string`  |    ✓    |    ✓   |     ✓    | Aggregate of all creator URIs. |
| `creator_ss`       | `string`  |    ✓    |    ✓   |     ✓  | Language-agnostic aggregate of all creator values. Trimmed and de-duplicated across languages.|
| `definition_ss`    | `string`  |    ✓    |    ✓   |     ✓  | Language-agnostic aggregate of all definition values. Trimmed and de-duplicated across languages. |
| `distributions_download_ss`| `string` |    ✓    |    ✓   |     ✓  | Download URLs for the record's distributions. |
| `distributions_format_ss` | `lc_keyword`  |    ✓   |    ✓   |     ✓  | Distribution format labels (case-insensitive exact match), e.g., CSV, JSON. |
| `distributions_mimetype_ss` | `lc_keyword`|    ✓   |    ✓   |     ✓  | Distribution MIME types, e.g., text/csv, application/json. |
| `extent_s`       | `string`   |    ✓   |    ✓   |     x  | Original extent string, as provided (display-only). |
| `fullrecord`       | `string` |    x    |    ✓    |      x      | The complete, unextended JSKOS record (raw JSON) as a string.|
| `identifier_ss`    | `string` |  	 ✓ 	  |    ✓ 	 |	   ✓     | Additional identifiers of the resource; corresponds to the JSKOS identifier field (alternate URIs or local IDs).|
| `languages_ss`     | `string` |    ✓    |    ✓   |     ✓     | ISO language codes of the document.                         |
| `listed_in_ss`     | `string` |    ✓    |    ✓   |     ✓     | Registry URIs of the scheme(s) that include this vocabulary, coming from JSKOS partOf|
| `license_type_ss`  | `string` |    ✓    |    ✓   |     ✓     | A multivalued list of machine-readable license identifiers (URIs) under which the resource is released. |
| `license_group_ss` | `string` |    ✓    |    ✓   |     ✓     | Canonical license category labels (e.g. “CC BY”, “CC BY-SA”, “Public Domain”, “WTFPL”) derived by mapping individual license URIs to a standardized group.|
| `namespace_s`      | `string` |    ✓    |    ✓   |      x     | Namespace (URI prefix) of the Concept Scheme; corresponds to the JSKOS namespace field |
| `notation_ss`      | `lc_keyword`  |   ✓    |    ✓   |     ✓     | Notational codes/identifiers from JSKOS notation |
| `notation_examples_ss`| `lc_keyword`  |   ✓    |    ✓   |     ✓     | Example notational codes from JSKOS notationExamples |
| `notation_pattern_s`| `string`  |   x    |    ✓   |     x     |  Regex pattern from JSKOS notationPattern |
| `publisher_uri_ss`     | `string` |    ✓    |    ✓   |    ✓      | Identifier URI of the publisher.  |
| `publisher_labels_ss`     | `lc_keyword` |    ✓    |    ✓   |    ✓      | Aggregate of all preferred publisher labels. |
| `pref_labels_ss`   | `string` |    ✓    |    ✓   |      ✓     | Aggregate of all preferred titles (trimmed, de-duplicated). |
| `subject_uri` | `string` |  ✓  |  ✓  |   ✓   | Subject concept URIs. |
| `subject_notation` | `lc_keyword` |  ✓  |  ✓  |   ✓   | Subject notations (codes). |
| `subject_scheme` | `string` |  ✓  |  ✓  |   ✓   | Subject scheme URIs (`inScheme[].uri`). |
| `subject_labels_ss` | `string` |  ✓  |  ✓  |   ✓   | Aggregate of all subject labels (trimmed, de-duplicated). |
| `subject_broader_uri_ss`      | `string`     |  ✓  |  ✓  |   ✓   | Immediate broader concept URIs. |
| `subject_broader_notation_ss` | `lc_keyword` |  ✓  |  ✓  |   ✓   | Immediate broader notations. |
| `subject_topconceptof_ss` | `string` |  ✓  |  ✓  |   ✓   | topConceptOf[].uri (schemes where it is a top concept). |
| `subject_type_ss`| `string`     |  ✓  |  ✓  |   ✓   | RDF types of the subject (e.g., `skos:Concept`).                           |
| `subject_context_ss` | `string`     |  ✗  |  ✓  |   ✓   | Stored `@context` URLs if present (display/debug).                         |
| `subject_of_url_ss`  | `string`     |    x    |    ✓   |   ✓   | Related resource URLs from JSKOS subjectOf  |
| `subject_of_host_ss` | `lc_keyword` |    ✓    |    ✓   |   ✓   | Hostnames extracted from URLs coming from JSKOS subjectOf (case-insensitive exact match). |
| `ddc_ss`           | `string` |    ✓    |    ✓   |     ✓     | Dewey Decimal Classification notations.                     |
| `ddc_root_ss`      | `string` |    ✓    |    ✓   |     ✓     | Dewey Decimal Classification notations only at root level.  |
| `ddc_ancestors_ss` | `string` |    ✓    |    ✓   |      ✓      | Hierarchical expansion of DDC integer notations. For each DDC class with an integer notation, all numeric prefixes are added (e.g., `420` → `["4","42","420"]`, `453` → `["4","45","453"]`). Used to support “bucket” filtering like `ddc:42` (420–429) and exact class queries like `ddc:420` without requiring range queries. Decimal notations (e.g., `32.1`) are not expanded and remain exact in `ddc_ss`. |
| `ddc_label_rank1_t` | `text` |    ✓    |    ✓   |     ✓     | Labels of the exact DDC assignments. |
| `ddc_label_rank2_t` | `text` |    ✓    |    ✓   |     ✓     | Labels of immediate DDC ancestors and memberSet components. |
| `ddc_label_rank3_t` | `text` |    ✓    |    ✓   |     ✓     | Labels of root DDC ancestors. |
| `modified_dt`      | `pdate`  |    ✓    |    ✓   |      x     | Last modification timestamp (ISO 8601).                     |
| `start_date_i`     | `pint`   |    ✓    |    ✓   |      x     | Start year (integer) of the classification.                 |
| `start_date_sort_s` | `string` |    ✓    |    ✓   |      x     | Trimmed JSKOS `startDate`, used to order edition previews. Missing values sort last. |
| `version_of_s`     | `string` |    ✓    |    ✓   |      x     | Direct main-record URI from `versionOf`; used to filter and group editions. |
| `url_s`            | `string` |    ×    |    ✓   |      x     | Canonical URL for more information (not indexed).           |
| `title_sort`       | `lc_keyword` |    ✓    |    ✓   |      x     | Sortable, un-analyzed title.                                |
| `type_uri`         | `string` |    ✓    |    ✓   |     ✓     | SKOS/NKOS type URIs (e.g. ConceptScheme, thesaurus).        |
| `title_search`     | `text`   |    ✓    |    ×   |     ✓     | Dedicated, multi-valued title field for title-only queries. |
| `title_trigram` | `text_trigram` | ✓ | × | ✓ | Trigram-indexed title field for typo-tolerant matching; filled via copyField from `title_*`. |
| `allfields_trigram` | `text_trigram` | ✓ | × | ✓ | Trigram-indexed catch-all mirror of `allfields`, used as a low-boost fuzzy fallback in queries. |
| `allfields` | `text` | ✓ | × | ✓ | Catch-all full-text field populated by copyField rules. |


## Edition Fields and Indexing

`version_of_s` stores the single direct BARTOC URI from `versionOf` (excluding self-links). Records without such a reference have no value; the default search excludes records with this field. Edition previews are grouped by it.

`start_date_sort_s` stores the trimmed `startDate`. Previews sort by this field, then `id`; missing dates sort last.

For an existing Solr core, update its active schema and run `npm run reindex`. A persistent core may not pick up changes to the repository configset automatically.

## DDC Enrichment Fields

During indexing, DDC subject URIs are expanded by `DdcEnricher` when the DDC snapshot is available. The snapshot is generated from [`bartoc-vocabularies`](https://github.com/gbv/bartoc-vocabularies) and loaded by `DdcStore` from `ddcConcepts.last.json`.

`DdcStore` reads `snapshotPath`, parses the DDC JSON, and builds an in-memory map of enriched DDC concepts. It follows JSKOS `broader` chains to build ancestors and resolves `memberSet` URIs to copy their labels.

If the snapshot cannot be loaded, `DdcEnricher` is not initialized and indexing falls back to numeric root and ancestor expansion. The snapshot path can be overridden with `DDC_CONCEPTS_FILE`.

- `ddc_ss`: exact DDC notations assigned to the terminology.
- `ddc_ancestors_ss`: intermediate ancestor notations.
- `ddc_root_ss`: top-level DDC classes used by the public `ddc` facet.
- `ddc_label_rank1_t`: labels of the exact DDC assignments.
- `ddc_label_rank2_t`: labels of immediate ancestors and memberSet components.
- `ddc_label_rank3_t`: labels of root ancestors.

The three `ddc_label_rank*_t` fields are copied into `allfields`, so DDC labels influence full-text matching and scoring.

## Dynamic Fields
These patterns capture additional multilingual or unforeseen fields without changing the schema:
| Pattern         | Type     | Indexed | Stored | MultiValued | Description                                              |
| --------------- | -------- | :-----: | :----: | :---------: | -------------------------------------------------------- |
| `alt_label_*`   | `text`   |    ✓    |    ✓   |      ✓     | Language-specific alternative labels (`alt_label_de`, `alt_label_und`, etc.). |
| `contributor_*`  | `text`   |    ✓    |    ✓   |      ✓     | Language-specific contributor labels (`contributor_de`, `contributor_en`, etc.). |
| `creator_*`     | `text`   |    ✓    |    ✓   |      ✓     | Language-specific creator labels (`creator_de`, `creator_en`, etc.). |
| `definition_*`  | `text`   |    ✓    |    ✓   |      ✓     | Language-specific definition labels (`definition_de`, `definition_en`, etc.). |
| `title_*`       | `text`   |    ✓    |    ✓   |      x     | Language-specific titles (`title_en`, `title_de`, etc.). |
| `pref_label_*`   | `text`   |    ✓    |    ✓   |      ✓     | Per-language preferred titles (`*` = language code).     |
| `publisher_*`   | `text`   |    ✓    |    ✓   |      ✓     | Per-language publisher labels (`*` = language code).     |
| `subject_label_*`| `text`   |    ✓    |    ✓   |      ✓     | Per-language subject labels (`prefLabel.*`).             |
| `type_label_*`  | `text`   |    ✓    |    ✓   |      x     | Language-specific human-readable type labels.            |
| `*_s`           | `string` |    ✓    |    ✓   |      x     | Arbitrary string fields following `_s` suffix.           |
| `*_i`           | `pint`   |    ✓    |    ✓   |      x     | Arbitrary integer fields.                                |
| `*_dt`          | `pdate`  |    ✓    |    ✓   |      x     | Arbitrary date fields.                                   |


## Copy Fields
To enable both targeted and global search, we copy field values into broader catch-all destinations:

| Source            | Destination    |
| ----------------- | -------------- |
| `address_*`       | `allfields`    |
| `alt_label_*`     | `allfields`    |
| `alt_labels_ss`   | `allfields`    |
| `bartoc_id_s`     | `allfields`    |
| `contributor_*`   | `allfields`    |
| `contributor_ss`  | `allfields`    |
| `creator_*`       | `allfields`    |
| `creator_ss`      | `allfields`    |
| `definition_*`    | `allfields`    |
| `definition_ss`   | `allfields`    |
| `examples_ss`     | `allfields`    |
| `notation_ss`     | `allfields`    |
| `publisher_*`     | `allfields`    |
| `publisher_labels_ss` | `allfields` |
| `pref_label_*`    | `allfields`    |
| `pref_labels_ss`  | `allfields`    |
| `subject_label_*` | `allfields`    |
| `subject_notation`| `allfields`    |
| `title_*`         | `allfields`    |
| `type_label_*`    | `allfields`    |
| `ddc_label_rank1_t` | `allfields`  |
| `ddc_label_rank2_t` | `allfields`  |
| `ddc_label_rank3_t` | `allfields`  |
| `title_*`         | `title_search` |
| `title_en`        | `title_sort`   |
| `title_*`         | `title_trigram` |

The sources copied into `allfields` are also copied directly into `allfields_trigram`; Solr does not chain copy fields. Existing cores need the updated schema and a reindex to populate this field.


- allfields
A multi-valued text field that aggregates most human-readable content for global full-text queries.

- title_search
A dedicated text field optimized for title-only searches.

## Exact short value boost

For global search (`allfields`), exact matches in `notation_ss`,
`alt_labels_ss`, and `bartoc_id_s` get an extra boost. This helps short names,
abbreviations, and BARTOC node ids, for example `AAT` or `20541`, rank above
records where the same text only appears in a longer title or description.

This boost is not used for field-specific searches such as `title_search` or
`subject_notation`.


## Fuzzy search via character trigrams (baseline)

Character trigrams make global and title searches resilient to typos. Exact matches still rank highest; trigram matches can recover small mistakes.

Global search (`allfields`) uses title and all-fields trigrams. Title search (`title_search`) uses only title trigrams. Other field-specific searches, such as `subject_notation`, stay strict.

#### Why trigrams?

Example: user types **“clasification”** (missing *s*).  
Index-time, Solr stores 3‑char slices for “classification”: `cla, las, ass, ssi, sif, ifi, fic, ica, cat, ati, tio, ion, …`  
Query-time, the typo is sliced similarly and **overlaps a lot** with the indexed grams → documents still score.

Trigrams are simple, predictable, and cheap to roll back.


#### Solr schema changes

A dedicated **text_trigram** that lowercases, ASCII‑folds, and splits into 3‑char n‑grams.

```xml
<!-- FieldType: trigrams for fuzzy-ish matching -->
<fieldType name="text_trigram" class="solr.TextField" positionIncrementGap="100">
  <analyzer type="index">
    <tokenizer class="solr.StandardTokenizerFactory"/>
    <filter class="solr.LowerCaseFilterFactory"/>
    <filter class="solr.ASCIIFoldingFilterFactory" preserveOriginal="false"/>
    <filter class="solr.NGramFilterFactory" minGramSize="3" maxGramSize="3"/>
  </analyzer>
  <analyzer type="query">
    <tokenizer class="solr.StandardTokenizerFactory"/>
    <filter class="solr.LowerCaseFilterFactory"/>
    <filter class="solr.ASCIIFoldingFilterFactory" preserveOriginal="false"/>
    <filter class="solr.NGramFilterFactory" minGramSize="3" maxGramSize="3"/>
  </analyzer>
</fieldType>
```

#### What Solr gets (example):

```
( allfields:("British Columbia First Nations Subject Headings"^3 OR ("British" AND "Columbia" AND "First" AND "Nations" AND "Subject" AND "Headings")) )
OR
( _query_:"{!edismax qf=title_trigram mm=90%}bri rit iti tis ish col olu lum umb mbi bia fir irs rst ..."^0.6
  OR _query_:"{!edismax qf=allfields_trigram mm=90%}bri rit iti tis ish col olu lum umb mbi bia fir irs rst ..."^0.25 )
```

- The first part boosts the exact phrase or requires all words in any order.
- The server sends generated 3-character grams to the trigram fields.
- The trigram part applies to simple global queries and, using only `title_trigram`, to simple title queries. eDisMax requires 90% gram overlap for multi-word input. For one word it requires 50% in titles and 75% in all fields.


**Enabled** for: typos and simple text in global or title search, e.g.

`Clasification`, `italain`, `deutsch land` (length ≥ 3, no Lucene syntax).

**Disabled** for: power-user cases, e.g.  
`title:"film noir"`, `api:*`, `foo AND bar`, `type:thesaurus`, or very short inputs like `it`.

**Also disabled** for other field-specific searches, e.g. `field=subject_notation`.

#### Tuning notes

- Start with boosts `title_trigram^0.6`, `allfields_trigram^0.25`.
  - Raise/lower as needed to balance recall vs. noise.
- Keep the multi-word overlap stricter than the single-word overlap: grams from several words can otherwise match unrelated metadata.
- Generate trigram query text in the server before calling eDisMax. Passing the
  whole word can make Solr match one noisy gram only.
- If index size grows too much, keep only `title_trigram` (remove `allfields_trigram` & copyField).
- Keep min/max gram size at **3** to avoid churn and false positives.


## Example Document Structure

The following example illustrates a typical Solr document indexed in the bartoc-search core:

```json
  {
    "access_type_ss":["http://bartoc.org/en/Access/Free"],
    "address_country_s":"Canada",
    "alt_labels_ss":["Classification system for films"], 
    "format_type_ss":["http://bartoc.org/en/Format/Online"],
    "created_dt":"2015-04-20T11:08:00Z", 
    "id":"http://bartoc.org/en/node/1313",
    "languages_ss":["en","fr"],
    "modified_dt":"2019-04-23T15:50:00Z",
    "publisher_id":"http://viaf.org/viaf/151723291",
    "publisher_label":"Bibliothèque et Archives nationales du Québec",
    "subject_uri":["http://dewey.info/class/7/e23/","http://dewey.info/class/791/e23/"],
    "subject_scheme":["http://bartoc.org/en/node/241","http://bartoc.org/en/node/241"],
    "type_uri":["http://www.w3.org/2004/02/skos/core#ConceptScheme","http://w3id.org/nkos/nkostype#classification_schema"], 
    "url_s":"https://www.banq.qc.ca/collections/collection_universelle/musique_films/classification_enregistrements_films/index.html?language_id=3#films", 
    "format_group_ss":["Online"], 
    "title_sort":"Film Classification Plan", 
    "title_en":"Film Classification Plan", 
    "description_en":"\"Fiction films are grouped into eight major cinematographic genres to help you choose from the collection. The films are sorted in alphabetical order according to each genre.\"", 
    "title_und":"Plan de classement des films", 
    "description_und":"\"Les films de fiction sont regroupés en huit grands genres cinématographiques afin de vous aider à faire un choix parmi la collection. Sous chaque genre, les films sont classés selon l’ordre alphabétique des réalisateurs.\"", 
    "_version_":1839600375931338800
    }
```
