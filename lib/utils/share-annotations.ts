/**
 * Encode / decode annotation data (highlights + comments) for sharing via URL.
 *
 * Format: JSON → UTF-8 → base64url (no padding).
 * We strip fields that are unique to the author (id, ecli, createdAt, updatedAt)
 * and use short keys to keep the URL compact.
 *
 * ── Security ──
 * Shared annotations are user-generated content embedded in URLs.  The decode
 * path therefore applies strict validation & sanitisation:
 *   • Maximum encoded payload size (100 KB)
 *   • Maximum annotation counts (500 highlights, 500 comments)
 *   • Type-checking every field (no prototype pollution, no unexpected keys)
 *   • Numeric range clamping (line/offset must be non-negative integers ≤ 1 000 000)
 *   • Text length limits (10 KB per string)
 *   • Allowlist for highlight colours
 *   • HTML / script / event-handler stripping from all text fields
 *   • Dangerous URL pattern removal (javascript:, data:, vbscript:)
 */

import type { Highlight, HighlightColor, DocComment } from '~/composables/useUserData'

/* ── Security constants ── */

/** Maximum size of the base64url-encoded string (≈ 100 KB). */
const MAX_ENCODED_LENGTH = 100_000
/** Maximum number of highlights allowed in one shared link. */
const MAX_HIGHLIGHTS = 500
/** Maximum number of comments allowed in one shared link. */
const MAX_COMMENTS = 500
/** Maximum character length for any single text field. */
const MAX_TEXT_LENGTH = 10_000
/** Upper bound for line numbers / offsets (sanity guard). */
const MAX_LINE_NUMBER = 1_000_000
/** Allowed highlight colours (allowlist). */
const VALID_COLORS: ReadonlySet<string> = new Set<string>([
  'yellow', 'green', 'blue', 'pink', 'orange',
])

/* ── compact wire types ── */

interface CompactHighlight {
  sl: number        // startLine
  so: number        // startOffset
  el: number        // endLine
  eo: number        // endOffset
  t: string         // text
  c: string         // color
  lc?: string       // languageCode (ECHR)
}

interface CompactComment {
  t: string         // text
  sl?: number       // startLine
  el?: number       // endLine
  lc?: string       // languageCode (ECHR)
}

interface SharedPayload {
  v: 1              // version
  h: CompactHighlight[]
  c: CompactComment[]
}

/* ── public types ── */

export interface SharedAnnotations {
  highlights: Omit<Highlight, 'id' | 'ecli' | 'createdAt'>[]
  comments: Omit<DocComment, 'id' | 'ecli' | 'createdAt' | 'updatedAt'>[]
}

/* ── sanitisation helpers ── */

/**
 * Strip HTML tags, event-handler attributes, script content,
 * and dangerous URI schemes from a string.
 * The result is safe for display as text content (Vue {{ }}).
 */
function sanitizeText(raw: unknown): string {
  if (typeof raw !== 'string') return ''

  let text = raw

  // 1. Remove <script>…</script> blocks (case-insensitive, dotAll)
  text = text.replace(/<script[\s>][\s\S]*?<\/script>/gi, '')

  // 2. Remove all HTML tags (opening, closing, self-closing)
  text = text.replace(/<\/?[a-z][^>]*>/gi, '')

  // 3. Remove event-handler patterns that could survive without tags
  //    e.g. "onload=alert(1)" embedded in text
  text = text.replace(/\bon\w+\s*=/gi, '')

  // 4. Remove dangerous URI schemes (javascript:, data:, vbscript:)
  text = text.replace(/\b(javascript|data|vbscript)\s*:/gi, '')

  // 5. Collapse control characters (except newlines & tabs) that could
  //    be used to bypass filters
  // eslint-disable-next-line no-control-regex
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  // 6. Enforce maximum length
  if (text.length > MAX_TEXT_LENGTH) {
    text = text.slice(0, MAX_TEXT_LENGTH)
  }

  return text
}

/**
 * Validate & clamp a numeric field.  Returns a safe non-negative integer
 * or `undefined` when the value is absent / invalid.
 */
function safeUint(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined
  const n = Number(value)
  if (!Number.isFinite(n)) return undefined
  const clamped = Math.max(0, Math.min(Math.round(n), MAX_LINE_NUMBER))
  return clamped
}

/** Validate a colour value against the allowlist. */
function safeColor(value: unknown): HighlightColor {
  if (typeof value === 'string' && VALID_COLORS.has(value)) {
    return value as HighlightColor
  }
  return 'yellow' // safe default
}

/** Validate an optional language code (short alphanumeric string). */
function safeLanguageCode(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  // Language codes are short uppercase alphabetic strings (e.g. "ENG", "FRE")
  const cleaned = value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 10)
  return cleaned || undefined
}

/* ── base64url helpers ── */

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(b64: string): string {
  let base64 = b64.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4 !== 0) base64 += '='
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

/* ── encode ── */

export function encodeAnnotations(
  highlights: Highlight[],
  comments: DocComment[],
): string {
  const payload: SharedPayload = {
    v: 1,
    h: highlights.map(hl => {
      const ch: CompactHighlight = {
        sl: hl.startLine,
        so: hl.startOffset,
        el: hl.endLine,
        eo: hl.endOffset,
        t: hl.text,
        c: hl.color,
      }
      if (hl.languageCode) ch.lc = hl.languageCode
      return ch
    }),
    c: comments.map(cm => {
      const cc: CompactComment = { t: cm.text }
      if (cm.startLine !== undefined) cc.sl = cm.startLine
      if (cm.endLine !== undefined) cc.el = cm.endLine
      if (cm.languageCode) cc.lc = cm.languageCode
      return cc
    }),
  }
  return toBase64Url(JSON.stringify(payload))
}

/* ── decode (with full validation & sanitisation) ── */

export function decodeAnnotations(encoded: string): SharedAnnotations | null {
  try {
    // ── Guard: payload size ──
    if (typeof encoded !== 'string' || encoded.length === 0) return null
    if (encoded.length > MAX_ENCODED_LENGTH) return null

    // ── Guard: only valid base64url characters ──
    if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return null

    const json = fromBase64Url(encoded)

    // ── Guard: decoded JSON size (base64 can expand slightly) ──
    if (json.length > MAX_ENCODED_LENGTH) return null

    const payload = JSON.parse(json)

    // ── Guard: must be a plain object ──
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null

    // ── Guard: version check ──
    if (payload.v !== 1) return null

    // ── Guard: arrays must be actual arrays ──
    const rawHighlights = Array.isArray(payload.h) ? payload.h : []
    const rawComments = Array.isArray(payload.c) ? payload.c : []

    // ── Guard: count limits ──
    const highlights = rawHighlights.slice(0, MAX_HIGHLIGHTS)
    const comments = rawComments.slice(0, MAX_COMMENTS)

    // ── Validate & sanitise each highlight ──
    const safeHighlights: SharedAnnotations['highlights'] = []
    for (const ch of highlights) {
      if (ch === null || typeof ch !== 'object' || Array.isArray(ch)) continue

      const sl = safeUint(ch.sl)
      const so = safeUint(ch.so)
      const el = safeUint(ch.el)
      const eo = safeUint(ch.eo)
      // All four numeric fields are required
      if (sl === undefined || so === undefined || el === undefined || eo === undefined) continue
      // startLine must be ≤ endLine
      if (sl > el) continue

      safeHighlights.push({
        startLine: sl,
        startOffset: so,
        endLine: el,
        endOffset: eo,
        text: sanitizeText(ch.t),
        color: safeColor(ch.c),
        languageCode: safeLanguageCode(ch.lc),
      })
    }

    // ── Validate & sanitise each comment ──
    const safeComments: SharedAnnotations['comments'] = []
    for (const cc of comments) {
      if (cc === null || typeof cc !== 'object' || Array.isArray(cc)) continue

      const text = sanitizeText(cc.t)
      // A comment must have non-empty text
      if (text.length === 0) continue

      const sl = safeUint(cc.sl)
      const el = safeUint(cc.el)
      // If both line numbers exist, start must be ≤ end
      if (sl !== undefined && el !== undefined && sl > el) continue

      safeComments.push({
        text,
        startLine: sl,
        endLine: el,
        languageCode: safeLanguageCode(cc.lc),
      })
    }

    return {
      highlights: safeHighlights,
      comments: safeComments,
    }
  } catch {
    // Any parse/decode error → silently reject
    return null
  }
}

/**
 * Check if there are any annotations to share.
 */
export function hasAnnotations(highlights: Highlight[], comments: DocComment[]): boolean {
  return highlights.length > 0 || comments.length > 0
}
