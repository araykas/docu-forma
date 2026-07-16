/**
 * __tests__/lib/rateLimit.test.ts
 *
 * Unit tests untuk lib/rateLimit.ts (Spec G1)
 * Mencakup:
 *   - Sliding window: request dalam batas diizinkan
 *   - Sliding window: request melampaui batas ditolak
 *   - IP berbeda punya counter independen
 *   - extractIp: berbagai format header
 */

// Perlu mock Date.now agar bisa kontrol waktu
import { checkRateLimit, extractIp } from '@/lib/rateLimit'

describe('checkRateLimit', () => {
  // Tiap test pakai IP unik supaya tidak saling interferensi
  // (store adalah module-level Map yang persist selama test run)

  test('request pertama selalu diizinkan', () => {
    const result = checkRateLimit('1.1.1.1')
    expect(result).toBe(false)
  })

  test('10 request pertama diizinkan', () => {
    const ip = '10.0.0.1'
    const results: boolean[] = []
    for (let i = 0; i < 10; i++) {
      results.push(checkRateLimit(ip))
    }
    // Semua 10 harus false (diizinkan)
    expect(results.every((r) => r === false)).toBe(true)
  })

  test('request ke-11 ditolak (rate limited)', () => {
    const ip = '10.0.0.2'
    // Isi 10 request dulu
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip)
    }
    // Request ke-11 harus ditolak
    expect(checkRateLimit(ip)).toBe(true)
  })

  test('IP berbeda punya counter independen', () => {
    const ipA = '192.168.1.1'
    const ipB = '192.168.1.2'
    // Exhaust ipA
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ipA)
    }
    // ipA rate limited
    expect(checkRateLimit(ipA)).toBe(true)
    // ipB masih bebas
    expect(checkRateLimit(ipB)).toBe(false)
  })

  test('IP "unknown" diproses sama seperti IP biasa', () => {
    const result = checkRateLimit('unknown')
    expect(typeof result).toBe('boolean')
  })
})

describe('extractIp', () => {
  function makeHeaders(entries: Record<string, string>): Headers {
    return new Headers(entries)
  }

  test('mengambil IP dari x-forwarded-for (single IP)', () => {
    const headers = makeHeaders({ 'x-forwarded-for': '203.0.113.5' })
    expect(extractIp(headers)).toBe('203.0.113.5')
  })

  test('mengambil IP pertama dari x-forwarded-for (chain: client, proxy1, proxy2)', () => {
    const headers = makeHeaders({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1, 172.16.0.1' })
    expect(extractIp(headers)).toBe('203.0.113.5')
  })

  test('mengambil IP dari x-real-ip jika x-forwarded-for tidak ada', () => {
    const headers = makeHeaders({ 'x-real-ip': '198.51.100.7' })
    expect(extractIp(headers)).toBe('198.51.100.7')
  })

  test('x-forwarded-for lebih prioritas dari x-real-ip', () => {
    const headers = makeHeaders({
      'x-forwarded-for': '203.0.113.5',
      'x-real-ip': '198.51.100.7',
    })
    expect(extractIp(headers)).toBe('203.0.113.5')
  })

  test('mengembalikan "unknown" jika tidak ada header IP', () => {
    const headers = makeHeaders({})
    expect(extractIp(headers)).toBe('unknown')
  })

  test('trim whitespace dari IP di x-forwarded-for', () => {
    const headers = makeHeaders({ 'x-forwarded-for': '  203.0.113.5  ' })
    expect(extractIp(headers)).toBe('203.0.113.5')
  })
})
