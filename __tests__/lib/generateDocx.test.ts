/**
 * __tests__/lib/generateDocx.test.ts
 *
 * Unit tests untuk lib/generateDocx.ts (Spec F1, F2, F3)
 * Mencakup:
 *   - generateDocx mengembalikan Buffer non-kosong
 *   - Output valid sebagai ZIP (magic bytes PK)
 *   - Berbagai kombinasi rules tidak menyebabkan error
 *   - ChapterContent 'lorem' dan 'empty' keduanya berhasil
 *   - Nilai ekstream/edge (margin 0, font_size kecil) ditangani
 */

import { generateDocx } from '@/lib/generateDocx'
import type { DocFormatRules } from '@/lib/generateDocx'

// ---------------------------------------------------------------------------
// Default rules yang valid
// ---------------------------------------------------------------------------

function makeDefaultRules(overrides: Partial<DocFormatRules> = {}): DocFormatRules {
  return {
    paper_size: 'A4',
    margin_left_cm: 4,
    margin_right_cm: 3,
    margin_top_cm: 4,
    margin_bottom_cm: 3,
    font_family: 'Times New Roman',
    font_size: 12,
    line_spacing: 2,
    font_color: 'black',
    chapter_title_case: 'uppercase',
    chapter_title_align: 'center',
    chapter_number_format: 'roman',
    subchapter_number_format: 'decimal',
    page_number_position: 'bottom-center',
    front_matter_numbering: 'lowercase-roman',
    main_body_numbering: 'arabic',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Output dasar
// ---------------------------------------------------------------------------

describe('generateDocx — output dasar', () => {
  test('mengembalikan Buffer (non-null, non-undefined)', async () => {
    const buf = await generateDocx(makeDefaultRules())
    expect(buf).toBeTruthy()
    expect(buf).toBeInstanceOf(Buffer)
  })

  test('Buffer memiliki ukuran > 0', async () => {
    const buf = await generateDocx(makeDefaultRules())
    expect(buf.length).toBeGreaterThan(0)
  })

  test('Buffer dimulai dengan magic bytes ZIP (PK = 0x50 0x4b)', async () => {
    const buf = await generateDocx(makeDefaultRules())
    // DOCX adalah ZIP, magic bytes: PK\x03\x04
    expect(buf[0]).toBe(0x50) // P
    expect(buf[1]).toBe(0x4b) // K
  })

  test('output "lorem" menghasilkan file lebih besar dari "empty"', async () => {
    const loremBuf = await generateDocx(makeDefaultRules(), 'lorem')
    const emptyBuf = await generateDocx(makeDefaultRules(), 'empty')
    expect(loremBuf.length).toBeGreaterThan(emptyBuf.length)
  })
})

// ---------------------------------------------------------------------------
// Variasi ChapterContent
// ---------------------------------------------------------------------------

describe('generateDocx — ChapterContent', () => {
  test('"lorem" berhasil tanpa error', async () => {
    await expect(generateDocx(makeDefaultRules(), 'lorem')).resolves.toBeInstanceOf(Buffer)
  })

  test('"empty" berhasil tanpa error', async () => {
    await expect(generateDocx(makeDefaultRules(), 'empty')).resolves.toBeInstanceOf(Buffer)
  })

  test('default content (tidak diberikan) berhasil', async () => {
    await expect(generateDocx(makeDefaultRules())).resolves.toBeInstanceOf(Buffer)
  })
})

// ---------------------------------------------------------------------------
// Variasi paper_size
// ---------------------------------------------------------------------------

describe('generateDocx — paper_size', () => {
  const sizes: Array<DocFormatRules['paper_size']> = ['A4', 'Letter', 'Legal']

  for (const size of sizes) {
    test(`paper_size "${size}" berhasil`, async () => {
      await expect(generateDocx(makeDefaultRules({ paper_size: size }))).resolves.toBeInstanceOf(Buffer)
    })
  }

  test('paper_size tidak dikenal fallback ke A4', async () => {
    await expect(generateDocx(makeDefaultRules({ paper_size: 'B5' }))).resolves.toBeInstanceOf(Buffer)
  })
})

// ---------------------------------------------------------------------------
// Variasi font settings
// ---------------------------------------------------------------------------

describe('generateDocx — font settings', () => {
  const fonts = ['Times New Roman', 'Arial', 'Calibri', 'Georgia']

  for (const font of fonts) {
    test(`font_family "${font}" berhasil`, async () => {
      await expect(generateDocx(makeDefaultRules({ font_family: font }))).resolves.toBeInstanceOf(Buffer)
    })
  }

  test('font_size minimum (8pt) berhasil', async () => {
    await expect(generateDocx(makeDefaultRules({ font_size: 8 }))).resolves.toBeInstanceOf(Buffer)
  })

  test('font_size maksimum (24pt) berhasil', async () => {
    await expect(generateDocx(makeDefaultRules({ font_size: 24 }))).resolves.toBeInstanceOf(Buffer)
  })
})

// ---------------------------------------------------------------------------
// Variasi font_color
// ---------------------------------------------------------------------------

describe('generateDocx — font_color', () => {
  const colors = ['black', 'white', 'red', 'blue', 'green']

  for (const color of colors) {
    test(`font_color "${color}" berhasil`, async () => {
      await expect(generateDocx(makeDefaultRules({ font_color: color }))).resolves.toBeInstanceOf(Buffer)
    })
  }

  test('font_color hex langsung (000000) berhasil', async () => {
    await expect(generateDocx(makeDefaultRules({ font_color: '000000' }))).resolves.toBeInstanceOf(Buffer)
  })

  test('font_color tidak dikenal fallback ke hitam (000000)', async () => {
    // Tidak boleh throw
    await expect(generateDocx(makeDefaultRules({ font_color: 'invalid-color' }))).resolves.toBeInstanceOf(Buffer)
  })
})

// ---------------------------------------------------------------------------
// Variasi page number position
// ---------------------------------------------------------------------------

describe('generateDocx — page_number_position', () => {
  const positions = [
    'bottom-center', 'bottom-right', 'bottom-left',
    'top-center', 'top-right', 'top-left',
  ]

  for (const pos of positions) {
    test(`position "${pos}" berhasil`, async () => {
      await expect(generateDocx(makeDefaultRules({ page_number_position: pos }))).resolves.toBeInstanceOf(Buffer)
    })
  }
})

// ---------------------------------------------------------------------------
// Variasi numbering format
// ---------------------------------------------------------------------------

describe('generateDocx — numbering formats', () => {
  test('front_matter_numbering lowercase-roman berhasil', async () => {
    await expect(generateDocx(makeDefaultRules({ front_matter_numbering: 'lowercase-roman' }))).resolves.toBeInstanceOf(Buffer)
  })

  test('front_matter_numbering uppercase-roman berhasil', async () => {
    await expect(generateDocx(makeDefaultRules({ front_matter_numbering: 'uppercase-roman' }))).resolves.toBeInstanceOf(Buffer)
  })

  test('main_body_numbering arabic berhasil', async () => {
    await expect(generateDocx(makeDefaultRules({ main_body_numbering: 'arabic' }))).resolves.toBeInstanceOf(Buffer)
  })

  test('chapter_number_format "none" berhasil', async () => {
    await expect(generateDocx(makeDefaultRules({ chapter_number_format: 'none' }))).resolves.toBeInstanceOf(Buffer)
  })

  test('subchapter_number_format "none" berhasil', async () => {
    await expect(generateDocx(makeDefaultRules({ subchapter_number_format: 'none' }))).resolves.toBeInstanceOf(Buffer)
  })
})

// ---------------------------------------------------------------------------
// Variasi chapter title settings
// ---------------------------------------------------------------------------

describe('generateDocx — chapter title settings', () => {
  const cases = ['uppercase', 'capitalize', 'normal']
  const aligns = ['left', 'center', 'right', 'justify']

  for (const c of cases) {
    test(`chapter_title_case "${c}" berhasil`, async () => {
      await expect(generateDocx(makeDefaultRules({ chapter_title_case: c }))).resolves.toBeInstanceOf(Buffer)
    })
  }

  for (const a of aligns) {
    test(`chapter_title_align "${a}" berhasil`, async () => {
      await expect(generateDocx(makeDefaultRules({ chapter_title_align: a }))).resolves.toBeInstanceOf(Buffer)
    })
  }
})

// ---------------------------------------------------------------------------
// Edge cases / nilai ekstrem
// ---------------------------------------------------------------------------

describe('generateDocx — edge cases', () => {
  test('semua margin = 0 berhasil', async () => {
    await expect(generateDocx(makeDefaultRules({
      margin_left_cm: 0,
      margin_right_cm: 0,
      margin_top_cm: 0,
      margin_bottom_cm: 0,
    }))).resolves.toBeInstanceOf(Buffer)
  })

  test('margin maksimum (10 cm) berhasil', async () => {
    await expect(generateDocx(makeDefaultRules({
      margin_left_cm: 10,
      margin_right_cm: 10,
      margin_top_cm: 10,
      margin_bottom_cm: 10,
    }))).resolves.toBeInstanceOf(Buffer)
  })

  test('line_spacing = 1 berhasil', async () => {
    await expect(generateDocx(makeDefaultRules({ line_spacing: 1 }))).resolves.toBeInstanceOf(Buffer)
  })

  test('line_spacing = 3 berhasil', async () => {
    await expect(generateDocx(makeDefaultRules({ line_spacing: 3 }))).resolves.toBeInstanceOf(Buffer)
  })
})
