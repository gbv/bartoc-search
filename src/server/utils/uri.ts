const BARTOC_RECORD_URI = /^http:\/\/bartoc\.org\/en\/node\/[1-9][0-9]+$/;

export function normalizeUri(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isBartocUri(value: unknown): boolean {
  return typeof value === "string" && BARTOC_RECORD_URI.test(value);
}
