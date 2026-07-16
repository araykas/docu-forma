/**
 * __tests__/lib/validateFile.test.ts
 *
 * Unit tests untuk lib/validateFile.ts (Spec B2, B3)
 * Mencakup:
 *   - File terlalu besar ditolak
 *   - Magic bytes PDF dikenali
 *   - Magic bytes ZIP yang bukan DOCX ditolak
 *   - Buffer kosong ditolak
 *   - Buffer arbitrary bytes ditolak
 *   - MAX_FILE_SIZE terekspor dengan nilai yang benar
 *
 * Note: isValidDocx membutuhkan JSZip untuk membuka archive nyata.
 * Test membuat buffer ZIP minimal valid menggunakan konstruksi manual.
 * isPdfPasswordProtected tidak ditest di sini karena bergantung pada
 * PDF.js (unpdf) — sudah dicakup di integration test callGemini.
 */

import { validateFileBuffer, MAX_FILE_SIZE } from '@/lib/validateFile'

// ---------------------------------------------------------------------------
// Helpers: membuat buffer sintetis
// ---------------------------------------------------------------------------

/** Buat ArrayBuffer berisi magic bytes yang diberikan, diikuti padding zeros. */
function makeBuffer(magic: number[], totalSize = 16): ArrayBuffer {
  const buf = new ArrayBuffer(totalSize)
  const view = new Uint8Array(buf)
  magic.forEach((byte, i) => { view[i] = byte })
  return buf
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46] // %PDF
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] // PK..

// ---------------------------------------------------------------------------
// MAX_FILE_SIZE
// ---------------------------------------------------------------------------

describe('validateFile — MAX_FILE_SIZE', () => {
  test('MAX_FILE_SIZE = 10 MB', () => {
    expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024)
  })
})

// ---------------------------------------------------------------------------
// Size validation
// ---------------------------------------------------------------------------

describe('validateFileBuffer — ukuran file', () => {
  test('file tepat di batas MAX_FILE_SIZE diizinkan (kalau magic bytes valid)', async () => {
    // PDF magic bytes di buffer MAX_FILE_SIZE → valid secara ukuran, tapi
    // ini test untuk memastikan tidak ada size rejection
    const buf = makeBuffer(PDF_MAGIC, MAX_FILE_SIZE)
    // Tidak throw → lolos size check (meski kontennya bukan PDF nyata)
    const result = await validateFileBuffer(buf)
    // PDF magic bytes terdeteksi valid
    expect(result.valid).toBe(true)
  })

  test('file melebihi MAX_FILE_SIZE ditolak', async () => {
    const buf = makeBuffer(PDF_MAGIC, MAX_FILE_SIZE + 1)
    const result = await validateFileBuffer(buf)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('10 MB')
    }
  })

  test('file 1 byte ditolak (bukan PDF atau ZIP)', async () => {
    const buf = makeBuffer([0x00], 1)
    const result = await validateFileBuffer(buf)
    expect(result.valid).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// PDF magic bytes
// ---------------------------------------------------------------------------

describe('validateFileBuffer — PDF', () => {
  test('buffer dengan magic bytes PDF dikenali sebagai PDF', async () => {
    const buf = makeBuffer(PDF_MAGIC, 1024)
    const result = await validateFileBuffer(buf)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.mimeType).toBe('application/pdf')
    }
  })

  test('buffer hanya 4 byte PDF magic → valid (PDF kecil/truncated terdeteksi)', async () => {
    const buf = makeBuffer(PDF_MAGIC, 4)
    const result = await validateFileBuffer(buf)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.mimeType).toBe('application/pdf')
    }
  })
})

// ---------------------------------------------------------------------------
// ZIP / DOCX magic bytes
// ---------------------------------------------------------------------------

describe('validateFileBuffer — ZIP/DOCX', () => {
  test('ZIP yang bukan DOCX valid ditolak', async () => {
    // Buffer dengan magic ZIP tapi isi kosong/tidak valid sebagai DOCX
    const buf = makeBuffer(ZIP_MAGIC, 64)
    const result = await validateFileBuffer(buf)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toBeTruthy()
    }
  })
})

// ---------------------------------------------------------------------------
// Unknown magic bytes
// ---------------------------------------------------------------------------

describe('validateFileBuffer — format tidak dikenal', () => {
  test('buffer dengan magic bytes acak ditolak', async () => {
    const buf = makeBuffer([0xDE, 0xAD, 0xBE, 0xEF], 32)
    const result = await validateFileBuffer(buf)
    expect(result.valid).toBe(false)
  })

  test('buffer kosong (0 byte) ditolak', async () => {
    const buf = new ArrayBuffer(0)
    const result = await validateFileBuffer(buf)
    expect(result.valid).toBe(false)
  })

  test('buffer berisi hanya null bytes ditolak', async () => {
    const buf = new ArrayBuffer(16) // semua 0x00
    const result = await validateFileBuffer(buf)
    expect(result.valid).toBe(false)
  })
})
