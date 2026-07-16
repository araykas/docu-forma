/**
 * __tests__/lib/extractionToGroups.test.ts
 *
 * Unit tests untuk lib/extractionToGroups.ts (Spec E4)
 * Mencakup:
 *   - Mapping detected:true → source 'ai_extraction' + nilai dari AI
 *   - Mapping detected:false → source 'default' + nilai default
 *   - source_quote diteruskan ke ReviewField
 *   - Struktur output: 4 grup dengan ID dan title yang benar
 *   - Semua 16 field ada di output
 *   - EXTRACTION_STORAGE_KEY terekspor
 */

import { extractionToGroups, EXTRACTION_STORAGE_KEY } from '@/lib/extractionToGroups'
import type { GeminiExtractionResult } from '@/lib/callGemini'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMinimalResult(): GeminiExtractionResult {
  const defaultField = { value: null, detected: false, source_quote: null }
  return {
    is_relevant: true,
    confidence_note: 'ok',
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
    },
  }
}

// ---------------------------------------------------------------------------
// Struktur output
// ---------------------------------------------------------------------------

describe('extractionToGroups — struktur output', () => {
  test('mengembalikan array 4 grup', () => {
    const result = makeMinimalResult()
    const groups = extractionToGroups(result)
    expect(groups).toHaveLength(4)
  })

  test('ID grup sesuai: kertas-margin, font-spasi, penomoran-halaman, judul-bab', () => {
    const result = makeMinimalResult()
    const groups = extractionToGroups(result)
    const ids = groups.map((g) => g.id)
    expect(ids).toEqual(['kertas-margin', 'font-spasi', 'penomoran-halaman', 'judul-bab'])
  })

  test('setiap grup memiliki title (string non-kosong)', () => {
    const result = makeMinimalResult()
    const groups = extractionToGroups(result)
    for (const group of groups) {
      expect(typeof group.title).toBe('string')
      expect(group.title.length).toBeGreaterThan(0)
    }
  })

  test('total semua field = 16', () => {
    const result = makeMinimalResult()
    const groups = extractionToGroups(result)
    const totalFields = groups.reduce((sum, g) => sum + g.fields.length, 0)
    expect(totalFields).toBe(16)
  })
})

// ---------------------------------------------------------------------------
// Mapping: detected:false → default
// ---------------------------------------------------------------------------

describe('extractionToGroups — detected:false → default', () => {
  test('semua field detected:false menghasilkan source "default"', () => {
    const result = makeMinimalResult() // semua false
    const groups = extractionToGroups(result)
    for (const group of groups) {
      for (const field of group.fields) {
        expect(field.source).toBe('default')
      }
    }
  })

  test('paper_size default = "A4"', () => {
    const result = makeMinimalResult()
    const groups = extractionToGroups(result)
    const paperField = groups[0].fields.find((f) => f.key === 'paper_size')
    expect(paperField?.value).toBe('A4')
    expect(paperField?.source).toBe('default')
  })

  test('font_family default = "Times New Roman"', () => {
    const result = makeMinimalResult()
    const groups = extractionToGroups(result)
    const fontField = groups[1].fields.find((f) => f.key === 'font_family')
    expect(fontField?.value).toBe('Times New Roman')
  })

  test('margin_left_cm default = "4"', () => {
    const result = makeMinimalResult()
    const groups = extractionToGroups(result)
    const field = groups[0].fields.find((f) => f.key === 'margin_left_cm')
    expect(field?.value).toBe('4')
  })

  test('front_matter_numbering default = "lowercase-roman"', () => {
    const result = makeMinimalResult()
    const groups = extractionToGroups(result)
    const field = groups[2].fields.find((f) => f.key === 'front_matter_numbering')
    expect(field?.value).toBe('lowercase-roman')
  })
})

// ---------------------------------------------------------------------------
// Mapping: detected:true → ai_extraction
// ---------------------------------------------------------------------------

describe('extractionToGroups — detected:true → ai_extraction', () => {
  test('field detected:true dengan source ai_extraction menghasilkan source "ai_extraction"', () => {
    const result = makeMinimalResult()
    result.rules.paper_size = {
      value: 'Letter',
      detected: true,
      source: 'ai_extraction',
      source_quote: 'Kertas berukuran Letter (8.5 × 11 inci)',
    }
    const groups = extractionToGroups(result)
    const field = groups[0].fields.find((f) => f.key === 'paper_size')
    expect(field?.value).toBe('Letter')
    expect(field?.source).toBe('ai_extraction')
  })

  test('nilai AI dipakai (bukan default) ketika detected:true', () => {
    const result = makeMinimalResult()
    result.rules.font_family = {
      value: 'Arial',
      detected: true,
      source: 'ai_extraction',
      source_quote: 'font yang digunakan adalah Arial',
    }
    const groups = extractionToGroups(result)
    const field = groups[1].fields.find((f) => f.key === 'font_family')
    expect(field?.value).toBe('Arial')
  })

  test('source_quote diteruskan ke ReviewField ketika ai_extraction', () => {
    const result = makeMinimalResult()
    const quote = 'margin kiri 4 cm dan atas 4 cm dari tepi kertas'
    result.rules.margin_left_cm = {
      value: 4,
      detected: true,
      source: 'ai_extraction',
      source_quote: quote,
    }
    const groups = extractionToGroups(result)
    const field = groups[0].fields.find((f) => f.key === 'margin_left_cm')
    expect(field?.source_quote).toBe(quote)
  })

  test('source_quote null tidak menyebabkan error', () => {
    const result = makeMinimalResult()
    result.rules.font_size = {
      value: 12,
      detected: true,
      source: 'ai_extraction',
      source_quote: null,
    }
    const groups = extractionToGroups(result)
    const field = groups[1].fields.find((f) => f.key === 'font_size')
    expect(field?.value).toBe('12')
    expect(field?.source).toBe('ai_extraction')
  })
})

// ---------------------------------------------------------------------------
// Mapping: docx_property_fallback
// ---------------------------------------------------------------------------

describe('extractionToGroups — docx_property_fallback', () => {
  test('source docx_property_fallback dipertahankan', () => {
    const result = makeMinimalResult()
    result.rules.margin_right_cm = {
      value: 2.5,
      detected: true,
      source: 'docx_property_fallback',
      source_quote: null,
    }
    const groups = extractionToGroups(result)
    const field = groups[0].fields.find((f) => f.key === 'margin_right_cm')
    expect(field?.source).toBe('docx_property_fallback')
    expect(field?.value).toBe('2.5')
  })
})

// ---------------------------------------------------------------------------
// EXTRACTION_STORAGE_KEY
// ---------------------------------------------------------------------------

describe('EXTRACTION_STORAGE_KEY', () => {
  test('terekspor sebagai string non-kosong', () => {
    expect(typeof EXTRACTION_STORAGE_KEY).toBe('string')
    expect(EXTRACTION_STORAGE_KEY.length).toBeGreaterThan(0)
  })
})
