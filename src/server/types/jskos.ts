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

  FORMAT?: Array<{
    uri: string;
  }>;

  altLabel?: {
    [lang: string]: string[];
  };

  // From current data structure contributor prefLabel is always given in English
  contributor?: Array<{
    prefLabel: {
      en?: string;
    };
    uri: string;
  }>;

  created: string;

  // From current data structure creator prefLabel is always given in English
  creator?: Array<{
    prefLabel: {
      en?: string;
    };
    uri: string;
  }>;

  definition?: {
    [lang: string]: string[];
  };

  // https://gbv.github.io/jskos/#list
  identifier?: (string | null)[];

  // Made optional
  languages?: string[];

  license?: Array<{
    uri: string;
  }>;

  namespace?:string;

  modified: string;

  partOf?: Array<{
    uri: string;
  }>;

  prefLabel: {
    [lang: string]: string;
  };

  publisher?: Array<{
    prefLabel: {
      en?: string;
    };
    uri: string;
  }>;

  startDate?: string;

  subject?: Array<{
    inScheme?: Array<{
      uri: string;
    }>;
    notation?: string[];
    uri: string;
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