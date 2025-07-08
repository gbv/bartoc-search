## Table of Contents
- [API](#api)
  - [GET /](#get)
  - [GET /search](#get-search)
  - [GET /status](#get-status)


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
