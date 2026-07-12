/**
 * lib/classifyDocx.ts
 *
 * Spec C1 — Deteksi jenis .docx: template siap pakai vs pedoman naratif.
 *
 * Menerima ArrayBuffer dari file .docx, mengekstrak teks polosnya dengan
 * mammoth, lalu menghitung "kata naratif" (kata-kata di luar heading pendek
 * dan placeholder kosong).  Jika jumlah kata naratif < NARRATIVE_WORD_THRESHOLD
 * file diklasifikasikan sebagai 'template'; jika ≥ threshold → 'narrative'.
 *
 * Modul ini HANYA mengklasifikasikan — tidak mengekstrak aturan apa pun.
 * (PRD v5, Bagian 3.2)
 */

import mammoth from 'mammoth'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Ambang jumlah kata naratif.  Di bawah nilai ini → 'template'.
 * Sesuai rekomendasi PRD Bagian 3.2: "<150 kata".
 */
export const NARRATIVE_WORD_THRESHOLD = 150

/**
 * Panjang maksimal sebuah "baris pendek" (heading / label / placeholder).
 * Baris yang lebih pendek dari ini tidak dihitung sebagai teks naratif.
 * Nilai 8 kata menyaring label seperti "BAB I", "Judul:", "Nama Mahasiswa:",
 * dan placeholder semacam "[Isi Pendahuluan]".
 */
const SHORT_LINE_WORD_LIMIT = 8

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DocxType = 'template' | 'narrative'

export interface ClassifyDocxResult {
  /** Klasifikasi akhir berdasarkan jumlah kata naratif. */
  type: DocxType
  /** Jumlah kata naratif yang dihitung (untuk keperluan debug/test). */
  narrativeWordCount: number
  /** Teks polos hasil ekstraksi mammoth (berguna untuk pipeline berikutnya). */
  plainText: string
}

export interface ClassifyDocxError {
  type: 'error'
  error: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Menghitung jumlah kata dalam string.
 * Memisahkan berdasarkan whitespace, mengabaikan token kosong.
 */
function countWords(text: string): number {
  return text
    .split(/\s+/)
    .filter((token) => token.length > 0).length
}

/**
 * Mengklasifikasikan sebuah baris sebagai "naratif" atau tidak.
 *
 * Sebuah baris dianggap BUKAN naratif (di-skip) jika:
 *   - kosong / hanya whitespace
 *   - panjangnya ≤ SHORT_LINE_WORD_LIMIT kata (heading, label, placeholder)
 *
 * Semua baris yang lolos filter dianggap naratif dan kata-katanya dihitung.
 */
function extractNarrativeWordCount(rawText: string): number {
  const lines = rawText.split(/\r?\n/)
  let total = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const wordCount = countWords(trimmed)
    if (wordCount > SHORT_LINE_WORD_LIMIT) {
      total += wordCount
    }
  }

  return total
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Mengklasifikasikan sebuah file .docx sebagai 'template' atau 'narrative'.
 *
 * @param buffer  - ArrayBuffer isi file .docx (sudah tervalidasi oleh
 *                  validateFileBuffer sebelum dipanggil ke sini).
 * @returns       ClassifyDocxResult jika berhasil, ClassifyDocxError jika
 *                mammoth gagal mengekstrak teks (file rusak / bukan .docx).
 *
 * @example
 * ```ts
 * const result = await classifyDocx(arrayBuffer)
 * if (result.type === 'error') {
 *   // tangani error ekstraksi
 * } else if (result.type === 'template') {
 *   // lanjut ke modul baca XML (Spec C2)
 * } else {
 *   // result.type === 'narrative'
 *   // lanjut ke pipeline AI generik (Kelompok D) dengan result.plainText
 * }
 * ```
 */
export async function classifyDocx(
  buffer: ArrayBuffer,
): Promise<ClassifyDocxResult | ClassifyDocxError> {
  let plainText: string

  try {
    // mammoth menerima { arrayBuffer } langsung (BrowserInput dalam type-nya)
    const result = await mammoth.extractRawText({ arrayBuffer: buffer })
    plainText = result.value
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Unknown mammoth error'
    return {
      type: 'error',
      error: `Gagal mengekstrak teks dari .docx: ${message}`,
    }
  }

  const narrativeWordCount = extractNarrativeWordCount(plainText)
  const docxType: DocxType =
    narrativeWordCount < NARRATIVE_WORD_THRESHOLD ? 'template' : 'narrative'

  return {
    type: docxType,
    narrativeWordCount,
    plainText,
  }
}
