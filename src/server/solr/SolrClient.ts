import { CollectionOperation } from "./CollectionOperation";
import { SearchOperation } from "./search/SearchOperation";
import config from "../conf/conf";

const SOLR_BASE_URL = config.solr.url || "http://localhost:8983/solr";

export class SolrClient {
  public searchOperation: SearchOperation;
  public collectionOperation: CollectionOperation;
  // public configsetOperation: ConfigsetOperation;
  // public aliasOperation: AliasOperation;
  // public indexOperation: IndexOperation;

  /**
   * @param apiVersion : the version of the Solr server (e.g. 8.1)
   */
  constructor(
    private apiVersion: number,
    private baseUrl: string = SOLR_BASE_URL,
  ) {
    this.searchOperation = new SearchOperation(this.apiVersion);
    this.collectionOperation = new CollectionOperation(this.apiVersion);
    // this.configsetOperation = new ConfigsetOperation(this.apiVersion);
    // this.aliasOperation = new AliasOperation(this.apiVersion);
    // this.indexOperation = new IndexOperation(this.apiVersion);
  }
}
