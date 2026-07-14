/**
 * lib/extractionToGroups.ts
 *
 * Spec E4 — Hubungkan ke data ekstraksi asli.
 *
 * Memetakan GeminiExtractionResult (dari /api/upload) ke struktur FieldGroup[]
 * yang dipakai oleh ReviewPage.
 *
 * Aturan pemetaan source → FieldSource:
 *   - RuleField.detected === true  && source === 'ai_extraction'          → 'ai_extraction'
 *   - RuleField.detected === true  && source === 'docx_property_fallback' → 'docx_property_fallback'
 *   - RuleField.detected === false                                         → 'default'
 */

import {
  PAPER_SIZE_OPTIONS,
  FONT_FAMILY_OPTIONS,
  PAGE_NUMBER_POSITION_OPTIONS,
  NUMBERING_FORMAT_OPTIONS,
  CHAPTER_TITLE_CASE_OPTIONS,
  CHAPTER_TITLE_ALIGN_OPTIONS,
  CHAPTER_NUMBER_FORMAT_OPTIONS,
  SUBCHAPTER_NUMBER_FORMAT_OPTIONS,
  MARGIN_RANGE,
  FONT_SIZE_RANGE,
  LINE_SPACING_RANGE,
} from '@/lib/fieldConfig'
import type { GeminiExtractionResult, RuleField } from '@/lib/callGemini'

// ---------------------------------------------------------------------------
// Types (mirrored from ReviewPage — kept in sync manually)
// ---------------------------------------------------------------------------

type FieldSource = 'ai_extraction' | 'docx_property_fallback' | 'default'

export interface ReviewField {
  key: string
  label: string
  value: string
  source: FieldSource
  type: 'text' | 'select' | 'number'
  options?: readonly string[]
  min?: number
  max?: number
  step?: number
  hint?: string
}

export interface FieldGroup {
  id: string
  title: string
  fields: ReviewField[]
}

// ---------------------------------------------------------------------------
// Default values (used when detected === false)
// ---------------------------------------------------------------------------

const DEFAULTS: Record<string, string> = {
  paper_size: 'A4',
  margin_left_cm: '4',
  margin_right_cm: '3',
  margin_top_cm: '4',
  margin_bottom_cm: '3',
  font_family: 'Times New Roman',
  font_size: '12',
  line_spacing: '2',
  page_number_position: 'bottom-center',
  front_matter_numbering: 'lowercase-roman',
  main_body_numbering: 'arabic',
  chapter_title_case: 'uppercase',
  chapter_title_align: 'center',
  chapter_number_format: 'roman',
  subchapter_number_format: 'decimal',
}

// ---------------------------------------------------------------------------
// Helper: convert a RuleField to { value, source }
// ---------------------------------------------------------------------------

function resolveField(
  field: RuleField | undefined,
  defaultValue: string,
): { value: string; source: FieldSource } {
  if (!field || !field.detected || field.value === null || field.value === undefined) {
    return { value: defaultValue, source: 'default' }
  }
  const source: FieldSource =
    field.source === 'docx_property_fallback'
      ? 'docx_property_fallback'
      : 'ai_extraction'
  return { value: String(field.value), source }
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Konversi hasil ekstraksi AI menjadi FieldGroup[] siap pakai di ReviewPage.
 *
 * @param result  GeminiExtractionResult dari /api/upload sukses.
 * @returns       FieldGroup[] dengan 4 kelompok (kertas/margin, font/spasi,
 *                penomoran, format judul bab).
 */
export function extractionToGroups(result: GeminiExtractionResult): FieldGroup[] {
  const r = result.rules

  return [
    // ── 1. Kertas & Margin ──────────────────────────────────────────────
    {
      id: 'kertas-margin',
      title: 'Kertas & Margin',
      fields: [
        {
          key: 'paper_size',
          label: 'Ukuran kertas',
          type: 'select',
          options: PAPER_SIZE_OPTIONS,
          ...resolveField(r.paper_size, DEFAULTS.paper_size),
        },
        {
          key: 'margin_left_cm',
          label: 'Margin kiri (cm)',
          type: 'number',
          ...MARGIN_RANGE,
          hint: '0–10 cm',
          ...resolveField(r.margin_left_cm, DEFAULTS.margin_left_cm),
        },
        {
          key: 'margin_right_cm',
          label: 'Margin kanan (cm)',
          type: 'number',
          ...MARGIN_RANGE,
          hint: '0–10 cm',
          ...resolveField(r.margin_right_cm, DEFAULTS.margin_right_cm),
        },
        {
          key: 'margin_top_cm',
          label: 'Margin atas (cm)',
          type: 'number',
          ...MARGIN_RANGE,
          hint: '0–10 cm',
          ...resolveField(r.margin_top_cm, DEFAULTS.margin_top_cm),
        },
        {
          key: 'margin_bottom_cm',
          label: 'Margin bawah (cm)',
          type: 'number',
          ...MARGIN_RANGE,
          hint: '0–10 cm',
          ...resolveField(r.margin_bottom_cm, DEFAULTS.margin_bottom_cm),
        },
      ],
    },

    // ── 2. Font & Spasi ─────────────────────────────────────────────────
    {
      id: 'font-spasi',
      title: 'Font & Spasi',
      fields: [
        {
          key: 'font_family',
          label: 'Jenis font',
          type: 'select',
          options: FONT_FAMILY_OPTIONS,
          ...resolveField(r.font_family, DEFAULTS.font_family),
        },
        {
          key: 'font_size',
          label: 'Ukuran font (pt)',
          type: 'number',
          ...FONT_SIZE_RANGE,
          hint: '8–24 pt',
          ...resolveField(r.font_size, DEFAULTS.font_size),
        },
        {
          key: 'line_spacing',
          label: 'Spasi baris',
          type: 'number',
          ...LINE_SPACING_RANGE,
          hint: '1–3',
          ...resolveField(r.line_spacing, DEFAULTS.line_spacing),
        },
      ],
    },

    // ── 3. Penomoran Halaman ─────────────────────────────────────────────
    {
      id: 'penomoran-halaman',
      title: 'Penomoran Halaman',
      fields: [
        {
          key: 'page_number_position',
          label: 'Posisi nomor halaman',
          type: 'select',
          options: PAGE_NUMBER_POSITION_OPTIONS,
          ...resolveField(r.page_number_position, DEFAULTS.page_number_position),
        },
        {
          key: 'front_matter_numbering',
          label: 'Format bagian awal',
          type: 'select',
          options: NUMBERING_FORMAT_OPTIONS,
          ...resolveField(r.front_matter_numbering, DEFAULTS.front_matter_numbering),
        },
        {
          key: 'main_body_numbering',
          label: 'Format bagian utama',
          type: 'select',
          options: NUMBERING_FORMAT_OPTIONS,
          ...resolveField(r.main_body_numbering, DEFAULTS.main_body_numbering),
        },
      ],
    },

    // ── 4. Format Judul Bab ──────────────────────────────────────────────
    {
      id: 'judul-bab',
      title: 'Format Judul Bab',
      fields: [
        {
          key: 'chapter_title_case',
          label: 'Gaya huruf judul bab',
          type: 'select',
          options: CHAPTER_TITLE_CASE_OPTIONS,
          ...resolveField(r.chapter_title_case, DEFAULTS.chapter_title_case),
        },
        {
          key: 'chapter_title_align',
          label: 'Perataan judul bab',
          type: 'select',
          options: CHAPTER_TITLE_ALIGN_OPTIONS,
          ...resolveField(r.chapter_title_align, DEFAULTS.chapter_title_align),
        },
        {
          key: 'chapter_number_format',
          label: 'Format nomor bab',
          type: 'select',
          options: CHAPTER_NUMBER_FORMAT_OPTIONS,
          ...resolveField(r.chapter_number_format, DEFAULTS.chapter_number_format),
        },
        {
          key: 'subchapter_number_format',
          label: 'Format nomor sub-bab',
          type: 'select',
          options: SUBCHAPTER_NUMBER_FORMAT_OPTIONS,
          ...resolveField(r.subchapter_number_format, DEFAULTS.subchapter_number_format),
        },
      ],
    },
  ]
}

// ---------------------------------------------------------------------------
// sessionStorage key (shared between FileUpload and ReviewPage)
// ---------------------------------------------------------------------------

export const EXTRACTION_STORAGE_KEY = 'docuforma_extraction'
