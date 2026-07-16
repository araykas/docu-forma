/**
 * __tests__/lib/validateExtraction.test.ts
 *
 * Unit tests untuk lib/validateExtraction.ts (Spec D4)
 * Mencakup:
 *   - Koreksi mismatch value vs source_quote untuk 6 field enum
 *   - Field yang sudah konsisten tidak diubah
 *   - Field tanpa source_quote tidak divalidasi
 *   - Field detected:false dilewati
 *   - Hitungan koreksi (corrections counter)
 */

import { validateAndCorrectExtraction } from '@/lib/validateExtraction'
import type { GeminiExtractionResult } from '@/lib/callGemini'

// ---------------------------------------------------------------------------
// Helper: buat result minimal yang valid
// ---------------------------------------------------------------------------

function makeResult(overrides: Partial<GeminiExtractionResult['rules']> = {}): GeminiExtractionResult {
  const defaultField = { value: null, detected: false, source_quote: null }
  return {
    is_relevant: true,
    confidence_note: 'test',
    missing_fields: [],
    rules: {
      paper_size:              { ...defaultField },
      margin_left_cm:          { ...defaultField },
      margin_right_cm:         { ...defaultField },
      margin_top_cm:           { ...defaultField },
      margin_bottom_cm:        { ...defaultField },
      font_family:             { ...defaultField },
      font_size:               { ...defaultField },
      line_spacing:            { ...defaultField },
      font_color:              { ...defaultField },
      page_number_position:    { ...defaultField },
      front_matter_numbering:  { ...defaultField },
      main_body_numbering:     { ...defaultField },
      chapter_title_case:      { ...defaultField },
      chapter_title_align:     { ...defaultField },
      chapter_number_format:   { ...defaultField },
      subchapter_number_format:{ ...defaultField },
      ...overrides,
    },
  }
}

// ---------------------------------------------------------------------------
// front_matter_numbering
// ---------------------------------------------------------------------------

describe('validateAndCorrectExtraction — front_matter_numbering', () => {
  test('koreksi: source_quote "romawi kecil" tapi value salah "arabic"', () => {
    const result = makeResult({
      front_matter_numbering: {
        value: 'arabic',
        detected: true,
        source_quote: 'penomoran bagian awal memakai angka romawi kecil (i, ii, iii)',
      },
    })
    const { result: corrected, corrections } = validateAndCorrectExtraction(result)
    expect(corrected.rules.front_matter_numbering.value).toBe('lowercase-roman')
    expect(corrections).toBe(1)
  })

  test('konsisten: source_quote "romawi kecil" dan value "lowercase-roman" → tidak diubah', () => {
    const result = makeResult({
      front_matter_numbering: {
        value: 'lowercase-roman',
        detected: true,
        source_quote: 'menggunakan huruf romawi kecil i, ii, iii',
      },
    })
    const { result: corrected, corrections } = validateAndCorrectExtraction(result)
    expect(corrected.rules.front_matter_numbering.value).toBe('lowercase-roman')
    expect(corrections).toBe(0)
  })

  test('koreksi: source_quote "angka arab" tapi value "lowercase-roman"', () => {
    const result = makeResult({
      front_matter_numbering: {
        value: 'lowercase-roman',
        detected: true,
        source_quote: 'nomor halaman menggunakan angka arab 1, 2, 3',
      },
    })
    const { result: corrected, corrections } = validateAndCorrectExtraction(result)
    expect(corrected.rules.front_matter_numbering.value).toBe('arabic')
    expect(corrections).toBe(1)
  })

  test('lewati: field detected:false — tidak ada koreksi', () => {
    const result = makeResult({
      front_matter_numbering: {
        value: 'arabic',  // nilai salah tapi tidak relevan karena detected:false
        detected: false,
        source_quote: null,
      },
    })
    const { corrections } = validateAndCorrectExtraction(result)
    expect(corrections).toBe(0)
  })

  test('lewati: source_quote null — tidak bisa memvalidasi', () => {
    const result = makeResult({
      front_matter_numbering: {
        value: 'arabic',
        detected: true,
        source_quote: null,
      },
    })
    const { corrections } = validateAndCorrectExtraction(result)
    expect(corrections).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// main_body_numbering
// ---------------------------------------------------------------------------

describe('validateAndCorrectExtraction — main_body_numbering', () => {
  test('koreksi: quote "angka Arab" tapi value "lowercase-roman" (bug klasik)', () => {
    const result = makeResult({
      main_body_numbering: {
        value: 'lowercase-roman',
        detected: true,
        source_quote: 'nomor halaman bab dan sub bab menggunakan angka Arab',
      },
    })
    const { result: corrected, corrections } = validateAndCorrectExtraction(result)
    expect(corrected.rules.main_body_numbering.value).toBe('arabic')
    expect(corrections).toBe(1)
  })

  test('konsisten: quote "angka Arab" dan value "arabic" → tidak diubah', () => {
    const result = makeResult({
      main_body_numbering: {
        value: 'arabic',
        detected: true,
        source_quote: 'penomoran menggunakan angka Arab dimulai dari halaman 1',
      },
    })
    const { corrections } = validateAndCorrectExtraction(result)
    expect(corrections).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// chapter_number_format
// ---------------------------------------------------------------------------

describe('validateAndCorrectExtraction — chapter_number_format', () => {
  test('koreksi: quote "angka Romawi" tapi value "arabic"', () => {
    const result = makeResult({
      chapter_number_format: {
        value: 'arabic',
        detected: true,
        source_quote: 'nomor urut bab menggunakan angka Romawi (I, II, III)',
      },
    })
    const { result: corrected, corrections } = validateAndCorrectExtraction(result)
    expect(corrected.rules.chapter_number_format.value).toBe('roman')
    expect(corrections).toBe(1)
  })

  test('konsisten: quote "romawi" dan value "roman" → tidak diubah', () => {
    const result = makeResult({
      chapter_number_format: {
        value: 'roman',
        detected: true,
        source_quote: 'setiap bab diberi nomor romawi kapital',
      },
    })
    const { corrections } = validateAndCorrectExtraction(result)
    expect(corrections).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// subchapter_number_format
// ---------------------------------------------------------------------------

describe('validateAndCorrectExtraction — subchapter_number_format', () => {
  test('koreksi: quote "desimal" tapi value "arabic"', () => {
    const result = makeResult({
      subchapter_number_format: {
        value: 'arabic',
        detected: true,
        source_quote: 'sub bab menggunakan penomoran desimal seperti 1.1, 1.2, 2.1',
      },
    })
    const { result: corrected, corrections } = validateAndCorrectExtraction(result)
    expect(corrected.rules.subchapter_number_format.value).toBe('decimal')
    expect(corrections).toBe(1)
  })

  test('konsisten: quote "1.1" dan value "decimal" → tidak diubah', () => {
    const result = makeResult({
      subchapter_number_format: {
        value: 'decimal',
        detected: true,
        source_quote: 'penomoran sub bab menggunakan format 1.1, 2.1, dst',
      },
    })
    const { corrections } = validateAndCorrectExtraction(result)
    expect(corrections).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// chapter_title_case
// ---------------------------------------------------------------------------

describe('validateAndCorrectExtraction — chapter_title_case', () => {
  test('koreksi: quote "huruf kapital semua" tapi value "normal"', () => {
    const result = makeResult({
      chapter_title_case: {
        value: 'normal',
        detected: true,
        source_quote: 'judul bab ditulis dengan huruf kapital semua',
      },
    })
    const { result: corrected, corrections } = validateAndCorrectExtraction(result)
    expect(corrected.rules.chapter_title_case.value).toBe('uppercase')
    expect(corrections).toBe(1)
  })

  test('koreksi: quote "kapital tiap kata" tapi value "uppercase"', () => {
    const result = makeResult({
      chapter_title_case: {
        value: 'uppercase',
        detected: true,
        source_quote: 'penulisan judul menggunakan huruf kapital tiap kata',
      },
    })
    const { result: corrected, corrections } = validateAndCorrectExtraction(result)
    expect(corrected.rules.chapter_title_case.value).toBe('capitalize')
    expect(corrections).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// chapter_title_align
// ---------------------------------------------------------------------------

describe('validateAndCorrectExtraction — chapter_title_align', () => {
  test('koreksi: quote "tengah" tapi value "left"', () => {
    const result = makeResult({
      chapter_title_align: {
        value: 'left',
        detected: true,
        source_quote: 'judul bab diketik di tengah halaman',
      },
    })
    const { result: corrected, corrections } = validateAndCorrectExtraction(result)
    expect(corrected.rules.chapter_title_align.value).toBe('center')
    expect(corrections).toBe(1)
  })

  test('koreksi: quote "rata kiri-kanan" tapi value "center"', () => {
    const result = makeResult({
      chapter_title_align: {
        value: 'center',
        detected: true,
        source_quote: 'teks isi menggunakan perataan rata kiri-kanan (justify)',
      },
    })
    const { result: corrected, corrections } = validateAndCorrectExtraction(result)
    expect(corrected.rules.chapter_title_align.value).toBe('justify')
    expect(corrections).toBe(1)
  })

  test('konsisten: quote "tengah" dan value "center" → tidak diubah', () => {
    const result = makeResult({
      chapter_title_align: {
        value: 'center',
        detected: true,
        source_quote: 'judul bab diketik rata tengah halaman',
      },
    })
    const { corrections } = validateAndCorrectExtraction(result)
    expect(corrections).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Multi-field corrections
// ---------------------------------------------------------------------------

describe('validateAndCorrectExtraction — multiple fields', () => {
  test('koreksi beberapa field sekaligus — corrections count benar', () => {
    const result = makeResult({
      main_body_numbering: {
        value: 'lowercase-roman',  // salah
        detected: true,
        source_quote: 'halaman utama memakai angka arab 1, 2, 3',
      },
      chapter_title_case: {
        value: 'normal',  // salah
        detected: true,
        source_quote: 'penulisan judul bab menggunakan huruf besar semua',
      },
      chapter_title_align: {
        value: 'right',  // salah
        detected: true,
        source_quote: 'judul bab diketik di tengah halaman',
      },
    })
    const { corrections } = validateAndCorrectExtraction(result)
    expect(corrections).toBe(3)
  })

  test('tidak ada field yang salah — corrections = 0', () => {
    const result = makeResult({
      main_body_numbering: {
        value: 'arabic',
        detected: true,
        source_quote: 'menggunakan angka arab',
      },
      chapter_number_format: {
        value: 'roman',
        detected: true,
        source_quote: 'nomor bab menggunakan angka romawi',
      },
    })
    const { corrections } = validateAndCorrectExtraction(result)
    expect(corrections).toBe(0)
  })

  test('semua field detected:false — tidak ada koreksi', () => {
    const result = makeResult() // semua default dengan detected:false
    const { corrections } = validateAndCorrectExtraction(result)
    expect(corrections).toBe(0)
  })
})
