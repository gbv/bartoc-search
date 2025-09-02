// formatUriToGroup.ts
export const FORMAT_URI_TO_GROUP = {
  "http://bartoc.org/en/Format/Online": "Online",
  "http://bartoc.org/en/Format/PDF": "PDF",
  "http://bartoc.org/en/Format/SKOS": "SKOS",
  "http://bartoc.org/en/Format/Printed": "Printed",
  "http://bartoc.org/en/Format/XML": "XML",

  "http://bartoc.org/en/Format/RDF": "RDF",
  "http://bartoc.org/en/Format/Turtle": "RDF",
  "http://bartoc.org/en/Format/N-Quads": "RDF",
  "http://bartoc.org/en/Format/N-Triples": "RDF",
  "http://bartoc.org/en/Format/N3": "RDF",
  "http://bartoc.org/en/Format/TriX": "RDF",
  "http://bartoc.org/en/Format/TriG": "RDF",

  "http://bartoc.org/en/Format/Spreadsheet": "Spreadsheet",
  "http://bartoc.org/en/Format/XLS": "Spreadsheet",
  "http://bartoc.org/en/Format/XLSX": "Spreadsheet",
  "http://bartoc.org/en/Format/ODT": "Spreadsheet",

  "http://bartoc.org/en/Format/HTML": "HTML",
  "http://bartoc.org/en/Format/XHTML": "HTML",

  "http://bartoc.org/en/Format/CSV": "CSV",
  "http://bartoc.org/en/Format/TAB": "CSV",

  "http://bartoc.org/en/Format/JSON": "JSON",
  "http://bartoc.org/en/Format/JSON-LD": "JSON-LD",
  "http://bartoc.org/en/Format/JSKOS": "JSKOS",
  "http://bartoc.org/en/Format/MADS": "MADS",
  "http://bartoc.org/en/Format/OWL": "OWL",
  "http://bartoc.org/en/Format/Zthes": "Zthes",
  "http://bartoc.org/en/Format/XTM": "XTM",
  "http://bartoc.org/en/Format/DC": "DC",
  "http://bartoc.org/en/Format/BS8723-5": "BS8723-5",
  "http://bartoc.org/en/Format/VDEX": "VDEX",
  "http://bartoc.org/en/Format/Microform": "Microform",

  "http://bartoc.org/en/Format/TXT": "TXT",
  "http://bartoc.org/en/Format/ASCII": "TXT",
  "http://bartoc.org/en/Format/PCC": "TXT",

  "http://bartoc.org/en/Format/Word": "Word",
  "http://bartoc.org/en/Format/DOC": "Word",
  "http://bartoc.org/en/Format/DOCX": "Word",
  "http://bartoc.org/en/Format/RTF": "Word",
  "http://bartoc.org/en/Format/OTD": "Word",

  "http://bartoc.org/en/Format/CD-ROM": "CD-ROM",
  "http://bartoc.org/en/Format/XSD": "XSD",
  "http://bartoc.org/en/Format/OBO": "OBO",
  "http://bartoc.org/en/Format/Floppy-Disc": "Floppy-Disc",

  "http://bartoc.org/en/Format/MARC": "MARC",
  "http://bartoc.org/en/Format/UNIMARC": "MARC",
  "http://bartoc.org/en/Format/USMARC": "MARC",
  "http://bartoc.org/en/Format/MARCXML": "MARC",

  "http://bartoc.org/en/Format/Database": "Database",
  "http://bartoc.org/en/Format/MS-Access": "Database",
  "http://bartoc.org/en/Format/MDB": "Database",
  "http://bartoc.org/en/Format/MySQL-Dump": "Database",

  "http://bartoc.org/en/Format/Geodata": "Geodata",
  "http://bartoc.org/en/Format/KML": "Geodata",
  "http://bartoc.org/en/Format/MapInfo": "Geodata",
  "http://bartoc.org/en/Format/GeoJSON": "Geodata",

  "http://bartoc.org/en/Format/EPUB": "EPUB",
  "http://bartoc.org/en/Format/ClaML": "ClaML",
} as const;

export type FormatGroupNotation = typeof FORMAT_URI_TO_GROUP[keyof typeof FORMAT_URI_TO_GROUP];
