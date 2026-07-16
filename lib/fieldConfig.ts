/**
 * lib/fieldConfig.ts
 *
 * Satu sumber kebenaran untuk enum options dan rentang numerik field ekstraksi.
 * Dipakai oleh:
 *   - components/ReviewPage.tsx  → kontrol UI (select/number input)
 *   - (future) Spec D4           → validasi/sanitasi hasil JSON dari AI
 *
 * PRD v6, Bagian 10 poin 6: validasi ketat terhadap hasil AI di server —
 * font_family harus cocok whitelist, margin dalam rentang wajar, enum sesuai daftar.
 */

// ---------------------------------------------------------------------------
// Paper size
// ---------------------------------------------------------------------------

export const PAPER_SIZE_OPTIONS = ['A4', 'Letter', 'Legal'] as const
export type PaperSize = (typeof PAPER_SIZE_OPTIONS)[number]

// ---------------------------------------------------------------------------
// Font family whitelist
// ---------------------------------------------------------------------------

export const FONT_FAMILY_OPTIONS = [
  'Times New Roman',
  'Arial',
  'Calibri',
  'Georgia',
  'Garamond',
  'Helvetica',
  'Palatino Linotype',
  'Tahoma',
  'Verdana',
] as const
export type FontFamily = (typeof FONT_FAMILY_OPTIONS)[number]

// ---------------------------------------------------------------------------
// Numeric field ranges
// ---------------------------------------------------------------------------

/** Margin kiri/kanan/atas/bawah dalam cm. PRD Bagian 10 poin 6: rentang 0–10 cm. */
export const MARGIN_RANGE = { min: 0, max: 10, step: 0.5 } as const

/** Ukuran font dalam pt. Rentang wajar untuk dokumen akademik. */
export const FONT_SIZE_RANGE = { min: 8, max: 24, step: 1 } as const

/** Spasi baris. */
export const LINE_SPACING_RANGE = { min: 1, max: 3, step: 0.5 } as const

// ---------------------------------------------------------------------------
// Enum fields
// ---------------------------------------------------------------------------

export const PAGE_NUMBER_POSITION_OPTIONS = [
  'bottom-center',
  'bottom-right',
  'bottom-left',
  'top-center',
  'top-right',
  'top-left',
] as const
export type PageNumberPosition = (typeof PAGE_NUMBER_POSITION_OPTIONS)[number]

export const NUMBERING_FORMAT_OPTIONS = [
  'lowercase-roman',
  'uppercase-roman',
  'arabic',
] as const
export type NumberingFormat = (typeof NUMBERING_FORMAT_OPTIONS)[number]

export const CHAPTER_TITLE_CASE_OPTIONS = [
  'uppercase',
  'capitalize',
  'normal',
] as const
export type ChapterTitleCase = (typeof CHAPTER_TITLE_CASE_OPTIONS)[number]

export const CHAPTER_TITLE_ALIGN_OPTIONS = [
  'left',
  'center',
  'right',
  'justify',
] as const
export type ChapterTitleAlign = (typeof CHAPTER_TITLE_ALIGN_OPTIONS)[number]

export const CHAPTER_NUMBER_FORMAT_OPTIONS = [
  'roman',
  'arabic',
  'none',
] as const
export type ChapterNumberFormat = (typeof CHAPTER_NUMBER_FORMAT_OPTIONS)[number]

export const SUBCHAPTER_NUMBER_FORMAT_OPTIONS = [
  'decimal',
  'roman',
  'arabic',
  'none',
] as const
export type SubchapterNumberFormat = (typeof SUBCHAPTER_NUMBER_FORMAT_OPTIONS)[number]

// ---------------------------------------------------------------------------
// Font color (field ke-16)
// ---------------------------------------------------------------------------

/**
 * Whitelist warna font yang diizinkan.
 * Hampir semua pedoman TA mewajibkan tinta hitam — default "black".
 * Nilai disimpan sebagai nama CSS / hex 6-digit tanpa '#'.
 */
export const FONT_COLOR_OPTIONS = [
  'black',
  'white',
  'red',
  'blue',
  'green',
] as const
export type FontColor = (typeof FONT_COLOR_OPTIONS)[number]

/** Peta nama warna → hex OOXML (tanpa '#', 6 digit). */
export const FONT_COLOR_HEX: Record<FontColor, string> = {
  black: '000000',
  white: 'FFFFFF',
  red:   'FF0000',
  blue:  '0000FF',
  green: '008000',
}

// ---------------------------------------------------------------------------
// Human-readable labels for select options
// ---------------------------------------------------------------------------

export const OPTION_LABELS: Record<string, string> = {
  // Paper size
  A4: 'A4',
  Letter: 'Letter',
  Legal: 'Legal',

  // Page number position
  'bottom-center': 'Bawah tengah',
  'bottom-right':  'Bawah kanan',
  'bottom-left':   'Bawah kiri',
  'top-center':    'Atas tengah',
  'top-right':     'Atas kanan',
  'top-left':      'Atas kiri',

  // Numbering format
  'lowercase-roman': 'Romawi kecil (i, ii, iii)',
  'uppercase-roman': 'Romawi besar (I, II, III)',
  arabic:            'Angka (1, 2, 3)',

  // Chapter title case
  uppercase:  'HURUF KAPITAL SEMUA',
  capitalize: 'Huruf Kapital Tiap Kata',
  normal:     'Huruf normal',

  // Chapter title align
  left:    'Rata kiri',
  center:  'Rata tengah',
  right:   'Rata kanan',
  justify: 'Rata kiri-kanan',

  // Number formats
  roman:   'Romawi (I, II, III)',
  decimal: 'Desimal (1.1, 1.2)',
  none:    'Tanpa nomor',

  // Font color
  black: 'Hitam (wajib)',
  white: 'Putih',
  red:   'Merah',
  blue:  'Biru',
  green: 'Hijau',
}
