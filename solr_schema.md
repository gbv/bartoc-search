
### Comments on Solr schema (Review it!)

This document explains the design decisions and structure of the Solr schema used in the bartoc-search project. The schema has been firstly designed to balance flexibility, multilingual content handling, and optimized full-text search across structured and unstructured data.

### Field Types
- **string**: Used for non-tokenized fields (IDs, keywords, URIs).
- **long**: Used for versioning fields (`_version_`).
- **text**: Configured with analyzers and filters suitable for full-text English search. Includes support for synonyms, word delimiters, unicode folding, stemming, and duplicate removal.
- **pdate**: Handles date fields (ISO 8601).  
  _Note: `TrieDateField` is currently used; maybe consider `DatePointField` for future versions._
- **pint**: Handles integer fields.  
  _Note: `TrieIntField` is currently used; maybe consider `IntPointField` for future versions._

### Fields
Each field is defined with appropriate attributes (`indexed`, `stored`, and `multiValued` where applicable) to match the data structure and search needs:
- Unique identifier (`id`).
- Language codes (`languages_ss`).
- Publisher labels and IDs (`publisher_label`, `publisher_id`).
- Alternative labels (`alt_labels_ss`).
- Dewey Decimal Classifications (`ddc_ss`).
- Date fields (`created_dt`, `modified_dt`).
- Start year (`start_year_i`).
- URL field (`url_s`).
- Type URIs (`type_uri`).
- Full-text title search support (`title_search`).

### Dynamic Fields
Dynamic fields handle unforeseen or future fields following naming conventions:
- `title_*`, `description_*`, `subject_*`, `type_label_*`: Full-text fields for multilingual and descriptive content.
- `*_s`: String fields for structured data.
- `*_i`: Integer fields.
- `*_dt`: Date fields.

### Copy Fields
Copy fields allow for flexible and comprehensive search capabilities:
- Selected fields (`title_*`, `description_*`, `publisher_label`, `subject_*`, `alt_labels_ss`) are copied into the general-purpose `allfields` field for global search.
- `title_*` is also copied into `title_search` to enable dedicated title-only search functionality.

### Schema Metadata
- The `uniqueKey` is set to `id` to ensure unique document identification.
- No default search field is defined explicitly; search functionality is primarily driven by `allfields` and custom query logic.

### Example Document Structure

The following example illustrates a typical Solr document indexed in the bartoc-search core:

```json
{
  "doc":
  {
    "alt_labels_ss":["Classification system for films"],
    "created_dt":"2015-04-20T11:08:00Z",
    "id":"http://bartoc.org/en/node/1313",
    "languages_ss":["en",
      "fr"],
    "modified_dt":"2019-04-23T15:50:00Z",
    "publisher_id":"http://viaf.org/viaf/151723291",
    "publisher_label":"Bibliothèque et Archives nationales du Québec",
    "subject_uri":["http://dewey.info/class/7/e23/",
      "http://dewey.info/class/791/e23/"],
    "subject_scheme":["http://bartoc.org/en/node/241",
      "http://bartoc.org/en/node/241"],
    "type_uri":["http://www.w3.org/2004/02/skos/core#ConceptScheme",
      "http://w3id.org/nkos/nkostype#classification_schema"],
    "url_s":"https://www.banq.qc.ca/collections/collection_universelle/musique_films/classification_enregistrements_films/index.html?language_id=3#films",
    "type_label_de":"Klassifikation",
    "title_en":"Film Classification Plan",
    "description_en":"\"Fiction films are grouped into eight major cinematographic genres to help you choose from the collection. The films are sorted in alphabetical order according to each genre.\"",
    "type_label_en":"Classification schema",
    "title_und":"Plan de classement des films",
    "description_und":"\"Les films de fiction sont regroupés en huit grands genres cinématographiques afin de vous aider à faire un choix parmi la collection. Sous chaque genre, les films sont classés selon l’ordre alphabétique des réalisateurs.\"",
    "_version_":1832086555959754752}
}
```