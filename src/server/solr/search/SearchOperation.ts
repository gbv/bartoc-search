import { SearchQuery } from "./SearchQuery";
import { LuceneQuery } from "./LuceneQuery";
import { SolrRequest } from "../SolrRequest";
import { SearchFilter } from "./SearchFilter";
import { Readable } from "stream";
import { SortOrder, SortFieldMap, SortField } from "../../types/solr";

export class SearchOperation extends SolrRequest {
  private _sortField: string = "";
  private _sortOrder: SortOrder = SortOrder.ASC;
  private _start: number = 0;
  private _rows: number = 0;
  private _fq: SearchFilter[] = new Array<SearchFilter>();
  private _facetOnField: string[] = new Array<string>();
  private _facetQueries: string[] = [];
  private _fl: string[] = new Array<string>();
  private readonly _wt = "json";
  private _q: SearchQuery = new LuceneQuery();
  private _collection = "";
  private _requesthandler = "";
  private _stats: boolean = false;
  private _statsField: string | null = null;

  /**
   * Creates a new SearchOperation instance.
   */
  constructor() {
    super();
  }

  public stats(enable: boolean): SearchOperation {
    this._stats = enable;
    return this;
  }

  public statsField(field: string): SearchOperation {
    this._statsField = field;
    return this;
  }

  /**
   * @param {ISearchQuery} query : the query where to search for
   */
  public for(query: SearchQuery): SearchOperation {
    this._q = query;
    return this;
  }

  /**
   * @param {number} from : offset from where the results should be returned
   */
  public offset(offset: number): SearchOperation {
    this._start = offset;
    return this;
  }

  /**
   * @param {string} field : the field(s) to return for each result in the response
   * @example : search.field('field1').field('field2').field('*')
   */
  public field(field: string): SearchOperation {
    this._fl.push(field);
    return this;
  }

  /**
   * @param {string} facetOnField : the field that Solr should create a facet for in the response
   * @example : search.facetOnField('field1').facetOnField('field2');
   */
  public facetOnField(field: string): SearchOperation {
    this._facetOnField.push(field);
    return this;
  }

   /**
   * @param {string} query A raw Solr facet.query expression (e.g. grouping multiple values).
   * @example
   * // count all Thesauri OR Classification Schemas as one bucket:
   * search
   *   .facetQuery('type_uri:"...#thesaurus" OR type_uri:"...#classification_schema"');
   */
  public facetQuery(query: string): SearchOperation {
    this._facetQueries.push(query);
    return this;
  }

  /**
   * @param {string} collection : in which collection do we want to search
   */
  public in(collection: string): SearchOperation {
    this._collection = collection;
    return this;
  }

  /**
   * @param field : field to filter on
   * @param value : filter on this value in field
   * @param toValue : optional 'to' value to define range (toValue's type should equal value's type)
   */
  public filter(filter: SearchFilter): SearchOperation {
    this._fq.push(filter);
    return this;
  }

  /**
   * @param on : field to sort on
   * @param order : order to sort the values in the field on
   */
  public sort(on: SortField, order: SortOrder): SearchOperation {
    this._sortField = SortFieldMap[on];  
    this._sortOrder = order;
    return this;
  }

  /**
   * @param {number} limit : the maximum amount of results that should be returned
   */
  public limit(limit: number): SearchOperation {
    this._rows = limit;
    return this;
  }

  /**
   * Specify the requesthandler that should be used
   *
   * @param {string} handler
   * @returns {SearchOperation}
   * @memberof SearchOperation
   */
  public handler(handler: string): SearchOperation {
    this._requesthandler = handler;
    return this;
  }

  protected httpQueryParams(): Record<string, string | number | boolean | string[]> {
    const params: Record<string, string | number | boolean | string[]> = {
      wt: this._wt,
    };

    if (this._q) {
      params.q = this._q.toString();
      params.defType = this._q.getDefType();
    }

    if (this._sortField) {
      params.sort = `${this._sortField} ${this._sortOrder}`;
    }

    if (this._start !== undefined) {
      params.start = this._start;
    }

    if (this._stats) {
      params.stats = true;
    }
    if (this._statsField) {
      params["stats.field"] = this._statsField;
    }

    // Multiple fq
    if (this._fq.length) {
      this._fq.forEach((fq, index) => {
        params[`fq${index}`] = fq.toHttpQueryStringParameter();
      });
    }

    // Multiple facet.field
    if (this._facetOnField.length) {
      params.facet = true;
      this._facetOnField.forEach((field => {
        params["facet.field"] = field;
      }));
    }

    // —— NEW: Multiple facet.query ——
    // If you’ve collected raw query‐strings in _facetQueries[],
    // assign them as an array under the same key so Axios emits:
    // &facet.query=Q1&facet.query=Q2&…
    if (this._facetQueries?.length) {
      params["facet.query"] = this._facetQueries;
    }

    if (this._fl.length) {
      params.fl = this._fl.join(",");
    }

    if (this._rows !== undefined) {
      params.rows = this._rows;
    }

    return params;
  }

  protected httpBodyStream(): Readable {
    return new Readable();
  }

  protected absolutePath(): string {
    if (!this._collection) {
      throw new Error("Collection must be specified first");
    }
    return `/${this._collection}/${this._requesthandler || "select"}`;
  }

  protected httpMethod(): "GET" | "POST" {
    return "GET";
  }

  protected httpHeaders(): { "content-type"?: string } {
    return {};
  }

  protected httpBody(): Readable {
    // Not used with GET method
    return null as unknown as Readable;
  }

  public prepareSelect(collectionName: string): this {
    this._collection = collectionName;
    return this;
  }
}
