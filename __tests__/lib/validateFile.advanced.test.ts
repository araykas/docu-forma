/**
 * __tests__/lib/validateFile.advanced.test.ts
 *
 * Advanced tests untuk lib/validateFile.ts dengan mock JSZip dan unpdf.
 * Meningkatkan coverage untuk isValidDocx (internal) dan isPdfPasswordProtected.
 *
 * Mencakup:
 *   - isValidDocx: ZIP valid dengan [Content_Types].xml + word/document.xml → DOCX valid
 *   - isValidDocx: ZIP tanpa [Content_Types].xml → ditolak
 *   - isValidDocx: ZIP tanpa word/document.xml → ditolak
 *   - isValidDocx: ZIP corrupt (JSZip.loadAsync throw) → ditolak
 *   - isPdfPasswordProtected: PDF tidak terkunci → false
 *   - isPdfPasswordProtected: PasswordException → true
 *   - isPdfPasswordProtected: Error lain → false
 */

// ---------------------------------------------------------------------------
// Mock JSZip dan unpdf sebelum import modul target
// ---------------------------------------------------------------------------

const mockLoadAsync = jest.fn()
const mockGetResolvedPDFJS = jest.fn()

jest.mock('jszip', () => ({
  default: { loadAsync: (...args: unknown[]) => mockLoadAsync(...args) },
  loadAsync: (...args: unknown[]) => mockLoadAsync(...args),
}))

jest.mock('unpdf', () => ({
  getResolvedPDFJS: (...args: unknown[]) => mockGetResolvedPDFJS(...args),
  // getDocumentProxy dipakai di extractPdfText.ts, bukan validateFile.ts
  getDocumentProxy: jest.fn(),
}))

import { validateFileBuffer, isPdfPasswordProtected } from '@/lib/validateFile'

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]

function makeBuffer(magic: number[], size = 64): ArrayBuffer {
  const buf = new ArrayBuffer(size)
  const view = new Uint8Array(buf)
  magic.forEach((b, i) => { view[i] = b })
  return buf
}

afterEach(() => {
  mockLoadAsync.mockReset()
  mockGetResolvedPDFJS.mockReset()
})

// ---------------------------------------------------------------------------
// isValidDocx via validateFileBuffer
// ---------------------------------------------------------------------------

describe('validateFileBuffer — DOCX (ZIP internal validation)', () => {
  function makeZipMock(options: {
    hasContentTypes?: boolean
    hasWordDocument?: boolean
    uncompressedSize?: number
  }) {
    const { hasContentTypes = true, hasWordDocument = true, uncompressedSize = 1000 } = options

    const files: Record<string, { dir: boolean; _data: { uncompressedSize: number } }> = {}

    if (hasContentTypes) {
      files['[Content_Types].xml'] = { dir: false, _data: { uncompressedSize } }
    }
    if (hasWordDocument) {
      files['word/document.xml'] = { dir: false, _data: { uncompressedSize } }
    }
    files['word/_rels/document.xml.rels'] = { dir: false, _data: { uncompressedSize } }

    return {
      files,
      file: (name: string) => name in files ? files[name] : null,
    }
  }

  test('ZIP valid dengan kedua required entries → diterima sebagai DOCX', async () => {
    mockLoadAsync.mockResolvedValue(makeZipMock({}))

    const buf = makeBuffer(ZIP_MAGIC)
    const result = await validateFileBuffer(buf)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.mimeType).toContain('wordprocessingml')
    }
  })

  test('ZIP tanpa [Content_Types].xml → ditolak', async () => {
    mockLoadAsync.mockResolvedValue(makeZipMock({ hasContentTypes: false }))

    const buf = makeBuffer(ZIP_MAGIC)
    const result = await validateFileBuffer(buf)
    expect(result.valid).toBe(false)
  })

  test('ZIP tanpa word/document.xml → ditolak', async () => {
    mockLoadAsync.mockResolvedValue(makeZipMock({ hasWordDocument: false }))

    const buf = makeBuffer(ZIP_MAGIC)
    const result = await validateFileBuffer(buf)
    expect(result.valid).toBe(false)
  })

  test('JSZip.loadAsync throw → ditolak dengan error', async () => {
    mockLoadAsync.mockRejectedValue(new Error('corrupt zip'))

    const buf = makeBuffer(ZIP_MAGIC)
    const result = await validateFileBuffer(buf)
    expect(result.valid).toBe(false)
  })

  test('ZIP bomb (uncompressed size > 50 MB) → ditolak', async () => {
    // Buat mock dengan uncompressedSize yang besar
    const HUGE = 51 * 1024 * 1024 // 51 MB
    const files: Record<string, { dir: boolean; _data: { uncompressedSize: number } }> = {
      '[Content_Types].xml': { dir: false, _data: { uncompressedSize: HUGE } },
      'word/document.xml':   { dir: false, _data: { uncompressedSize: 1000 } },
    }
    mockLoadAsync.mockResolvedValue({
      files,
      file: (name: string) => name in files ? files[name] : null,
    })

    const buf = makeBuffer(ZIP_MAGIC)
    const result = await validateFileBuffer(buf)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('terlalu besar')
    }
  })
})

// ---------------------------------------------------------------------------
// isPdfPasswordProtected
// ---------------------------------------------------------------------------

describe('isPdfPasswordProtected', () => {
  const pdfBuf = makeBuffer(PDF_MAGIC, 1024)

  test('PDF tidak terkunci → mengembalikan false', async () => {
    const mockDestroy = jest.fn().mockResolvedValue(undefined)
    const mockDoc = { destroy: mockDestroy }
    const mockLoadingTask = { promise: Promise.resolve(mockDoc) }
    const mockGetDocument = jest.fn().mockReturnValue(mockLoadingTask)

    mockGetResolvedPDFJS.mockResolvedValue({ getDocument: mockGetDocument })

    const result = await isPdfPasswordProtected(pdfBuf)
    expect(result).toBe(false)
    expect(mockDestroy).toHaveBeenCalledTimes(1)
  })

  test('PasswordException → mengembalikan true', async () => {
    const passwordErr = new Error('Password required')
    passwordErr.name = 'PasswordException'

    const mockLoadingTask = { promise: Promise.reject(passwordErr) }
    const mockGetDocument = jest.fn().mockReturnValue(mockLoadingTask)

    mockGetResolvedPDFJS.mockResolvedValue({ getDocument: mockGetDocument })

    const result = await isPdfPasswordProtected(pdfBuf)
    expect(result).toBe(true)
  })

  test('Error selain PasswordException → mengembalikan false', async () => {
    const parseErr = new Error('Invalid PDF structure')
    parseErr.name = 'InvalidPDFException'

    const mockLoadingTask = { promise: Promise.reject(parseErr) }
    const mockGetDocument = jest.fn().mockReturnValue(mockLoadingTask)

    mockGetResolvedPDFJS.mockResolvedValue({ getDocument: mockGetDocument })

    const result = await isPdfPasswordProtected(pdfBuf)
    expect(result).toBe(false)
  })

  test('getResolvedPDFJS throw → mengembalikan false', async () => {
    mockGetResolvedPDFJS.mockRejectedValue(new Error('pdfjs not available'))

    const result = await isPdfPasswordProtected(pdfBuf)
    expect(result).toBe(false)
  })
})
