# BARTOC Search

[![Test](https://github.com/gbv/bartoc-search/actions/workflows/test.yml/badge.svg)](https://github.com/gbv/bartoc-search/actions/workflows/test.yml)

> Experimental BARTOC Search engine with indexing pipeline and discovery interface

This application extracts JSKOS data with metadata about terminologies from [BARTOC] knowledge organization systems registry (managed in [jskos-server]), transforms and enriches the data and loads in into a [Solr] search index. The index is then made available via a search API and a discovery interface.


### System Architecture Overview

~~~mermaid
graph TD
  Solr[(🔎 Solr Index)]
  DB[(BARTOC database Jskos-Server)]
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
  DB <-- "Watching Streams" --> Server
  DB <-- "full dump" --> Server
  Server -->|update| Solr
  Solr -->|search| Server

  Server -- "Queue Jobs" --> BullMQ
  BullMQ -- "Backed by" --> Redis

  Client -- "Browser" --> User
  Server -- "API" --> Applications
  Server -- "API" --> Client
~~~


The diagram above illustrates the architecture of the BARTOC Search application and its supporting services:

- **Jskos-Server** provides a real-time stream of vocabulary changes, which the Search service consumes via a WebSocket connection ("Watching Streams").
- **Search service** is the core backend, responsible for transforming and loading data into the **Solr Index** for search and discovery. It also manages background jobs using a **BullMQ Queue**.
- **BullMQ Queue** is used for job scheduling and processing, and is backed by a **Redis** instance for fast, reliable message handling.
- The **Vue Client** communicates with the Search service for user-facing search and discovery features.
- Users interact with the system through the browser, while external applications can access the API directly.
- Data flows are bi-directional where appropriate (e.g., between Server and Client, and for API access), and the system is designed for modularity and resilience.

This architecture ensures robust, scalable, and real-time search capabilities, with clear separation of concerns between data ingestion, indexing, background processing, and user interaction.

---

## Table of Contents

- [Install](#installation)
- [Usage](#usage)
- [API](#api)
  - [GET /](#get-)
  - [GET /api/search](#get-apisearch)
  - [GET /api/status](#get-apistatus)
- [Architecture](#architecture)
  - [Jskos Server (optional)](#jskos-server-instance-optional)
  - [Solr](#solr)
  - [Redis](#redis)
- [Development](#development)
- [Maintainers](#maintainers)
- [License](#license)

## Installation

### Prerequisites

- Node.js >= 18
- jskos-server instance (local or remote)
- Solr instance with configured schema
- Docker & Docker Compose (optional but recommended)

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
   - jskos-server instance (local or remote)
   - Solr instance with configured schema
   - Redis

2. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/gbv/bartoc-search.git
   cd bartoc-search
   npm install
   ```

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

---



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

### JSKOS Server Instance (Optional)

The JSKOS server is provided as a Docker service (`jskos-server`) in the `docker-compose.yml` file. It is responsible for exposing the BARTOC MongoDB data and providing a WebSocket endpoint for real-time vocabulary change events.

- **Image:** `ghcr.io/gbv/jskos-server:dev`
- **Port:** `3000` (exposed as `http://localhost:3000` on the host)
- **Configuration:** The server is configured via `../config/jskos-server-dev.json` (mounted into the container).
- **Dependencies:** The JSKOS server depends on the `mongo` service for its database.

**Note:**
> The local JSKOS server instance is **not strictly required**. You can configure the backend to consume a remote WebSocket endpoint (such as the public instance at `wss://coli-conc.gbv.de/dev-api/voc/changes`) by setting the `WS_HOST` environment variable in your `.env` file or in `config.default.json` the `webSocket` key.

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

##### Environment Variables (`.env`)

Create a file named `.env` in `/docker` where the compose file is containing:

```dotenv
# Name of the Solr core (must match /docker/solr-config/SOLR_CORE_NAME-configset/conf)
SOLR_CORE_NAME=terminologies
```

- `SOLR_CORE_NAME` drives both the Solr container’s precreation step and your app’s `config.solr.coreName`.

##### Docker Compose Setup

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


#### Localhost (without Docker)
TBA


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
  - Verify `.env` is loaded by both Solr and your app (`docker exec -it bartoc-solr echo $SOLR_CORE_NAME`).
  - Ensure `config.solr.url` points to `http://bartoc-solr:8983/solr` from within the app container.

### Redis

Redis is used for fast, in-memory job queues and background processing (via BullMQ). If Redis is unavailable, background jobs are paused but the app continues to serve API and search requests. Connection settings are read from config or environment variables (`localhost` in development, `redis` in Docker). Jobs are retried automatically if Redis goes down temporarily.

### BullMQ Monitoring Board

You can monitor and manage background jobs (queues, workers, job status) using the [bull-board](https://github.com/felixmosh/bull-board) UI. This is highly recommended for development and debugging.

Replace `myQueue` with your actual BullMQ queue instance(s) and the board will be available at [http://localhost:3883/admin/queues](http://localhost:3883/admin/queues) (or your app port).


**Features:**
  - View, retry, or remove jobs
  - Inspect job data and logs
  - Monitor queue and worker status in real time

For more details, see the [bull-board documentation](https://github.com/felixmosh/bull-board).

---

## Development

### Project Goals

* Provide a reliable pipeline to synchronize BARTOC database with a Solr index
* Enrich data before to improve search
* Experiment with relevance ranking and facetted search

###  Technologies

* Node.js + TypeScript
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

## Maintainers

- [@rodolv-commons](https://github.com/rodolv-commons)
- [@nichtich](https://github.com/nichtich)

## License

MIT © 2025- Verbundzentrale des GBV (VZG)

[jskos-server]: https://github.com/gbv/jskos-server
[BARTOC]: https://bartoc.org/
[Solr]: https://solr.apache.org/