import { CollectionOperation } from "./CollectionOperation"
import { SearchOperation } from "./search/SearchOperation"

export class SolrClient {
  public searchOperation: SearchOperation
  public collectionOperation: CollectionOperation

  constructor() {
    this.searchOperation = new SearchOperation()
    this.collectionOperation = new CollectionOperation()
  }
}
