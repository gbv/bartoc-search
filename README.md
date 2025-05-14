# bartoc-search


## 🗺️ System Diagram

~~~mermaid
graph TD
  subgraph Backend
    A[(🍃 MongoDB :27017)]
    B[[⚙️ ETL search service :3000]]
    C[(🔎 Solr Index :8983)]
  end

  subgraph Frontend
    D[[🖥️ Bartoc Frontend App :5173]]
  end

  A -->|Extract initial load| B
  A -- Change Stream --> B
  B -->|Transform and Load| C
  D -->|Query| C
  C -->|Results| D
~~~


**bartoc-search** serves to extract JSKOS data from MongoDB, transform and load it into a Solr index for the future [BARTOC](https://bartoc.org) knowledge organization systems registry.

## 📝 Project Goals (? needs review)

* Provide a reliable pipeline to synchronize MongoDB data with Solr.
* Allow flexible transformation and enrichment of JSKOS records.
* Be fully event-driven (future versions) using MongoDB Change Streams.
* Be professionally structured and fully tested.

## 🏛️ Architecture

```
MongoDB (BARTOC Database) → bartoc-search ETL → Solr Index → Search frontend
```

The ETL process consists of:

1. **Extract**: Connect to MongoDB and extract JSKOS data from the `terminologies` collection.
2. **Transform**: Validate and enrich JSKOS records (e.g., with labels from vocabularies).
3. **Load**: Push the transformed data into a Solr index.

## 🛠️ Technologies

* Node.js + TypeScript
* MongoDB with Mongoose
* Solr (sketched a minimal `solr-client`)
* Vite for build tooling
* Docker & Docker Compose for containerization
* Jest for unit and integration tests (?) -- no tests at the moment

## 🚀 Installation

### Prerequisites

* Node.js >= 18
* MongoDB instance (local or remote)
* Solr instance with configured schema
* Docker & Docker Compose (optional but recommended)

### Clone Repository

```bash
git clone https://github.com/gbv/bartoc-search.git
cd bartoc-search
```

### Install Dependencies

```bash
npm install
```

## 🐳 Docker Usage
In the docker folder: 

```bash
docker-compose up --build
```

This starts:

* MongoDB (`mongo`) at localhost:27017
* Solr (`solr`) at localhost:8983
* bartoc-search app (`search`) at localhost:3000
* frontend app at localhost:5173

So, we have four pieces, everything is configurable in `config/config.default.json`. 


## 🏃 Usage

The ETL pipeline can be executed  via the dockerized setup. The workflow is composed of the following stages:

1. **Extract**: Retrieves JSKOS records from the `terminologies` collection in MongoDB.
2. **Transform/Enrich**: Validates and optionally enriches records using external vocabulary data.
3. **Load**: Indexes the processed records into Solr.

The application exposes dedicated commands (usually via CLI or internal scripts), but in normal production use, everything runs automatically inside the docker service `search`.

For local development or maintenance tasks:

* `extract`: Export MongoDB data to a local NDJSON file.
* `enrich`: Enrich existing JSKOS data from file and output to a new file.
* `etl`: Run the full extract → transform → load pipeline.

All configuration for MongoDB and Solr is set in `config/config.default.json` and can be overridden by local files.


At startup, as part of the automated initialization process, a dataset in NDJSON format is automatically loaded into the MongoDB instance. This dataset provides the starting records for the terminologies collection and ensures the system has data to process during the first execution of the ETL pipeline. The NDJSON import is handled by the mongoDB service in the Docker environment and can be customized or replaced depending on the project requirements. 

#### loadNdjsonData 
In particular: 

```json
"loadNdjsonData": true,
```
This option determines whether the NDJSON data should be automatically loaded into the MongoDB instance at container startup. This mechanism is considered a temporary workaround and can be disabled by setting the value to `false`.
When the Docker environment is started, an NDJSON dataset is automatically imported into the MongoDB instance as part of the initialization routine. This import populates the `terminologies` collection with initial records, providing a working dataset for testing, development, or first-time system execution. The operation is performed by the MongoDB service itself in conjunction with an initialization script. The dataset and behavior can be fully customized or disabled based on project needs in `config.default.json`.


#### indexDataAtBoot
```json
"indexDataAtBoot": true,
```
This option defines whether the existing data in the `terminologies` collection of MongoDB should be immediately indexed into Solr when the `bartoc-search` service starts. When enabled (true), the system will automatically trigger the full ETL pipeline at startup to ensure the Solr index reflects the current database contents. This is particularly useful for development or testing environments, but can be deactivated (false) in production systems where indexing is triggered externally or on-demand.


## 📦 Features

* MongoDB connection handling
* Solr client with retry logic and batching
* Modular commands: `extract`, `enrich`, `load` (?)
* Frontend 

## 🧩 Planned Features (Roadmap)

* MongoDB Change Streams for live extraction (?)
* Web UI monitoring with Vue.js frontend

### Code Style

* TypeScript strict mode enabled
* Use ESLint and Prettier (`npm run lint`)
* Tests must be provided for new features


## Comments on Solr schema
## Comments on Solr schema

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