export interface ConceptSchemeDocument {
  "@context": string;

  ACCESS?: Array<{
    uri: string;
  }>;

  ADDRESS?: {
    code?: string;
    country?: string;
    locality?: string;
    region?: string;
    street?: string;
  };

  API?: Array<{
    type: string;
    url: string;
  }>;

  CONTACT?: string;

  DISPLAY?: DisplaySettings;

  EXAMPLES?: string[]

  FORMAT?: Array<{
    uri: string;
  }>;

  altLabel?: {
    [lang: string]: string[];
  };

  contributor?: Contributor[]

  created: string;

  creator?: Creator[]

  definition?: {
    [lang: string]: string[];
  };

  distributions?: Distributions[];

  extent?: string;

  // https://gbv.github.io/jskos/#list
  identifier?: (string | null)[];

  // Made optional
  languages?: string[];

  license?: Array<{
    uri: string;
  }>;
  
  modified: string;

  namespace?: string;

  notation?: string[];

  notationExamples?: string[];

  notationPattern?: string;
  
  // is used in solr as listed_in
  partOf?: Array<{
    uri: string;
  }>;

  prefLabel: {
    [lang: string]: string;
  };

  publisher?: Publisher[];

  startDate?: string;

  subject?: Array<{
    inScheme?: Array<{
      uri: string;
    }>;
    notation?: string[];
    uri: string;
  }>;

  subjectOf?: Array<{
    url?: string;
  }>;

  type: string[];

  uri: string;

  url?: string;
}

export interface ConceptDocument {
  "@context": string;

  uri: string;

  type: string[]; // Always includes SKOS Concept

  inScheme: Array<{
    uri: string;
    prefLabel: {
      [lang: string]: string;
    };
    type: string[]; // ConceptScheme and nkostype#list
  }>;

  publisher?: Array<{
    prefLabel: {
      [lang: string]: string;
    };
    // No `uri` provided in file for publisher field?
  }>;

  notation: string[]; // E.g., "glossary", "ontology", etc.

  prefLabel: {
    [lang: string]: string; // English and German at least
  };

  altLabel?: {
    [lang: string]: string[]; // Alternative names
  };

  scopeNote?: {
    [lang: string]: string[]; // Explanations / descriptions
  };

  topConceptOf: Array<{
    uri: string;
    prefLabel: {
      [lang: string]: string;
    };
    type: string[];
  }>;
}

/**
 * Represents a JSKOS subject entry.
 */
export interface JskosSubject {
  inScheme?: Array<{
      uri: string;
    }>;
  notation?: string[];
  uri: string;
}

/**
 * Input shape of JKSOKS record about languages mapping
 */
export type LangMap = Record<string, string[]>;

export type Contributor = {
  uri?: string;
  prefLabel?: LangMap;   // e.g. { en: "Foo Org", de: ["Foo Verein", "FV"] }
};

export type Creator = {
  uri?: string;
  prefLabel?: LangMap;   // e.g. { en: "Foo Org", de: ["Foo Verein", "FV"] }
};

export type Distributions = {
  download?: string[];
  format?: string[];
  mimetype?: string[];
}

export type Publisher = {
  uri: string;
  prefLabel?: Record<string, string[] | string>;
};

export type DisplaySettings = {
  hideNotation?: boolean;
  numericalNotation?: boolean;
};


export interface LicenseEntry {
  key: string
  label: string
  uris: string[]
}

export interface LicenseResult {
  key: string
  label: string
}

export interface GroupEntry {
  key: string
  label: string
  uris: string[]
}

export interface GroupResult {
  key: string
  label: string
}