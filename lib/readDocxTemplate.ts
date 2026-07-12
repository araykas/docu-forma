/**
 * lib/readDocxTemplate.ts
 *
 * Spec C2 — Baca metadata .docx (khusus jalur "template").
 *
 * Untuk file .docx yang ke-tag 'template' oleh classifyDocx (Spec C1),
 * modul ini membaca properti tata letak langsung dari XML internal .docx
 * TANPA pemanggilan AI:
 *
 *   Sumber XML          Field yang dibaca
 *   ─────────────────── ──────────────────────────────────────────────────
 *   word/document.xml   paper_size, margin_left/right/top/bottom (cm)
 *   word/styles.xml     font_family, font_size (pt), line_spacing
 *
 * Field yang tidak ditemukan di properti XML standar .docx (penomoran
 * halaman, format judul bab) diberi detected:false + nilai default.
 *
 * Output mengikuti skema JSON PRD v5 Bagian 3.4.
 *
 * Konversi satuan:
 *   - Margin / page size: twips → cm  (1 inch = 1440 twips = 2.54 cm
 *                                       → twips / 566.929)
 *   - Font size: half-points → pt      (value / 2)
 *   - Line spacing: w:line twips.
 *       240 = single (1.0), 276 = 1.15, 360 = 1.5, 480 = double (2.0).
 *       Kita deteksi "2.0" kalau nilai ≥ 460 (toleransi ±10%), "1.5" kalau
 *       ≥ 345, "1.15" kalau ≥ 265, sisanya "1.0".
 */

import JSZip from 'jszip'

// ---------------------------------------------------------------------------
// Constants & defaults
// ---------------------------------------------------------------------------

/** 1 inch = 1440 twips = 2.54 cm → divisor untuk konversi twips ke cm. */
const TWIPS_PER_CM = 1440 / 2.54 // ≈ 566.929

/**
 * Nilai default dipakai saat field tidak terdeteksi di XML.
 * Nilai ini mengikuti standar umum pedoman kampus Indonesia (sesuai PRD).
 */
const DEFAULTS = {
  paper_size: 'A4',
  margin_left_cm: 4,
  margin_right_cm: 3,
  margin_top_cm: 4,
  margin_bottom_cm: 3,
  font_family: 'Times New Roman',
  font_size: 12,
  line_spacing: 2,
  // Field di bawah ini tidak tersedia dari properti dasar .docx → selalu default
  page_number_position: 'bottom-center',
  front_matter_numbering: 'lowercase-roman',
  main_body_numbering: 'arabic',
  chapter_title_case: 'uppercase',
  chapter_title_align: 'center',
  chapter_number_format: 'roman',
  subchapter_number_format: 'decimal',
} as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Satu field hasil ekstraksi — sesuai skema PRD Bagian 3.4. */
export interface ExtractedField<T> {
  value: T
  detected: boolean
}

/** Struktur lengkap output modul ini. */
export interface DocxTemplateMetadata {
  paper_size: ExtractedField<string>
  margin_left_cm: ExtractedField<number>
  margin_right_cm: ExtractedField<number>
  margin_top_cm: ExtractedField<number>
  margin_bottom_cm: ExtractedField<number>
  font_family: ExtractedField<string>
  font_size: ExtractedField<number>
  line_spacing: ExtractedField<number>
  // Field berikut tidak bisa dibaca dari XML .docx dasar → selalu detected:false
  page_number_position: ExtractedField<string>
  front_matter_numbering: ExtractedField<string>
  main_body_numbering: ExtractedField<string>
  chapter_title_case: ExtractedField<string>
  chapter_title_align: ExtractedField<string>
  chapter_number_format: ExtractedField<string>
  subchapter_number_format: ExtractedField<string>
}

/** Bentuk sukses: seluruh metadata + daftar field yang tidak terdeteksi. */
export interface ReadDocxTemplateResult {
  ok: true
  metadata: DocxTemplateMetadata
  /** Nama field yang detected:false — untuk diinformasikan ke pengguna. */
  missing_fields: string[]
}

/** Bentuk gagal: ZIP tidak bisa dibuka atau word/document.xml tidak ditemukan. */
export interface ReadDocxTemplateError {
  ok: false
  error: string
}

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

/**
 * Ekstrak nilai atribut XML secara sederhana dengan regex.
 * Contoh: getAttr('<w:pgMar w:left="1701" ...>', 'w:left') → '1701'
 *
 * Regex ini cukup handal untuk atribut tunggal dan tidak perlu full XML parser
 * karena OOXML menggunakan format atribut yang konsisten.
 */
function getAttr(xml: string, attr: string): string | null {
  // Escape titik dua di nama namespace agar tidak salah diinterpretasi regex
  const escaped = attr.replace(':', ':')
  const match = new RegExp(`${escaped}="([^"]*)"`, 'i').exec(xml)
  return match ? match[1] : null
}

/**
 * Cari tag pertama yang cocok dan kembalikan konten atributnya.
 * Misalnya: findTagAttr(xml, 'w:pgMar', 'w:left') mencari
 * <w:pgMar ... w:left="VALUE" .../> dan mengembalikan VALUE.
 */
function findTagAttr(xml: string, tag: string, attr: string): string | null {
  // Cari semua kemunculan tag (tanpa menutup, karena bisa self-closing)
  const tagEscaped = tag.replace(':', ':')
  // Ambil substring mulai dari tag hingga > berikutnya
  const tagRe = new RegExp(`<${tagEscaped}\\s[^>]*>`, 'i')
  const tagMatch = tagRe.exec(xml)
  if (!tagMatch) return null
  return getAttr(tagMatch[0], attr)
}

/**
 * Konversi twips ke cm, dibulatkan 2 desimal.
 * Mengembalikan null jika input bukan angka valid.
 */
function twipsToCm(twipsStr: string | null): number | null {
  if (!twipsStr) return null
  const n = parseInt(twipsStr, 10)
  if (isNaN(n) || n <= 0) return null
  return Math.round((n / TWIPS_PER_CM) * 100) / 100
}

/**
 * Tebak line spacing dari nilai w:line (twips).
 * Standar OOXML: w:lineRule="auto" → 240 = single, 480 = double.
 * Kita kembalikan nilai desimal umum: 1.0 / 1.15 / 1.5 / 2.0.
 * Kembalikan null jika tidak bisa ditebak.
 */
function parseLineSpacing(lineStr: string | null, ruleStr: string | null): number | null {
  if (!lineStr) return null
  const val = parseInt(lineStr, 10)
  if (isNaN(val) || val <= 0) return null

  // Kalau lineRule bukan "auto", ini spacing exact/atLeast dalam twips —
  // bisa jadi pt eksplisit, tidak mudah dipetakan ke multiplier umum.
  // Kita skip saja (detected:false) daripada menampilkan nilai menyesatkan.
  const rule = ruleStr?.toLowerCase() ?? 'auto'
  if (rule !== 'auto') return null

  // Toleransi ±5% dari nilai standar
  if (val >= 456) return 2.0    // 480 ± 5%
  if (val >= 342) return 1.5    // 360 ± 5%
  if (val >= 262) return 1.15   // 276 ± 5%
  if (val >= 228) return 1.0    // 240 ± 5%

  return null // nilai di bawah single → tidak dikenali
}

/**
 * Normalisasi nama font: bersihkan spasi lebih dan kapitalisasi konsisten.
 * Kembalikan null kalau string kosong setelah trim.
 */
function normalizeFont(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

// ---------------------------------------------------------------------------
// Section-property reader (word/document.xml)
// ---------------------------------------------------------------------------

/**
 * Baca ukuran kertas dan margin dari <w:sectPr> di word/document.xml.
 * sectPr bisa ada di akhir <w:body> (level dokumen) atau di dalam
 * paragraf tertentu (section break). Kita ambil yang pertama ditemukan —
 * untuk template sederhana ini sudah cukup.
 */
function parseSectPr(documentXml: string): {
  paperSize: string | null
  marginLeftCm: number | null
  marginRightCm: number | null
  marginTopCm: number | null
  marginBottomCm: number | null
} {
  // Ambil blok <w:sectPr ...>...</w:sectPr> pertama
  const sectPrMatch = /<w:sectPr[\s\S]*?<\/w:sectPr>/i.exec(documentXml)
  if (!sectPrMatch) {
    return {
      paperSize: null,
      marginLeftCm: null,
      marginRightCm: null,
      marginTopCm: null,
      marginBottomCm: null,
    }
  }
  const sectPr = sectPrMatch[0]

  // Ukuran kertas: <w:pgSz w:w="NNNN" w:h="NNNN" w:orient="..."/>
  // A4 = 11906 x 16838 twips, Letter = 12240 x 15840 twips
  const pgSzW = findTagAttr(sectPr, 'w:pgSz', 'w:w')
  const pgSzH = findTagAttr(sectPr, 'w:pgSz', 'w:h')
  let paperSize: string | null = null
  if (pgSzW && pgSzH) {
    const w = parseInt(pgSzW, 10)
    const h = parseInt(pgSzH, 10)
    // Toleransi ±100 twips (±0.18 cm) untuk mengakomodasi pembulatan
    if (Math.abs(w - 11906) <= 100 && Math.abs(h - 16838) <= 100) {
      paperSize = 'A4'
    } else if (Math.abs(w - 12240) <= 100 && Math.abs(h - 15840) <= 100) {
      paperSize = 'Letter'
    } else if (Math.abs(w - 9917) <= 100 && Math.abs(h - 14033) <= 100) {
      paperSize = 'A5'
    } else {
      // Kembalikan dimensi mentah sebagai informasi (dalam cm)
      const wcm = twipsToCm(pgSzW)
      const hcm = twipsToCm(pgSzH)
      if (wcm && hcm) {
        paperSize = `${wcm}x${hcm}cm`
      }
    }
  }

  // Margin: <w:pgMar w:top="NNNN" w:right="NNNN" w:bottom="NNNN" w:left="NNNN" .../>
  const marginLeft = twipsToCm(findTagAttr(sectPr, 'w:pgMar', 'w:left'))
  const marginRight = twipsToCm(findTagAttr(sectPr, 'w:pgMar', 'w:right'))
  const marginTop = twipsToCm(findTagAttr(sectPr, 'w:pgMar', 'w:top'))
  const marginBottom = twipsToCm(findTagAttr(sectPr, 'w:pgMar', 'w:bottom'))

  return {
    paperSize,
    marginLeftCm: marginLeft,
    marginRightCm: marginRight,
    marginTopCm: marginTop,
    marginBottomCm: marginBottom,
  }
}

// ---------------------------------------------------------------------------
// Styles reader (word/styles.xml)
// ---------------------------------------------------------------------------

/**
 * Baca properti font dan spasi dari style 'Normal' (w:styleId="Normal") di
 * word/styles.xml. Style Normal adalah fallback default untuk seluruh teks.
 *
 * Jika 'Normal' tidak ada, coba 'DefaultParagraphFont' atau ambil
 * <w:docDefaults> sebagai fallback terakhir.
 */
function parseStylesXml(stylesXml: string): {
  fontFamily: string | null
  fontSizePt: number | null
  lineSpacing: number | null
} {
  // Helper: cari blok style berdasarkan styleId
  function extractStyleBlock(xml: string, styleId: string): string | null {
    // Cari <w:style ... w:styleId="ID" ...>...</w:style>
    const idPattern = new RegExp(
      `<w:style\\s[^>]*w:styleId="${styleId}"[^>]*>[\\s\\S]*?<\\/w:style>`,
      'i',
    )
    const m = idPattern.exec(xml)
    return m ? m[0] : null
  }

  // Helper: ekstrak font dan spacing dari satu blok XML
  function extractFontAndSpacing(block: string): {
    fontFamily: string | null
    fontSizePt: number | null
    lineSpacing: number | null
  } {
    // Font family: <w:rFonts w:ascii="..." /> atau w:hAnsi / w:cs
    // Prioritas: w:ascii > w:hAnsi > w:cs
    const rFontsMatch = /<w:rFonts\s[^>]*>/i.exec(block)
    let fontFamily: string | null = null
    if (rFontsMatch) {
      const rFontsTag = rFontsMatch[0]
      fontFamily =
        normalizeFont(getAttr(rFontsTag, 'w:ascii')) ??
        normalizeFont(getAttr(rFontsTag, 'w:hAnsi')) ??
        normalizeFont(getAttr(rFontsTag, 'w:cs'))
    }

    // Font size: <w:sz w:val="NN"/> (half-points) atau <w:szCs w:val="NN"/>
    const szVal =
      findTagAttr(block, 'w:sz', 'w:val') ??
      findTagAttr(block, 'w:szCs', 'w:val')
    let fontSizePt: number | null = null
    if (szVal) {
      const halfPts = parseInt(szVal, 10)
      if (!isNaN(halfPts) && halfPts > 0) {
        fontSizePt = halfPts / 2
      }
    }

    // Line spacing: <w:spacing w:line="NNN" w:lineRule="auto"/>
    const lineVal = findTagAttr(block, 'w:spacing', 'w:line')
    const ruleVal = findTagAttr(block, 'w:spacing', 'w:lineRule')
    const lineSpacing = parseLineSpacing(lineVal, ruleVal)

    return { fontFamily, fontSizePt, lineSpacing }
  }

  // 1. Coba style Normal
  const normalBlock = extractStyleBlock(stylesXml, 'Normal')
  if (normalBlock) {
    const result = extractFontAndSpacing(normalBlock)
    // Kalau Normal ada tapi fontnya kosong, coba docDefaults sebagai suplemen
    if (!result.fontFamily || !result.fontSizePt) {
      const defaults = extractDocDefaults(stylesXml)
      return {
        fontFamily: result.fontFamily ?? defaults.fontFamily,
        fontSizePt: result.fontSizePt ?? defaults.fontSizePt,
        lineSpacing: result.lineSpacing ?? defaults.lineSpacing,
      }
    }
    return result
  }

  // 2. Fallback: <w:docDefaults>
  return extractDocDefaults(stylesXml)
}

/**
 * Baca <w:docDefaults> dari styles.xml — dipakai sebagai fallback
 * kalau style Normal tidak mendefinisikan font/ukuran secara eksplisit.
 */
function extractDocDefaults(stylesXml: string): {
  fontFamily: string | null
  fontSizePt: number | null
  lineSpacing: number | null
} {
  const defaultsMatch = /<w:docDefaults[\s\S]*?<\/w:docDefaults>/i.exec(stylesXml)
  if (!defaultsMatch) return { fontFamily: null, fontSizePt: null, lineSpacing: null }

  const block = defaultsMatch[0]

  const rFontsMatch = /<w:rFonts\s[^>]*>/i.exec(block)
  let fontFamily: string | null = null
  if (rFontsMatch) {
    const rFontsTag = rFontsMatch[0]
    fontFamily =
      normalizeFont(getAttr(rFontsTag, 'w:ascii')) ??
      normalizeFont(getAttr(rFontsTag, 'w:hAnsi')) ??
      normalizeFont(getAttr(rFontsTag, 'w:cs'))
  }

  const szVal =
    findTagAttr(block, 'w:sz', 'w:val') ??
    findTagAttr(block, 'w:szCs', 'w:val')
  let fontSizePt: number | null = null
  if (szVal) {
    const halfPts = parseInt(szVal, 10)
    if (!isNaN(halfPts) && halfPts > 0) fontSizePt = halfPts / 2
  }

  const lineVal = findTagAttr(block, 'w:spacing', 'w:line')
  const ruleVal = findTagAttr(block, 'w:spacing', 'w:lineRule')
  const lineSpacing = parseLineSpacing(lineVal, ruleVal)

  return { fontFamily, fontSizePt, lineSpacing }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Baca metadata tata letak dari file .docx template.
 *
 * @param buffer - ArrayBuffer isi file .docx (sudah divalidasi oleh
 *                 validateFileBuffer dan diklasifikasikan 'template' oleh
 *                 classifyDocx).
 *
 * @returns ReadDocxTemplateResult jika berhasil, ReadDocxTemplateError jika
 *          ZIP tidak bisa dibuka atau entry XML wajib tidak ada.
 *
 * @example
 * ```ts
 * const result = await readDocxTemplate(buffer)
 * if (!result.ok) {
 *   // tampilkan result.error ke pengguna
 * } else {
 *   const { metadata, missing_fields } = result
 *   // metadata.margin_left_cm.detected === true → pakai nilai asli
 *   // metadata.font_size.detected === false → pakai default, beri tanda
 * }
 * ```
 */
export async function readDocxTemplate(
  buffer: ArrayBuffer,
): Promise<ReadDocxTemplateResult | ReadDocxTemplateError> {
  // Buka arsip ZIP
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: `Gagal membuka arsip .docx: ${msg}` }
  }

  // Baca word/document.xml (wajib ada — sudah dijamin oleh validateFileBuffer)
  const documentEntry = zip.file('word/document.xml')
  if (!documentEntry) {
    return { ok: false, error: 'File word/document.xml tidak ditemukan di arsip .docx.' }
  }
  const documentXml = await documentEntry.async('string')

  // Baca word/styles.xml (opsional — mungkin tidak ada di .docx minimalis)
  const stylesEntry = zip.file('word/styles.xml')
  const stylesXml = stylesEntry ? await stylesEntry.async('string') : null

  // --- Parse ---
  const sectPr = parseSectPr(documentXml)
  const styles = stylesXml ? parseStylesXml(stylesXml) : {
    fontFamily: null,
    fontSizePt: null,
    lineSpacing: null,
  }

  // --- Susun metadata dengan fallback ke default ---
  const metadata: DocxTemplateMetadata = {
    paper_size: {
      value: sectPr.paperSize ?? DEFAULTS.paper_size,
      detected: sectPr.paperSize !== null,
    },
    margin_left_cm: {
      value: sectPr.marginLeftCm ?? DEFAULTS.margin_left_cm,
      detected: sectPr.marginLeftCm !== null,
    },
    margin_right_cm: {
      value: sectPr.marginRightCm ?? DEFAULTS.margin_right_cm,
      detected: sectPr.marginRightCm !== null,
    },
    margin_top_cm: {
      value: sectPr.marginTopCm ?? DEFAULTS.margin_top_cm,
      detected: sectPr.marginTopCm !== null,
    },
    margin_bottom_cm: {
      value: sectPr.marginBottomCm ?? DEFAULTS.margin_bottom_cm,
      detected: sectPr.marginBottomCm !== null,
    },
    font_family: {
      value: styles.fontFamily ?? DEFAULTS.font_family,
      detected: styles.fontFamily !== null,
    },
    font_size: {
      value: styles.fontSizePt ?? DEFAULTS.font_size,
      detected: styles.fontSizePt !== null,
    },
    line_spacing: {
      value: styles.lineSpacing ?? DEFAULTS.line_spacing,
      detected: styles.lineSpacing !== null,
    },
    // Field berikut tidak bisa dibaca dari properti dasar .docx
    page_number_position: {
      value: DEFAULTS.page_number_position,
      detected: false,
    },
    front_matter_numbering: {
      value: DEFAULTS.front_matter_numbering,
      detected: false,
    },
    main_body_numbering: {
      value: DEFAULTS.main_body_numbering,
      detected: false,
    },
    chapter_title_case: {
      value: DEFAULTS.chapter_title_case,
      detected: false,
    },
    chapter_title_align: {
      value: DEFAULTS.chapter_title_align,
      detected: false,
    },
    chapter_number_format: {
      value: DEFAULTS.chapter_number_format,
      detected: false,
    },
    subchapter_number_format: {
      value: DEFAULTS.subchapter_number_format,
      detected: false,
    },
  }

  // Kumpulkan daftar field yang tidak terdeteksi
  const missing_fields = (
    Object.entries(metadata) as [string, ExtractedField<unknown>][]
  )
    .filter(([, field]) => !field.detected)
    .map(([key]) => key)

  return { ok: true, metadata, missing_fields }
}
