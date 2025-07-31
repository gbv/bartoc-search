/**
 * A SearchFilter filters the search results on results that have an accepted value for the field.
 * It is send as 'fq' to Solr (see https://lucene.apache.org/solr/guide/8_5/common-query-parameters.html#CommonQueryParameters-Thefq_FilterQuery_Parameter).
 */
export class SearchFilter {
  private _fromValue: string | number | Date = "";
  private _toValue: string | number | Date = "";
  private _equalsValue: string | number | Date = "";
  private _orsValue: (string | number | Date)[] = [];

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
    let param = "";
    if (this._field) {
      if (this._equalsValue) {
        // single‐value exact match
        const raw = this.genericValueToString(this._equalsValue);
        const v = this.escapeAndQuote(raw);
        param = `${this._field}:${v}`;
      } else if (this._orsValue.length) {
        const terms = this._orsValue
        .map(v => this.escapeAndQuote(this.genericValueToString(v)))
        .join(" OR ");
        param =`${this._field}:(${terms})`;
      } else {
        const fromValue: string =
          this.genericValueToString(this._fromValue) || "*";
        const toValue: string = this.genericValueToString(this._toValue) || "*";
        param = `${this._field}:[${fromValue} TO ${toValue}]`;
      }
    }
    return param;
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
