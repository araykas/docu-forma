/**
 * lib/validateExtraction.ts
 *
 * Spec D4 — Post-processing validasi dan auto-koreksi hasil ekstraksi AI.
 *
 * Masalah yang diselesaikan:
 *   AI model kadang menghasilkan `value` dan `source_quote` secara INDEPENDEN,
 *   sehingga keduanya bisa saling bertentangan — contoh nyata yang ditemukan:
 *     source_quote: "...menggunakan angka Arab"  (benar)
 *     value: "roman_lower"                       (salah — harus "arabic")
 *
 * Fungsi utama: validateAndCorrectExtraction()
 *   1. Untuk setiap field enum yang rawan (lihat FIELD_RULES di bawah):
 *      - Periksa apakah source_quote mengandung kata kunci yang jelas
 *      - Bandingkan kata kunci tersebut dengan value yang dikembalikan AI
 *      - Jika ada ketidakcocokan jelas → log WARNING + auto-correct value
 *   2. Log semua koreksi ke server console (bukan ke client)
 *   3. Kembalikan result yang sudah dikoreksi
 *
 * Cakupan field (semua field enum yang rawan tertukar):
 *   - front_matter_numbering   (romawi kecil vs romawi besar vs arab)
 *   - main_body_numbering      (idem)
 *   - chapter_number_format    (romawi vs arab vs none)
 *   - subchapter_number_format (decimal vs romawi vs arab vs none)
 *   - chapter_title_case       (uppercase vs capitalize vs normal)
 *   - chapter_title_align      (center vs left vs right vs justify)
 *
 * Field numerik (margin, font_size, line_spacing) dan string bebas (font_family,
 * paper_size) tidak divalidasi di sini — mereka sudah divalidasi oleh whitelist
 * dan range-check di layer lain.
 */

import type { GeminiExtractionResult, RuleField } from '@/lib/callGemini'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Satu aturan mapping: jika source_quote cocok dengan pattern ini, value harus X. */
interface QuoteSignal {
  /** Regex atau string (case-insensitive) yang dicari di source_quote */
  pattern: RegExp
  /** Nilai yang seharusnya dikembalikan jika pattern ditemukan */
  expectedValue: string
  /** Deskripsi singkat untuk log */
  label: string
}

/** Definisi validasi untuk satu field */
interface FieldRule {
  /** Nama field sesuai skema (kunci di ExtractionRules) */
  field: string
  /** Label manusiawi untuk log */
  label: string
  /** Daftar sinyal dalam source_quote → nilai yang diharapkan, urutan prioritas */
  signals: QuoteSignal[]
}

// ---------------------------------------------------------------------------
// Aturan validasi per field
// ---------------------------------------------------------------------------

/**
 * Daftar field enum yang rawan mismatch antara source_quote dan value,
 * beserta kata kunci pendeteksi di source_quote.
 *
 * Urutan signals PENTING: sinyal lebih spesifik harus di atas sinyal lebih umum.
 * Contoh: "romawi kecil" harus dicek sebelum "romawi" supaya tidak salah-classify.
 */
const FIELD_RULES: FieldRule[] = [
  // ── Penomoran halaman bagian awal ────────────────────────────────────────
  {
    field: 'front_matter_numbering',
    label: 'Format bagian awal',
    signals: [
      // Arab dulu (paling spesifik)
      { pattern: /angka\s+arab|arab(?:ic)?|\b1[,\s]+2[,\s]+3\b/i, expectedValue: 'arabic',        label: 'angka arab → arabic' },
      // Romawi kecil — harus sebelum "romawi" generik
      { pattern: /romawi\s+kecil|huruf\s+kecil|\bi[,\s]+ii[,\s]+iii\b/i, expectedValue: 'lowercase-roman', label: 'romawi kecil → lowercase-roman' },
      // Romawi besar
      { pattern: /romawi\s+besar|huruf\s+besar|\bI[,\s]+II[,\s]+III\b/, expectedValue: 'uppercase-roman', label: 'romawi besar → uppercase-roman' },
    ],
  },

  // ── Penomoran halaman bagian utama ───────────────────────────────────────
  {
    field: 'main_body_numbering',
    label: 'Format bagian utama',
    signals: [
      { pattern: /angka\s+arab|arab(?:ic)?|\b1[,\s]+2[,\s]+3\b/i, expectedValue: 'arabic',        label: 'angka arab → arabic' },
      { pattern: /romawi\s+kecil|huruf\s+kecil|\bi[,\s]+ii[,\s]+iii\b/i, expectedValue: 'lowercase-roman', label: 'romawi kecil → lowercase-roman' },
      { pattern: /romawi\s+besar|huruf\s+besar|\bI[,\s]+II[,\s]+III\b/, expectedValue: 'uppercase-roman', label: 'romawi besar → uppercase-roman' },
    ],
  },

  // ── Format nomor bab ─────────────────────────────────────────────────────
  {
    field: 'chapter_number_format',
    label: 'Format nomor bab',
    signals: [
      // "angka arab" / "arab" tanpa kata "romawi" → arabic
      { pattern: /angka\s+arab(?!\s+romawi)|(?<![a-z])arab(?!i)(?:ic)?\b/i, expectedValue: 'arabic', label: 'angka arab → arabic' },
      // "romawi" (termasuk "angka romawi", "angka Romawi") → roman
      { pattern: /romawi|roman/i, expectedValue: 'roman', label: 'romawi → roman' },
      // "tanpa nomor" / "tidak ada nomor"
      { pattern: /tanpa\s+nomor|tidak\s+bernomor|tanpa\s+angka/i, expectedValue: 'none', label: 'tanpa nomor → none' },
    ],
  },

  // ── Format nomor sub-bab ─────────────────────────────────────────────────
  {
    field: 'subchapter_number_format',
    label: 'Format nomor sub-bab',
    signals: [
      // "desimal" / contoh "1.1" / "2.1" → decimal (paling spesifik, cek duluan)
      { pattern: /desimal|decimal|\b\d+\.\d+\b/i, expectedValue: 'decimal', label: 'desimal → decimal' },
      // "romawi"
      { pattern: /romawi|roman/i, expectedValue: 'roman', label: 'romawi → roman' },
      // "angka arab" / "arab" tanpa konteks desimal
      { pattern: /angka\s+arab|arab(?:ic)?\b/i, expectedValue: 'arabic', label: 'angka arab → arabic' },
    ],
  },

  // ── Gaya huruf judul bab ─────────────────────────────────────────────────
  {
    field: 'chapter_title_case',
    label: 'Gaya huruf judul bab',
    signals: [
      // "kapital tiap kata" / "title case" lebih spesifik dari "kapital" saja
      { pattern: /kapital\s+tiap\s+kata|title\s+case|setiap\s+kata/i, expectedValue: 'capitalize', label: 'title case → capitalize' },
      // "huruf kapital" / "huruf besar" / "kapital semua" → uppercase
      { pattern: /huruf\s+kapital|kapital\s+semua|huruf\s+besar|uppercase|all\s+caps/i, expectedValue: 'uppercase', label: 'huruf kapital → uppercase' },
    ],
  },

  // ── Perataan judul bab ───────────────────────────────────────────────────
  {
    field: 'chapter_title_align',
    label: 'Perataan judul bab',
    signals: [
      // "rata kiri-kanan" / "justify" lebih spesifik dari "kiri" atau "kanan"
      { pattern: /rata\s+kiri.kanan|justify/i, expectedValue: 'justify', label: 'rata kiri-kanan → justify' },
      // "tengah" / "center"
      { pattern: /tengah|center|centre/i, expectedValue: 'center', label: 'tengah → center' },
      // "kiri" / "left" (tanpa "-kanan" supaya tidak overlap justify)
      { pattern: /(?<![a-z])kiri(?!.kanan)|(?<![a-z])left\b/i, expectedValue: 'left', label: 'kiri → left' },
      // "kanan" / "right"
      { pattern: /(?<![a-z])kanan|(?<![a-z])right\b/i, expectedValue: 'right', label: 'kanan → right' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Koreksi satu field
// ---------------------------------------------------------------------------

/**
 * Periksa satu field: apakah source_quote mengandung sinyal yang jelas
 * yang bertentangan dengan value saat ini?
 *
 * @returns  value yang dikoreksi (mungkin tidak berubah), dan apakah ada koreksi
 */
function checkAndCorrectField(
  fieldName: string,
  fieldLabel: string,
  field: RuleField,
  signals: QuoteSignal[],
  provider: string,
): { corrected: boolean; oldValue: string; newValue: string; matchedSignal: string } | null {
  // Hanya berlaku jika field detected dan ada source_quote
  if (!field.detected || !field.source_quote || typeof field.source_quote !== 'string') {
    return null
  }

  const quote = field.source_quote
  const currentValue = String(field.value ?? '')

  for (const signal of signals) {
    if (signal.pattern.test(quote)) {
      // Sinyal ditemukan di quote — apakah value sudah sesuai?
      if (currentValue !== signal.expectedValue) {
        // MISMATCH — log warning dan auto-correct
        console.warn(
          `[validateExtraction] ⚠️  MISMATCH [${provider}] field="${fieldName}" (${fieldLabel}):\n` +
          `  source_quote : "${quote}"\n` +
          `  value (AI)   : "${currentValue}"  ← SALAH\n` +
          `  signal match : ${signal.label}\n` +
          `  auto-correct → "${signal.expectedValue}"`,
        )
        return {
          corrected: true,
          oldValue: currentValue,
          newValue: signal.expectedValue,
          matchedSignal: signal.label,
        }
      } else {
        // Match dan konsisten — log sebagai DEBUG untuk audit
        console.log(
          `[validateExtraction] ✓ OK [${provider}] field="${fieldName}": ` +
          `value="${currentValue}" consistent with quote signal (${signal.label})`,
        )
        return null  // tidak perlu koreksi
      }
    }
  }

  // Tidak ada sinyal yang ditemukan di quote — tidak bisa memvalidasi, biarkan
  return null
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Jalankan validasi dan auto-koreksi pada semua field enum yang rawan mismatch.
 *
 * Memodifikasi result IN-PLACE (field value diganti jika ada koreksi) dan
 * mengembalikan objek yang sama dengan statistik koreksi.
 *
 * @param result    Hasil ekstraksi dari callGemini.
 * @param provider  Label provider untuk log (default: 'gemini').
 * @returns         { result, corrections } — result yang sudah dikoreksi,
 *                  dan jumlah koreksi yang dilakukan.
 */
export function validateAndCorrectExtraction(
  result: GeminiExtractionResult,
  provider: 'gemini' = 'gemini',
): { result: GeminiExtractionResult; corrections: number } {
  const rules = result.rules as unknown as Record<string, RuleField>
  let corrections = 0

  for (const rule of FIELD_RULES) {
    const field = rules[rule.field]
    if (!field) continue

    const correction = checkAndCorrectField(
      rule.field,
      rule.label,
      field,
      rule.signals,
      provider,
    )

    if (correction) {
      // Auto-correct: ganti value mengikuti sinyal dari source_quote
      field.value = correction.newValue
      corrections++
    }
  }

  if (corrections > 0) {
    console.warn(
      `[validateExtraction] Total koreksi untuk request ini: ${corrections} field(s). ` +
      `Provider: ${provider}. Pantau frekuensi ini untuk menilai kualitas prompt.`,
    )
  } else {
    console.log(
      `[validateExtraction] Semua field enum konsisten (0 koreksi). Provider: ${provider}.`,
    )
  }

  return { result, corrections }
}
