# BARTOC Search

[![Test](https://github.com/gbv/bartoc-search/actions/workflows/test.yml/badge.svg)](https://github.com/gbv/bartoc-search/actions/workflows/test.yml)

> Experimental BARTOC Search engine with indexing pipeline and discovery interface

This application extracts JSKOS data with metadata about terminologies from [BARTOC](https://bartoc.org) knowledge organization systems registry (managed in [jskos-server](https://github.com/gbv/jskos-server) / MongoDB), transforms and enriches the data and loads in into a [Solr](https://solr.apache.org/) search index. The index is then made available via a search API and an experimental discovery interface.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [API](#api)
  - [GET /](#get)
  - [GET /search](#get-search)
  - [GET /status](#get-status)
- [Development](#development)
- [Maintainers](#maintainers)
- [License](#license)

## Install

### Prerequisites

* Node.js >= 18
* MongoDB instance (local or remote)
* Solr instance with configured schema
* Docker & Docker Compose (optional but recommended)

### Fetch Repository or Docker image

A docker image [is published](https://github.com/orgs/gbv/packages/container/package/bartoc-search) on every push on branches `main` and `dev` and  when pushing a git tag starting with `v` (e.g., `v1.0.0`). Commits are ignored if they only modify documentation, GitHub workflows, config, or meta files.

See `docker-compose.yml` in the `docker` directory for usage.

Alternatively run from sources:

```bash
git clone https://github.com/gbv/bartoc-search.git
cd bartoc-search
npm install
```

## API

This service exposes three HTTP endpoints:

- **[GET /](#get)** – Root endpoint, returns the Vue Client.
- **[GET /search](#get-search)** – Search endpoint, accepts query parameters and returns matching results in json format.
- **[GET /status](#get-status)** – Health-check endpoint, returns service status about mongoDb and Solr connection.

All endpoints respond with JSON and use standard HTTP status codes.

### GET /

Returns the discovery interface in form of an HTML page with the experimental Vue client.

### GET /search

Executes a search query against the Solr index, returning results along with query metrics.

#### Query Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `q` | string | yes | Solr query string (e.g., `*:*` for all documents). |
| `start` | integer | no  | Zero-based offset into result set (default: `0`). |
| `rows` | integer | no  | Number of results to return (default: `10`). |
| `wt` | string | no  | Response writer type (default: `json`). |

#### Request Example

```http
GET /search?q=*:*&start=0&rows=10&wt=json HTTP/1.1
Host: api.example.com
Accept: application/json
```

#### Response

- **Status:** `200 OK`
- **Body:**
  
  ```json
  {
    "responseHeader": {
      "status": 0,
      "QTime": 3,
      "params": {
        "q": "*:*",
        "defType": "lucene",
        "start": "0",
        "rows": "10",
        "wt": "json"
      }
    },
    "response": {
      "numFound": 3684,
      "start": 0,
      "numFoundExact": true,
      "docs": [
        {
          "id": "http://bartoc.org/en/node/10",
          "title_en": "Australian Public Affairs Information Service Thesaurus",
          "description_en": "The APAIS thesaurus lists the subject terms used to index articles for APAIS...",
          "publisher_label": "National Library of Australia",
          "created_dt": "2013-08-14T10:23:00Z",
          "modified_dt": "2021-02-10T10:31:55.487Z"
        },
        {
          "id": "http://bartoc.org/en/node/100",
          "title_en": "The Institute of Electrical and Electronics Engineers Thesaurus",
          "description_en": "The IEEE Thesaurus is a controlled vocabulary of over 9,000 descriptive terms...",
          "publisher_label": "Institute of Electrical and Electronics Engineers",
          "created_dt": "2013-09-02T14:17:00Z",
          "modified_dt": "2019-04-23T15:50:00Z"
        }
        // …more documents…
      ]
    }
  }
  ```

#### Response Fields

| Field | Type | Description |
| --- | --- | --- |
| `responseHeader.status` | integer | Solr execution status (0 = success). |
| `responseHeader.QTime` | integer | Query execution time in milliseconds. |
| `responseHeader.params` | object | Echoes back the parameters used for the query. |
| `response.numFound` | integer | Total number of matching documents. |
| `response.start` | integer | Offset into the result set. |
| `response.numFoundExact` | boolean | Indicates if `numFound` is an exact count. |
| `response.docs` | array | Array of document objects matching the query. |
| └─ `id` | string | Unique document identifier (URI). |
| └─ `title_en` | string | English title of the thesaurus or concept scheme. |
| └─ `description_en` | string | Short English description or abstract. |
| └─ `publisher_label` | string | Label of the publishing organization. |
| └─ `created_dt` | string | Creation timestamp (ISO-8601). |
| └─ `modified_dt` | string | Last modification timestamp (ISO-8601). |

#### Error Responses
TBA
  
### GET /status


Returns a concise health check of the service, including environment and Solr index status.

**Request**

```
GET /status
```

**Response (HTTP 200)**

```json
{
  "ok": true,
  "environment": "development",
  "solr": {
    "connected": true,
    "indexedRecords": 3684,
    "lastIndexedAt": "2025-05-22T09:45:17.794Z"
  }
}
```

| Field                 | Type    | Description                                                                               |
| --------------------- | ------- | ----------------------------------------------------------------------------------------- |
| `ok`                  | boolean | Always `true` when the endpoint itself is reachable.                                      |
| `environment`         | string  | The `NODE_ENV` the server is running in (e.g. `development` or `production`).             |
| `solr.connected`      | boolean | `true` if Solr responded to a basic stats query; otherwise `false`.                       |
| `solr.indexedRecords` | number  | Total number of documents currently indexed in the Solr `bartoc` core.                    |
| `solr.lastIndexedAt`  | string  | ISO‑8601 timestamp of the most recent indexing run (max value of the `indexed_dt` field). |

> **Note:**
>
> * Here, **`lastIndexedAt`** refers to the time when the most recent document was pushed into Solr (the indexing timestamp), *not* the document-level `modified_dt`.
> * Other internal or experimental fields are omitted from this public API, as they may change without notice.


## Usage

To run from the `docker` directory:

```bash
docker-compose up --build
```

This starts:

* MongoDB (`mongo`) at localhost:27017
* Solr (`solr`) at localhost:8983
* bartoc-search app (`search`) at localhost:3000

So, we have three pieces, everything is configurable in `config/config.default.json`. 

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

## Development

### System Diagram

~~~mermaid
graph TD
  Solr[(🔎 Solr Index)]
  DB[(🍃 BARTOC database)]
  subgraph search service [ ]
    direction TB
    Server[⚙️ Search service]
    Client[🖥️ Vue Client]
  end
  Client[🖥️ Vue Client]

  User[👤 User]

  Applications

  %% FLOWS %%
  DB -- "Extract initial load" --> Server
  DB <-- "Watching Streams"        --> Server

  Server -->|Transform and Load| Solr
  Solr   -->|Indexing         | Server

  Server <--> Client
  Client -- "Browser" --> User
  Server -- "API"     --> Applications
~~~


### Project Goals

* Provide a reliable pipeline to synchronize BARTOC database with a Solr index
* Enrich data before to improve search
* Experiment with relevance ranking and facetted search

### Architecture

```
JSKOS Server / MongoDB (BARTOC Database) → bartoc-search server → Solr Index → Search frontend
```

The ETL process consists of:

1. **Extract**: Connect to MongoDB and extract JSKOS data from the `terminologies` collection.
2. **Transform**: Validate and enrich JSKOS records (e.g., with labels from vocabularies).
3. **Load**: Push the transformed data into a Solr index.

###  Technologies

* Node.js + TypeScript
* MongoDB with Mongoose
* Solr (sketched a minimal `solr-client`)
* Vite for build tooling
* Docker & Docker Compose for containerization
* Jest for unit and integration tests (?) -- no tests at the moment

### Bootstrapping the Architecture

The search application architecture has been initialized using a combination of community-supported templates and official Vite SSR guidance:

- **SSR Template:**  
  Bootstrapped from the [create-vite-extra SSR Vue TS template](https://github.com/bluwy/create-vite-extra/tree/master/template-ssr-vue-ts), which provides a ready-to-use setup for server-side rendering with Vue 3 and TypeScript.
  
- **Vite SSR Dev Server:**  
  Configured following the Vite official guide on setting up the SSR development server, enabling seamless hot module replacement and middleware integration – see [Vite SSR Guide](https://vite.dev/guide/ssr.html#setting-up-the-dev-server).
  

This combination ensures a modern, high-performance development workflow with SSR capabilities out of the box.

###  Features

* MongoDB connection handling
* Solr client with retry logic and batching
* Modular commands: `extract`, `enrich`, `load` (?)
* Frontend 

###  Planned Features (Roadmap)

* MongoDB Change Streams for live extraction (?)
* Web UI monitoring with Vue.js frontend

### Code Style

* TypeScript strict mode enabled
* Use ESLint and Prettier (`npm run lint`)
* Tests must be provided for new features

### Comments on Solr schema

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

## Maintainers

- [@rodolv-commons](https://github.com/rodolv-commons)
- [@nichtich](https://github.com/nichtich)

## License

MIT © 2025- Verbundzentrale des GBV (VZG)

