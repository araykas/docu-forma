/**
 * app/api/upload/route.ts
 *
 * POST /api/upload
 *
 * Accepts a multipart/form-data body with a single "file" field.
 * Performs server-side validation:
 *   - File type via magic bytes (not extension)          [Spec B2]
 *   - File size ≤ 10 MB                                  [Spec B2]
 *   - PDF password detection                             [Spec B3]
 *   - Processed entirely in-memory (no disk writes)
 *
 * Returns JSON:
 *   { ok: true,  mimeType: string }            — on success
 *   { ok: false, error: string }               — on validation failure
 *
 * Error wording follows PRD section 6, Scenarios 1 & 2.
 */

import { type NextRequest } from 'next/server'
import { validateFileBuffer, isPdfPasswordProtected } from '@/lib/validateFile'

export const runtime = 'nodejs' // needs Buffer / ArrayBuffer support

export async function POST(request: NextRequest) {
  try {
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
    }

    // Validation passed — return detected mime type so the client knows what
    // type was actually confirmed.  File content is discarded here.
    return Response.json({ ok: true, mimeType: result.mimeType })
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
