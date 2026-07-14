/**
 * app/api/generate/route.ts
 *
 * Spec F1 — Generator dasar (margin, font, kertas).
 * Spec F3 — Isi bab (lorem/kosong) & endpoint terhubung ke tombol Download.
 * PRD v6, Bagian 3.1, 3.4, 10 poin 9.
 *
 * POST /api/generate
 *
 * Body (JSON):
 *   {
 *     rules: DocFormatRules,
 *     content: 'lorem' | 'empty'
 *   }
 *
 * Response (success):
 *   Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
 *   Body: Buffer .docx
 *
 * Response (error):
 *   Content-Type: application/json
 *   Body: { error: string }
 *
 * PRD Bagian 10 poin 9: seluruh alur dibungkus try-catch tunggal yang
 * selalu mengembalikan response terstruktur.
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateDocx } from '@/lib/generateDocx'
import type { DocFormatRules, ChapterContent } from '@/lib/generateDocx'
import { checkRateLimit, extractIp } from '@/lib/rateLimit'

/** Vercel serverless function timeout (PRD Bagian 10 poin 9). */
export const maxDuration = 25

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Spec G1: Rate limiting per IP (PRD Bagian 10 poin 5)
    const ip = extractIp(request.headers)
    if (checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan. Silakan tunggu sebentar dan coba lagi.' },
        { status: 429 },
      )
    }

    // ── Parse request body ────────────────────────────────────────────

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Request body tidak valid — harap kirim JSON.' },
        { status: 400 },
      )
    }

    if (typeof body !== 'object' || body === null) {
      return NextResponse.json(
        { error: 'Body harus berupa JSON object.' },
        { status: 400 },
      )
    }

    const { rules, content } = body as { rules?: unknown; content?: unknown }

    // ── Validate rules ────────────────────────────────────────────────

    if (!rules || typeof rules !== 'object') {
      return NextResponse.json(
        { error: 'Field "rules" tidak ditemukan atau tidak valid.' },
        { status: 400 },
      )
    }

    const validatedRules = validateRules(rules as Record<string, unknown>)

    // ── Validate content ──────────────────────────────────────────────

    const chapterContent: ChapterContent =
      content === 'empty' ? 'empty' : 'lorem'

    // ── Generate .docx ────────────────────────────────────────────────

    const buffer = await generateDocx(validatedRules, chapterContent)

    // ── Return file ───────────────────────────────────────────────────

    // Next.js 16 NextResponse body expects BodyInit — convert Buffer → Uint8Array.
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="template-docuforma.docx"',
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[/api/generate] Error:', message)
    return NextResponse.json(
      {
        error:
          'Terjadi kesalahan saat membuat dokumen. Silakan coba lagi.',
      },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// Validation helpers (PRD Bagian 10 poin 6)
// ---------------------------------------------------------------------------

const FONT_FAMILY_WHITELIST = [
  'Times New Roman',
  'Arial',
  'Calibri',
  'Georgia',
  'Garamond',
  'Helvetica',
  'Palatino Linotype',
  'Tahoma',
  'Verdana',
]

const PAPER_SIZE_WHITELIST = ['A4', 'Letter', 'Legal']

const CHAPTER_TITLE_CASE_WHITELIST = ['uppercase', 'capitalize', 'normal']
const CHAPTER_TITLE_ALIGN_WHITELIST = ['left', 'center', 'right', 'justify']
const CHAPTER_NUMBER_FORMAT_WHITELIST = ['roman', 'arabic', 'none']
const SUBCHAPTER_NUMBER_FORMAT_WHITELIST = ['decimal', 'roman', 'arabic', 'none']

// Spec F2 additions
const PAGE_NUMBER_POSITION_WHITELIST = [
  'bottom-center', 'bottom-right', 'bottom-left',
  'top-center', 'top-right', 'top-left',
]
const NUMBERING_FORMAT_WHITELIST = ['lowercase-roman', 'uppercase-roman', 'arabic']

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value)
  if (isNaN(n)) return fallback
  return Math.max(min, Math.min(n, max))
}

function whitelistString(
  value: unknown,
  whitelist: string[],
  fallback: string,
): string {
  if (typeof value === 'string' && whitelist.includes(value)) return value
  return fallback
}

function validateRules(raw: Record<string, unknown>): DocFormatRules {
  return {
    paper_size: whitelistString(raw.paper_size, PAPER_SIZE_WHITELIST, 'A4'),

    // Margin: 0–10 cm (PRD Bagian 10 poin 6)
    margin_left_cm:   clampNumber(raw.margin_left_cm,   0, 10, 4),
    margin_right_cm:  clampNumber(raw.margin_right_cm,  0, 10, 3),
    margin_top_cm:    clampNumber(raw.margin_top_cm,    0, 10, 4),
    margin_bottom_cm: clampNumber(raw.margin_bottom_cm, 0, 10, 3),

    // Font
    font_family: whitelistString(raw.font_family, FONT_FAMILY_WHITELIST, 'Times New Roman'),
    font_size:   clampNumber(raw.font_size, 8, 24, 12),

    // Spasi baris: 1–3
    line_spacing: clampNumber(raw.line_spacing, 1, 3, 2),

    // Enum fields
    chapter_title_case:       whitelistString(raw.chapter_title_case,       CHAPTER_TITLE_CASE_WHITELIST,       'uppercase'),
    chapter_title_align:      whitelistString(raw.chapter_title_align,      CHAPTER_TITLE_ALIGN_WHITELIST,      'center'),
    chapter_number_format:    whitelistString(raw.chapter_number_format,    CHAPTER_NUMBER_FORMAT_WHITELIST,    'roman'),
    subchapter_number_format: whitelistString(raw.subchapter_number_format, SUBCHAPTER_NUMBER_FORMAT_WHITELIST, 'decimal'),

    // Spec F2 — penomoran halaman
    page_number_position:   whitelistString(raw.page_number_position,   PAGE_NUMBER_POSITION_WHITELIST, 'bottom-center'),
    front_matter_numbering: whitelistString(raw.front_matter_numbering, NUMBERING_FORMAT_WHITELIST,     'lowercase-roman'),
    main_body_numbering:    whitelistString(raw.main_body_numbering,    NUMBERING_FORMAT_WHITELIST,     'arabic'),
  }
}
