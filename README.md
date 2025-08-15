# BARTOC Search

[![Test](https://github.com/gbv/bartoc-search/actions/workflows/test.yml/badge.svg)](https://github.com/gbv/bartoc-search/actions/workflows/test.yml)

> Experimental BARTOC Search engine with indexing pipeline and discovery interface

This application extracts JSKOS data with metadata about terminologies from [BARTOC] knowledge organization systems registry (managed in [jskos-server]), transforms and enriches the data and loads it in into a [Solr] search index. The index is then made available via a search API and a discovery interface.

## Table of Contents

- [Install](#installation)
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

## Installation

### Requirements

- an URL to download database dumps with JSKOS concept schemes (by default <https://bartoc.org/data/dumps/latest.ndjson>)
- a Solr search server instance with configured scheme as expected by BARTOC search
- a jskos-server instance with `/voc/changes` API endpoint (by default the BARTOC instance available at <https://bartoc.org/api>) for live updates 
- either Docker to run from a Docker image or Node.js >= 18 and Redis to run from sources

### With Docker (all)

The repository contains a docker-compose.yml to start the application, Solr, and Redis with one command:

```bash
cd docker
docker-compose up --build
```

- The search app is available at [http://localhost:3883](http://localhost:3883).
- Solr Admin UI is at [http://localhost:8983](http://localhost:8983).
- Redis runs in the background at port 6379.

Ports are hard-coded, so no service must run at these ports.

#### With Docker (individual)

A docker image of the application [is published](https://github.com/orgs/gbv/packages/container/package/bartoc-search) on every push on branches `main` and `dev` and  when pushing a git tag starting with `v` (e.g., `v1.0.0`). Commits are ignored if they only modify documentation, GitHub workflows, config, or meta files.

See `docker-compose.yml` in the `docker` directory for usage.

**Tip:** For Docker and most local development, configuration is handled automatically in the `config/` directory. The default setup works out of the box.

**Note:**
- **Choose one approach:**
  - If you use **Docker** (recommended), do **not** create a `.env` file in the project root—Docker handles all configuration for you.
  - If you use `npm run dev` (without Docker), you **must** create a `.env` file in the project root to define your local settings (e.g., database URLs, Solr, Redis). The `config/config.default.json` is primarily for Docker and CI setups, and should not be edited for local development.


Uncomment and adjust values as needed for your environment. If you are running services via Docker, keep these lines commented out or remove the `.env` file entirely.

### Run Backends via Docker

Start redis and Solr from Docker images:

```bash
docker compose -f docker/docker-compose-backends.yml create --remove-orphans
docker compose -f docker/docker-compose-backends.yml start
```

Create a local `config/config.json` to refer to these backend services:

~~~json
{
   "redis": {
    "host": "localhost",
    "pingTimeout": 10000,
    "pingRetries": 5,
    "pingRetryDelay": 1000,
    "port": 6379
  },
  "solr": {
    "batchSize": 500,
    "coreName": "terminologies",
    "host": "localhost",
    "pingTimeout": 10000,
    "pingRetries": 5,
    "pingRetryDelay": 1000,
    "port": 8983,
    "version": 8.1
  }
}
~~~

And a local `.env` file:

~~~
CONFIG_FILE=./config/config.json
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=.coli-conc.gbv.de
BASE_URL=http://localhost:3883/
~~~

Then start bartoc-search for development:

```bash
npm run dev
```

### Manual Setup (Advanced)

1. **Install prerequisites:**
   - Node.js >= 18
   - jskos-server instance (local or remote)
   - Solr instance with configured schema
   - Redis

2. **Clone and install dependencies**

3. **Configure environment:**
   - Create a `.env` file in the project root to define your local settings for Redis and Solr services, and websocket host (see below for example).

#### Example `.env` file for localhost development

```dotenv
# Redis configuration
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Solr configuration
SOLR_HOST=127.0.0.1
SOLR_PORT=8983


# Websocket configuration acess to Jskos server changes API
# - If you are running the Jskos server in a Docker container, you can use the
#   container name as the host, e.g., `ws://jskos-server:3000`
# - If you are running the Jskos server on your local machine, you can use
#   `ws://localhost:3000` or `ws://127.0.0.   
WS_HOST=ws://jskos-server:3000
```

Uncomment and adjust values as needed for your environment. If you are running services via Docker, keep these lines related to both Solr and Redis commented out.

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


### Configuration
You can customize the application settings via a configuration file. By default, this configuration file resides in `config/config.json`. However, it is possible to adjust this path via the `CONFIG_FILE` environment variable. The path has to be either absolute (i.e. starting with `/`) or relative to the `config/` folder (i.e. it defaults to `./config.json`). If the file exists and contains invalid JSON data, JSKOS Server will refuse to start.

Currently, there are only two environment variables:
- `NODE_ENV` - either `development` (default) or `production`
- `CONFIG_FILE` - alternate path to a configuration file, relative to the `config/` folder; defaults to `./config.json`.

You can either provide the environment variables during the command to start the server, or in a `.env` file in the root folder.

All missing keys will be defaulted from `config/config.default.json`:

## Usage

The web interface is currently being developed. Feedback is welcome!

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

All query parameters are optional.


| Name            | Type     |  Default     | Description                                                                                  |
| --------------- | -------- |  ----------- | -------------------------------------------------------------------------------------------- |
| **search**      | `string` |  —           | Full-text search terms (e.g. `Film`).                                                        |
| **limit**       | `number` | `10`        | Maximum number of results to return.                                                         |
| **sort**        | `string` |`relevance` | Sort field (e.g. `relevance`, `created`, `modified`).                                        |
| **order**       | `string` | `desc`      | Sort direction: `asc` or `desc`.                                                             |
| **start**       | `number` |  `0`         | Zero-based index of first result to return (for paging).                                     |
| **rows**        | `number` |  matches `limit` if omitted | Alias for `limit` — number of rows to return.                                            |
| **filters**     | `object` |  `{}`        | Facet filters as a JSON object. Each key is a multivalued field name, value is an array of selected facet values. |
| **format**     | `string` |  -        |If set to `jskos`, returns the raw JSKOS records (from the `fullrecord` field) instead of the usual Solr docs.  |
| **uri**     | `string` |  -        | `format=jskos&uri=<ConceptURI>` When both are included, the endpoint returns the raw JSKOS record for that exact URI instead of the list of JSKOS records.|


### Faceted Filtering

You can drive fine‐grained filtering by passing any of your multivalued facet fields in the `filters` object. Behind the scenes, each non-empty array translates to a Solr facet query like:

 `/api/search?search=Film&sort=modified&order=desc&filters={"format_group_ss":[],"api_type_ss":[]}`


- `filters={"format_group_ss":[],"api_type_ss":[]}`  
  - Filters on the **format group** and **API type** facets.  
  - An empty array (`[]`) means “no restriction” on that facet.  
  - To restrict, supply one or more facet values, for example:  
    ```json
    filters={
      "format_group_ss":["PDF","RDF"],
      "api_type_ss":["jskos","sparql"]
    }
    ```

#### Response
  
```json
{
  "responseHeader": {
    "status": 0,
    "QTime": 0,
    "params": {
      "q": "allfields:(\"Film\"^3)",
      "defType": "lucene",
      "start": "0",
      "sort": "modified_dt desc",
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
        "alt_labels_ss": [
          "Klassifikation för litteraturvetenskap",
          "estetik",
          "teatervetenskap",
          "film- och televisionsforskning",
          "Classification for comparative literature",
          "aesthetics",
          "theatre research",
          "film and television studies"
        ],
        "created_dt": "2015-04-17T14:19:00Z",
        "ddc_ss": [
          "7",
          "790",
          "80"
        ],
        "ddc_root_ss": [
          "7",
          "8",
        ],
        "id": "http://bartoc.org/en/node/1297",
        "languages_ss": [
          "en",
          "fi",
          "sv"
        ],
        "listed_in_ss": [
          "http://bartoc.org/en/node/241",
          "http://bartoc.org/en/node/241",
          "http://bartoc.org/en/node/241",
        ],
        "modified_dt": "2025-07-14T14:00:00.900Z",
        "publisher_id": "http://viaf.org/viaf/126520961",
        "publisher_label": "Helsingin yliopisto, Kirjasto",
        "subject_uri": [
          "http://dewey.info/class/7/e23/",
          "http://dewey.info/class/790/e23/",
          "http://dewey.info/class/80/e23/"
        ],
        "subject_notation": [
          "7",
          "790",
          "80"
        ],
        "subject_scheme": [
          "http://bartoc.org/en/node/241",
          "http://bartoc.org/en/node/241",
          "http://bartoc.org/en/node/241"
        ],
        "type_uri": [
          "http://www.w3.org/2004/02/skos/core#ConceptScheme",
          "http://w3id.org/nkos/nkostype#classification_schema"
        ],
        "title_en": "Shelf Rating of Literary Research, Aesthetics, Theater Science, Film and Television Research",
        "title_sort": "Shelf Rating of Literary Research, Aesthetics, Theater Science, Film and Television Research",
        "description_en": "Subject-specific classification scheme used by the University of Helsinki Library for literary studies, aesthetics, theatre research, film and television studies.",
        "title_und": "Kirjallisuudentutkimuksen, estetiikan, teatteritieteen, elokuva- ja televisiotutkimuksen hyllyluokitus",
        "_version_": 1837876396177752000
      },
      // …more documents…
    ]
  },
  "facet_counts": {
  "facet_queries":  {},
  "facet_fields": {
    "format_group_ss": [
      "PDF", 1024,
      "Online", 2287,
      "RDF",  629,
      …
    ],
    "license_group_ss": [
      "CC BY", 211,
      "Public Domain", 210,
      "CC BY-ND", 84,
      …
    ]
  },
  "facet_ranges":    {},
  "facet_intervals": {},
  "facet_heatmaps":  {}
}
```

| Field                    | Type    | Description                                              |
| ------------------------ | ------- | -------------------------------------------------------- |
| `responseHeader.status`  | integer | Solr execution status (0 = success).                     |
| `responseHeader.QTime`   | integer | Query execution time in milliseconds.                    |
| `responseHeader.params`  | object  | Echoes back the parameters used for the query.           |
| `response.numFound`      | integer | Total number of matching documents.                      |
| `response.start`         | integer | Offset into the result set.                              |
| `response.numFoundExact` | boolean | Indicates if `numFound` is an exact count.               |
| `response.docs`          | array   | Array of document objects matching the query.            |
| └─ `id`                  | string  | Unique document identifier (URI).                        |
| └─ `access_type_ss`      | string  | URIs denoting the resource’s access policy (e.g. Freely available, Registration required, License required )|
| └─ `address_code_s`      | lc_keyword | Postal/ZIP code (e.g., 00165) |
| └─ `address_country_s`   | lc_keyword | Country name (verbatim; case-insensitive match) (e.g., Italy) |
| └─ `address_locality_s`  | lc_keyword | City / locality (e.g., Rome) |
| └─ `address_region_s`    | lc_keyword | Region / state / province (e.g., Lazio) |
| └─ `address_street_s`    | lc_keyword | Street address line (e.g., via Monte del Gallo 47) |
| └─ `api_type_ss`         | array   | One or more API-type identifiers (e.g. jskos, skosmos, sparql) denoting the service/interface protocols supported by the record.|
| └─ `api_url_ss`          | array   | One or more fully qualified endpoint URLs corresponding to each api_type_ss entry.|
| └─ `contact_email_s`     | string  | Email address of anyone in charge of the vocabulary |
| └─ `display_hideNotation_b`  | boolean |  Hide notation it is only used as internal identifier  |
| └─`display_numericalNotation_b`  | boolean |  Numerical notation concepts of the vocabulary will be sorted numerically when displayed as a list  |
| └─ `examples_ss`         | lc_keyword |  Example sentences/snippets from JSKOS EXAMPLES field |
| └─ `format_type_ss`      | array   | A multivalued list of machine-readable format identifiers (URIs) describing the available resource formats. |
| └─ `format_group_ss`     | array   | Canonical format category labels (e.g. “PDF”, “HTML”, “Spreadsheet”) derived by mapping individual format URIs to standardized groups. |
| └─ `title_en`            | string  | English title of the thesaurus or concept scheme.        |
| └─ `title_sort`          | string  | Title normalized for sorting.                            |
| └─ `title_und`           | string  | Title in the “undefined” (und) language.                 |
| └─ `description_en`      | string  | Short English description or abstract.                   |
| └─ `fullrecord`          | string  | The complete, unextended JSKOS record (raw JSON) as a string. (multilingual).                       |
| └─ `identifier_ss`       | array   | Additional identifiers of the resource; corresponds to the JSKOS identifier field (alternate URIs or local IDs).|
| └─ `alt_labels_ss`       | array   | Language-agnostic aggregate of all altLabel values. Trimmed and de-duplicated across languages.
| └─ `contributor_uri_ss`  | array   | Aggregate of all contributor uris|
| └─ `contributor_labels_ss` | array | Language-agnostic aggregate of all contributor prefLabel values. Trimmed and de-duplicated across languages.|
| └─ `languages_ss`        | array   | Languages available (ISO codes).                         |
| └─ `license_type_ss`     | array   | A multivalued list of machine-readable license identifiers (URIs) under which the resource is released. |
| └─ `license_group_ss`    | array   | Canonical license category labels (e.g. “CC BY”, “CC BY-SA”, “Public Domain”, “WTFPL”) derived by mapping individual license URIs to a standardized group.|
| └─ `namespace_s`         | string  | Namespace (URI prefix) of the Concept Scheme; corresponds to the JSKOS namespace field |
| └─ `listed_in_ss`        | array   | Registry URIs of the scheme(s) that include this vocabulary.|
| └─ `ddc_ss`              | array   | Dewey Decimal Classification notations.                  |
| └─ `ddc_root_ss`         | array   | Dewey Decimal Classification notations at root level.    |
| └─ `publisher_id`        | string  | Identifier URI of the publishing organization.           |
| └─ `publisher_label`     | string  | Human‐readable label of the publishing organization.     |
| └─ `subject_uri`         | array   | URIs of subject classifications.                         |
| └─ `subject_notation`    | array   | Notation codes for subjects.                             |
| └─ `subject_scheme`      | array   | URIs of subject schemes.                                 |
| └─ `type_uri`            | array   | URIs indicating the resource’s SKOS/NKOS type(s).        |
| └─ `created_dt`          | string  | Creation timestamp (ISO-8601).                           |
| └─ `modified_dt`         | string  | Last modification timestamp (ISO-8601).                  |
| └─ `_version_`           | integer | Solr internal version number for optimistic concurrency. |



#### Available Facet Fields

| Field | Description |
| --- | --- |
| `type_uri` | SKOS/NKOS type URIs (e.g. ConceptScheme, thesaurus).|
| `ddc_root_ss` | Dewey Decimal root notations |
| `languages_ss` | ISO language codes |
| `api_type_ss` | API protocol identifiers (e.g. jskos, sparql, skosmos) |
| `listed_in_ss` | Registry URIs of the concept scheme(s) |
| `access_type_ss` | Access policy URIs |
| `license_type_ss` | Machine-readable license URIs |
| `license_group_ss` | Canonical license group labels (e.g. “CC BY”, “Public Domain”, “WTFPL”) |
| `format_type_ss` | Machine-readable format URIs |
| `format_group_ss` | Canonical format group labels (e.g. “PDF”, “HTML”, “Spreadsheet”) |
| `address_country_s` | Country of origin |
| `publisher_label` | Name of the publisher |


##### “No value” Facet Bucket

In addition to ordinary facet values, every facet field also offers a special “no value” option. 
Selecting this will only return documents where that field is entirely absent (i.e. `null` or not defined).  
Under the hood we translate it into the Solr `filter:-field:[* TO *]`
For example:

- `-languages_ss:[* TO *]` → documents with no `languages_ss`  
- `-ddc_ss:[* TO *]`       → documents with no Dewey Decimal Classification with no root level 


#### Error Responses

...
  
### GET /api/status

Returns a concise health check of the service, including environment and Solr index status.

#### Response

| Field                  | Type    | Description                                                                |
| ---------------------- | ------- | -------------------------------------------------------------------------- |
| `ok`                   | boolean | Whether the application is running fine                                    |
| `config.env`           | string  | The environment the server is run in (e.g. `development` or `production`)  |
| `config.serverVersion` | string  | Version number of the application                                          |
| `config.title`         | string  | A custom title of the BARTOC Search application instance                   |
| `solr.connected`       | boolean | Whether Solr responded to a basic stats query                              |
| `solr.indexedRecords`  | number  | Total number of documents currently indexed in the Solr `terminologies` core      |
| `solr.lastIndexedAt`   | string  | ISO‑8601 timestamp of the most recent update of a record into the index    |
| `jskos.connected`      | boolean | Whether WebSocket connection (JSKOS API) has been established for updates  |

In case of an error, for instance failed connection to Solr or to jskos-server backend, the response field `ok` is set to `false`.

The response may temporarily include additional fields for debugging.

**Example:**

```json
{
  "ok": true,
  "config": {
    "env": "development",
    "serverVersion": "0.1.0",
    "title": "BARTOC Search (dev)"
  },
  "solr": {
    "connected": true 
    "indexedRecords": 3782, 
    "lastIndexedAt": "2025-07-13T10:28:27"
  },
  "jskosServer": {
    "connected": true 
  }
}
```

## Architecture

~~~mermaid
graph TD
  Solr[(🔎 Solr Index)]
  DB[(BARTOC database<br>jskos-server)]
  Redis[(🧩 Redis)]
  BullMQ[(📦 BullMQ Queue)]
  subgraph search service [ ]
    direction TB
    Server[⚙️ Search service]
    BullMQ[(📦 BullMQ Queue)]
    Client[🖥️ Vue Client]
  end
  Client[🖥️ Vue Client]

  User[👤 User]

  Applications

  %% FLOWS %%
  DB -- "changes" --> Server
  DB -- "full dump" --> Server
  Server -->|update| Solr
  Solr -->|search| Server

  Server -- "Queue Jobs" --> BullMQ
  BullMQ -- "Backed by" --> Redis

  Client -- "Browser" --> User
  Server -- "API" --> Applications
  Server -- "API" --> Client
~~~

The application consists of the following components:

- **jskos-Server** provides a real-time stream of vocabulary changes, which the Search service consumes via a WebSocket connection ("Watching Streams").
- **Search service** is the core backend, responsible for transforming and loading data into the **Solr Index** for search and discovery. It also manages background jobs using a **BullMQ Queue**.
- **BullMQ Queue** is used for job scheduling and processing, and is backed by a **Redis** instance for fast, reliable message handling.
- The **Vue Client** communicates with the Search service for user-facing search and discovery features.
- Users interact with the system through the browser, while external applications can directly access the **API**.


[jskos-server]: https://github.com/gbv/jskos-server

The application requires a [jskos-server] with Changes API to get live updates. The API endpoint can be configured in configuration key `webSocket` or with `WS_HOST` environment variable (e.g. `wss://coli-conc.gbv.de/dev-api/voc/changes` for BARTOC production).

### WebSocket Usage in `useVocChanges.ts`

The backend service listens for vocabulary change events from the JSKOS server using a WebSocket connection. This is handled in `src/server/composables/useVocChanges.ts`. See also from `jskos-server` repository, [here](https://github.com/gbv/jskos-server?tab=readme-ov-file#real-time-change-stream-endpoints) some reference

- **Purpose:**  
  The WebSocket connection allows the backend to receive real-time notifications about vocabulary changes (create, update, delete) and enqueue them for processing in Solr.
- **Configuration:**  
  You can override the WebSocket endpoint by setting `WS_HOST` in your environment (e.g., in your `.env` file or defined in `/config/config.default.json` as `webSocket` field.).

### Solr

This section is about getting running the Solr service in a dockerized environment. 

- [Environment Variables (`.env`)](#environment-variables-env)
- [Docker Compose Setup](#docker-compose-setup)
- [Application Service Configuration](#application-service-configuration)
- [Bootstrapping at Startup](#bootstrapping-at-startup)
- [Solr Schema](#solr-schema)
- [Troubleshooting](#troubleshooting)


#### Docker 

See `docker-compose.yml` in directory `docker` for boilerplate.

#### Bootstrapping at Startup

When `indexDataAtBoot` is enabled, the app will automatically:

1. Wait for Solr to be ready (with retries if needed)
2. Download the latest NDJSON dump from BARTOC
3. Parse and transform records on the fly
4. Batch and index them into Solr

This is handled by `connectToSolr()` and `bootstrapIndexSolr()`—no manual steps required.
  
#### Solr Schema
Read the documentation [here](solr_schema.md).

#### Troubleshooting

- **Core never appears / persistent 503**
  - Increase `MAX_RETRIES` and/or `RETRY_INTERVAL` in `connectToSolr()`.
  - Ensure `terminologies-configset` is correct and accessible by Solr.

- **Indexing errors**
  - Check network logs for `POST /solr/terminologies/update?commit=true`.
  - Inspect Solr logs under `/var/solr/logs` inside the container.

- **Environment mismatch**
  - Ensure `config.solr.url` points to `http://bartoc-solr:8983/solr` from within the app container.

### Redis

Redis is used for fast, in-memory job queues and background processing (via BullMQ). If Redis is unavailable, background jobs are paused but the app continues to serve API and search requests. Connection settings are read from config or environment variables (`localhost` in development, `redis` in Docker). Jobs are retried automatically if Redis goes down temporarily.

### BullMQ Monitoring Board

You can monitor and manage background jobs (queues, workers, job status) using the [bull-board](https://github.com/felixmosh/bull-board) UI. This is recommended for development and debugging.

Replace `myQueue` with your actual BullMQ queue instance(s) and the board will be available at [http://localhost:3883/admin/queues](http://localhost:3883/admin/queues) (or your app port).

**Features:**
- View, retry, or remove jobs
- Inspect job data and logs
- Monitor queue and worker status in real time

For more details, see the [bull-board documentation](https://github.com/felixmosh/bull-board).

## Development

### Project Goals

- Provide a reliable pipeline to synchronize BARTOC database with a Solr index
- Enrich data before to improve search
- Experiment with relevance ranking and facetted search

###  Technologies

- Node.js + TypeScript
- Vite for build tooling
- Docker & Docker Compose for containerization
- Jest for unit and integration tests (?) -- no tests at the moment

### Bootstrapping the Architecture

The search application architecture has been initialized using a combination of community-supported templates and official Vite SSR guidance:

- **SSR Template:**  
  Bootstrapped from the [create-vite-extra SSR Vue TS template](https://github.com/bluwy/create-vite-extra/tree/master/template-ssr-vue-ts), which provides a ready-to-use setup for server-side rendering with Vue 3 and TypeScript.
  
- **Vite SSR Dev Server:**  
  Configured following the Vite official guide on setting up the SSR development server, enabling seamless hot module replacement and middleware integration – see [Vite SSR Guide](https://vite.dev/guide/ssr.html#setting-up-the-dev-server).
  
### Code Style

- TypeScript strict mode enabled
- Use ESLint and Prettier (`npm run lint`)
- Tests must be provided for new features

## Maintainers

- [@rodolv-commons](https://github.com/rodolv-commons)
- [@nichtich](https://github.com/nichtich)

## License

MIT © 2025- Verbundzentrale des GBV (VZG)

[jskos-server]: https://github.com/gbv/jskos-server
[BARTOC]: https://bartoc.org/
[Solr]: https://solr.apache.org/
