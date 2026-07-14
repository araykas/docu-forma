/**
 * lib/extractPdfText.ts
 *
 * Spec D1 — Ekstraksi teks PDF saja (tanpa AI).
 * PRD v6, Bagian 3.2 (baris PDF) & Bagian 6 Skenario 4.
 *
 * Menerima ArrayBuffer dari file PDF yang sudah tervalidasi (tidak terkunci),
 * lalu mengekstrak seluruh teks dengan unpdf/PDF.js.
 *
 * Jika PDF tidak mengandung teks yang bisa diekstrak (PDF hasil scan/foto),
 * modul mengembalikan error sesuai Skenario 4 PRD — belum ada AI di spec ini.
 *
 * Output berupa teks mentah yang siap diteruskan ke pipeline AI (Kelompok D).
 */

import { extractText, getDocumentProxy } from 'unpdf'

// ---------------------------------------------------------------------------
// Threshold deteksi PDF scan
// ---------------------------------------------------------------------------

/**
 * Jumlah minimum karakter (setelah trim) yang harus ada di seluruh dokumen
 * agar dianggap "berbasis teks" dan bukan hasil scan.
 *
 * Nilai 50 cukup konservatif: PDF kosong/scan menghasilkan string kosong atau
 * sangat pendek, sedangkan dokumen pedoman nyata menghasilkan ribuan karakter.
 */
const MIN_TEXT_LENGTH = 50

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface ExtractPdfTextResult {
  /** Teks polos gabungan seluruh halaman, siap dikirim ke pipeline AI. */
  text: string
  /** Jumlah halaman PDF. */
  totalPages: number
}

export interface ExtractPdfTextError {
  /** Selalu bernilai 'error' sebagai discriminant. */
  type: 'error'
  /**
   * Kode error untuk diteruskan ke response handler:
   * - 'scanned_pdf'  → Skenario 4 PRD: PDF scan/gambar, tidak ada teks.
   * - 'parse_error'  → File rusak atau format tidak terbaca.
   */
  code: 'scanned_pdf' | 'parse_error'
  error: string
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Mengekstrak teks polos dari sebuah file PDF.
 *
 * @param buffer  ArrayBuffer isi file PDF yang sudah lolos validasi:
 *                - magic bytes terverifikasi sebagai PDF
 *                - ukuran ≤ 10 MB
 *                - tidak terkunci password (cek sebelumnya di validateFile)
 *
 * @returns  ExtractPdfTextResult jika teks berhasil diekstrak,
 *           atau ExtractPdfTextError jika PDF scan (code: 'scanned_pdf')
 *           atau jika file gagal di-parse (code: 'parse_error').
 *
 * @example
 * ```ts
 * const result = await extractPdfText(arrayBuffer)
 * if ('type' in result) {
 *   // result.code === 'scanned_pdf' → tampilkan pesan Skenario 4
 *   // result.code === 'parse_error' → tampilkan pesan Skenario 2
 * } else {
 *   // result.text → teruskan ke pipeline AI (Spec D2 dst.)
 *   console.log(result.text)
 * }
 * ```
 */
export async function extractPdfText(
  buffer: ArrayBuffer,
): Promise<ExtractPdfTextResult | ExtractPdfTextError> {
  try {
    // slice(0) makes an independent copy of the backing memory.
    // PDF.js (via unpdf) detaches the ArrayBuffer it receives during parsing,
    // so we must never pass the caller's original buffer — doing so would
    // corrupt it for any subsequent use and causes "detached ArrayBuffer" errors
    // when the same buffer was already consumed by isPdfPasswordProtected.
    const pdf = await getDocumentProxy(new Uint8Array(buffer.slice(0)))

    // mergePages: true → gabungkan semua halaman menjadi satu string
    const { totalPages, text } = await extractText(pdf, { mergePages: true })

    // text bisa berupa string (karena mergePages: true) atau string[]
    // Normalkan ke string untuk keamanan tipe
    const fullText = Array.isArray(text) ? text.join('\n') : text

    // Deteksi PDF scan: tidak ada teks yang bisa diekstrak
    if (fullText.trim().length < MIN_TEXT_LENGTH) {
      return {
        type: 'error',
        code: 'scanned_pdf',
        error:
          'Dokumen ini tampaknya berupa hasil scan gambar. ' +
          'Saat ini kami hanya mendukung PDF berbasis teks atau file DOCX.',
      }
    }

    console.log(
      `[extractPdfText] Berhasil: ${totalPages} halaman, ` +
        `${fullText.length} karakter diekstrak.`,
    )

    return { text: fullText, totalPages }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown PDF.js error'
    console.error('[extractPdfText] Parse error:', message)
    return {
      type: 'error',
      code: 'parse_error',
      error: `Dokumen tidak dapat dibaca. Pastikan file tidak rusak atau terkunci kata sandi.`,
    }
  }
}
