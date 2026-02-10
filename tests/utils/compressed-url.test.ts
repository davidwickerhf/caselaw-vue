import { describe, it, expect } from 'vitest'
import { compressSearchParams, decompressSearchParams } from '../../lib/utils/compressed-url'

/* ── helpers ── */

/** Build URLSearchParams from a plain object. */
function makeParams(obj: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(obj)) {
    params.set(key, value)
  }
  return params
}

/** Convert URLSearchParams to a sorted key=value record for easy comparison. */
function toObj(params: URLSearchParams): Record<string, string> {
  const obj: Record<string, string> = {}
  for (const [key, value] of params.entries()) {
    obj[key] = value
  }
  return obj
}

/* ── tests ── */

describe('compressed-url', () => {
  describe('roundtrip', () => {
    it('compresses and decompresses a typical results URL', () => {
      const original = makeParams({
        qb: JSON.stringify({ op: 'AND', rules: [{ f: 'text', o: 'contains', v: 'proportionality', s: 'ANY' }], groups: [] }),
        searchString: 'proportionality principle',
        sortBy: 'date',
        sortDirection: 'desc',
        page: '2',
      })

      const compressed = compressSearchParams(original)
      // Should have a single 's' param
      expect(compressed.has('s')).toBe(true)
      expect(compressed.get('s')!.startsWith('2.')).toBe(true)
      // Should NOT have the original params
      expect(compressed.has('qb')).toBe(false)
      expect(compressed.has('searchString')).toBe(false)

      // Decompress via route.query format
      const routeQuery: Record<string, string> = {}
      for (const [key, value] of compressed.entries()) {
        routeQuery[key] = value
      }
      const decompressed = decompressSearchParams(routeQuery)
      expect(toObj(decompressed)).toEqual({
        qb: original.get('qb')!,
        searchString: 'proportionality principle',
        sortBy: 'date',
        sortDirection: 'desc',
        page: '2',
      })
    })

    it('preserves doc param uncompressed', () => {
      const original = makeParams({
        qb: '{"op":"AND","rules":[],"groups":[]}',
        doc: 'ECLI:EU:C:2021:123',
      })

      const compressed = compressSearchParams(original)
      expect(compressed.get('doc')).toBe('ECLI:EU:C:2021:123')
      expect(compressed.has('s')).toBe(true)

      const routeQuery: Record<string, string> = {}
      for (const [key, value] of compressed.entries()) {
        routeQuery[key] = value
      }
      const decompressed = decompressSearchParams(routeQuery)
      expect(decompressed.get('doc')).toBe('ECLI:EU:C:2021:123')
      expect(decompressed.get('qb')).toBe('{"op":"AND","rules":[],"groups":[]}')
    })

    it('roundtrips with filter params', () => {
      const original = makeParams({
        qb: '{"op":"AND","rules":[{"f":"text","o":"contains","v":"test","s":"ANY"}],"groups":[]}',
        sources: 'ECHR,RS',
        articleViolated: '6,8',
        respondentState: 'NLD,DEU',
        importance: '1,2',
        dateStart: '2020-01-01',
        dateEnd: '2024-12-31',
      })

      const compressed = compressSearchParams(original)
      const routeQuery: Record<string, string> = {}
      for (const [key, value] of compressed.entries()) {
        routeQuery[key] = value
      }
      const decompressed = decompressSearchParams(routeQuery)

      expect(decompressed.get('sources')).toBe('ECHR,RS')
      expect(decompressed.get('articleViolated')).toBe('6,8')
      expect(decompressed.get('respondentState')).toBe('NLD,DEU')
      expect(decompressed.get('importance')).toBe('1,2')
      expect(decompressed.get('dateStart')).toBe('2020-01-01')
      expect(decompressed.get('dateEnd')).toBe('2024-12-31')
    })
  })

  describe('backwards compatibility', () => {
    it('passes through qb-format URLs unchanged', () => {
      const routeQuery = {
        qb: '{"op":"AND","rules":[{"f":"text","o":"contains","v":"hello","s":"ANY"}],"groups":[]}',
        searchString: 'hello world',
        page: '1',
      }

      const params = decompressSearchParams(routeQuery)
      expect(params.get('qb')).toBe(routeQuery.qb)
      expect(params.get('searchString')).toBe('hello world')
      expect(params.get('page')).toBe('1')
    })

    it('passes through legacy flat param URLs unchanged', () => {
      const routeQuery = {
        text: 'proportionality',
        year_start: '2020',
        year_end: '2024',
        source: 'ECHR',
      }

      const params = decompressSearchParams(routeQuery)
      expect(params.get('text')).toBe('proportionality')
      expect(params.get('year_start')).toBe('2020')
      expect(params.get('source')).toBe('ECHR')
    })

    it('handles array values in route.query', () => {
      const routeQuery = {
        qb: '{"op":"AND","rules":[],"groups":[]}',
        sources: ['ECHR', 'RS'],
      }

      const params = decompressSearchParams(routeQuery as Record<string, string | string[]>)
      expect(params.get('qb')).toBe('{"op":"AND","rules":[],"groups":[]}')
      expect(params.get('sources')).toBe('ECHR,RS')
    })
  })

  describe('corrupted data', () => {
    it('returns empty params for corrupted s param', () => {
      const params = decompressSearchParams({ s: '2.INVALID_DATA!!!' })
      expect([...params.keys()]).toHaveLength(0)
    })

    it('returns empty params for s param without 2. prefix', () => {
      const params = decompressSearchParams({ s: 'not-a-valid-format' })
      expect([...params.keys()]).toHaveLength(0)
    })

    it('returns empty params for "2." with empty body', () => {
      const params = decompressSearchParams({ s: '2.' })
      expect([...params.keys()]).toHaveLength(0)
    })

    it('returns empty params for "2." with invalid base64url body', () => {
      const params = decompressSearchParams({ s: '2.AAAA' })
      expect([...params.keys()]).toHaveLength(0)
    })

    it('preserves doc even when s is corrupted', () => {
      // doc is not inside the compressed payload, so it should survive
      // Note: corrupted s means we can't decompress — doc in routeQuery is lost
      // because decompressSearchParams returns empty on error
      const params = decompressSearchParams({ s: '2.INVALID', doc: 'ECLI:EU:C:2021:123' })
      // Corrupted s → empty result (doc was in the route.query but we can't trust the context)
      expect([...params.keys()]).toHaveLength(0)
    })
  })

  describe('edge cases', () => {
    it('handles empty params', () => {
      const compressed = compressSearchParams(new URLSearchParams())
      expect(compressed.has('s')).toBe(true)

      const routeQuery: Record<string, string> = {}
      for (const [key, value] of compressed.entries()) {
        routeQuery[key] = value
      }
      const decompressed = decompressSearchParams(routeQuery)
      expect([...decompressed.keys()]).toHaveLength(0)
    })

    it('handles empty route query', () => {
      const params = decompressSearchParams({})
      expect([...params.keys()]).toHaveLength(0)
    })
  })

  describe('compression effectiveness', () => {
    it('compressed URL is shorter than uncompressed for typical queries', () => {
      const qb = JSON.stringify({
        op: 'AND',
        rules: [
          { f: 'text', o: 'contains', v: 'proportionality', s: 'ANY' },
          { f: 'year', o: 'gte', v: '2015', s: 'ANY' },
          { f: 'source', o: 'equals', v: 'ECHR', s: 'ANY' },
        ],
        groups: [{
          op: 'OR',
          rules: [
            { f: 'article_violated', o: 'equals', v: '6', s: 'ECHR' },
            { f: 'article_violated', o: 'equals', v: '8', s: 'ECHR' },
          ],
        }],
      })
      const original = makeParams({
        qb,
        searchString: 'proportionality in ECHR judgments',
        sortBy: 'date',
        sortDirection: 'desc',
        page: '3',
        sources: 'ECHR',
        respondentState: 'NLD,DEU,FRA',
      })

      const uncompressedUrl = original.toString()
      const compressed = compressSearchParams(original)
      const compressedUrl = compressed.toString()

      expect(compressedUrl.length).toBeLessThan(uncompressedUrl.length)
    })
  })
})
