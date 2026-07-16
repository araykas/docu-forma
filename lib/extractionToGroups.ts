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
  FONT_COLOR_OPTIONS,
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
  /**
   * Kutipan verbatim dari dokumen pedoman yang menjadi dasar deteksi.
   * Diisi hanya saat source === 'ai_extraction' dan AI yakin dengan kalimat sumbernya.
   */
  source_quote?: string | null
}

export interface FieldGroup {
  id: string
  title: string
  fields: ReviewField[]
}

// ---------------------------------------------------------------------------
// Default values — dipakai ketika AI tidak mendeteksi field (detected: false)
//
// PENTING: setiap nilai bukan asal comot. Alasan per-field:
//
// paper_size: 'A4'
//   Standar nasional Indonesia (SNI 8-1992 / ISO 216). Seluruh pedoman TA
//   perguruan tinggi Indonesia yang diketahui menetapkan A4. Bukan Letter
//   (standar AS) atau Legal.
//
// margin_left_cm: '4', margin_top_cm: '4'
//   4 cm adalah margin penjilidan yang paling sering muncul di pedoman TA
//   Indonesia (termasuk Pedoman FTI UNISBANK Bab V: "dari samping kiri: 4 cm,
//   dari atas: 4 cm"). Lebih lebar dari margin kanan/bawah karena sisi kiri
//   dipakai untuk jilid hardcover — jika terlalu sempit, teks terpotong.
//
// margin_right_cm: '3', margin_bottom_cm: '3'
//   3 cm adalah nilai yang konsisten muncul di pedoman TA Indonesia untuk sisi
//   non-jilid (Pedoman FTI UNISBANK: "kanan 3 cm, bawah 3 cm"). Bukan 2,5 cm
//   (terlalu sempit untuk cetakan laser) dan bukan 4 cm (pemborosan halaman).
//
// font_family: 'Times New Roman'
//   Font serif paling umum diwajibkan di pedoman TA Indonesia. Muncul eksplisit
//   di Pedoman FTI UNISBANK Bab V ("huruf Times New Roman"). Bukan Calibri
//   (default Word modern, tapi jarang diwajibkan di TA Indonesia) dan bukan
//   Arial (sans-serif, tidak lazim untuk naskah akademik formal).
//
// font_size: '12'
//   12 pt adalah ukuran standar Times New Roman untuk naskah akademik Indonesia.
//   Muncul di Pedoman FTI UNISBANK (tersirat dari konteks "2 spasi Times New
//   Roman") dan konsisten dengan konvensi penerbitan akademik internasional
//   untuk font serif 12pt. BUKAN meniru default Microsoft Word (yang
//   defaultnya Calibri 11pt — font dan ukuran berbeda, bukan acuan yang tepat
//   untuk naskah ilmiah Indonesia).
//
// line_spacing: '2'
//   Spasi ganda (2) adalah standar de facto naskah TA/skripsi Indonesia.
//   Pedoman FTI UNISBANK Bab V secara eksplisit: "jarak pengetikan 2 spasi".
//   Bukan 1 (terlalu rapat untuk koreksi dosen) dan bukan 1,5 (beberapa
//   pedoman memakainya, tapi 2 lebih umum di konteks Indonesia).
//
// font_color: 'black'
//   Hitam adalah satu-satunya warna yang diizinkan untuk naskah TA cetak.
//   Pedoman FTI UNISBANK Bab V secara eksplisit: "Warna tinta hitam".
//   Bukan default aksidental — ini persyaratan cetak yang hampir universal
//   di perguruan tinggi Indonesia.
//
// page_number_position: 'bottom-center'
//   Posisi paling umum untuk nomor halaman bagian utama di pedoman TA
//   Indonesia. Pedoman FTI UNISBANK: "di bawah tengah (1,5 cm dari bawah)".
//   Bukan top-right (konvensi jurnal/artikel, bukan skripsi) dan bukan
//   bottom-right (lebih jarang, meski ada beberapa pedoman yang memakainya).
//
// front_matter_numbering: 'lowercase-roman'
//   Romawi kecil (i, ii, iii) adalah konvensi baku untuk bagian awal
//   (halaman judul s.d. daftar lampiran) di hampir seluruh pedoman TA
//   Indonesia. Pedoman FTI UNISBANK: "angka romawi huruf kecil (i, ii, ...)".
//   Bukan angka Arab (yang dipakai bagian utama) dan bukan romawi besar.
//
// main_body_numbering: 'arabic'
//   Angka Arab (1, 2, 3) untuk bagian utama adalah standar universal.
//   Pedoman FTI UNISBANK: "nomor halaman bab dan sub bab menggunakan angka
//   Arab (1, 2, ...)".
//
// chapter_title_case: 'uppercase'
//   Judul bab seluruh huruf kapital adalah konvensi paling umum di pedoman
//   TA Indonesia. Pedoman FTI UNISBANK: "setiap bab dan sub bab diketik
//   dengan huruf kapital semua". Bukan capitalize (konvensi judul Inggris)
//   dan bukan normal (terlalu informal untuk judul bab).
//
// chapter_title_align: 'center'
//   Judul bab rata tengah adalah konvensi yang hampir universal di pedoman
//   TA Indonesia. Cocok dengan tampilan formal skripsi cetak. Bukan rata
//   kiri (konvensi laporan teknis/jurnal).
//
// chapter_number_format: 'roman'
//   Nomor bab angka Romawi (BAB I, BAB II) adalah konvensi TA Indonesia
//   paling umum. Pedoman FTI UNISBANK: "nomor urut bab menggunakan Angka
//   Romawi". Bukan angka Arab (lebih umum di buku teks dan tesis luar negeri).
//
// subchapter_number_format: 'decimal'
//   Format desimal (1.1, 1.2, 2.1) adalah konvensi paling umum untuk
//   sub-bab di pedoman TA Indonesia. Pedoman FTI UNISBANK: "nomor urut
//   sub bab menggunakan Angka Arab dengan cara desimal". Bukan romawi
//   (terlalu berjenjang) dan bukan none (tidak ada penomoran sama sekali).
// ---------------------------------------------------------------------------

const DEFAULTS: Record<string, string> = {
  paper_size:              'A4',
  margin_left_cm:          '4',
  margin_right_cm:         '3',
  margin_top_cm:           '4',
  margin_bottom_cm:        '3',
  font_family:             'Times New Roman',
  font_size:               '12',
  line_spacing:            '2',
  font_color:              'black',
  page_number_position:    'bottom-center',
  front_matter_numbering:  'lowercase-roman',
  main_body_numbering:     'arabic',
  chapter_title_case:      'uppercase',
  chapter_title_align:     'center',
  chapter_number_format:   'roman',
  subchapter_number_format: 'decimal',
}

// ---------------------------------------------------------------------------
// Helper: convert a RuleField to { value, source }
// ---------------------------------------------------------------------------

function resolveField(
  field: RuleField | undefined,
  defaultValue: string,
): { value: string; source: FieldSource; source_quote?: string | null } {
  if (!field || !field.detected || field.value === null || field.value === undefined) {
    return { value: defaultValue, source: 'default' }
  }
  const source: FieldSource =
    field.source === 'docx_property_fallback'
      ? 'docx_property_fallback'
      : 'ai_extraction'
  return {
    value: String(field.value),
    source,
    // Hanya teruskan source_quote untuk ai_extraction — field lain tidak relevan
    source_quote: source === 'ai_extraction' ? (field.source_quote ?? null) : null,
  }
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
        {
          key: 'font_color',
          label: 'Warna tinta',
          type: 'select',
          options: FONT_COLOR_OPTIONS,
          hint: 'Hampir semua pedoman TA mewajibkan hitam',
          ...resolveField(r.font_color, DEFAULTS.font_color),
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
