/**
 * A SearchFilter filters the search results on results that have an accepted value for the field.
 * It is send as 'fq' to Solr (see https://lucene.apache.org/solr/guide/8_5/common-query-parameters.html#CommonQueryParameters-Thefq_FilterQuery_Parameter).
 */
export class SearchFilter {
  private _fromValue: string | number | Date = "";
  private _toValue: string | number | Date = "";
  private _equalsValue: string | number | Date = "";
  private _orsValue: (string | number | Date)[] = [];
  private _rawExpr?: string = "";


  constructor(private _field: string) {}

  /**
   * A list of values where the field should contain one or more from
   * @param value
   */
  public ors(value: (string | number | Date)[]): SearchFilter {
    this._orsValue = value;
    return this;
  }

  /**
   * Specifies an exact value the field should contain
   * @param value
   */
  public equals(value: string | number | Date): SearchFilter {
    this._equalsValue = value;
    return this;
  }

  /**
   * Specifies the starting point of a range
   * @param value : the value where to start from
   */
  public from(value: string | number | Date): SearchFilter {
    this._fromValue = value;
    return this;
  }

  /**
   * Specifies the end point of a range
   * @param value : the value where to end with
   */
  public to(value: string | number | Date): SearchFilter {
    this._toValue = value;
    return this;
  }

  /**  
    * * Inject a raw Solr filter clause (e.g. "-field:[* TO *]") 
    * * @param expr : field to inject
  */
  public raw(expr: string): SearchFilter {
    this._rawExpr = expr;
    return this;
  }

  private genericValueToString(value: string | number | Date): string {
    switch (typeof value) {
      case "string": {
        return value as string;
      }
      case "number": {
        return (value as number).toString();
      }
      case "object": {
        return (value as Date).toISOString();
      }
      default: {
        throw new Error("Could not handle value type");
      }
    }
  }

  public toHttpQueryStringParameter(): string {
  if (this._rawExpr) {
    return this._rawExpr;
  }

  if (!this._field) return "";

  // 1) single‐value exact match
  if (this._equalsValue !== undefined) {
    const raw = this.genericValueToString(this._equalsValue);

    // “no value” bucket
    if (raw === "") {
      return `-${this._field}:[* TO *]`;
    }

    // normal exact match
    const v = this.escapeAndQuote(raw);
    return `${this._field}:${v}`;
  }

  // 2) OR‐list
  if (this._orsValue.length) {
    const hasNoValue = this._orsValue
      .map(v => this.genericValueToString(v))
      .includes("");

    const vals = this._orsValue
      .map(v => this.genericValueToString(v))
      .filter(v => v !== "");

    const termClauses = vals
      .map(v => this.escapeAndQuote(v))
      .join(" OR ");

    // only “no value”
    if (hasNoValue && !termClauses) {
      return `-${this._field}:[* TO *]`;
    }
    // mix of values + no-value
    if (hasNoValue && termClauses) {
      return `(-${this._field}:[* TO *] OR ${this._field}:(${termClauses}))`;
    }
    // pure OR
    return `${this._field}:(${termClauses})`;
  }


  // 3) range
  const from = this.genericValueToString(this._fromValue) || "*";
  const to   = this.genericValueToString(this._toValue)   || "*";
  return `${this._field}:[${from} TO ${to}]`;

}

  /**
 * Escape any Solr special characters in a term,
 * then wrap in quotes if the original contains whitespace.
 */
  public escapeAndQuote(term: string): string {
    // 1) First, escape all special characters with a backslash
    const escaped = term.replace(
      /([+\-!(){}[\]^"~*?:\\/])/g,
      "\\$1"
    );
    // 2) If it contains whitespace, wrap in quotes
    return /\s/.test(escaped) ? `"${escaped}"` : escaped;
  }

}
