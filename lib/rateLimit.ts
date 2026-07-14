/**
 * lib/rateLimit.ts
 *
 * Spec G1 — Rate limiting per IP.
 * PRD v6, Bagian 10 poin 5.
 *
 * Implementasi in-memory rate limiter berbasis sliding window.
 * Karena Vercel Serverless Functions bisa berjalan di beberapa instance
 * terpisah, limiter ini bekerja per-instance (bukan cluster-wide).
 * Untuk MVP / demo ini sudah cukup: penyalahgunaan ringan tertahan,
 * dan tidak perlu setup Redis/Upstash.
 *
 * Batas default: 10 request per menit per IP (PRD §10 poin 5).
 *
 * Cara pakai di API Route:
 * ```ts
 * import { checkRateLimit } from '@/lib/rateLimit'
 *
 * const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
 * const limited = checkRateLimit(ip)
 * if (limited) {
 *   return Response.json({ ok: false, error: '...' }, { status: 429 })
 * }
 * ```
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Durasi sliding window (ms). */
const WINDOW_MS = 60_000 // 1 menit

/** Jumlah request maksimal yang diizinkan per IP dalam satu window. */
const MAX_REQUESTS = 10

// ---------------------------------------------------------------------------
// Store in-memory
// ---------------------------------------------------------------------------

/**
 * Map dari IP → daftar timestamp request (dalam ms) yang jatuh dalam window
 * aktif. Entry lama di-prune saat pengecekan.
 *
 * Catatan: Map ini hidup selama lifetime process Node.js. Pada Vercel
 * Serverless, setiap cold start punya Map kosong sendiri — ini acceptable
 * untuk MVP, tidak butuh persistence.
 */
const store = new Map<string, number[]>()

/** Interval pembersihan entry yang sudah tidak punya request aktif. */
const CLEANUP_INTERVAL_MS = 5 * 60_000 // tiap 5 menit

let cleanupTimer: ReturnType<typeof setInterval> | null = null

function ensureCleanupTimer(): void {
  if (cleanupTimer !== null) return
  // Hanya jalankan interval di server environment
  if (typeof setInterval === 'undefined') return
  cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - WINDOW_MS
    for (const [ip, timestamps] of store.entries()) {
      const active = timestamps.filter((t) => t > cutoff)
      if (active.length === 0) {
        store.delete(ip)
      } else {
        store.set(ip, active)
      }
    }
  }, CLEANUP_INTERVAL_MS)
  // Unref agar timer tidak mencegah proses shutdown
  if (cleanupTimer && typeof (cleanupTimer as NodeJS.Timeout).unref === 'function') {
    (cleanupTimer as NodeJS.Timeout).unref()
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Cek apakah `ip` sudah melebihi batas request.
 *
 * @param ip  Alamat IP pengguna (dari header `x-forwarded-for` atau sejenisnya).
 * @returns   `true`  jika rate limit terlampaui (tolak request),
 *            `false` jika masih dalam batas (izinkan request).
 */
export function checkRateLimit(ip: string): boolean {
  ensureCleanupTimer()

  const now = Date.now()
  const cutoff = now - WINDOW_MS

  // Ambil timestamps yang masih dalam window, buang yang sudah kedaluwarsa
  const previous = store.get(ip) ?? []
  const active = previous.filter((t) => t > cutoff)

  if (active.length >= MAX_REQUESTS) {
    // Simpan kembali tanpa menambah entry baru — biarkan prune berjalan
    store.set(ip, active)
    return true // rate limited
  }

  // Catat request ini
  active.push(now)
  store.set(ip, active)
  return false // tidak limited
}

/**
 * Ekstrak IP pengguna dari NextRequest headers secara aman.
 * Mengembalikan 'unknown' bila tidak ada header yang bisa dibaca.
 *
 * Header yang dicek (prioritas menurun):
 *   1. x-forwarded-for (Vercel / reverse proxy — bisa berisi chain, ambil yang pertama)
 *   2. x-real-ip       (alternatif beberapa CDN/proxy)
 *
 * @param headers  Headers object dari NextRequest.
 */
export function extractIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    // x-forwarded-for bisa berisi "clientIP, proxy1, proxy2" — ambil yang pertama
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }

  const realIp = headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  return 'unknown'
}
