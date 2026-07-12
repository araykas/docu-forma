/**
 * lib/extractDocxText.ts
 *
 * Spec C1 — Ekstraksi teks dari .docx (untuk pipeline AI).
 * PRD v6, Bagian 3.2.
 *
 * Menerima ArrayBuffer dari file .docx yang sudah tervalidasi, lalu
 * mengekstrak seluruh teks polosnya menggunakan mammoth.
 *
 * Tidak ada logika klasifikasi atau threshold di sini.
 * Output teks diperlakukan identik dengan hasil ekstraksi PDF —
 * langsung diteruskan ke pipeline AI (Kelompok D).
 */

import mammoth from 'mammoth'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractDocxTextResult {
  /** Teks polos hasil ekstraksi, siap dikirim ke pipeline AI. */
  text: string
}

export interface ExtractDocxTextError {
  /** Selalu bernilai 'error' sebagai discriminant. */
  type: 'error'
  error: string
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Mengekstrak teks polos dari sebuah file .docx.
 *
 * @param buffer  ArrayBuffer isi file .docx (sudah tervalidasi oleh
 *                validateFileBuffer sebelum dipanggil ke sini).
 * @returns       ExtractDocxTextResult berisi teks jika berhasil,
 *                atau ExtractDocxTextError jika mammoth gagal membaca file
 *                (file rusak, terenkripsi, atau bukan .docx yang valid).
 *
 * @example
 * ```ts
 * const result = await extractDocxText(arrayBuffer)
 * if ('type' in result) {
 *   // result.type === 'error' — tangani error
 * } else {
 *   // result.text → teruskan ke pipeline AI (Kelompok D)
 * }
 * ```
 */
export async function extractDocxText(
  buffer: ArrayBuffer,
): Promise<ExtractDocxTextResult | ExtractDocxTextError> {
  try {
    // mammoth di Node.js menerima { buffer: Buffer }, bukan { arrayBuffer }.
    // Buffer.from() menyalin data dari ArrayBuffer ke Node Buffer tanpa alokasi ekstra.
    const nodeBuffer = Buffer.from(buffer)
    const { value: text } = await mammoth.extractRawText({ buffer: nodeBuffer })
    return { text }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown mammoth error'
    return {
      type: 'error',
      error: `Gagal mengekstrak teks dari .docx: ${message}`,
    }
  }
}
