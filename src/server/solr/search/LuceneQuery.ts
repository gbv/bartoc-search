import { SearchQuery } from "./SearchQuery";

export class LuceneQuery extends SearchQuery {
  constructor(
    private _terms: string[] = new Array<string>(),
    private _field: string = "",
    private _weight: number = 0,
    private _op: "AND" | "OR" = "OR",
    private _phrase: string | null = null,
    private _phraseBoost = 1,
    private _tokens: string[] = [],
  ) {
    super();
  }

  public getDefType(): "lucene" | "dismax" | "edismax" {
    return "lucene";
  }

  /**
   * @param term : the term to search on
   */
  public term(term: string): LuceneQuery {
    const termEscaped = this._escape(term);
    this._terms.push(`"${termEscaped}"`);
    return this;
  }

  /**
   * @param field : the field to search in, defaults to _df
   */
  public in(field: string): LuceneQuery {
    this._field = field;
    return this;
  }

  /**
   * @param weight : the weight for matches of <term> in field <in>
   */
  public weight(weight: number): LuceneQuery {
    this._weight = weight;
    return this;
  }

  public static fromText(
    input: string,
    field: string,
    phraseBoost = 3,
    minTokenLength = 2, // lowered default to 2 to include two-letter tokens
  ): LuceneQuery {
    const q = new LuceneQuery();
    q._field = field;
    q._phrase = input.trim();
    q._phraseBoost = phraseBoost;
    // split on non-word chars, filter short terms and the phrase itself

    const rawTokens = input
      .split(/\W+/)
      .map((t) => t.trim())
      .filter(
        (t) =>
          t.length >= minTokenLength &&
          t.toLowerCase() !== q._phrase!.toLowerCase(),
      );

    q._tokens = Array.from(new Set(rawTokens)); // unique tokens, excludes the phrase

    return q;
  }

  /**
   * Manually specify operator (default OR)
   */
  public operator(op: "AND" | "OR"): LuceneQuery {
    this._op = op;
    return this;
  }

  public toString(): string {
    // Collect all query parts: manually added terms, phrase, and tokens
    const parts: string[] = [];

    // Add terms from .term()
    if (this._terms.length) {
      parts.push(...this._terms);
    }

    const phrase = this._phrase
      ? `"${this._escape(this._phrase)}"^${this._phraseBoost}`
      : null;
    const tokens = this._tokens.map(token => `"${this._escape(token)}"`);

    if (phrase && this._op === "AND" && tokens.length) {
      // Prefer the exact phrase, while still matching all words in any order.
      parts.push(`(${phrase} OR (${tokens.join(" AND ")}))`);
    } else {
      if (phrase) parts.push(phrase);
      parts.push(...tokens);
    }

    // If no parts, match all
    if (!parts.length) {
      return "*:*";
    }

    // Join parts with operator
    const joined = `(${parts.join(` ${this._op} `)})`;

    // Prefix field if provided
    let query = this._field ? `${this._field}:${joined}` : joined;

    // Apply overall weight if set
    if (this._weight > 0) {
      query = `${query}^${this._weight}`;
    }
    return query;
  }

  private _escape(str: string): string {
    return str.replace(/([+\-!(){}[\]^"~*?:\\/]|&&|\|\|)/g, "\\$1");
  }
}
