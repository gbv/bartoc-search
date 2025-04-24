# bartoc-etl
Prototype ETL pipeline for indexing Bartoc data from MongoDB into Solr.


~~~mermaid
graph TD
  subgraph Backend
    A[(🍃 MongoDB)]
    B[[⚙️ ETL Express + TypeScript]]
    C[(🔎 Solr Index)]
  end

  subgraph Frontend
    D[[🖥️ Bartoc Frontend App]]
  end

  A -->|Extract_initial_load| B
  A -- Change_Stream --> B
  B -->|Transform_and_Load| C
  D -->|Query| C
  C -->|Results| D
~~~


# WIP NOT RELIABLE ATM 

### Data

in the ndjson file provided in the data folder, the `prefLabel` attribute has several languages as follow:
Found **prefLabel** languages:
- en: 3498 unique labels
- pt: 30 unique labels
- und: 621 unique labels
- eu: 1 unique labels
- ca: 24 unique labels
- fr: 114 unique labels
- es: 104 unique labels
- de: 480 unique labels
- pl: 4 unique labels
- it: 28 unique labels
- da: 9 unique labels
- la: 4 unique labels
- ro: 7 unique labels
- nl: 23 unique labels
- sv: 7 unique labels
- el: 11 unique labels
- fi: 14 unique labels
- ru: 3 unique labels
- ko: 353 unique labels
- nb: 6 unique labels
- no: 1 unique labels
- ja: 1 unique labels
- kr: 2 unique labels
- tr: 1 unique labels
- zh: 2 unique labels
- nn: 2 unique labels
- se: 1 unique labels
- hu: 1 unique labels
- gl: 1 unique labels

source is coming from running the script `analyze-prefLabel.js`.



### Setting Up a Local Solr Instance

A common approach is using Docker. For example:
```bash
docker run -d -p 8983:8983 --name solr solr:8
```

After starting Solr, you can create a new collection (for instance, named bartoc):
```bash
docker exec -it solr bin/solr create -c bartoc -n data_driven_schema_configs
```
This command creates a collection using a dynamic, data-driven schema which you can later modify.

##### Mounting a Custom Configset

you can mount your custom config set to a directory inside the container and then create your collection using that config set. For example:

1. Create a local folder with your custom configuration:
```pgsql
solr-configs/
  └── your-configset/
      └── conf/
          ├── schema.xml
          └── solrconfig.xml
```

2. Mount it to a known location inside the container. If the default isn’t available, you can choose another path (for instance, /configsets/your-configset):
```bash
docker run -d -p 8983:8983 --name solr-custom -v $(pwd)/solr-configs/your-configset:/configsets/your-configset solr:8
```

3. When creating the collection, tell Solr which config set to use. If you mounted it to /configsets/your-configset, create your collection with:
```bash
docker exec -it solr-custom bin/solr create -c bartoc -n your-configset
```

##### Comments on index schema
- Field Types:
  - *string* is used for non-tokenized fields (IDs, keywords).
  - *text_en* is configured with tokenizers and filters suitable for English text.
  - *pdate* and *pint* handle date and integer conversions.

- Fields:
Each field is defined with the proper attributes (indexed, stored, and multiValued where applicable) to match the mapping established.

- Dynamic Fields:
This section ensures that any unexpected or future fields following a naming convention (like *_s, *_txt, etc.) are handled gracefully.

- Copy Fields:
These allow the contents of title_en and description_en to be searched in a general-purpose catch-all field (text).

- Schema Metadata:
The uniqueKey is set to id, and default search behaviors are defined.