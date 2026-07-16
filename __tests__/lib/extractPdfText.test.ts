/**
 * __tests__/lib/extractPdfText.test.ts
 *
 * Unit tests untuk lib/extractPdfText.ts (Spec D1)
 * Menggunakan Jest manual mock untuk modul 'unpdf' karena
 * kita tidak ingin bergantung pada file PDF nyata di test suite.
 *
 * Mencakup:
 *   - PDF valid dengan teks yang cukup → ExtractPdfTextResult
 *   - PDF scan/gambar (teks < threshold) → error 'scanned_pdf'
 *   - Teks persis di batas threshold → tidak dianggap scan
 *   - Kegagalan parse (getDocumentProxy throw) → error 'parse_error'
 *   - mergePages:true menghasilkan satu string gabungan
 */

// ---------------------------------------------------------------------------
// Mock 'unpdf'
// ---------------------------------------------------------------------------

const mockExtractText = jest.fn()
const mockGetDocumentProxy = jest.fn()

jest.mock('unpdf', () => ({
  extractText: (...args: unknown[]) => mockExtractText(...args),
  getDocumentProxy: (...args: unknown[]) => mockGetDocumentProxy(...args),
}))

import { extractPdfText } from '@/lib/extractPdfText'

afterEach(() => {
  mockExtractText.mockReset()
  mockGetDocumentProxy.mockReset()
})

// ---------------------------------------------------------------------------
// Helper: buat fake PDF buffer (content tidak penting karena getDocumentProxy di-mock)
// ---------------------------------------------------------------------------

function makeFakePdfBuffer(): ArrayBuffer {
  // Magic bytes %PDF diikuti bytes acak
  const buf = new ArrayBuffer(64)
  const view = new Uint8Array(buf)
  ;[0x25, 0x50, 0x44, 0x46].forEach((b, i) => { view[i] = b })
  return buf
}

const FAKE_PDF_DOC = {} // objek dummy — getDocumentProxy akan return ini

// ---------------------------------------------------------------------------
// Sukses: teks cukup
// ---------------------------------------------------------------------------

describe('extractPdfText — sukses', () => {
  test('mengembalikan ExtractPdfTextResult saat teks cukup', async () => {
    const fakeText = 'Ini adalah teks pedoman format yang cukup panjang untuk diproses oleh sistem.'
    mockGetDocumentProxy.mockResolvedValue(FAKE_PDF_DOC)
    mockExtractText.mockResolvedValue({ totalPages: 5, text: fakeText })

    const result = await extractPdfText(makeFakePdfBuffer())

    expect('type' in result).toBe(false)
    if (!('type' in result)) {
      expect(result.text).toBe(fakeText)
      expect(result.totalPages).toBe(5)
    }
  })

  test('teks lebih dari MIN_TEXT_LENGTH (50 karakter) lolos threshold', async () => {
    const text = 'A'.repeat(51)
    mockGetDocumentProxy.mockResolvedValue(FAKE_PDF_DOC)
    mockExtractText.mockResolvedValue({ totalPages: 1, text })

    const result = await extractPdfText(makeFakePdfBuffer())
    expect('type' in result).toBe(false)
  })

  test('array teks (bukan string) digabung dengan newline', async () => {
    const pages = ['Halaman 1 konten format', 'Halaman 2 konten spesifikasi']
    mockGetDocumentProxy.mockResolvedValue(FAKE_PDF_DOC)
    mockExtractText.mockResolvedValue({ totalPages: 2, text: pages })

    const result = await extractPdfText(makeFakePdfBuffer())
    expect('type' in result).toBe(false)
    if (!('type' in result)) {
      expect(result.text).toContain('Halaman 1')
      expect(result.text).toContain('Halaman 2')
      expect(result.totalPages).toBe(2)
    }
  })
})

// ---------------------------------------------------------------------------
// Scanned PDF detection
// ---------------------------------------------------------------------------

describe('extractPdfText — deteksi PDF scan', () => {
  test('teks kosong → error scanned_pdf', async () => {
    mockGetDocumentProxy.mockResolvedValue(FAKE_PDF_DOC)
    mockExtractText.mockResolvedValue({ totalPages: 10, text: '' })

    const result = await extractPdfText(makeFakePdfBuffer())
    expect('type' in result).toBe(true)
    if ('type' in result) {
      expect(result.code).toBe('scanned_pdf')
      expect(result.type).toBe('error')
    }
  })

  test('teks hanya whitespace → error scanned_pdf', async () => {
    mockGetDocumentProxy.mockResolvedValue(FAKE_PDF_DOC)
    mockExtractText.mockResolvedValue({ totalPages: 3, text: '   \n\t   ' })

    const result = await extractPdfText(makeFakePdfBuffer())
    expect('type' in result).toBe(true)
    if ('type' in result) {
      expect(result.code).toBe('scanned_pdf')
    }
  })

  test('teks tepat di batas (49 karakter setelah trim) → error scanned_pdf', async () => {
    const text = 'A'.repeat(49)
    mockGetDocumentProxy.mockResolvedValue(FAKE_PDF_DOC)
    mockExtractText.mockResolvedValue({ totalPages: 1, text })

    const result = await extractPdfText(makeFakePdfBuffer())
    expect('type' in result).toBe(true)
    if ('type' in result) {
      expect(result.code).toBe('scanned_pdf')
    }
  })

  test('teks tepat 50 karakter → TIDAK error (lolos threshold)', async () => {
    const text = 'A'.repeat(50)
    mockGetDocumentProxy.mockResolvedValue(FAKE_PDF_DOC)
    mockExtractText.mockResolvedValue({ totalPages: 1, text })

    const result = await extractPdfText(makeFakePdfBuffer())
    expect('type' in result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Parse error
// ---------------------------------------------------------------------------

describe('extractPdfText — parse error', () => {
  test('getDocumentProxy throw → error parse_error', async () => {
    mockGetDocumentProxy.mockRejectedValue(new Error('Invalid PDF structure'))

    const result = await extractPdfText(makeFakePdfBuffer())
    expect('type' in result).toBe(true)
    if ('type' in result) {
      expect(result.code).toBe('parse_error')
    }
  })

  test('extractText throw → error parse_error', async () => {
    mockGetDocumentProxy.mockResolvedValue(FAKE_PDF_DOC)
    mockExtractText.mockRejectedValue(new Error('Extraction failed'))

    const result = await extractPdfText(makeFakePdfBuffer())
    expect('type' in result).toBe(true)
    if ('type' in result) {
      expect(result.code).toBe('parse_error')
    }
  })
})
