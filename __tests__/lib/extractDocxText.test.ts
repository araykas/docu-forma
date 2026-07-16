/**
 * __tests__/lib/extractDocxText.test.ts
 *
 * Unit tests untuk lib/extractDocxText.ts (Spec C1)
 * Menggunakan Jest manual mock untuk 'mammoth'.
 *
 * Mencakup:
 *   - Ekstraksi teks sukses → ExtractDocxTextResult dengan teks
 *   - Mammoth throw → ExtractDocxTextError
 *   - Buffer diteruskan ke mammoth dalam format yang benar
 */

// ---------------------------------------------------------------------------
// Mock 'mammoth'
// ---------------------------------------------------------------------------

const mockExtractRawText = jest.fn()

jest.mock('mammoth', () => ({
  extractRawText: (...args: unknown[]) => mockExtractRawText(...args),
}))

import { extractDocxText } from '@/lib/extractDocxText'

afterEach(() => {
  mockExtractRawText.mockReset()
})

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeFakeDocxBuffer(): ArrayBuffer {
  const buf = new ArrayBuffer(64)
  const view = new Uint8Array(buf)
  // ZIP magic bytes
  ;[0x50, 0x4b, 0x03, 0x04].forEach((b, i) => { view[i] = b })
  return buf
}

// ---------------------------------------------------------------------------
// Sukses
// ---------------------------------------------------------------------------

describe('extractDocxText — sukses', () => {
  test('mengembalikan ExtractDocxTextResult dengan teks dari mammoth', async () => {
    const expectedText = 'Pedoman penulisan Tugas Akhir FTI UNISBANK. Margin kiri 4 cm.'
    mockExtractRawText.mockResolvedValue({ value: expectedText })

    const result = await extractDocxText(makeFakeDocxBuffer())

    expect('type' in result).toBe(false)
    if (!('type' in result)) {
      expect(result.text).toBe(expectedText)
    }
  })

  test('teks kosong dari mammoth → tetap dikembalikan (bukan error)', async () => {
    mockExtractRawText.mockResolvedValue({ value: '' })

    const result = await extractDocxText(makeFakeDocxBuffer())
    expect('type' in result).toBe(false)
    if (!('type' in result)) {
      expect(result.text).toBe('')
    }
  })

  test('mammoth dipanggil dengan Node Buffer (bukan ArrayBuffer langsung)', async () => {
    mockExtractRawText.mockResolvedValue({ value: 'teks' })

    await extractDocxText(makeFakeDocxBuffer())

    expect(mockExtractRawText).toHaveBeenCalledTimes(1)
    const calledArg = mockExtractRawText.mock.calls[0][0] as { buffer: Buffer }
    // Argumen harus berupa object { buffer: Buffer }
    expect(calledArg).toHaveProperty('buffer')
    expect(Buffer.isBuffer(calledArg.buffer)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

describe('extractDocxText — error', () => {
  test('mammoth throw Error → mengembalikan ExtractDocxTextError', async () => {
    mockExtractRawText.mockRejectedValue(new Error('Corrupt DOCX file'))

    const result = await extractDocxText(makeFakeDocxBuffer())
    expect('type' in result).toBe(true)
    if ('type' in result) {
      expect(result.type).toBe('error')
      expect(result.error).toContain('Gagal')
    }
  })

  test('mammoth throw non-Error object → tetap mengembalikan ExtractDocxTextError', async () => {
    mockExtractRawText.mockRejectedValue('string error bukan Error object')

    const result = await extractDocxText(makeFakeDocxBuffer())
    expect('type' in result).toBe(true)
  })
})
