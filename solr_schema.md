
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
| Field              | Type     | Indexed | Stored | MultiValued | Description                                                 |
| -----------------  | -------- | :-----: | :----: | :---------: | ----------------------------------------------------------- |
| `_version_`        | `long`   |    ✓    |    ✓   |      No     | Solr internal version for optimistic concurrency.           |
| `id`               | `string` |    ✓    |    ✓   |      No     | Unique document identifier (URI).                           |
| `access_type_ss`   | `string` |    ✓    |    ✓   |      Yes    | URIs denoting the resource’s access policy (e.g. Freely available, Registration required, License required )|
| `address_country_s`| `string` |    ✓    |    ✓   |      No     | Country of origin|
| `api_type_ss`      | `string` |    ✓    |    ✓   |     Yes     | One or more API-type identifiers (e.g. jskos, skosmos, sparql) denoting the service/interface protocols supported by the record.|
| `api_url_ss`       | `string` |    x    |    ✓   |     Yes     | One or more fully qualified endpoint URLs corresponding to each api_type_ss entry.|
| `format_type_ss`   | `array`  |    x    |    ✓   |     Yes     | A multivalued list of machine-readable format identifiers (URIs) describing the available resource formats. |
| `format_group_ss`  | `array`  |    x    |    ✓   |     Yes     | Canonical format category labels (e.g. “PDF”, “HTML”, “Spreadsheet”) derived by mapping individual format URIs to standardized groups. |
| `languages_ss`     | `string` |    ✓    |    ✓   |     Yes     | ISO language codes of the document.                         |
| `listed_in_ss`     | `string` |    ✓    |    ✓   |     Yes     | Registry URIs of the scheme(s) that include this vocabulary.|
| `license_type_ss`  | `string` |    ✓    |    ✓   |     Yes     | A multivalued list of machine-readable license identifiers (URIs) under which the resource is released. |
| `license_group_ss` | `string` |    ✓    |    ✓   |     Yes     | Canonical license category labels (e.g. “CC BY”, “CC BY-SA”, “Public Domain”, “WTFPL”) derived by mapping individual license URIs to a standardized group.|
| `publisher_label`  | `text`   |    ✓    |    ✓   |      No     | Name of the publishing organization (full-text).            |
| `publisher_id`     | `string` |    ✓    |    ✓   |      No     | Identifier URI of the publisher.                            |
| `alt_labels_ss`    | `string` |    ✓    |    ✓   |     Yes     | Alternative labels (multilingual).                          |
| `ddc_ss`           | `string` |    ✓    |    ✓   |     Yes     | Dewey Decimal Classification notations.                     |
| `ddc_root_ss`      | `string` |    ✓    |    ✓   |     Yes     | Dewey Decimal Classification notations only at root level.  |
| `created_dt`       | `pdate`  |    ✓    |    ✓   |      No     | Document creation timestamp (ISO 8601).                     |
| `modified_dt`      | `pdate`  |    ✓    |    ✓   |      No     | Last modification timestamp (ISO 8601).                     |
| `start_year_i`     | `pint`   |    ✓    |    ✓   |      No     | Start year (integer) of the classification.                 |
| `url_s`            | `string` |    ×    |    ✓   |      No     | Canonical URL for more information (not indexed).           |
| `title_sort`       | `string` |    ✓    |    ✓   |      No     | Sortable, un-analyzed title.                                |
| `type_uri`         | `string` |    ✓    |    ✓   |     Yes     | SKOS/NKOS type URIs (e.g. ConceptScheme, thesaurus).        |
| `title_search`     | `text`   |    ✓    |    ×   |     Yes     | Dedicated, multi-valued title field for title-only queries. |


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


### Example Document Structure

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