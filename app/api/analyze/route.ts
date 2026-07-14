/**
 * app/api/analyze/route.ts
 *
 * POST /api/analyze
 *
 * Spec D2 — Wiring dasar ke Gemini API.
 * Spec D3 — Scoping prompt: dokumen dengan spesifikasi ganda.
 * PRD v6, Bagian 3.4 (skema JSON) & Bagian 10 poin 4.
 *
 * Menerima teks polos yang sudah diekstrak (dari PDF via Spec D1,
 * atau dari .docx via Spec C1), mengirimnya ke Gemini API, dan
 * mengembalikan JSON terstruktur sesuai skema Bagian 3.4.
 *
 * Fokus spec ini: memastikan komunikasi ke Gemini berjalan dan JSON
 * berhasil di-parse, dengan scoping prompt yang sudah diperkuat (D3).
 * Validasi rentang nilai (D4) ditangani di spec berikutnya.
 *
 * Request body (JSON):
 *   { "text": string }          — teks polos hasil ekstraksi
 *
 * Response:
 *   { ok: true,  data: GeminiExtractionResult }   — sukses
 *   { ok: false, error: string }                  — gagal
 */

import { type NextRequest } from 'next/server'
import { callGemini } from '@/lib/callGemini'
import { checkRateLimit, extractIp } from '@/lib/rateLimit'

// ---------------------------------------------------------------------------
// Route Segment Config
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

/**
 * maxDuration: batas waktu eksekusi maksimal route ini di Vercel (detik).
 * Vercel free tier (Hobby) membolehkan hingga 60 detik untuk Serverless Functions.
 * Set ke 55 agar ada sedikit buffer sebelum hard-limit platform.
 * PRD Bagian 10 poin 4 & 9: wajib set maxDuration eksplisit di route ini.
 */
export const maxDuration = 55

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // Spec G1: Rate limiting per IP (PRD Bagian 10 poin 5)
    const ip = extractIp(request.headers)
    if (checkRateLimit(ip)) {
      return Response.json(
        { ok: false, error: 'Terlalu banyak permintaan. Silakan tunggu sebentar dan coba lagi.' },
        { status: 429 },
      )
    }

    // Parse JSON body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return Response.json(
        { ok: false, error: 'Request body harus berupa JSON dengan field "text".' },
        { status: 400 },
      )
    }

    // Validasi field "text"
    if (
      typeof body !== 'object' ||
      body === null ||
      typeof (body as Record<string, unknown>)['text'] !== 'string'
    ) {
      return Response.json(
        { ok: false, error: 'Field "text" (string) wajib ada di request body.' },
        { status: 400 },
      )
    }

    const text = ((body as Record<string, unknown>)['text'] as string).trim()

    if (text.length === 0) {
      return Response.json(
        { ok: false, error: 'Field "text" tidak boleh kosong.' },
        { status: 400 },
      )
    }

    // Panggil Gemini
    const result = await callGemini(text)

    // Tangani error dari callGemini
    if ('type' in result && result.type === 'error') {
      const status = result.code === 'missing_key' ? 500 : 502
      return Response.json({ ok: false, error: result.error }, { status })
    }

    // Sukses — kembalikan data ke client
    return Response.json({ ok: true, data: result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[analyze] unexpected error:', message)
    return Response.json(
      {
        ok: false,
        error: 'Terjadi kesalahan pada server. Silakan coba lagi.',
      },
      { status: 500 },
    )
  }
}
