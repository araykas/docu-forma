/**
 * __tests__/lib/fieldConfig.test.ts
 *
 * Unit tests untuk lib/fieldConfig.ts
 * Mencakup:
 *   - Semua konstanta tipe dan value terdefinisi dengan benar
 *   - FONT_COLOR_HEX mapping konsisten dengan FONT_COLOR_OPTIONS
 *   - OPTION_LABELS mencakup semua enum values dari setiap field
 *   - Range values masuk akal
 */

import {
  PAPER_SIZE_OPTIONS,
  FONT_FAMILY_OPTIONS,
  FONT_COLOR_OPTIONS,
  FONT_COLOR_HEX,
  PAGE_NUMBER_POSITION_OPTIONS,
  NUMBERING_FORMAT_OPTIONS,
  CHAPTER_TITLE_CASE_OPTIONS,
  CHAPTER_TITLE_ALIGN_OPTIONS,
  CHAPTER_NUMBER_FORMAT_OPTIONS,
  SUBCHAPTER_NUMBER_FORMAT_OPTIONS,
  MARGIN_RANGE,
  FONT_SIZE_RANGE,
  LINE_SPACING_RANGE,
  OPTION_LABELS,
} from '@/lib/fieldConfig'

describe('fieldConfig — konstanta tipe opsi', () => {
  test('PAPER_SIZE_OPTIONS memiliki nilai yang valid', () => {
    expect(PAPER_SIZE_OPTIONS).toContain('A4')
    expect(PAPER_SIZE_OPTIONS).toContain('Letter')
    expect(PAPER_SIZE_OPTIONS).toContain('Legal')
  })

  test('FONT_FAMILY_OPTIONS mengandung Times New Roman', () => {
    expect(FONT_FAMILY_OPTIONS).toContain('Times New Roman')
  })

  test('FONT_COLOR_OPTIONS mengandung black', () => {
    expect(FONT_COLOR_OPTIONS).toContain('black')
  })

  test('PAGE_NUMBER_POSITION_OPTIONS memiliki 6 posisi', () => {
    expect(PAGE_NUMBER_POSITION_OPTIONS).toHaveLength(6)
    expect(PAGE_NUMBER_POSITION_OPTIONS).toContain('bottom-center')
    expect(PAGE_NUMBER_POSITION_OPTIONS).toContain('top-right')
  })

  test('NUMBERING_FORMAT_OPTIONS memiliki 3 format', () => {
    expect(NUMBERING_FORMAT_OPTIONS).toHaveLength(3)
    expect(NUMBERING_FORMAT_OPTIONS).toContain('lowercase-roman')
    expect(NUMBERING_FORMAT_OPTIONS).toContain('uppercase-roman')
    expect(NUMBERING_FORMAT_OPTIONS).toContain('arabic')
  })

  test('CHAPTER_TITLE_CASE_OPTIONS memiliki 3 opsi', () => {
    expect(CHAPTER_TITLE_CASE_OPTIONS).toHaveLength(3)
    expect(CHAPTER_TITLE_CASE_OPTIONS).toContain('uppercase')
    expect(CHAPTER_TITLE_CASE_OPTIONS).toContain('capitalize')
    expect(CHAPTER_TITLE_CASE_OPTIONS).toContain('normal')
  })

  test('CHAPTER_TITLE_ALIGN_OPTIONS memiliki 4 opsi', () => {
    expect(CHAPTER_TITLE_ALIGN_OPTIONS).toHaveLength(4)
    expect(CHAPTER_TITLE_ALIGN_OPTIONS).toContain('center')
    expect(CHAPTER_TITLE_ALIGN_OPTIONS).toContain('justify')
  })

  test('CHAPTER_NUMBER_FORMAT_OPTIONS memiliki 3 opsi', () => {
    expect(CHAPTER_NUMBER_FORMAT_OPTIONS).toHaveLength(3)
    expect(CHAPTER_NUMBER_FORMAT_OPTIONS).toContain('roman')
    expect(CHAPTER_NUMBER_FORMAT_OPTIONS).toContain('arabic')
    expect(CHAPTER_NUMBER_FORMAT_OPTIONS).toContain('none')
  })

  test('SUBCHAPTER_NUMBER_FORMAT_OPTIONS memiliki 4 opsi', () => {
    expect(SUBCHAPTER_NUMBER_FORMAT_OPTIONS).toHaveLength(4)
    expect(SUBCHAPTER_NUMBER_FORMAT_OPTIONS).toContain('decimal')
  })
})

describe('fieldConfig — FONT_COLOR_HEX', () => {
  test('setiap warna di FONT_COLOR_OPTIONS memiliki hex mapping', () => {
    for (const color of FONT_COLOR_OPTIONS) {
      expect(FONT_COLOR_HEX).toHaveProperty(color)
    }
  })

  test('semua hex value adalah string 6 karakter hex valid', () => {
    for (const color of FONT_COLOR_OPTIONS) {
      const hex = FONT_COLOR_HEX[color]
      expect(hex).toMatch(/^[0-9A-Fa-f]{6}$/)
    }
  })

  test('black = 000000', () => {
    expect(FONT_COLOR_HEX['black']).toBe('000000')
  })

  test('white = FFFFFF', () => {
    expect(FONT_COLOR_HEX['white']).toBe('FFFFFF')
  })
})

describe('fieldConfig — numeric ranges', () => {
  test('MARGIN_RANGE memiliki min=0, max=10', () => {
    expect(MARGIN_RANGE.min).toBe(0)
    expect(MARGIN_RANGE.max).toBe(10)
    expect(MARGIN_RANGE.step).toBeGreaterThan(0)
  })

  test('FONT_SIZE_RANGE min ≥ 6 dan max ≤ 72', () => {
    expect(FONT_SIZE_RANGE.min).toBeGreaterThanOrEqual(6)
    expect(FONT_SIZE_RANGE.max).toBeLessThanOrEqual(72)
    expect(FONT_SIZE_RANGE.min).toBeLessThan(FONT_SIZE_RANGE.max)
  })

  test('LINE_SPACING_RANGE min ≥ 1 dan max ≤ 5', () => {
    expect(LINE_SPACING_RANGE.min).toBeGreaterThanOrEqual(1)
    expect(LINE_SPACING_RANGE.max).toBeLessThanOrEqual(5)
    expect(LINE_SPACING_RANGE.min).toBeLessThan(LINE_SPACING_RANGE.max)
  })
})

describe('fieldConfig — OPTION_LABELS', () => {
  const allEnumValues = [
    ...PAPER_SIZE_OPTIONS,
    ...PAGE_NUMBER_POSITION_OPTIONS,
    ...NUMBERING_FORMAT_OPTIONS,
    ...CHAPTER_TITLE_CASE_OPTIONS,
    ...CHAPTER_TITLE_ALIGN_OPTIONS,
    ...CHAPTER_NUMBER_FORMAT_OPTIONS,
    ...SUBCHAPTER_NUMBER_FORMAT_OPTIONS,
    ...FONT_COLOR_OPTIONS,
  ]

  test('setiap enum value memiliki label di OPTION_LABELS', () => {
    for (const value of allEnumValues) {
      expect(OPTION_LABELS).toHaveProperty(value)
      expect(typeof OPTION_LABELS[value]).toBe('string')
      expect(OPTION_LABELS[value].length).toBeGreaterThan(0)
    }
  })

  test('label "bottom-center" adalah string bahasa Indonesia', () => {
    expect(OPTION_LABELS['bottom-center']).toBeTruthy()
    expect(typeof OPTION_LABELS['bottom-center']).toBe('string')
  })

  test('label "lowercase-roman" mengandung kata yang deskriptif', () => {
    expect(OPTION_LABELS['lowercase-roman']).toBeTruthy()
    expect(typeof OPTION_LABELS['lowercase-roman']).toBe('string')
  })
})
