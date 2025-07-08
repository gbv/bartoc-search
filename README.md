# BARTOC Search

[![Test](https://github.com/gbv/bartoc-search/actions/workflows/test.yml/badge.svg)](https://github.com/gbv/bartoc-search/actions/workflows/test.yml)

> Experimental BARTOC Search engine with indexing pipeline and discovery interface

This application extracts JSKOS data and metadata about terminologies from the [BARTOC](https://bartoc.org) registry (managed by [jskos-server](https://github.com/gbv/jskos-server) and MongoDB), transforms and enriches the data, and loads it into a [Solr](https://solr.apache.org/) search index. The indexed data is then exposed via a robust search API and a modern, experimental discovery interface for users and applications.


### System Architecture Overview

~~~mermaid
graph TD
  Solr[(🔎 Solr Index)]
  DB[(🍃 Jskos-Server)]
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
  Server -->|Transform and Load| Solr
  Solr -->|Indexing| Server

  Server -- "Queue Jobs" --> BullMQ
  BullMQ -- "Backed by" --> Redis

  Server <--> Client
  Client -- "Browser" --> User
  Server -- "API" --> Applications
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
- [Services](#services)
  - [Jskos Server (optional)](#jskos-server-instance-optional)
  - [Solr](#solr)
  - [Redis](#redis)
- [API](#api)
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
   - Solr (with the provided configset)
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

## Services

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


## API
Read the documentation [here](api_docu.md).

## Development (Under WIP)

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
  

This combination ensures a modern, high-performance development workflow with SSR capabilities out of the box.

## Maintainers

- [@rodolv-commons](https://github.com/rodolv-commons)
- [@nichtich](https://github.com/nichtich)

## License

MIT © 2025- Verbundzentrale des GBV (VZG)

