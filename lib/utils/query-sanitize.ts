/**
 * Shared security helpers for sanitising search-query and query-builder inputs
 * that originate from URL parameters or user-editable UI.
 *
 * Goals:
 *   1. Protect the CLIENT  – prevent XSS / script injection via reflected URL
 *      params that end up in the DOM (Vue {{ }}, v-html, attribute bindings).
 *   2. Protect the SERVER  – ensure the JSON payload sent to the API contains
 *      only well-formed, bounded values so the backend cannot be abused with
 *      oversized payloads, injection patterns, or unexpected data types.
 *
 * These functions are intentionally conservative: they silently truncate or
 * strip rather than reject outright, so a slightly-over-limit legitimate query
 * still works (with a trim) rather than erroring.
 */

/* ──────────────────────────── constants ──────────────────────────── */

/** Max characters for a single free-text search term. */
export const MAX_TEXT_LENGTH = 2_000

/** Max characters for a single filter value (title, keyword, state, etc.). */
export const MAX_FILTER_VALUE_LENGTH = 500

/** Max items in any single filter-value array (e.g. keywords[], eclis[]). */
export const MAX_ARRAY_ITEMS = 100

/** Max total rules in a QueryBuilderGroup (root + nested). */
export const MAX_RULES = 200

/** Max nested groups inside a QueryBuilderGroup. */
export const MAX_GROUPS = 20

/** Max rules per nested group. */
export const MAX_RULES_PER_GROUP = 50

/** Max byte-length of the JSON `qb` URL param. */
export const MAX_QB_JSON_LENGTH = 50_000

/** Max pageSize the client will send to the API. */
export const MAX_PAGE_SIZE = 200

/** Max characters for a cursor token. */
export const MAX_CURSOR_LENGTH = 1_000

/** Max characters for an ECLI string. */
export const MAX_ECLI_LENGTH = 120

/* ────────────────────────── text helpers ─────────────────────────── */

/**
 * Sanitise a free-text search string (query, title, keyword, …).
 *
 * Strips:
 *   • <script> blocks
 *   • HTML tags
 *   • on-event handler patterns (e.g. `onerror=…`)
 *   • Dangerous URI schemes (javascript:, data:, vbscript:)
 *   • Control characters (except \n \t)
 *
 * Then collapses whitespace and enforces `maxLen`.
 */
export function sanitizeText(raw: string, maxLen = MAX_TEXT_LENGTH): string {
  if (typeof raw !== 'string') return ''
  let text = raw

  // 1. Remove <script>…</script> blocks
  text = text.replace(/<script[\s>][\s\S]*?<\/script>/gi, '')

  // 2. Strip HTML tags
  text = text.replace(/<\/?[a-z][^>]*>/gi, '')

  // 3. Remove on-event handler patterns
  text = text.replace(/\bon\w+\s*=/gi, '')

  // 4. Remove dangerous URI schemes
  text = text.replace(/\b(javascript|data|vbscript)\s*:/gi, '')

  // 5. Strip control chars (keep \n \r \t)
  // eslint-disable-next-line no-control-regex
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  // 6. Collapse whitespace & trim
  text = text.replace(/\s+/g, ' ').trim()

  // 7. Enforce length
  if (text.length > maxLen) text = text.slice(0, maxLen)

  return text
}

/**
 * Sanitise a short filter value (not a free-text query).
 * Same stripping, shorter limit.
 */
export function sanitizeFilterValue(raw: string): string {
  return sanitizeText(raw, MAX_FILTER_VALUE_LENGTH)
}

/* ────────────────────────── array helper ─────────────────────────── */

/**
 * Cap an array to `MAX_ARRAY_ITEMS`, then sanitise each element.
 * Removes empty strings after sanitisation.
 */
export function sanitizeStringArray(
  arr: string[],
  sanitizer: (s: string) => string = sanitizeFilterValue,
  maxItems = MAX_ARRAY_ITEMS,
): string[] {
  return arr
    .slice(0, maxItems)
    .map(sanitizer)
    .filter(Boolean)
}

/* ────────────────────────── numeric helpers ──────────────────────── */

/**
 * Clamp a page size to [1, MAX_PAGE_SIZE].
 */
export function clampPageSize(raw: number): number {
  if (!Number.isFinite(raw) || raw < 1) return 10
  return Math.min(Math.round(raw), MAX_PAGE_SIZE)
}

/**
 * Validate & sanitise a cursor token.
 * Cursors are opaque strings from the API; we cap length and strip
 * anything that shouldn't be there.
 */
export function sanitizeCursor(raw: string | undefined): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined
  // Strip HTML / script content
  let cursor = raw.replace(/<[^>]*>/g, '').trim()
  if (cursor.length > MAX_CURSOR_LENGTH) cursor = cursor.slice(0, MAX_CURSOR_LENGTH)
  return cursor || undefined
}

/* ────────────────────────── ECLI validation ─────────────────────── */

/**
 * Validate that a string looks like a plausible ECLI.
 * ECLIs follow the pattern: ECLI:<country>:<court>:<year>:<number>
 * We enforce the prefix and max length but don't restrict country codes
 * beyond alphanumeric + colon + dot + hyphen.
 */
export function isValidEcli(ecli: string): boolean {
  if (!ecli || ecli.length > MAX_ECLI_LENGTH) return false
  // Must start with ECLI: (case-insensitive)
  if (!/^ECLI:/i.test(ecli)) return false
  // Only allow safe characters: alphanumeric, colon, dot, hyphen, underscore
  if (!/^[A-Za-z0-9:.\\-_]+$/.test(ecli)) return false
  return true
}

/**
 * Sanitise an ECLI string: trim, uppercase, validate.
 * Returns the cleaned ECLI or null if invalid.
 */
export function sanitizeEcli(raw: string): string | null {
  const trimmed = raw.trim().toUpperCase()
  return isValidEcli(trimmed) ? trimmed : null
}
