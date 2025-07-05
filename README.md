# BARTOC Search

[![Test](https://github.com/gbv/bartoc-search/actions/workflows/test.yml/badge.svg)](https://github.com/gbv/bartoc-search/actions/workflows/test.yml)

> Experimental BARTOC Search engine with indexing pipeline and discovery interface

This application extracts JSKOS data with metadata about terminologies from [BARTOC] knowledge organization systems registry (managed in [jskos-server]), transforms and enriches the data and loads in into a [Solr] search index. The index is then made available via a search API and a discovery interface.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [API](#api)
  - [GET /](#get-)
  - [GET /api/search](#get-apisearch)
  - [GET /api/status](#get-apistatus)
- [Architecture](#architecture)
  - [Solr](#solr)
  - [Redis](#redis)
- [Development](#development)
- [Maintainers](#maintainers)
- [License](#license)

[jskos-server]: https://github.com/gbv/jskos-server
[BARTOC]: https://bartoc.org/
[Solr]: https://solr.apache.org/

## Install

### Prerequisites

- Node.js >= 18
- jskos-server instance (local or remote)
- Solr instance with configured schema
- Docker & Docker Compose (optional but recommended)

### Fetch Repository or Docker image

A docker image [is published](https://github.com/orgs/gbv/packages/container/package/bartoc-search) on every push on branches `main` and `dev` and  when pushing a git tag starting with `v` (e.g., `v1.0.0`). Commits are ignored if they only modify documentation, GitHub workflows, config, or meta files.

See `docker-compose.yml` in the `docker` directory for usage.

Alternatively run from sources:

```bash
git clone https://github.com/gbv/bartoc-search.git
cd bartoc-search
npm install
```
---

## Usage

To run from the `docker` directory:

```bash
docker-compose up --build
```

This starts:

- Solr (`solr`) at localhost:8983
- bartoc-search app (`search`) at localhost:3000

### Configuration

All configuration for Solr is set in `config/config.default.json` and can be overridden by local files.

Create a file named `.env` at your project root containing:

```dotenv
# Name of the Solr core (must match /docker/solr-config/SOLR_CORE_NAME-configset/conf)
SOLR_CORE_NAME=terminologies
```

The environment variables `SOLR_CORE_NAME` drives both the Solr container’s precreation step and your app’s `config.solr.coreName`.

## API

This service exposes three HTTP endpoints:

- **[GET /](#get-)** – web interface (HTML)
- **[GET /api/search](#get-apisearch)** – search API (JSON)
- **[GET /api/status](#get-apistatus)** – service status (JSON)

The HTTP response code should always be 200 except for endpoint `/api/search` if there is an error with the Solr backend.

### GET /

Returns the discovery interface in form of an HTML page with an experimental Vue client.

#### Query Parameters

...

### GET /api/search

Performs a search query against the Solr index, returning results along with query metrics.

#### Query Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `q` | string | yes | Solr query string (e.g., `*:*` for all documents). |
| `start` | integer | no  | Zero-based offset into result set (default: `0`). |
| `rows` | integer | no  | Number of results to return (default: `10`). |
| `wt` | string | no  | Response writer type (default: `json`). |

#### Response

JSON object like the following example:

  
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

...
  
### GET /status

Returns a concise health check of the service, including environment and Solr index status.

#### Response

```json
{
  "ok": true,
  "appVersion": "1.0.0",
  "environment": "development",
  "runtimeInfo": 
    "nodeVersion": "v20.19.2",
    "uptime": "3 hours, 28 minutes, 39 seconds",
    "memoryUsage":  
      "rss": "131.9 MB",
      "heapTotal": "59.6 MB",
      "heapUsed": "57.9 MB",
      "external": "7.5 MB",
      "arrayBuffers": "0.6 MB",
    "timestamp":" Jun 18, 2025, 11:57:37 AM UTC",
  "services":  
    "solr": 
      "connected": false, 
      "indexedRecords": 0, 
      "lastIndexedAt": "Jun 17, 2025, 10:28:27 AM UTC", 
      "firstUpdate": "",
      "lastUpdate": ""
}
```

| Field                 | Type    | Description                                                                               |
| --------------------- | ------- | ----------------------------------------------------------------------------------------- |
| `ok`                  | boolean | Always `true` when the endpoint itself is reachable.                                      |
| `environment`         | string  | The `NODE_ENV` the server is running in (e.g. `development` or `production`).             |
| `solr.connected`      | boolean | `true` if Solr responded to a basic stats query; otherwise `false`.                       |
| `solr.indexedRecords` | number  | Total number of documents currently indexed in the Solr `bartoc` core.                    |
| `solr.lastIndexedAt`  | string  | ISO‑8601 timestamp of the most recent indexing run.                                       |

> **Note:**
>
> * Here, **`lastIndexedAt`** refers to the time when the most recent indexing procedure was pushed into Solr (the indexing timestamp).

## Architecture

*This section is outdated and/or incomplete*

### Data Flow

The application gets data from the [jskos-server] instance of [BARTOC], publically available at <https://bartoc.org/api>.

*TODO: update with Redis*

~~~mermaid
graph TD
  Solr[(🔎 Solr Index)]
  DB[("BARTOC database<br>jskos-server")]
  subgraph bartoc-search [ ]
    direction TB
    Server[⚙️ Search service]
    Client[🖥️ Vue Client]
  end

  User[👤 User]

  DB -- full dump --> Server
  DB -- changes --> Server

  Server -->|update| Solr
  Solr   -->|search| Server

  Server --API --> Client
  Client -- Browser --> User
  Server -- API     --> Applications
~~~

The ETL process consists of:

1. **Extract**: Connect to MongoDB and extract JSKOS data from the `terminologies` collection.
2. **Transform**: Validate and enrich JSKOS records (e.g., with labels from vocabularies).
3. **Load**: Push the transformed data into a Solr index.

The ETL pipeline can be executed  via the dockerized setup. The workflow is composed of the following stages:

The application exposes dedicated commands (usually via CLI or internal scripts), but in normal production use, everything runs automatically inside the docker service `search`.

### Solr

This section contains 

- [Environment Variables (`.env`)](#environment-variables-env)
- [Docker Compose Setup](#docker-compose-setup)
- [Application Service Configuration](#application-service-configuration)
- [Bootstrapping at Startup](#bootstrapping-at-startup)
- [Troubleshooting](#troubleshooting)

#### Docker Compose Setup

In `docker-compose.yml`, define a Solr service that pre-creates your core from a custom configset:

```yaml
services:
  solr:
    image: solr:8
    container_name: bartoc-solr
    ports:
      - "8983:8983"   # Solr Admin UI & HTTP API
    volumes:
      - solr_data:/var/solr
      - ./solr-config/terminologies-configset:/configsets/terminologies-configset
    environment:
      - SOLR_CORE_NAME=${SOLR_CORE_NAME}
    command:
      - solr-precreate
      - ${SOLR_CORE_NAME}
      - /configsets/terminologies-configset

volumes:
  solr_data:
```

- **`solr-precreate ${SOLR_CORE_NAME}`** automatically creates the core on startup.
- Place your `managed-schema`, `solrconfig.xml` etc. under `solr-config/terminologies-configset/`.

#### Application Service Configuration

Ensure your app service reads the same `.env` values and depends on Solr:

```yaml
services:
  bartoc-search:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    container_name: bartoc-search
    env_file:
      - .env
    environment:
      - NODE_ENV=development
      - CONFIG_FILE=./config/config.json
      # …other vars…
    depends_on:
      - solr
    ports:
      - "3883:3883"     # HTTP
      - "24678:24678"   # HMR WebSocket
    volumes:
      - ../:/usr/src/app
      - /usr/src/app/node_modules
```

#### Bootstrapping at Startup

When the `indexDataAtBoot` setting is enabled, the application performs a series of coordinated steps at startup to populate the Solr core:

1. **Ping & Retry**  
  Check that the Solr core endpoint is responsive. If the service returns a “SolrCore is loading” status, automatically retry the ping operation multiple times with a short delay until the core is fully up.
  
2. **Stream-Fetch NDJSON**  
  Download the latest NDJSON dump from the [remote URL](https://bartoc.org/data/dumps/latest.ndjson) as a streaming response. This allows line-by-line processing without loading the entire file into memory at once.
  
3. **Line-by-Line Parsing & Transformation**  
  Read each line from the streamed data, skip any empty lines, parse it as JSON to obtain individual records, and convert each record into the Solr document format using the project’s transformation logic.
  
4. **Batch Indexing**  
  Group the transformed documents into manageable batches and send each batch to the Solr update API, committing after each batch to populate the core efficiently.
  

All of these operations are orchestrated by the `connectToSolr()` and `bootstrapIndexSolr()` functions, ensuring that the core is ready and data is indexed without manual intervention.
  

#### Troubleshooting

- **Core never appears / persistent 503**
  - Increase `MAX_RETRIES` and/or `RETRY_INTERVAL` in `connectToSolr()`.
  - Ensure `terminologies-configset` is correct and accessible by Solr.

- **Indexing errors**
  - Check network logs for `POST /solr/terminologies/update?commit=true`.
  - Inspect Solr logs under `/var/solr/logs` inside the container.

- **Environment mismatch**
  - Verify `.env` is loaded by both Solr and your app (`docker exec -it bartoc-solr echo $SOLR_CORE_NAME`).
  - Ensure `config.solr.url` points to `http://bartoc-solr:8983/solr` from within the app container.

### Redis

...TODO...


## Development

### Project Goals

* Provide a reliable pipeline to synchronize BARTOC database with a Solr index
* Enrich data before to improve search
* Experiment with relevance ranking and facetted search

###  Technologies

* Node.js + TypeScript
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

