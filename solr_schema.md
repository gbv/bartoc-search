
### Comments on Solr schema

This document explains the design decisions and structure of the Solr schema used in the bartoc-search project. The schema has been firstly designed to balance flexibility, multilingual content handling, and optimized full-text search across structured and unstructured data.

### Field Types


| Name     | Class                 | Description                                                                                                                                                |
| -------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `string` | `solr.StrField`       | Non-tokenized strings for IDs, exact keywords, and URIs.|
| `boolean` | `solr.BoolField` | True/false flag. |
| `lc_keyword` | `solr.StrField`   | Case-insensitive keyword, Uses KeywordTokenizer + LowerCaseFilter|
| `long`   | `solr.LongPointField` | 64-bit integers (used for internal versioning `_version_`).|
| `text`   | `solr.TextField`      | Full-text fields with custom analyzers for English: specials folding, word-delimiter, unicode folding, synonym expansion, stemming, and duplicate removal.|
| `pdate`  | `solr.TrieDateField`  | ISO 8601 date fields. (*Note: currently `TrieDateField`; consider moving to `DatePointField` in a future Solr major release.*)|
| `pint`   | `solr.TrieIntField`   | 32-bit integer fields. (*Note: currently `TrieIntField`; consider `IntPointField` later.*)|


### Field Definitions
Each field is configured with `indexed`, `stored`, and `multiValued` attributes to match our data model and search requirements:
| Field              | Type     | Indexed | Stored | MultiValued | Description                                                 |
| -----------------  | -------- | :-----: | :----: | :---------: | ----------------------------------------------------------- |
| `_version_`        | `long`   |    ✓    |    ✓   |      x     | Solr internal version for optimistic concurrency.           |
| `id`               | `string` |    ✓    |    ✓   |      x     | Unique document identifier (URI).                           |
| `access_type_ss`   | `string` |    ✓    |    ✓   |      ✓    | URIs denoting the resource’s access policy (e.g. Freely available, Registration required, License required )|
| `address_code_s`   | `lc_keyword` |    ✓    |    ✓   |      x     | Postal/ZIP code (e.g., 00165) |
| `address_country_s`| `lc_keyword` |    ✓    |    ✓   |      x     | Country name (verbatim; case-insensitive match) (e.g., Italy) |
| `address_locality_s`  | `lc_keyword` |    ✓    |    ✓   |      x     | City / locality (e.g., Rome) |
| `address_region_s`    | `lc_keyword` |    ✓    |    ✓   |      x     | Region / state / province (e.g., Lazio) |
| `address_street_s`    | `lc_keyword` |    ✓    |    ✓   |      x     | Street address line (e.g., via Monte del Gallo 47) |
| `api_type_ss`      | `string` |    ✓    |    ✓   |     ✓     | One or more API-type identifiers (e.g. jskos, skosmos, sparql) denoting the service/interface protocols supported by the record.|
| `api_url_ss`       | `string` |    x    |    ✓   |     ✓     | One or more fully qualified endpoint URLs corresponding to each api_type_ss entry.|
| `contact_email_s`  | `string` |    ✓    |    ✓   |     x     | Email address of anyone in charge of the vocabulary |
| `display_hideNotation_b`  | `boolean` |    ✓    |    ✓   |     x     | Hide notation it is only used as internal identifier  |
| `display_numericalNotation_b`  | `boolean` |    ✓    |    ✓   |     x     | Numerical notation concepts of the vocabulary will be sorted numerically when displayed as a list  |
| `examples_ss`      | `lc_keyword` | ✓ | ✓ | ✓ | Example sentences/snippets from JSKOS EXAMPLES field; |
| `format_type_ss`   | `array`  |    x    |    ✓   |     ✓     | A multivalued list of machine-readable format identifiers (URIs) describing the available resource formats. |
| `format_group_ss`  | `array`  |    x    |    ✓   |     ✓     | Canonical format category labels (e.g. “PDF”, “HTML”, “Spreadsheet”) derived by mapping individual format URIs to standardized groups. |
| `alt_labels_ss`    | `array`  |    x    |    ✓   |     ✓     | Language-agnostic aggregate of all altLabel values. Trimmed and de-duplicated across languages.|
| `contributor_uri_ss` | `array`  |    x    |    ✓   |     ✓    | Aggregate of all contributor uris|
| `contributor_ss`   | `array`  |    x    |    ✓   |     ✓  | Language-agnostic aggregate of all contributor values. Trimmed and de-duplicated across languages.|
| `created_dt`       | `pdate`  |    ✓    |    ✓   |      x     | Document creation timestamp (ISO 8601).                     |
| `creator_uri_ss`   | `array`  |    x    |    ✓   |     ✓    | Aggregate of all creator uris|
| `creator_ss`       | `array`  |    x    |    ✓   |     ✓  | Language-agnostic aggregate of all creator values. Trimmed and de-duplicated across languages.|
| `distribution_download_ss`| `array` |    x    |    ✓   |     ✓  |   Download URLs for the record’s distributions.
| `distribution_format_ss` | `array`  |    ✓   |    ✓   |     ✓  |   Distribution format labels (case-insensitive exact match), e.g., CSV, JSON.
| `distribution_mimetype_ss` | `array`|    ✓   |    ✓   |     ✓  |    Distribution MIME types, e.g., text/csv, application/json.
| `extent_s`       | string   |    ✓   |    ✓   |     x  |  Original extent string, as provided (display-only). |
| `fullrecord`       | `string` |  	 x	  |    ✓ 	 |	   x      | The complete, unextended JSKOS record (raw JSON) as a string.|
| `identifier_ss`    | `string` |  	 ✓ 	  |    ✓ 	 |	   ✓     | Additional identifiers of the resource; corresponds to the JSKOS identifier field (alternate URIs or local IDs).|
| `languages_ss`     | `array` |    ✓    |    ✓   |     ✓     | ISO language codes of the document.                         |
| `listed_in_ss`     | `string` |    ✓    |    ✓   |     ✓     | Registry URIs of the scheme(s) that include this vocabulary, coming from JSKOS partOf|
| `license_type_ss`  | `string` |    ✓    |    ✓   |     ✓     | A multivalued list of machine-readable license identifiers (URIs) under which the resource is released. |
| `license_group_ss` | `string` |    ✓    |    ✓   |     ✓     | Canonical license category labels (e.g. “CC BY”, “CC BY-SA”, “Public Domain”, “WTFPL”) derived by mapping individual license URIs to a standardized group.|
| `namespace_s`      | `string` |    ✓    |    ✓   |      x     | Namespace (URI prefix) of the Concept Scheme; corresponds to the JSKOS namespace field |
| `notation_ss`      | `array`  |   ✓    |    ✓   |     ✓     | Notational codes/identifiers from JSKOS notation |
| `notation_examples_ss`| `array`  |   ✓    |    ✓   |     ✓     | Example notational codes from JSKOS notationExamples |
| `notation_pattern_s`| `string`  |   x    |    ✓   |     x     |  Regex pattern from JSKOS notationPattern |
| `publisher_uri_ss`     | `string` |    ✓    |    ✓   |    ✓      | Identifier URI of the publisher.                            |
| `publisher_labels_ss`     | `string` |    ✓    |    ✓   |    ✓      | Aggregate of all prefered publisher labels                            |
| `pref_labels_ss`   | `string` |    ✓    |    ✓   |      ✓     | Aggregate of all preferred titles (trimmed, de-duplicated). |
| `ddc_ss`           | `string` |    ✓    |    ✓   |     ✓     | Dewey Decimal Classification notations.                     |
| `ddc_root_ss`      | `string` |    ✓    |    ✓   |     ✓     | Dewey Decimal Classification notations only at root level.  |
| `modified_dt`      | `pdate`  |    ✓    |    ✓   |      x     | Last modification timestamp (ISO 8601).                     |
| `start_year_i`     | `pint`   |    ✓    |    ✓   |      x     | Start year (integer) of the classification.                 |
| `url_s`            | `string` |    ×    |    ✓   |      x     | Canonical URL for more information (not indexed).           |
| `title_sort`       | `string` |    ✓    |    ✓   |      x     | Sortable, un-analyzed title.                                |
| `type_uri`         | `string` |    ✓    |    ✓   |     ✓     | SKOS/NKOS type URIs (e.g. ConceptScheme, thesaurus).        |
| `title_search`     | `text`   |    ✓    |    ×   |     ✓     | Dedicated, multi-valued title field for title-only queries. |


### Dynamic Fields
These patterns capture additional multilingual or unforeseen fields without changing the schema:
| Pattern         | Type     | Indexed | Stored | MultiValued | Description                                              |
| --------------- | -------- | :-----: | :----: | :---------: | -------------------------------------------------------- |
| `alt_label_*`   | `text`   |    ✓    |    ✓   |      x     | Language-specific alternative labels (`alt_label_de`, `alt_label_und`, etc.). |
| `contibutor_*`  | `text`   |    ✓    |    ✓   |      x     | Language-specific contributor labels (`contibutor_de`, `contibutor_en`, etc.). |
| `creator_*`     | `text`   |    ✓    |    ✓   |      x     | Language-specific creator labels (`creator_de`, `creator_en`, etc.). |
| `definition_*`  | `text`   |    ✓    |    ✓   |      x     | Language-specific definition labels (`definition_de`, `definition_en`, etc.). |
| `title_*`       | `text`   |    ✓    |    ✓   |      x     | Language-specific titles (`title_en`, `title_de`, etc.). |
| `description_*` | `text`   |    ✓    |    ✓   |      x     | Language-specific descriptions.                          |
| `prefLabel_*`   | `text`   |    ✓    |    ✓   |      ✓     | Per-language preferred titles (`*` = language code).        |
| `publisher_*`   | `text`   |    ✓    |    ✓   |      ✓     | Per-language preferred titles (`*` = language code).        |
| `subject_*`     | `text`   |    ✓    |    ✓   |      ✓     | Language-specific subject labels.                        |
| `type_label_*`  | `text`   |    ✓    |    ✓   |      x     | Language-specific human-readable type labels.            |
| `*_s`           | `string` |    ✓    |    ✓   |      x     | Arbitrary string fields following `_s` suffix.           |
| `*_i`           | `pint`   |    ✓    |    ✓   |      x     | Arbitrary integer fields.                                |
| `*_dt`          | `pdate`  |    ✓    |    ✓   |      x     | Arbitrary date fields.                                   |


### Copy Fields
To enable both targeted and global search, we copy field values into broader catch-all destinations:

| Source            | Destination    |
| ----------------- | -------------- |
| `address_*`       | `allfields`    |
| `alt_label_*`     | `allfields`    |
| `alt_labels_ss`   | `allfields`    |
| `contributor_*`   | `allfields`    |
| `contributor_ss`  | `allfields`    |
| `examples_ss`     | `allfields`    |
| `notation_ss`     | `allfields`    |
| `title_*`         | `allfields`    |
| `description_*`   | `allfields`    |
| `description_ss`  | `allfields`    |
| `publisher_label` | `allfields`    |
| `subject_*`       | `allfields`    |
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