/**
 * lib/readDocxTemplate.ts
 *
 * Spec C2 — Baca metadata XML .docx sebagai fallback pelengkap.
 * PRD v6, Bagian 3.2 ("Peran baca metadata XML") & Bagian 3.4 (field `source`).
 *
 * Modul ini BUKAN jalur utama ekstraksi — ia dipanggil SETELAH pipeline AI
 * (Kelompok D) selesai.  Tugasnya satu: untuk setiap field yang AI kembalikan
 * sebagai detected:false, coba cari nilainya dari XML internal .docx.
 * Kalau XML punya nilainya → isi value + tandai source:'docx_property_fallback'.
 * Kalau XML juga tidak punya → biarkan detected:false + default seperti biasa.
 *
 * Field yang AI sudah deteksi (detected:true) TIDAK disentuh sama sekali.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Sumber XML yang dibaca:
 *   word/document.xml → <w:sectPr>  paper_size, margin_left/right/top/bottom
 *   word/styles.xml   → style Normal / <w:docDefaults>  font_family, font_size, line_spacing
 *
 * Field yang TIDAK bisa dibaca dari XML .docx dasar (selalu tetap detected:false):
 *   page_number_position, front_matter_numbering, main_body_numbering,
 *   chapter_title_case, chapter_title_align, chapter_number_format,
 *   subchapter_number_format
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Konversi satuan:
 *   Margin / page size : twips → cm   (1 inch = 1440 twips = 2.54 cm → ÷ 566.929)
 *   Font size          : half-points → pt  (÷ 2)
 *   Line spacing       : w:line twips, w:lineRule="auto"
 *                        240=1.0 | 276=1.15 | 360=1.5 | 480=2.0  (toleransi ±5%)
 */

import JSZip from 'jszip'

// ---------------------------------------------------------------------------
// Shared types (dipakai juga oleh Kelompok D)
// ---------------------------------------------------------------------------

/**
 * Asal-usul nilai sebuah field.
 * - `'ai_extraction'`          : AI membaca nilai ini secara eksplisit dari teks pedoman.
 * - `'docx_property_fallback'` : Nilai diambil dari properti XML .docx sumber — hanya
 *                                 sebagai saran, belum tentu mencerminkan aturan eksplisit.
 */
export type ExtractionSource = 'ai_extraction' | 'docx_property_fallback'

/**
 * Satu field hasil ekstraksi sesuai skema PRD v6 Bagian 3.4.
 *
 * - `detected: true`  → nilai ditemukan (dari AI atau dari XML fallback).
 * - `detected: false` → nilai tidak ditemukan; `value` berisi nilai default.
 * - `source`          → opsional; absen berarti `'ai_extraction'` (default implisit).
 */
export interface ExtractedField<T> {
  value: T
  detected: boolean
  source?: ExtractionSource
}

/**
 * Skema lengkap rules sesuai PRD v6 Bagian 3.4.
 * Digunakan oleh output AI (Kelompok D) dan oleh modul ini.
 */
export interface RulesSchema {
  paper_size: ExtractedField<string>
  margin_left_cm: ExtractedField<number>
  margin_right_cm: ExtractedField<number>
  margin_top_cm: ExtractedField<number>
  margin_bottom_cm: ExtractedField<number>
  font_family: ExtractedField<string>
  font_size: ExtractedField<number>
  line_spacing: ExtractedField<number>
  page_number_position: ExtractedField<string>
  front_matter_numbering: ExtractedField<string>
  main_body_numbering: ExtractedField<string>
  chapter_title_case: ExtractedField<string>
  chapter_title_align: ExtractedField<string>
  chapter_number_format: ExtractedField<string>
  subchapter_number_format: ExtractedField<string>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 1 inch = 1440 twips = 2.54 cm */
const TWIPS_PER_CM = 1440 / 2.54 // ≈ 566.929

/**
 * Nilai default — dipakai saat baik AI maupun XML tidak menemukan nilai.
 * Mengikuti standar umum pedoman kampus Indonesia (PRD).
 */
export const FIELD_DEFAULTS: RulesSchema = {
  paper_size:               { value: 'A4',               detected: false },
  margin_left_cm:           { value: 4,                   detected: false },
  margin_right_cm:          { value: 3,                   detected: false },
  margin_top_cm:            { value: 4,                   detected: false },
  margin_bottom_cm:         { value: 3,                   detected: false },
  font_family:              { value: 'Times New Roman',   detected: false },
  font_size:                { value: 12,                  detected: false },
  line_spacing:             { value: 2,                   detected: false },
  page_number_position:     { value: 'bottom-center',     detected: false },
  front_matter_numbering:   { value: 'lowercase-roman',   detected: false },
  main_body_numbering:      { value: 'arabic',            detected: false },
  chapter_title_case:       { value: 'uppercase',         detected: false },
  chapter_title_align:      { value: 'center',            detected: false },
  chapter_number_format:    { value: 'roman',             detected: false },
  subchapter_number_format: { value: 'decimal',           detected: false },
}

// ---------------------------------------------------------------------------
// Internal XML parser types
// ---------------------------------------------------------------------------

/**
 * Nilai mentah yang berhasil diekstrak dari XML .docx.
 * Semua field nullable — null artinya tidak ditemukan di XML.
 */
interface DocxRawValues {
  paperSize: string | null
  marginLeftCm: number | null
  marginRightCm: number | null
  marginTopCm: number | null
  marginBottomCm: number | null
  fontFamily: string | null
  fontSizePt: number | null
  lineSpacing: number | null
}

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

function getAttr(xmlTag: string, attr: string): string | null {
  const match = new RegExp(`${attr}="([^"]*)"`, 'i').exec(xmlTag)
  return match ? match[1] : null
}

function findTagAttr(xml: string, tag: string, attr: string): string | null {
  const tagRe = new RegExp(`<${tag}\\s[^>]*>`, 'i')
  const tagMatch = tagRe.exec(xml)
  if (!tagMatch) return null
  return getAttr(tagMatch[0], attr)
}

function twipsToCm(twipsStr: string | null): number | null {
  if (!twipsStr) return null
  const n = parseInt(twipsStr, 10)
  if (isNaN(n) || n <= 0) return null
  return Math.round((n / TWIPS_PER_CM) * 100) / 100
}

/**
 * Tebak line spacing multiplier dari w:line (twips) + w:lineRule.
 * Hanya dikenali kalau lineRule="auto" (relatif, bukan exact/atLeast).
 */
function parseLineSpacing(lineStr: string | null, ruleStr: string | null): number | null {
  if (!lineStr) return null
  const val = parseInt(lineStr, 10)
  if (isNaN(val) || val <= 0) return null
  const rule = (ruleStr ?? 'auto').toLowerCase()
  if (rule !== 'auto') return null // exact/atLeast dalam twips, tidak bisa dipetakan
  if (val >= 456) return 2.0   // 480 ± 5%
  if (val >= 342) return 1.5   // 360 ± 5%
  if (val >= 262) return 1.15  // 276 ± 5%
  if (val >= 228) return 1.0   // 240 ± 5%
  return null
}

function normalizeFont(raw: string | null): string | null {
  if (!raw) return null
  const t = raw.trim()
  return t.length > 0 ? t : null
}

// ---------------------------------------------------------------------------
// XML section parsers
// ---------------------------------------------------------------------------

function parseSectPr(documentXml: string): Pick<
  DocxRawValues,
  'paperSize' | 'marginLeftCm' | 'marginRightCm' | 'marginTopCm' | 'marginBottomCm'
> {
  const m = /<w:sectPr[\s\S]*?<\/w:sectPr>/i.exec(documentXml)
  if (!m) return { paperSize: null, marginLeftCm: null, marginRightCm: null, marginTopCm: null, marginBottomCm: null }
  const sectPr = m[0]

  // Paper size
  const pgW = findTagAttr(sectPr, 'w:pgSz', 'w:w')
  const pgH = findTagAttr(sectPr, 'w:pgSz', 'w:h')
  let paperSize: string | null = null
  if (pgW && pgH) {
    const w = parseInt(pgW, 10)
    const h = parseInt(pgH, 10)
    if (Math.abs(w - 11906) <= 100 && Math.abs(h - 16838) <= 100)      paperSize = 'A4'
    else if (Math.abs(w - 12240) <= 100 && Math.abs(h - 15840) <= 100) paperSize = 'Letter'
    else if (Math.abs(w - 9917)  <= 100 && Math.abs(h - 14033) <= 100) paperSize = 'A5'
    else {
      const wcm = twipsToCm(pgW)
      const hcm = twipsToCm(pgH)
      if (wcm && hcm) paperSize = `${wcm}x${hcm}cm`
    }
  }

  return {
    paperSize,
    marginLeftCm:   twipsToCm(findTagAttr(sectPr, 'w:pgMar', 'w:left')),
    marginRightCm:  twipsToCm(findTagAttr(sectPr, 'w:pgMar', 'w:right')),
    marginTopCm:    twipsToCm(findTagAttr(sectPr, 'w:pgMar', 'w:top')),
    marginBottomCm: twipsToCm(findTagAttr(sectPr, 'w:pgMar', 'w:bottom')),
  }
}

function extractFontAndSpacingFromBlock(block: string): {
  fontFamily: string | null
  fontSizePt: number | null
  lineSpacing: number | null
} {
  // Font family: w:ascii > w:hAnsi > w:cs
  const rFontsTag = /<w:rFonts\s[^>]*>/i.exec(block)?.[0] ?? null
  const fontFamily = rFontsTag
    ? (normalizeFont(getAttr(rFontsTag, 'w:ascii'))
       ?? normalizeFont(getAttr(rFontsTag, 'w:hAnsi'))
       ?? normalizeFont(getAttr(rFontsTag, 'w:cs')))
    : null

  // Font size: half-points
  const szRaw = findTagAttr(block, 'w:sz', 'w:val') ?? findTagAttr(block, 'w:szCs', 'w:val')
  const halfPts = szRaw ? parseInt(szRaw, 10) : NaN
  const fontSizePt = !isNaN(halfPts) && halfPts > 0 ? halfPts / 2 : null

  // Line spacing
  const lineSpacing = parseLineSpacing(
    findTagAttr(block, 'w:spacing', 'w:line'),
    findTagAttr(block, 'w:spacing', 'w:lineRule'),
  )

  return { fontFamily, fontSizePt, lineSpacing }
}

function parseStylesXml(stylesXml: string): Pick<
  DocxRawValues,
  'fontFamily' | 'fontSizePt' | 'lineSpacing'
> {
  // Helper: cari blok <w:style ... w:styleId="ID" ...>...</w:style>
  function getStyleBlock(styleId: string): string | null {
    const re = new RegExp(
      `<w:style\\s[^>]*w:styleId="${styleId}"[^>]*>[\\s\\S]*?<\\/w:style>`,
      'i',
    )
    return re.exec(stylesXml)?.[0] ?? null
  }

  // Helper: baca <w:docDefaults>
  function getDocDefaults(): { fontFamily: string | null; fontSizePt: number | null; lineSpacing: number | null } {
    const block = /<w:docDefaults[\s\S]*?<\/w:docDefaults>/i.exec(stylesXml)?.[0]
    if (!block) return { fontFamily: null, fontSizePt: null, lineSpacing: null }
    return extractFontAndSpacingFromBlock(block)
  }

  // 1. Coba style Normal
  const normalBlock = getStyleBlock('Normal')
  if (normalBlock) {
    const r = extractFontAndSpacingFromBlock(normalBlock)
    // Kalau Normal tidak lengkap, suplemen dari docDefaults
    if (!r.fontFamily || !r.fontSizePt) {
      const d = getDocDefaults()
      return {
        fontFamily:  r.fontFamily  ?? d.fontFamily,
        fontSizePt:  r.fontSizePt  ?? d.fontSizePt,
        lineSpacing: r.lineSpacing ?? d.lineSpacing,
      }
    }
    return r
  }

  // 2. Fallback: docDefaults langsung
  return getDocDefaults()
}

// ---------------------------------------------------------------------------
// Core XML extractor
// ---------------------------------------------------------------------------

/**
 * Buka arsip .docx dan ekstrak semua nilai yang bisa dibaca dari XML.
 * Mengembalikan null kalau ZIP gagal dibuka.
 * Field yang tidak ada di XML dikembalikan sebagai null.
 */
async function extractRawFromDocx(buffer: ArrayBuffer): Promise<DocxRawValues | null> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    return null
  }

  const documentEntry = zip.file('word/document.xml')
  if (!documentEntry) return null
  const documentXml = await documentEntry.async('string')

  const stylesEntry = zip.file('word/styles.xml')
  const stylesXml = stylesEntry ? await stylesEntry.async('string') : null

  const sectPr = parseSectPr(documentXml)
  const styles = stylesXml
    ? parseStylesXml(stylesXml)
    : { fontFamily: null, fontSizePt: null, lineSpacing: null }

  return {
    paperSize:      sectPr.paperSize,
    marginLeftCm:   sectPr.marginLeftCm,
    marginRightCm:  sectPr.marginRightCm,
    marginTopCm:    sectPr.marginTopCm,
    marginBottomCm: sectPr.marginBottomCm,
    fontFamily:     styles.fontFamily,
    fontSizePt:     styles.fontSizePt,
    lineSpacing:    styles.lineSpacing,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Terapkan fallback XML .docx ke hasil AI untuk field yang `detected:false`.
 *
 * Dipanggil SETELAH pipeline AI (Kelompok D) menghasilkan `aiRules`.
 * Untuk setiap field yang `detected:false`:
 *   - Kalau XML punya nilai → isi `value`, set `detected:true`,
 *     tambahkan `source:'docx_property_fallback'`.
 *   - Kalau XML juga tidak punya → biarkan `detected:false` + nilai default.
 * Field yang sudah `detected:true` dari AI tidak disentuh sama sekali.
 *
 * Kalau buffer tidak bisa dibuka (ZIP rusak, dll.), fungsi ini tetap return
 * `aiRules` yang asli tanpa perubahan — fallback gagal secara senyap.
 *
 * @param aiRules  Hasil JSON dari AI (sudah melalui validasi Kelompok D).
 * @param buffer   ArrayBuffer file .docx sumber yang sama yang dikirim ke AI.
 * @returns        RulesSchema baru — immutable copy dari aiRules dengan field
 *                 fallback yang sudah terisi (jika tersedia).
 *
 * @example
 * ```ts
 * // Setelah AI memberikan hasil:
 * const finalRules = await applyDocxFallback(aiResult.rules, docxBuffer)
 * // finalRules.font_size mungkin sekarang:
 * //   { value: 11, detected: true, source: 'docx_property_fallback' }
 * // kalau sebelumnya AI mengembalikan detected:false untuk font_size.
 * ```
 */
export async function applyDocxFallback(
  aiRules: RulesSchema,
  buffer: ArrayBuffer,
): Promise<RulesSchema> {
  // Salin dulu supaya tidak mutate input
  const result: RulesSchema = { ...aiRules }

  // Coba buka XML — kalau gagal, kembalikan rules asli tanpa perubahan
  const raw = await extractRawFromDocx(buffer)
  if (!raw) return result

  // Mapping: nama field RulesSchema → nilai mentah dari XML
  // Hanya field yang BISA dibaca dari XML .docx dasar yang dimapping di sini.
  // Field penomoran/judul bab tidak ada di sini karena XML tidak bisa membacanya.
  type NumericField = 'margin_left_cm' | 'margin_right_cm' | 'margin_top_cm' | 'margin_bottom_cm' | 'font_size' | 'line_spacing'
  type StringField  = 'paper_size' | 'font_family'

  const numericMappings: Array<[NumericField, number | null]> = [
    ['margin_left_cm',   raw.marginLeftCm],
    ['margin_right_cm',  raw.marginRightCm],
    ['margin_top_cm',    raw.marginTopCm],
    ['margin_bottom_cm', raw.marginBottomCm],
    ['font_size',        raw.fontSizePt],
    ['line_spacing',     raw.lineSpacing],
  ]

  const stringMappings: Array<[StringField, string | null]> = [
    ['paper_size',  raw.paperSize],
    ['font_family', raw.fontFamily],
  ]

  // Terapkan fallback hanya ke field yang AI tandai detected:false
  for (const [fieldName, rawValue] of numericMappings) {
    const current = result[fieldName] as ExtractedField<number>
    if (!current.detected && rawValue !== null) {
      (result[fieldName] as ExtractedField<number>) = {
        value: rawValue,
        detected: true,
        source: 'docx_property_fallback',
      }
    }
  }

  for (const [fieldName, rawValue] of stringMappings) {
    const current = result[fieldName] as ExtractedField<string>
    if (!current.detected && rawValue !== null) {
      (result[fieldName] as ExtractedField<string>) = {
        value: rawValue,
        detected: true,
        source: 'docx_property_fallback',
      }
    }
  }

  return result
}

/**
 * Hitung ulang daftar field yang masih `detected:false` setelah fallback.
 * Berguna untuk mengisi kembali `missing_fields` di response akhir.
 */
export function getMissingFields(rules: RulesSchema): string[] {
  return (Object.entries(rules) as [string, ExtractedField<unknown>][])
    .filter(([, field]) => !field.detected)
    .map(([key]) => key)
}
