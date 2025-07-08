# BARTOC Search

[![Test](https://github.com/gbv/bartoc-search/actions/workflows/test.yml/badge.svg)](https://github.com/gbv/bartoc-search/actions/workflows/test.yml)

> Experimental BARTOC Search engine with indexing pipeline and discovery interface

This application extracts JSKOS data with metadata about terminologies from [BARTOC](https://bartoc.org) knowledge organization systems registry (managed in [jskos-server](https://github.com/gbv/jskos-server) / MongoDB), transforms and enriches the data and loads in into a [Solr](https://solr.apache.org/) search index. The index is then made available via a search API and an experimental discovery interface.


### System Diagram (TO DO, deprecated)

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


So, we have three pieces, everything is configurable in `config/config.default.json`. 

The ETL pipeline can be executed  via the dockerized setup. The workflow is composed of the following stages:


The application exposes dedicated commands (usually via CLI or internal scripts), but in normal production use, everything runs automatically inside the docker service `search`.


All configuration for Solr is set in `config/config.default.json` and can be overridden by local files.

---

## Table of Contents

- [Install](#installation)
- [Usage](#usage)
- [Services](#services)
  - [Jskos Server (optional)](#jskos-server-instance-optional)
  - [Solr](#solr)
  - [Redis](#redis)
- [API](#api)
  - [GET /](#get)
  - [GET /search](#get-search)
  - [GET /status](#get-status)
- [Development](#development)
- [Maintainers](#maintainers)
- [License](#license)


## Installation

### Quick Start (Recommended: Docker)

The fastest way to get BARTOC Search running locally is with Docker and Docker Compose. This will start all required services (Solr, Redis, and the app) with a single command.

```bash
cd docker
docker-compose up --build
```

- The search app will be available at [http://localhost:3883](http://localhost:3000).
- Solr Admin UI will be at [http://localhost:8983](http://localhost:8983).
- Redis run in the background; no manual setup needed.

#### Fetch Repository or Docker image

A docker image [is published](https://github.com/orgs/gbv/packages/container/package/bartoc-search) on every push on branches `main` and `dev` and  when pushing a git tag starting with `v` (e.g., `v1.0.0`). Commits are ignored if they only modify documentation, GitHub workflows, config, or meta files.

See `docker-compose.yml` in the `docker` directory for usage.


**Tip:** For Docker and most local development, configuration is handled automatically in the `config/` directory. The default setup works out of the box.

**Note:**
- **Choose one approach:**
  - If you use **Docker** (recommended), do **not** create a `.env` file in the project root—Docker handles all configuration for you.
  - If you use `npm run dev` (without Docker), you **must** create a `.env` file in the project root to define your local settings (e.g., database URLs, Solr, Redis). The `config/config.default.json` is primarily for Docker and CI setups, and should not be edited for local development.


Uncomment and adjust values as needed for your environment. If you are running services via Docker, keep these lines commented out or remove the `.env` file entirely.

### Manual Setup (Advanced)

If you prefer to run services manually (not recommended for most users):

1. **Install prerequisites:**
   - Node.js >= 18
   - MongoDB (local or remote) (?) **To be clarified!** 
   - Solr (with the provided configset)
   - Redis

2. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/gbv/bartoc-search.git
   cd bartoc-search
   npm install
   ```

3. **Configure environment:**
   - Create a `.env` file in the project root to define your local settings (see below for example).
   - Do **not** edit `config/config.default.json` for local development; it is used by Docker and CI.

#### Example `.env` file for localhost development

```dotenv
# Redis configuration
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Solr configuration
SOLR_HOST=127.0.0.1
SOLR_PORT=8983
```

Uncomment and adjust values as needed for your environment. If you are running services via Docker, keep these lines commented out or remove the `.env` file entirely.

4. **Start the app:**
   ```bash
   npm run dev
   ```
   - The app will attempt to connect to all services and retry if any are temporarily unavailable.
   - If Redis or Solr are not running, background jobs and search will be disabled, but the app will still start.


### Troubleshooting

- **Docker issues:** Make sure Docker Desktop or the Docker daemon is running.
- **Port conflicts:** Stop any other services using ports 3883, 3000, 8983, 6379, or 27017.
- **Service not available:** The app will log warnings if Solr or Redis are unavailable, but will keep running for development convenience.
- **Configuration:** See the `config/` directory and comments in `config.default.json` for all options.

---

## Services

### JSKOS Server Instance (Optional)

The JSKOS server is provided as a Docker service (`jskos-server`) in the `docker-compose.yml` file. It is responsible for exposing the BARTOC MongoDB data and providing a WebSocket endpoint for real-time vocabulary change events.

- **Image:** `ghcr.io/gbv/jskos-server:dev`
- **Port:** `3000` (exposed as `http://localhost:3000` on the host)
- **Configuration:** The server is configured via `../config/jskos-server-dev.json` (mounted into the container).
- **Dependencies:** The JSKOS server depends on the `mongo` service for its database.

**Note:**
> The local JSKOS server instance is **not strictly required**. You can configure the backend to consume a remote WebSocket endpoint (such as the public instance at `wss://coli-conc.gbv.de/dev-api/voc/changes`) by setting the `WS_HOST` environment variable in your `.env` file or in `config.default.json`. This allows Redis and the queue to receive vocabulary change events from any compatible JSKOS server, local or remote.

### WebSocket Usage in `useVocChanges.ts`

The backend service listens for vocabulary change events from the JSKOS server using a WebSocket connection. This is handled in `src/server/composables/useVocChanges.ts`. See also from `jskos-server` repository, [here](https://github.com/gbv/jskos-server?tab=readme-ov-file#real-time-change-stream-endpoints) some reference

- **Purpose:**  
  The WebSocket connection allows the backend to receive real-time notifications about vocabulary changes (create, update, delete) and enqueue them for processing in Solr.
- **Configuration:**  
  You can override the WebSocket endpoint by setting `WS_HOST` in your environment (e.g., in your `.env` file or defined in `/config/config.default.json` as `webSocket` field.).

**Example `.env` entry:**
```
# Websocket configuration acess to Jskos server changes API
# - If you are running the Jskos server in a Docker container, you can use the
#   container name as the host, e.g., `ws://jskos-server:3000`
# - If you are running the Jskos server on your local machine, you can use
#   `ws://localhost:3000` or `ws://127.0.0.   
WS_HOST=ws://jskos-server:3000
```

### Solr

This section contains 

- [Environment Variables (`.env`)](#environment-variables-env)
- [Docker Compose Setup](#docker-compose-setup)
- [Application Service Configuration](#application-service-configuration)
- [Bootstrapping at Startup](#bootstrapping-at-startup)
- [Troubleshooting](#troubleshooting)


#### Environment Variables (`.env`)

Create a file named `.env` in `/docker` where the compose file is containing:

```dotenv
# Name of the Solr core (must match /docker/solr-config/SOLR_CORE_NAME-configset/conf)
SOLR_CORE_NAME=terminologies
```

- `SOLR_CORE_NAME` drives both the Solr container’s precreation step and your app’s `config.solr.coreName`.

#### Docker Compose Setup

In `docker-compose.yml`, define a Solr service that pre-creates your core from a custom configset:

```yaml
solr:
    image: solr:8
    container_name: bartoc-solr
    ports:
      - "8983:8983"
    environment:
      - SOLR_CORE_NAME=${SOLR_CORE_NAME}
    volumes:
      - solr_data:/var/solr
      - ./solr-config/${SOLR_CORE_NAME}-configset:/configsets/${SOLR_CORE_NAME}-configset
    command:
      - solr-precreate
      - ${SOLR_CORE_NAME}
      - /configsets/${SOLR_CORE_NAME}-configset

volumes:
  solr_data:
```

- **`solr-precreate ${SOLR_CORE_NAME}`** automatically creates the core on startup.
- Place your `managed-schema`, `solrconfig.xml` etc. under `solr-config/${SOLR_CORE_NAME}-configset/`.

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

Redis is used as a fast, in-memory job queue and messaging system for background processing in bartoc-search. The application uses Redis to coordinate and manage tasks such as indexing, updating, and deleting records in Solr, ensuring that these operations are reliable and can be retried if needed.

- **Automatic Connection & Retry:**
  - On startup, the app tries to connect to Redis. If Redis is not available, it will keep retrying for a limited number of attempts before giving up. This prevents the app from crashing if Redis is temporarily down.
  - If Redis is not reachable, features that depend on background jobs (like indexing) are disabled, but the rest of the app continues to work.

- **Job Queues:**
  - The app uses Redis to manage queues for background jobs (using BullMQ). Each queue is created only once and shared across the app, so jobs are not duplicated.
  - If Redis is not available, the queues are not started, and a clear warning is logged.

- **Worker Resilience:**
  - Workers that process jobs from the queue will only start if Redis is available. If Redis goes down, workers will stop and automatically try to reconnect when Redis is back.

- **Configuration:**
  - Redis connection settings (host, port, etc.) are read from the app's config files or environment variables. By default, the app connects to `localhost` in development, or to the `redis` service in Docker.

- **No Data Loss:**
  - If Redis is temporarily unavailable, jobs are not lost—they are retried once Redis is back online.

This setup ensures that background processing is robust and does not block the main application if Redis is down. All Redis-related errors are logged, and the app continues to serve search and API requests even if background jobs are paused.

---


## API (To be reviewed)

This service exposes three HTTP endpoints:

- **[GET /](#get)** – Root endpoint, returns the Vue Client.
- **[GET /api/search](#get-search)** – Search endpoint, accepts query parameters and returns matching results in json format.
- **[GET /api/status](#get-status)** – Health-check endpoint, returns service status about mongoDb and Solr connection.

All endpoints respond with JSON and use standard HTTP status codes.

### GET /

Returns the discovery interface in form of an HTML page with the experimental Vue client.

### GET /api/search

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
GET /api/search?q=*:*&start=0&rows=10&wt=json HTTP/1.1
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
> * Other internal or experimental fields are omitted from this public API, as they may change without notice.


## Development (Under WIP)

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

* Solr client with retry logic and batching
* Frontend 


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

