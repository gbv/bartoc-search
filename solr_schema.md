
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
  {"created_dt":"2020-12-16T19:00:11.362Z",
  "ddc_ss": ["7","700","338"],
  "ddc_root_ss": ["7","3"],
  "id": "http://bartoc.org/en/node/20087",
  "languages_ss": ["ko"],
  "modified_dt": "2024-12-04T18:31:25.903Z",
  "publisher_id": "http://viaf.org/viaf/132970081",
  "publisher_label": "Statistics Korea", 
  "start_year_i": 2010, 
  "subject_uri": ["http://dewey.info/class/7/e23/","http://dewey.info/class/700/e23/","http://dewey.info/class/338/e23/","http://eurovoc.europa.eu/1367","http://eurovoc.europa.eu/c_d6e5f3ab"], 
  "subject_notation": ["7","700","338","1367","c_d6e5f3ab"], 
  "subject_scheme": ["http://bartoc.org/en/node/241","http://bartoc.org/en/node/241","http://bartoc.org/en/node/241","http://eurovoc.europa.eu/100141","http://eurovoc.europa.eu/100141"], 
  "type_uri": ["http://www.w3.org/2004/02/skos/core#ConceptScheme","http://w3id.org/nkos/nkostype#classification_schema"], 
  "url_s":"http://kssc.kostat.go.kr/", 
  "title_sort":"Contents Industry Classification", 
  "title_en":"Contents Industry Classification", 
  "description_en":"- To support the policy, the Ministry of Culture decided to unify the promotion policy of the content industry following the reorganization of the government in 2008.\n- Referring to international standards prepared by the OECD (Content Media Industry Classification) and UNESCO (2009 UNESCO Framework for Cultural Statistics) and reflecting the characteristics of domestic industries\n- Includes music, film and video, animation industry, broadcasting industry, game industry, performance industry, craft and design industry, advertising industry, information service industry, intellectual property management, etc.","title_ko":"콘텐츠산업분류", 
  "description_und":"- 2008년 정부조직개편에 따라 문화부에서 콘텐츠산업 진흥정책을 일원화하기로 결정됨에 따라 해당 정책을 지원하기 위해 작성\n- OECD(콘텐츠미디어산업분류)와 UNESCO(2009 UNESCO Framework for Cultural Statistics)가 작성한 국제기준을 참조하고 국내산업의 특성을 반영하여 작성\n- 음악, 영화·비디오, 애니메이션 산업, 방송 산업, 게임 산업, 공연 산업, 공예품 및 디자인업, 광고 산업, 정보서비스업, 지적재산권 관리업 등을 포함","_version_":1839157696917405700}
```