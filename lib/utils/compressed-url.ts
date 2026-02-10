/**
 * Compress / decompress URL query parameters for the results page.
 *
 * All query params (qb JSON, filters, sort, pagination, searchString) are
 * packed into a single `s=2.<base64url>` parameter using deflate compression.
 * The `doc` param (open document ECLI) is kept uncompressed for readability.
 *
 * Backwards compatibility:
 *   • URLs with `s=2.xxx` → decompress
 *   • URLs with `qb=` (current format) → pass through
 *   • URLs with legacy flat params → pass through
 *   • Corrupted `s` param → returns empty URLSearchParams (graceful fallback)
 */

import { deflateRaw, inflateRaw } from 'pako'

/* ── constants ── */

const V2_PREFIX = '2.'
/** Maximum encoded `s` param length (200 KB — generous for search URLs). */
const MAX_ENCODED_LENGTH = 200_000

/* ── base64url helpers (same as share-annotations.ts) ── */

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(b64: string): Uint8Array {
  let base64 = b64.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4 !== 0) base64 += '='
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/* ── compress ── */

/**
 * Compress all query params into a single `s=2.xxx` param.
 * The `doc` param is preserved uncompressed.
 */
export function compressSearchParams(params: URLSearchParams): URLSearchParams {
  // Extract doc (keep uncompressed)
  const doc = params.get('doc')
  params.delete('doc')

  // Build object from remaining params
  const obj: Record<string, string> = {}
  for (const [key, value] of params.entries()) {
    obj[key] = value
  }

  const json = JSON.stringify({ v: 1, p: obj })
  const compressed = deflateRaw(new TextEncoder().encode(json))
  const encoded = V2_PREFIX + bytesToBase64Url(compressed)

  const result = new URLSearchParams()
  result.set('s', encoded)
  if (doc) result.set('doc', doc)
  return result
}

/* ── decompress ── */

/**
 * Decompress query params from route.query.
 *
 * Detection order:
 *   1. `s` param starting with "2." → decompress v2
 *   2. No `s` param → pass through all params as-is (backwards compat)
 *   3. Corrupted `s` → return empty URLSearchParams
 */
export function decompressSearchParams(
  routeQuery: Record<string, string | (string | null)[] | undefined>,
): URLSearchParams {
  // Flatten route.query into a simple key→string map
  const raw: Record<string, string> = {}
  for (const [key, value] of Object.entries(routeQuery)) {
    if (Array.isArray(value)) {
      const joined = value.filter(Boolean).join(',')
      if (joined) raw[key] = joined
    } else if (value) {
      raw[key] = value
    }
  }

  const sParam = raw.s
  if (!sParam) {
    // No compressed param — pass through as-is (backwards compat)
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(raw)) {
      params.set(key, value)
    }
    return params
  }

  // Attempt v2 decompression
  try {
    if (!sParam.startsWith(V2_PREFIX)) return new URLSearchParams()
    if (sParam.length > MAX_ENCODED_LENGTH) return new URLSearchParams()

    const body = sParam.slice(V2_PREFIX.length)
    if (body.length === 0) return new URLSearchParams()
    if (!/^[A-Za-z0-9_-]+$/.test(body)) return new URLSearchParams()

    const compressed = base64UrlToBytes(body)
    const decompressed = inflateRaw(compressed)
    const json = new TextDecoder().decode(decompressed)
    const parsed = JSON.parse(json)

    if (!parsed || typeof parsed !== 'object' || parsed.v !== 1) return new URLSearchParams()
    if (!parsed.p || typeof parsed.p !== 'object') return new URLSearchParams()

    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(parsed.p)) {
      if (typeof value === 'string') {
        params.set(key, value)
      }
    }

    // Re-add doc if present in route query (it's kept uncompressed)
    if (raw.doc) params.set('doc', raw.doc)

    return params
  } catch {
    // Corrupted data → graceful fallback
    return new URLSearchParams()
  }
}
