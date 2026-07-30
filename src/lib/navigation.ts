/**
 * Open Redirect Prevention: only allow same-origin relative paths.
 * Must start with '/', cannot start with '//', cannot contain ':'.
 */
export function sanitizeNextUrl(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next) return fallback;
  if (next.startsWith("/") && !next.startsWith("//") && !next.includes(":")) {
    return next;
  }
  return fallback;
}
