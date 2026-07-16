/**
 * lib/generateDocx.ts
 *
 * Spec F1 — Generator dasar (margin, font, kertas).
 * Spec F2 — Section break & penomoran halaman.
 * Spec F3 — Isi bab lorem ipsum / kosong sesuai pilihan user.
 * PRD v6, Bagian 3.1, 3.4.
 *
 * Membuat file .docx dari aturan format yang sudah dikonfirmasi pengguna di halaman Review.
 *
 * Spec F2 menambahkan:
 *   - Bagian awal (front matter): halaman judul / kata pengantar / daftar isi.
 *     Penomoran dengan format front_matter_numbering (romawi kecil/besar), dimulai dari 1.
 *   - Section break NEXT_PAGE antara bagian awal dan bagian utama.
 *   - Bagian utama (main body): BAB I–VI.
 *     Penomoran dengan format main_body_numbering (arab/romawi), dimulai dari 1.
 *   - Nomor halaman di posisi sesuai page_number_position.
 *   - Judul bab dengan chapter_title_case / chapter_title_align / chapter_number_format.
 *
 * Unit konversi:
 *   Word (OOXML) menggunakan twips untuk margin.
 *   1 cm = 567 twips  (1 cm ≈ 28.35 pt × 20 = 567)
 *   Font size dalam halfpoints: 12 pt → size: 24
 *   Line spacing dalam "lines × 240" untuk LineRuleType.AUTO:
 *     spasi 1 = 240, spasi 1.5 = 360, spasi 2 = 480
 */

import {
  Document,
  Footer,
  Header,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  LineRuleType,
  NumberFormat,
  PageNumber,
  SectionType,
} from 'docx'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Subset dari skema PRD Bagian 3.4 yang relevan untuk generator ini.
 * F2 menambahkan: page_number_position, front_matter_numbering, main_body_numbering.
 * Field ke-16: font_color — warna tinta (default "000000" = hitam).
 */
export interface DocFormatRules {
  paper_size: string                 // 'A4' | 'Letter' | 'Legal'
  margin_left_cm: number
  margin_right_cm: number
  margin_top_cm: number
  margin_bottom_cm: number
  font_family: string                // e.g. 'Times New Roman'
  font_size: number                  // dalam pt
  line_spacing: number               // faktor: 1, 1.5, 2, dll.
  /**
   * Warna tinta teks dalam format hex OOXML 6-digit (tanpa '#').
   * Default: '000000' (hitam). Sesuai Pedoman TA FTI UNISBANK Bab V:
   * "Warna tinta hitam".
   */
  font_color: string
  chapter_title_case: string         // 'uppercase' | 'capitalize' | 'normal'
  chapter_title_align: string        // 'left' | 'center' | 'right' | 'justify'
  chapter_number_format: string      // 'roman' | 'arabic' | 'none'
  subchapter_number_format: string   // 'decimal' | 'roman' | 'arabic' | 'none'
  // Spec F2 fields:
  page_number_position: string       // 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left'
  front_matter_numbering: string     // 'lowercase-roman' | 'uppercase-roman' | 'arabic'
  main_body_numbering: string        // 'lowercase-roman' | 'uppercase-roman' | 'arabic'
}

export type ChapterContent = 'lorem' | 'empty'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 1 cm dalam twips. */
const CM_TO_TWIPS = 567

/** Ukuran kertas dalam twips: A4, Letter, Legal. */
const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  A4:     { width: 11906, height: 16838 },
  Letter: { width: 12240, height: 15840 },
  Legal:  { width: 12240, height: 20160 },
}

/** Halaman generik bagian awal (front matter). */
const FRONT_MATTER_PAGES = [
  'HALAMAN JUDUL',
  'HALAMAN PERSETUJUAN',
  'HALAMAN PENGESAHAN',
  'KATA PENGANTAR',
  'DAFTAR ISI',
  'DAFTAR GAMBAR',
  'DAFTAR TABEL',
  'ABSTRAK',
]

/** Bab generik BAB I–VI (PRD Bagian 3.3). */
const CHAPTER_TITLES = [
  'PENDAHULUAN',
  'TINJAUAN PUSTAKA',
  'METODOLOGI PENELITIAN',
  'HASIL DAN PEMBAHASAN',
  'IMPLEMENTASI DAN PENGUJIAN',
  'PENUTUP',
]

const SUBCHAPTER_NAMES = ['Latar Belakang', 'Rumusan Masalah', 'Tujuan Penelitian']

const LOREM_PARAGRAPH =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor ' +
  'incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud ' +
  'exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure ' +
  'dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.'

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

// ---------------------------------------------------------------------------
// Helper: konversi cm ke twips
// ---------------------------------------------------------------------------

function cmToTwips(cm: number): number {
  const clamped = Math.max(0, Math.min(cm, 10))
  return Math.round(clamped * CM_TO_TWIPS)
}

// ---------------------------------------------------------------------------
// Helper: NumberFormat dari string numbering setting
// ---------------------------------------------------------------------------

function resolveNumberFormat(
  setting: string,
): (typeof NumberFormat)[keyof typeof NumberFormat] {
  switch (setting) {
    case 'uppercase-roman': return NumberFormat.UPPER_ROMAN
    case 'lowercase-roman': return NumberFormat.LOWER_ROMAN
    case 'arabic':
    default:               return NumberFormat.DECIMAL
  }
}

// ---------------------------------------------------------------------------
// Helper: AlignmentType dari string
// ---------------------------------------------------------------------------

function resolveAlignment(
  align: string,
): (typeof AlignmentType)[keyof typeof AlignmentType] {
  switch (align) {
    case 'center':  return AlignmentType.CENTER
    case 'right':   return AlignmentType.RIGHT
    case 'justify': return AlignmentType.BOTH
    case 'left':
    default:        return AlignmentType.LEFT
  }
}

// ---------------------------------------------------------------------------
// Helper: posisi nomor halaman (atas/bawah, kiri/tengah/kanan)
// ---------------------------------------------------------------------------

function isTopPosition(pos: string): boolean {
  return pos.startsWith('top')
}

function resolveFooterAlignment(
  pos: string,
): (typeof AlignmentType)[keyof typeof AlignmentType] {
  if (pos.endsWith('-right'))  return AlignmentType.RIGHT
  if (pos.endsWith('-left'))   return AlignmentType.LEFT
  return AlignmentType.CENTER
}

// ---------------------------------------------------------------------------
// Helper: judul bab sesuai chapter_title_case
// ---------------------------------------------------------------------------

function applyTitleCase(text: string, titleCase: string): string {
  switch (titleCase) {
    case 'uppercase':
      return text.toUpperCase()
    case 'capitalize':
      return text.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    case 'normal':
    default:
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
  }
}

// ---------------------------------------------------------------------------
// Helper: nomor bab
// ---------------------------------------------------------------------------

function formatChapterNumber(index: number, format: string): string {
  const n = index + 1
  switch (format) {
    case 'roman':  return ROMAN_NUMERALS[index] ?? String(n)
    case 'arabic': return String(n)
    case 'none':
    default:       return ''
  }
}

// ---------------------------------------------------------------------------
// Helper: nomor sub-bab
// ---------------------------------------------------------------------------

function formatSubchapterNumber(
  chapterIndex: number,
  subIndex: number,
  format: string,
): string {
  const cn = chapterIndex + 1
  const sn = subIndex + 1
  switch (format) {
    case 'decimal': return `${cn}.${sn}`
    case 'arabic':  return String(sn)
    case 'roman':   return ROMAN_NUMERALS[subIndex] ?? String(sn)
    case 'none':
    default:        return ''
  }
}

// ---------------------------------------------------------------------------
// Helper: spacing object
// ---------------------------------------------------------------------------

function resolveSpacing(lineSpacing: number, fontSizePt: number) {
  const safeFactor = isNaN(lineSpacing) || lineSpacing <= 0 ? 2 : lineSpacing
  return {
    after: Math.round(fontSizePt * 20 * 0.5),
    line: Math.round(safeFactor * 240),
    lineRule: LineRuleType.AUTO,
  }
}

// ---------------------------------------------------------------------------
// Paragraph defaults type
// ---------------------------------------------------------------------------

interface ParagraphDefaults {
  fontFamily: string
  fontSizeHalfPt: number
  spacing: ReturnType<typeof resolveSpacing>
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType]
  /**
   * Warna teks dalam format hex OOXML 6-digit (tanpa '#').
   * Default: '000000' (hitam). Wajib di-set eksplisit pada setiap TextRun
   * untuk mencegah style Heading Word yang defaultnya biru.
   */
  fontColor: string
}

// ---------------------------------------------------------------------------
// Paragraph builders
// ---------------------------------------------------------------------------

function makeBodyParagraph(text: string, opts: ParagraphDefaults): Paragraph {
  return new Paragraph({
    spacing: opts.spacing,
    alignment: opts.alignment,
    children: [
      new TextRun({ text, font: opts.fontFamily, size: opts.fontSizeHalfPt, color: opts.fontColor }),
    ],
  })
}

function makeChapterHeading(label: string, opts: ParagraphDefaults): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { ...opts.spacing, before: Math.round(opts.fontSizeHalfPt * 20) },
    alignment: opts.alignment,
    children: [
      new TextRun({
        text: label,
        font: opts.fontFamily,
        size: Math.round(opts.fontSizeHalfPt * 1.2),
        bold: true,
        // Eksplisit override warna — Word default Heading 1 style = biru (#2E74B5)
        color: opts.fontColor,
      }),
    ],
  })
}

function makeSubchapterHeading(label: string, opts: ParagraphDefaults): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { ...opts.spacing, before: Math.round(opts.fontSizeHalfPt * 10) },
    alignment: AlignmentType.LEFT,
    children: [
      new TextRun({
        text: label,
        font: opts.fontFamily,
        size: opts.fontSizeHalfPt,
        bold: true,
        // Eksplisit override warna — Word default Heading 2 style = biru (#2E74B5)
        color: opts.fontColor,
      }),
    ],
  })
}

function makeEmptyParagraph(opts: ParagraphDefaults): Paragraph {
  return new Paragraph({
    spacing: opts.spacing,
    children: [new TextRun({ text: '', font: opts.fontFamily, size: opts.fontSizeHalfPt, color: opts.fontColor })],
  })
}

// ---------------------------------------------------------------------------
// Build front matter section children
// ---------------------------------------------------------------------------

function buildFrontMatterChildren(
  rules: DocFormatRules,
  content: ChapterContent,
  defaults: ParagraphDefaults,
): Paragraph[] {
  const children: Paragraph[] = []
  const titleAlignment = resolveAlignment(rules.chapter_title_align)

  FRONT_MATTER_PAGES.forEach((pageName, idx) => {
    // Page heading
    const label = applyTitleCase(pageName, rules.chapter_title_case)
    children.push(
      new Paragraph({
        spacing: { ...defaults.spacing, before: Math.round(defaults.fontSizeHalfPt * 20) },
        alignment: titleAlignment,
        children: [
          new TextRun({
            text: label,
            font: defaults.fontFamily,
            size: Math.round(defaults.fontSizeHalfPt * 1.2),
            bold: true,
            // Eksplisit override warna agar tidak mengambil default theme Word
            color: defaults.fontColor,
          }),
        ],
      }),
    )
    children.push(makeEmptyParagraph(defaults))

    if (content === 'lorem') {
      children.push(makeBodyParagraph(LOREM_PARAGRAPH, defaults))
      children.push(makeEmptyParagraph(defaults))
    } else {
      children.push(makeEmptyParagraph(defaults))
    }

    // Page break after each front matter page except the last
    if (idx < FRONT_MATTER_PAGES.length - 1) {
      children.push(new Paragraph({ pageBreakBefore: true, children: [] }))
    }
  })

  return children
}

// ---------------------------------------------------------------------------
// Build main body section children (BAB I–VI)
// ---------------------------------------------------------------------------

function buildMainBodyChildren(
  rules: DocFormatRules,
  content: ChapterContent,
  defaults: ParagraphDefaults,
): Paragraph[] {
  const children: Paragraph[] = []
  const titleAlignment = resolveAlignment(rules.chapter_title_align)

  CHAPTER_TITLES.forEach((title, i) => {
    // Chapter heading
    const chapNum = formatChapterNumber(i, rules.chapter_number_format)
    const chapTitle = CHAPTER_TITLES[i]
    const chapLabel = chapNum
      ? applyTitleCase(`BAB ${chapNum} ${chapTitle}`, rules.chapter_title_case)
      : applyTitleCase(chapTitle, rules.chapter_title_case)

    children.push(
      makeChapterHeading(chapLabel, { ...defaults, alignment: titleAlignment }),
    )
    children.push(makeEmptyParagraph(defaults))

    // Sub-chapters
    for (let si = 0; si < 3; si++) {
      const subNum = formatSubchapterNumber(i, si, rules.subchapter_number_format)
      const subName = SUBCHAPTER_NAMES[si] ?? `Sub-bab ${si + 1}`
      const subLabel = subNum ? `${subNum} ${subName}` : subName

      children.push(makeSubchapterHeading(subLabel, defaults))
      children.push(makeEmptyParagraph(defaults))

      if (content === 'lorem') {
        children.push(makeBodyParagraph(LOREM_PARAGRAPH, defaults))
        children.push(makeEmptyParagraph(defaults))
        children.push(makeBodyParagraph(LOREM_PARAGRAPH, defaults))
        children.push(makeEmptyParagraph(defaults))
      } else {
        children.push(makeEmptyParagraph(defaults))
      }
    }

    // Page break between chapters (not after the last)
    if (i < CHAPTER_TITLES.length - 1) {
      children.push(new Paragraph({ pageBreakBefore: true, children: [] }))
    }
  })

  return children
}

// ---------------------------------------------------------------------------
// Build footer paragraph with page number field
// ---------------------------------------------------------------------------

/**
 * Buat Footer/Header object dengan nomor halaman di posisi yang ditentukan.
 * docx v9: Footer/Header menerima { children: Paragraph[] }.
 */
function makePageNumberFooter(
  position: string,
  fontFamily: string,
  fontSizeHalfPt: number,
  fontColor: string,
): Footer {
  const alignment = resolveFooterAlignment(position)
  return new Footer({
    children: [
      new Paragraph({
        alignment,
        children: [
          new TextRun({
            children: [PageNumber.CURRENT],
            font: fontFamily,
            size: fontSizeHalfPt,
            color: fontColor,
          }),
        ],
      }),
    ],
  })
}

function makePageNumberHeader(
  position: string,
  fontFamily: string,
  fontSizeHalfPt: number,
  fontColor: string,
): Header {
  const alignment = resolveFooterAlignment(position)
  return new Header({
    children: [
      new Paragraph({
        alignment,
        children: [
          new TextRun({
            children: [PageNumber.CURRENT],
            font: fontFamily,
            size: fontSizeHalfPt,
            color: fontColor,
          }),
        ],
      }),
    ],
  })
}

// ---------------------------------------------------------------------------
// Main: generateDocx
// ---------------------------------------------------------------------------

/**
 * Buat Buffer .docx dari aturan format yang dikonfirmasi pengguna.
 *
 * Spec F2: dokumen dibagi 2 section:
 *   Section 1 — Bagian awal (front matter): penomoran sesuai front_matter_numbering,
 *               dimulai dari 1.
 *   Section 2 — Bagian utama (main body): penomoran sesuai main_body_numbering,
 *               dimulai dari 1, diawali section break NEXT_PAGE.
 *
 * @param rules    Aturan format hasil review (dari ReviewPage).
 * @param content  'lorem' untuk isi lorem ipsum, 'empty' untuk hanya struktur.
 * @returns        Buffer berisi file .docx siap download.
 */
export async function generateDocx(
  rules: DocFormatRules,
  content: ChapterContent = 'lorem',
): Promise<Buffer> {
  // ── Unit conversions ──────────────────────────────────────────────────

  const pageSize = PAGE_SIZES[rules.paper_size] ?? PAGE_SIZES['A4']

  const marginTop    = cmToTwips(rules.margin_top_cm)
  const marginRight  = cmToTwips(rules.margin_right_cm)
  const marginBottom = cmToTwips(rules.margin_bottom_cm)
  const marginLeft   = cmToTwips(rules.margin_left_cm)

  // Font size pt → halfpoints
  const safeFontSize = isNaN(rules.font_size) || rules.font_size <= 0 ? 12 : rules.font_size
  const fontSizeHalfPt = Math.round(safeFontSize * 2)

  const spacing = resolveSpacing(rules.line_spacing, safeFontSize)
  const fontFamily = rules.font_family || 'Times New Roman'

  // Resolve font_color: nama warna → hex OOXML.
  // Default '000000' (hitam) sesuai Pedoman TA FTI UNISBANK Bab V.
  const COLOR_NAME_TO_HEX: Record<string, string> = {
    black: '000000',
    white: 'FFFFFF',
    red:   'FF0000',
    blue:  '0000FF',
    green: '008000',
  }
  const rawColor = (rules.font_color ?? 'black').toLowerCase().trim()
  // Terima nama warna ATAU hex 6-digit langsung (tanpa '#')
  const fontColor =
    COLOR_NAME_TO_HEX[rawColor] ??
    (/^[0-9a-f]{6}$/i.test(rawColor) ? rawColor.toUpperCase() : '000000')

  const defaults: ParagraphDefaults = {
    fontFamily,
    fontSizeHalfPt,
    spacing,
    alignment: AlignmentType.LEFT,
    fontColor,
  }

  // ── Shared page properties ────────────────────────────────────────────

  const sharedPage = {
    size: { width: pageSize.width, height: pageSize.height },
    margin: { top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft },
  }

  // ── Numbering formats ─────────────────────────────────────────────────

  const frontNumberFormat = resolveNumberFormat(rules.front_matter_numbering ?? 'lowercase-roman')
  const mainNumberFormat  = resolveNumberFormat(rules.main_body_numbering  ?? 'arabic')

  const pageNumPos = rules.page_number_position ?? 'bottom-center'
  const isTop = isTopPosition(pageNumPos)

  // ── Section 1: Front matter ───────────────────────────────────────────

  const frontFooter = !isTop ? makePageNumberFooter(pageNumPos, fontFamily, fontSizeHalfPt, fontColor) : undefined
  const frontHeader = isTop  ? makePageNumberHeader(pageNumPos, fontFamily, fontSizeHalfPt, fontColor) : undefined

  const frontChildren = buildFrontMatterChildren(rules, content, defaults)

  const frontSection = {
    properties: {
      page: {
        ...sharedPage,
        pageNumbers: {
          start: 1,
          formatType: frontNumberFormat,
        },
      },
      // No 'type' on first section — it's implicit start of document
    },
    ...(frontHeader ? { headers: { default: frontHeader } } : {}),
    ...(frontFooter ? { footers: { default: frontFooter } } : {}),
    children: frontChildren,
  }

  // ── Section 2: Main body ──────────────────────────────────────────────

  const mainFooter = !isTop ? makePageNumberFooter(pageNumPos, fontFamily, fontSizeHalfPt, fontColor) : undefined
  const mainHeader = isTop  ? makePageNumberHeader(pageNumPos, fontFamily, fontSizeHalfPt, fontColor) : undefined

  const mainChildren = buildMainBodyChildren(rules, content, defaults)

  const mainSection = {
    properties: {
      type: SectionType.NEXT_PAGE, // section break antara bagian awal & utama
      page: {
        ...sharedPage,
        pageNumbers: {
          start: 1,
          formatType: mainNumberFormat,
        },
      },
    },
    ...(mainHeader ? { headers: { default: mainHeader } } : {}),
    ...(mainFooter ? { footers: { default: mainFooter } } : {}),
    children: mainChildren,
  }

  // ── Assemble Document ─────────────────────────────────────────────────

  const doc = new Document({
    sections: [frontSection, mainSection],
  })

  return Packer.toBuffer(doc)
}
