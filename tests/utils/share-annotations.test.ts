import { describe, it, expect } from 'vitest'
import {
  encodeAnnotations,
  decodeAnnotations,
  reconstructHighlightText,
  hasAnnotations,
} from '../../lib/utils/share-annotations'
import type { Highlight, DocComment } from '../../composables/useUserData'

/* ── helpers ── */

function makeHighlight(overrides: Partial<Highlight> = {}): Highlight {
  return {
    id: 'h-1',
    ecli: 'ECLI:EU:C:2021:123',
    startLine: 10,
    startOffset: 5,
    endLine: 10,
    endOffset: 42,
    text: 'The court held that the principle of proportionality applies.',
    color: 'yellow',
    createdAt: Date.now(),
    ...overrides,
  }
}

function makeComment(overrides: Partial<DocComment> = {}): DocComment {
  return {
    id: 'c-1',
    ecli: 'ECLI:EU:C:2021:123',
    text: 'Important paragraph regarding fundamental rights.',
    startLine: 15,
    endLine: 18,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

/**
 * Simulate v1 encoding: JSON → base64url (no compression, no prefix).
 * Includes highlight text (as v1 did). Used for backwards-compat tests.
 */
function encodeV1(highlights: Highlight[], comments: DocComment[]): string {
  const payload = {
    v: 1,
    h: highlights.map(hl => {
      const ch: Record<string, unknown> = {
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
      const cc: Record<string, unknown> = { t: cm.text }
      if (cm.startLine !== undefined) cc.sl = cm.startLine
      if (cm.endLine !== undefined) cc.el = cm.endLine
      if (cm.languageCode) cc.lc = cm.languageCode
      return cc
    }),
  }
  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Build fake document lines for text reconstruction tests.
 * Lines are 1-indexed to match parsedLines in document.vue.
 */
function makeDocLines(texts: string[]): { lineNumber: number; text: string }[] {
  return texts.map((text, i) => ({ lineNumber: i + 1, text }))
}

/* ── tests ── */

describe('share-annotations', () => {
  describe('v2 roundtrip', () => {
    it('encodes with v2 prefix and decodes highlight positions + color', () => {
      const highlights = [makeHighlight(), makeHighlight({ id: 'h-2', color: 'blue', startLine: 20, endLine: 22 })]
      const encoded = encodeAnnotations(highlights, [])
      expect(encoded.startsWith('2.')).toBe(true)

      const decoded = decodeAnnotations(encoded)
      expect(decoded).not.toBeNull()
      expect(decoded!.highlights).toHaveLength(2)
      // v2 omits highlight text — it will be empty until reconstructed
      expect(decoded!.highlights[0].text).toBe('')
      expect(decoded!.highlights[0].color).toBe('yellow')
      expect(decoded!.highlights[0].startLine).toBe(10)
      expect(decoded!.highlights[0].startOffset).toBe(5)
      expect(decoded!.highlights[0].endLine).toBe(10)
      expect(decoded!.highlights[0].endOffset).toBe(42)
      expect(decoded!.highlights[1].color).toBe('blue')
    })

    it('encodes and decodes comments correctly (text is always preserved)', () => {
      const comments = [makeComment(), makeComment({ id: 'c-2', text: 'Another note' })]
      const encoded = encodeAnnotations([], comments)
      const decoded = decodeAnnotations(encoded)
      expect(decoded).not.toBeNull()
      expect(decoded!.comments).toHaveLength(2)
      expect(decoded!.comments[0].text).toBe(comments[0].text)
      expect(decoded!.comments[1].text).toBe('Another note')
    })

    it('roundtrips highlights + comments together', () => {
      const highlights = [makeHighlight()]
      const comments = [makeComment()]
      const encoded = encodeAnnotations(highlights, comments)
      const decoded = decodeAnnotations(encoded)
      expect(decoded!.highlights).toHaveLength(1)
      expect(decoded!.comments).toHaveLength(1)
      expect(decoded!.comments[0].text).toBe(comments[0].text)
    })

    it('preserves languageCode when present', () => {
      const hl = makeHighlight({ languageCode: 'ENG' })
      const cm = makeComment({ languageCode: 'FRE' })
      const decoded = decodeAnnotations(encodeAnnotations([hl], [cm]))!
      expect(decoded.highlights[0].languageCode).toBe('ENG')
      expect(decoded.comments[0].languageCode).toBe('FRE')
    })

    it('strips author-specific fields (id, ecli, createdAt, updatedAt)', () => {
      const decoded = decodeAnnotations(encodeAnnotations([makeHighlight()], [makeComment()]))!
      const hl = decoded.highlights[0] as Record<string, unknown>
      const cm = decoded.comments[0] as Record<string, unknown>
      expect(hl.id).toBeUndefined()
      expect(hl.ecli).toBeUndefined()
      expect(hl.createdAt).toBeUndefined()
      expect(cm.id).toBeUndefined()
      expect(cm.ecli).toBeUndefined()
      expect(cm.createdAt).toBeUndefined()
      expect(cm.updatedAt).toBeUndefined()
    })
  })

  describe('backwards compatibility – decoding v1 payloads', () => {
    it('decodes a v1-encoded string with text preserved', () => {
      const highlights = [makeHighlight()]
      const comments = [makeComment()]
      const v1Encoded = encodeV1(highlights, comments)

      expect(v1Encoded.startsWith('2.')).toBe(false)

      const decoded = decodeAnnotations(v1Encoded)
      expect(decoded).not.toBeNull()
      expect(decoded!.highlights).toHaveLength(1)
      // v1 includes text
      expect(decoded!.highlights[0].text).toBe(highlights[0].text)
      expect(decoded!.comments).toHaveLength(1)
      expect(decoded!.comments[0].text).toBe(comments[0].text)
    })

    it('decodes v1 payload with languageCode', () => {
      const hl = makeHighlight({ languageCode: 'ENG' })
      const v1 = encodeV1([hl], [])
      const decoded = decodeAnnotations(v1)!
      expect(decoded.highlights[0].languageCode).toBe('ENG')
    })

    it('v1 preserves text while v2 omits it (positions and comments match)', () => {
      const highlights = [
        makeHighlight(),
        makeHighlight({ id: 'h-2', color: 'green', startLine: 50, endLine: 55, text: 'Another passage' }),
      ]
      const comments = [makeComment()]

      const v1Decoded = decodeAnnotations(encodeV1(highlights, comments))!
      const v2Decoded = decodeAnnotations(encodeAnnotations(highlights, comments))!

      // Comments are identical
      expect(v2Decoded.comments).toEqual(v1Decoded.comments)

      // Highlight positions and colors match
      expect(v2Decoded.highlights).toHaveLength(v1Decoded.highlights.length)
      for (let i = 0; i < v1Decoded.highlights.length; i++) {
        expect(v2Decoded.highlights[i].startLine).toBe(v1Decoded.highlights[i].startLine)
        expect(v2Decoded.highlights[i].startOffset).toBe(v1Decoded.highlights[i].startOffset)
        expect(v2Decoded.highlights[i].endLine).toBe(v1Decoded.highlights[i].endLine)
        expect(v2Decoded.highlights[i].endOffset).toBe(v1Decoded.highlights[i].endOffset)
        expect(v2Decoded.highlights[i].color).toBe(v1Decoded.highlights[i].color)
        // v2 text is empty, v1 text is preserved
        expect(v2Decoded.highlights[i].text).toBe('')
        expect(v1Decoded.highlights[i].text).not.toBe('')
      }
    })
  })

  describe('compression effectiveness', () => {
    it('v2 output is dramatically shorter than v1 (text stripped + deflate)', () => {
      const highlights: Highlight[] = Array.from({ length: 50 }, (_, i) =>
        makeHighlight({
          id: `h-${i}`,
          startLine: i * 10,
          endLine: i * 10 + 5,
          text: `Highlight text for annotation number ${i} in a legal document.`,
          color: i % 2 === 0 ? 'yellow' : 'blue',
        }),
      )
      const comments: DocComment[] = Array.from({ length: 20 }, (_, i) =>
        makeComment({
          id: `c-${i}`,
          text: `Comment about paragraph ${i} discussing proportionality.`,
          startLine: i * 5,
          endLine: i * 5 + 2,
        }),
      )

      const v1 = encodeV1(highlights, comments)
      const v2 = encodeAnnotations(highlights, comments)

      // v2 should be dramatically smaller (text stripped + compression)
      expect(v2.length).toBeLessThan(v1.length * 0.5) // at least 50% smaller
    })
  })

  describe('reconstructHighlightText', () => {
    it('reconstructs single-line highlight text from document lines', () => {
      const hl = makeHighlight({ startLine: 3, startOffset: 10, endLine: 3, endOffset: 25 })
      const decoded = decodeAnnotations(encodeAnnotations([hl], []))!
      expect(decoded.highlights[0].text).toBe('')

      const lines = makeDocLines([
        'Line one content here.',
        'Line two content here.',
        'ABCDEFGHIJ0123456789012345end.',  // line 3 (1-indexed)
      ])

      reconstructHighlightText(decoded, lines)
      // slice(10, 25) on "ABCDEFGHIJ0123456789012345end." = "012345678901234" (15 chars)
      expect(decoded.highlights[0].text).toBe('012345678901234')
    })

    it('reconstructs multi-line highlight text', () => {
      const hl = makeHighlight({ startLine: 2, startOffset: 5, endLine: 4, endOffset: 10 })
      const decoded = decodeAnnotations(encodeAnnotations([hl], []))!

      const lines = makeDocLines([
        'Line 1: irrelevant.',
        'Line 2: ABCDE_rest_of_line_2',  // slice(5) = "2: ABCDE_rest_of_line_2"
        'Line 3: full middle line',       // full
        'Line 4: 01234567890tail',         // slice(0,10) = "Line 4: 01"
      ])

      reconstructHighlightText(decoded, lines)
      expect(decoded.highlights[0].text).toBe(
        '2: ABCDE_rest_of_line_2\nLine 3: full middle line\nLine 4: 01',
      )
    })

    it('skips highlights that already have text (v1 backwards compat)', () => {
      const v1Encoded = encodeV1([makeHighlight({ text: 'already-present' })], [])
      const decoded = decodeAnnotations(v1Encoded)!
      expect(decoded.highlights[0].text).toBe('already-present')

      const lines = makeDocLines(['anything at all on line 1'] )
      reconstructHighlightText(decoded, lines)
      // Should NOT overwrite existing text
      expect(decoded.highlights[0].text).toBe('already-present')
    })

    it('handles empty document lines gracefully', () => {
      const hl = makeHighlight({ startLine: 1, startOffset: 0, endLine: 1, endOffset: 5 })
      const decoded = decodeAnnotations(encodeAnnotations([hl], []))!

      reconstructHighlightText(decoded, [])
      // No lines → text stays empty
      expect(decoded.highlights[0].text).toBe('')
    })

    it('handles highlight referencing non-existent line gracefully', () => {
      const hl = makeHighlight({ startLine: 999, startOffset: 0, endLine: 999, endOffset: 5 })
      const decoded = decodeAnnotations(encodeAnnotations([hl], []))!

      const lines = makeDocLines(['Only one line'])
      reconstructHighlightText(decoded, lines)
      expect(decoded.highlights[0].text).toBe('')
    })
  })

  describe('edge cases', () => {
    it('handles empty annotation arrays', () => {
      const encoded = encodeAnnotations([], [])
      const decoded = decodeAnnotations(encoded)
      expect(decoded).not.toBeNull()
      expect(decoded!.highlights).toHaveLength(0)
      expect(decoded!.comments).toHaveLength(0)
    })

    it('returns null for empty string', () => {
      expect(decodeAnnotations('')).toBeNull()
    })

    it('returns null for garbage input', () => {
      expect(decodeAnnotations('not-valid-at-all!!!')).toBeNull()
    })

    it('returns null for "2." with empty body', () => {
      expect(decodeAnnotations('2.')).toBeNull()
    })

    it('returns null for "2." with invalid compressed data', () => {
      expect(decodeAnnotations('2.AAAA')).toBeNull()
    })

    it('sanitises XSS in v1 highlight text', () => {
      // v1 includes text, so XSS sanitisation applies
      const v1 = encodeV1([makeHighlight({ text: '<script>alert(1)</script>Hello' })], [])
      const decoded = decodeAnnotations(v1)!
      expect(decoded.highlights[0].text).not.toContain('<script>')
      expect(decoded.highlights[0].text).toContain('Hello')
    })

    it('rejects highlights where startLine > endLine', () => {
      const hl = makeHighlight({ startLine: 100, endLine: 5 })
      const decoded = decodeAnnotations(encodeAnnotations([hl], []))!
      expect(decoded.highlights).toHaveLength(0)
    })
  })

  describe('hasAnnotations', () => {
    it('returns true when highlights exist', () => {
      expect(hasAnnotations([makeHighlight()], [])).toBe(true)
    })

    it('returns true when comments exist', () => {
      expect(hasAnnotations([], [makeComment()])).toBe(true)
    })

    it('returns false for empty arrays', () => {
      expect(hasAnnotations([], [])).toBe(false)
    })
  })
})
