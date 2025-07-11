/** Convert bytes → megabytes with one decimal place */
export function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Format an ISO timestamp into a human-friendly string.
 * @param iso  e.g. "2020-08-21T20:13:10.540Z"
 * @returns    e.g. "Aug 21, 2020 8:13 PM UTC"
 */
export function formatTimestamp(iso: string | number | undefined): string {
  if (iso) {
    const date = new Date(iso)
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
      hour12: true,
    }).format(date)
  }
  return ""
}
/**
 * Resolves after the given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
