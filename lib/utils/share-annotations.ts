/**
 * Encode / decode annotation data (highlights + comments) for sharing via URL.
 *
 * v1 format: JSON → UTF-8 → base64url (no padding).
 * v2 format: JSON → UTF-8 → deflate (raw) → base64url, prefixed with "2.".
 *
 * v2 is typically 50-70 % smaller than v1 for real-world annotation sets.
 * The decoder supports both formats for full backwards compatibility.
 *
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

import { deflateRaw, inflateRaw } from 'pako'
import type { Highlight, HighlightColor, DocComment } from '~/composables/useUserData'

/* ── Security constants ── */

/** Maximum size of the base64url-encoded string (≈ 100 KB). */
const MAX_ENCODED_LENGTH = 100_000

/**
 * Prefix used to identify v2 (compressed) payloads.
 * The dot is not part of the base64url alphabet, so it can never appear
 * in a v1 payload – making detection unambiguous.
 */
const V2_PREFIX = '2.'
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
  t?: string        // text (omitted in v2 to save space; reconstructed from document)
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

/** Encode a UTF-8 string to base64url. */
function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str)
  return bytesToBase64Url(bytes)
}

/** Decode a base64url string to a UTF-8 string. */
function fromBase64Url(b64: string): string {
  const bytes = base64UrlToBytes(b64)
  return new TextDecoder().decode(bytes)
}

/** Encode raw bytes to base64url. */
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Decode base64url to raw bytes. */
function base64UrlToBytes(b64: string): Uint8Array {
  let base64 = b64.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4 !== 0) base64 += '='
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/* ── encode ── */

/**
 * Build the compact JSON payload from full annotation objects.
 *
 * Highlight text (`t`) is **omitted** from the payload to keep URLs short.
 * The recipient reconstructs it from the document content using the position
 * data (startLine, startOffset, endLine, endOffset).
 *
 * Comment text is always included because it is user-authored content that
 * cannot be derived from the document.
 */
function buildPayload(
  highlights: Highlight[],
  comments: DocComment[],
): SharedPayload {
  return {
    v: 1,
    h: highlights.map(hl => {
      const ch: CompactHighlight = {
        sl: hl.startLine,
        so: hl.startOffset,
        el: hl.endLine,
        eo: hl.endOffset,
        // t is intentionally omitted – reconstructed on the receiving end
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
}

/**
 * Encode annotations for sharing via URL.
 *
 * Uses **v2 format**: JSON → deflate (raw) → base64url, prefixed with "2.".
 * Typically 50-70 % smaller than v1 for real-world annotation sets.
 */
export function encodeAnnotations(
  highlights: Highlight[],
  comments: DocComment[],
): string {
  const payload = buildPayload(highlights, comments)
  const json = JSON.stringify(payload)
  const compressed = deflateRaw(new TextEncoder().encode(json))
  return V2_PREFIX + bytesToBase64Url(compressed)
}

/* ── decode (with full validation & sanitisation) ── */

/**
 * Decode a shared annotation string.
 *
 * Supports **both** formats for full backwards compatibility:
 *   • **v2** – prefixed with "2.", body is deflate-compressed base64url
 *   • **v1** – plain base64url-encoded JSON (no prefix)
 *
 * Old shared URLs (v1) will continue to work indefinitely.
 */
export function decodeAnnotations(encoded: string): SharedAnnotations | null {
  try {
    // ── Guard: payload size ──
    if (typeof encoded !== 'string' || encoded.length === 0) return null
    if (encoded.length > MAX_ENCODED_LENGTH) return null

    let json: string

    if (encoded.startsWith(V2_PREFIX)) {
      // ── v2: compressed ──
      const body = encoded.slice(V2_PREFIX.length)
      if (body.length === 0) return null
      // Guard: only valid base64url characters in the body
      if (!/^[A-Za-z0-9_-]+$/.test(body)) return null
      const compressed = base64UrlToBytes(body)
      const decompressed = inflateRaw(compressed)
      json = new TextDecoder().decode(decompressed)
    } else {
      // ── v1: plain base64url JSON ──
      // Guard: only valid base64url characters
      if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return null
      json = fromBase64Url(encoded)
    }

    // ── Guard: decoded JSON size ──
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
        // text may be absent (v2 strips it to save space); default to empty string.
        // The consumer is expected to reconstruct it from the document content.
        text: ch.t !== undefined ? sanitizeText(ch.t) : '',
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
 * Reconstruct highlight text from document lines.
 *
 * When highlights are shared without text (v2), the receiving client calls
 * this function after the document full text has loaded to fill in the
 * `text` field from the actual content at the highlight positions.
 *
 * @param annotations  The decoded shared annotations (mutated in place).
 * @param lines        The document lines, 1-indexed by `lineNumber`.
 */
export function reconstructHighlightText(
  annotations: SharedAnnotations,
  lines: { lineNumber: number; text: string }[],
): void {
  for (const hl of annotations.highlights) {
    // Skip highlights that already have text (v1 backwards compat)
    if (hl.text) continue

    if (hl.startLine === hl.endLine) {
      // Single-line highlight
      const line = lines.find(l => l.lineNumber === hl.startLine)
      if (line) {
        hl.text = line.text.slice(hl.startOffset, hl.endOffset)
      }
    } else {
      // Multi-line highlight
      const parts: string[] = []
      for (let ln = hl.startLine; ln <= hl.endLine; ln++) {
        const line = lines.find(l => l.lineNumber === ln)
        if (!line) continue
        if (ln === hl.startLine) {
          parts.push(line.text.slice(hl.startOffset))
        } else if (ln === hl.endLine) {
          parts.push(line.text.slice(0, hl.endOffset))
        } else {
          parts.push(line.text)
        }
      }
      hl.text = parts.join('\n')
    }
  }
}

/**
 * Check if there are any annotations to share.
 */
export function hasAnnotations(highlights: Highlight[], comments: DocComment[]): boolean {
  return highlights.length > 0 || comments.length > 0
}
