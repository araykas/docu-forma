/**
 * app/api/upload/route.ts
 *
 * POST /api/upload
 *
 * Accepts a multipart/form-data body with a single "file" field.
 * Performs server-side validation and text extraction:
 *   - File type via magic bytes (not extension)          [Spec B2]
 *   - File size ≤ 10 MB                                  [Spec B2]
 *   - PDF password detection                             [Spec B3]
 *   - PDF text extraction + scan detection               [Spec D1]
 *   - Processed entirely in-memory (no disk writes)
 *
 * Spec D5: seluruh pipeline (extract → AI → validasi) dibungkus dalam satu
 * try-catch tunggal yang SELALU mengembalikan response terstruktur. Tidak ada
 * jalur kode yang membiarkan request menggantung tanpa response.
 * maxDuration ditetapkan eksplisit sesuai PRD Bagian 10 poin 9.
 *
 * Returns JSON:
 *   { ok: true,  mimeType: string, text?: string }   — on success
 *   { ok: false, error: string }                     — on validation/extraction failure
 *
 * Error wording follows PRD section 6, Scenarios 1, 2, 4, 6 & 7.
 */

import { type NextRequest } from 'next/server'
import { validateFileBuffer, isPdfPasswordProtected } from '@/lib/validateFile'
import { extractPdfText } from '@/lib/extractPdfText'
import { extractDocxText } from '@/lib/extractDocxText'
import { callGemini } from '@/lib/callGemini'
import { checkRateLimit, extractIp } from '@/lib/rateLimit'

export const runtime = 'nodejs' // needs Buffer / ArrayBuffer support

/**
 * maxDuration: batas waktu eksekusi maksimal route ini di Vercel (detik).
 * Vercel free tier (Hobby) membolehkan hingga 60 detik untuk Serverless Functions.
 * Set ke 55 agar ada sedikit buffer sebelum hard-limit platform.
 * PRD Bagian 10 poin 9 & Spec D5: wajib set maxDuration eksplisit di route ini.
 */
export const maxDuration = 55

export async function POST(request: NextRequest) {
  try {
    // Spec G1: Rate limiting per IP (PRD Bagian 10 poin 5)
    const ip = extractIp(request.headers)
    if (checkRateLimit(ip)) {
      return Response.json(
        {
          ok: false,
          error: 'Terlalu banyak permintaan. Silakan tunggu sebentar dan coba lagi.',
        },
        { status: 429 },
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file')

    // Ensure a file field was actually submitted
    if (!file || typeof file === 'string') {
      return Response.json(
        {
          ok: false,
          error: 'Gagal: Harap unggah file PDF/DOCX dengan ukuran maksimal 10 MB.',
        },
        { status: 400 },
      )
    }

    // Read the file into an ArrayBuffer — in-memory only, never written to disk
    const buffer = await (file as File).arrayBuffer()

    // Validate size + magic bytes (async: ZIP files get further inspected)
    const result = await validateFileBuffer(buffer)

    if (!result.valid) {
      return Response.json({ ok: false, error: result.error }, { status: 422 })
    }

    // Spec B3: for PDF files, detect password protection before any further
    // processing.  A locked PDF cannot be parsed by the extraction pipeline,
    // so we stop here with Skenario 2 wording from PRD section 6.
    if (result.mimeType === 'application/pdf') {
      const locked = await isPdfPasswordProtected(buffer)
      if (locked) {
        return Response.json(
          {
            ok: false,
            error:
              'Dokumen tidak dapat dibaca. Pastikan file tidak rusak atau terkunci kata sandi.',
          },
          { status: 422 },
        )
      }

      // Spec D1: extract text from PDF.
      // Detects scanned PDFs (Skenario 4) and logs raw text to console
      // for verification — AI pipeline (Spec D2+) is not called yet.
      const extraction = await extractPdfText(buffer)

      if ('type' in extraction) {
        // extraction is ExtractPdfTextError
        const status = extraction.code === 'scanned_pdf' ? 422 : 422
        return Response.json({ ok: false, error: extraction.error }, { status })
      }

      // [DIAG] Log extracted PDF text for comparison with docx pipeline
      console.log('=== [DIAG] SOURCE: pdf (unpdf) ===')
      console.log(`[DIAG] Total chars: ${extraction.text.length} | Pages: ${extraction.totalPages}`)
      console.log('[DIAG] First 500 chars:')
      console.log(extraction.text.slice(0, 500))
      console.log('=== [DIAG] end pdf text preview ===')

      // [DIAG] Print FULL prompts being sent to Gemini
      // (system prompt is defined in callGemini.ts — see SYSTEM_PROMPT constant)
      const userPromptPdf = `Berikut adalah teks dokumen pedoman penulisan. Ekstrak aturan formatnya:\n\n${extraction.text}`
      console.log('=== [DIAG] USER PROMPT sent to Gemini (pdf) ===')
      console.log(userPromptPdf)
      console.log('=== [DIAG] end user prompt (pdf) ===')

      // Spec D2/D3: send extracted text to Gemini for rule extraction
      const geminiResult = await callGemini(extraction.text)

      // [DIAG] Log raw Gemini result BEFORE any D4 validation
      console.log('=== [DIAG] Gemini raw result (pdf, pre-D4) ===')
      console.log(JSON.stringify(geminiResult, null, 2))
      console.log('=== [DIAG] end Gemini raw result (pdf) ===')

      // If Gemini returned an error, surface it to the client
      if ('type' in geminiResult) {
        // missing_key = server misconfiguration, not a transient AI issue
        const status = geminiResult.code === 'missing_key' ? 500 : 502
        return Response.json({ ok: false, error: geminiResult.error }, { status })
      }

      // Spec D6: dokumen tidak relevan — hentikan alur sebelum masuk Review.
      // PRD Bagian 6 Skenario 3.
      if (!geminiResult.is_relevant) {
        return Response.json(
          {
            ok: false,
            code: 'not_relevant',
            error:
              'Dokumen ini tampaknya bukan pedoman format penulisan. Silakan unggah dokumen pedoman yang sesuai.',
          },
          { status: 422 },
        )
      }

      return Response.json({
        ok: true,
        mimeType: result.mimeType,
        totalPages: extraction.totalPages,
        extraction: geminiResult,
      })
    }

    // Spec C1: extract text from .docx via mammoth, then send to Gemini (D2/D3).
    if (result.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const extraction = await extractDocxText(buffer)

      if ('type' in extraction) {
        return Response.json({ ok: false, error: extraction.error }, { status: 422 })
      }

      // [DIAG] Log extracted .docx text for comparison with PDF pipeline
      console.log('=== [DIAG] SOURCE: docx (mammoth) ===')
      console.log(`[DIAG] Total chars: ${extraction.text.length}`)
      console.log('[DIAG] First 500 chars:')
      console.log(extraction.text.slice(0, 500))
      console.log('=== [DIAG] end docx text preview ===')

      // [DIAG C2 STATUS] Spec C2 (XML property fallback) is NOT called here.
      // Only mammoth plain-text extraction is active at this point.
      // XML fallback will be wired in a later spec — results below reflect
      // mammoth-only extraction, no docx property enrichment yet.
      console.log('[DIAG] NOTE: Spec C2 XML property fallback is NOT active in this test run.')

      // [DIAG] Print full user prompt being sent to Gemini for docx
      // (system prompt is identical to pdf — defined as SYSTEM_PROMPT in callGemini.ts)
      const userPromptDocx = `Berikut adalah teks dokumen pedoman penulisan. Ekstrak aturan formatnya:\n\n${extraction.text}`
      console.log('=== [DIAG] USER PROMPT sent to Gemini (docx) ===')
      console.log(userPromptDocx)
      console.log('=== [DIAG] end user prompt (docx) ===')

      // Spec D2/D3: send extracted text to Gemini for rule extraction
      // NOTE: callGemini is called identically for both pdf and docx — no branching.
      const geminiResult = await callGemini(extraction.text)

      // [DIAG] Log raw Gemini result BEFORE any D4 validation
      console.log('=== [DIAG] Gemini raw result (docx, pre-D4) ===')
      console.log(JSON.stringify(geminiResult, null, 2))
      console.log('=== [DIAG] end Gemini raw result (docx) ===')

      if ('type' in geminiResult) {
        // missing_key = server misconfiguration, not a transient AI issue
        const status = geminiResult.code === 'missing_key' ? 500 : 502
        return Response.json({ ok: false, error: geminiResult.error }, { status })
      }

      // Spec D6: dokumen tidak relevan — hentikan alur sebelum masuk Review.
      // PRD Bagian 6 Skenario 3.
      if (!geminiResult.is_relevant) {
        return Response.json(
          {
            ok: false,
            code: 'not_relevant',
            error:
              'Dokumen ini tampaknya bukan pedoman format penulisan. Silakan unggah dokumen pedoman yang sesuai.',
          },
          { status: 422 },
        )
      }

      return Response.json({
        ok: true,
        mimeType: result.mimeType,
        extraction: geminiResult,
      })
    }

    // Fallback: unsupported mime type that passed validation (should not happen)
    return Response.json({ ok: false, error: 'Tipe file tidak didukung.' }, { status: 422 })
  } catch (err) {
    console.error('[upload] unexpected error:', err)
    return Response.json(
      {
        ok: false,
        error: 'Terjadi kesalahan pada server. Silakan coba lagi.',
      },
      { status: 500 },
    )
  }
}
