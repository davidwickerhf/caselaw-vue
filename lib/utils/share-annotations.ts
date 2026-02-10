/**
 * Encode / decode annotation data (highlights + comments) for sharing via URL.
 *
 * Format: JSON → UTF-8 → base64url (no padding).
 * We strip fields that are unique to the author (id, ecli, createdAt, updatedAt)
 * and use short keys to keep the URL compact.
 */

import type { Highlight, HighlightColor, DocComment } from '~/composables/useUserData'

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

/* ── helpers ── */

function toBase64Url(str: string): string {
  // TextEncoder → Uint8Array → binary string → btoa → base64url
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(b64: string): string {
  // base64url → base64 → atob → Uint8Array → TextDecoder
  let base64 = b64.replace(/-/g, '+').replace(/_/g, '/')
  // Add padding
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

/* ── decode ── */

export function decodeAnnotations(encoded: string): SharedAnnotations | null {
  try {
    const json = fromBase64Url(encoded)
    const payload = JSON.parse(json) as SharedPayload
    if (payload.v !== 1) return null

    return {
      highlights: (payload.h ?? []).map(ch => ({
        startLine: ch.sl,
        startOffset: ch.so,
        endLine: ch.el,
        endOffset: ch.eo,
        text: ch.t,
        color: ch.c as HighlightColor,
        languageCode: ch.lc,
      })),
      comments: (payload.c ?? []).map(cc => ({
        text: cc.t,
        startLine: cc.sl,
        endLine: cc.el,
        languageCode: cc.lc,
      })),
    }
  } catch {
    return null
  }
}

/**
 * Check if there are any annotations to share.
 */
export function hasAnnotations(highlights: Highlight[], comments: DocComment[]): boolean {
  return highlights.length > 0 || comments.length > 0
}
