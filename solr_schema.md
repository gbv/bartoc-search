
### Comments on Solr schema

This document explains the design decisions and structure of the Solr schema used in the bartoc-search project. The schema has been firstly designed to balance flexibility, multilingual content handling, and optimized full-text search across structured and unstructured data.

### Field Types


| Name     | Class                 | Description                                                                                                                                                |
| -------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `string` | `solr.StrField`       | Non-tokenized strings for IDs, exact keywords, and URIs.                                                                                                   |
| `long`   | `solr.LongPointField` | 64-bit integers (used for internal versioning, `_version_`).                                                                                               |
| `text`   | `solr.TextField`      | Full-text fields with custom analyzers for English: specials folding, word-delimiter, unicode folding, synonym expansion, stemming, and duplicate removal. |
| `pdate`  | `solr.TrieDateField`  | ISO 8601 date fields. (*Note: currently `TrieDateField`; consider moving to `DatePointField` in a future Solr major release.*)                             |
| `pint`   | `solr.TrieIntField`   | 32-bit integer fields. (*Note: currently `TrieIntField`; consider `IntPointField` later.*)                                                                 |


### Field Definitions
Each field is configured with `indexed`, `stored`, and `multiValued` attributes to match our data model and search requirements:
| Field             | Type     | Indexed | Stored | MultiValued | Description                                                 |
| ----------------- | -------- | :-----: | :----: | :---------: | ----------------------------------------------------------- |
| `_version_`       | `long`   |    ✓    |    ✓   |      No     | Solr internal version for optimistic concurrency.           |
| `id`              | `string` |    ✓    |    ✓   |      No     | Unique document identifier (URI).                           |
| `languages_ss`    | `string` |    ✓    |    ✓   |     Yes     | ISO language codes of the document.                         |
| `publisher_label` | `text`   |    ✓    |    ✓   |      No     | Name of the publishing organization (full-text).            |
| `publisher_id`    | `string` |    ✓    |    ✓   |      No     | Identifier URI of the publisher.                            |
| `alt_labels_ss`   | `string` |    ✓    |    ✓   |     Yes     | Alternative labels (multilingual).                          |
| `ddc_ss`          | `string` |    ✓    |    ✓   |     Yes     | Dewey Decimal Classification notations.                     |
| `created_dt`      | `pdate`  |    ✓    |    ✓   |      No     | Document creation timestamp (ISO 8601).                     |
| `modified_dt`     | `pdate`  |    ✓    |    ✓   |      No     | Last modification timestamp (ISO 8601).                     |
| `start_year_i`    | `pint`   |    ✓    |    ✓   |      No     | Start year (integer) of the classification.                 |
| `url_s`           | `string` |    ×    |    ✓   |      No     | Canonical URL for more information (not indexed).           |
| `title_sort`      | `string` |    ✓    |    ✓   |      No     | Sortable, un-analyzed title.                                |
| `type_uri`        | `string` |    ✓    |    ✓   |     Yes     | SKOS/NKOS type URIs (e.g. ConceptScheme, thesaurus).        |
| `title_search`    | `text`   |    ✓    |    ×   |     Yes     | Dedicated, multi-valued title field for title-only queries. |


### Dynamic Fields
These patterns capture additional multilingual or unforeseen fields without changing the schema:
| Pattern         | Type     | Indexed | Stored | MultiValued | Description                                              |
| --------------- | -------- | :-----: | :----: | :---------: | -------------------------------------------------------- |
| `title_*`       | `text`   |    ✓    |    ✓   |      No     | Language-specific titles (`title_en`, `title_de`, etc.). |
| `description_*` | `text`   |    ✓    |    ✓   |      No     | Language-specific descriptions.                          |
| `subject_*`     | `text`   |    ✓    |    ✓   |     Yes     | Language-specific subject labels.                        |
| `type_label_*`  | `text`   |    ✓    |    ✓   |      No     | Language-specific human-readable type labels.            |
| `*_s`           | `string` |    ✓    |    ✓   |      No     | Arbitrary string fields following `_s` suffix.           |
| `*_i`           | `pint`   |    ✓    |    ✓   |      No     | Arbitrary integer fields.                                |
| `*_dt`          | `pdate`  |    ✓    |    ✓   |      No     | Arbitrary date fields.                                   |


### Copy Fields
To enable both targeted and global search, we copy field values into broader catch-all destinations:

| Source            | Destination    |
| ----------------- | -------------- |
| `title_*`         | `allfields`    |
| `description_*`   | `allfields`    |
| `publisher_label` | `allfields`    |
| `subject_*`       | `allfields`    |
| `alt_labels_ss`   | `allfields`    |
| `title_*`         | `title_search` |
| `title_en`        | `title_sort`   |

- allfields
A multi-valued text field that aggregates most human-readable content for global full-text queries.

- title_search
A dedicated text field optimized for title-only searches.

- title_sort
Also receives values from title_en to ensure consistent sort ordering.

### Example Document Structure

The following example illustrates a typical Solr document indexed in the bartoc-search core:

```json
  "id":                "http://bartoc.org/en/node/1297",
  "alt_labels_ss":    ["Klassifikation för litteraturvetenskap", "estetik", …],
  "languages_ss":     ["en", "fi", "sv"],
  "publisher_label":  "Helsingin yliopisto, Kirjasto",
  "publisher_id":     "http://viaf.org/viaf/126520961",
  "ddc_ss":           ["7", "790", "80"],
  "created_dt":       "2015-04-17T14:19:00Z",
  "modified_dt":      "2025-07-14T14:00:00.900Z",
  "start_year_i":     2009,
  "url_s":            "https://…",
  "title_sort":       "Shelf Rating of Literary Research, Aesthetics, Theater Science, Film and Television Research",
  "title_en":         "Shelf Rating of Literary Research, Aesthetics, Theater Science, Film and Television Research",
  "description_en":   "Subject-specific classification scheme used by the University of Helsinki Library …",
  "type_uri":         ["http://www.w3.org/2004/02/skos/core#ConceptScheme", …],
  "type_label_en":    "Classification schema",
  "_version_":         1837876396177752000
```