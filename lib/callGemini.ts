/**
 * lib/callGemini.ts
 *
 * Spec D2 — Wiring dasar ke Gemini API.
 * Spec D3 — Scoping prompt: dokumen dengan spesifikasi ganda.
 * PRD v6, Bagian 3.3 (catatan scoping ekstraksi) & Bagian 3.4 (skema JSON output)
 *           & Bagian 10 poin 4.
 *
 * Mendukung multi-key rotation (opsi 2 — fallback sequential):
 *   Baca GEMINI_API_KEY_1 … GEMINI_API_KEY_5 dari env.
 *   Coba key pertama. Kalau kena error sementara (429, 503, 401, 403),
 *   langsung skip ke key berikutnya tanpa retry ke key yang sama.
 *   Kalau semua key habis → kembalikan error ke caller.
 *
 * Validasi enum post-processing (Spec D4) dijalankan di dalam callGemini
 * sebelum hasil dikembalikan ke caller.
 */

// ---------------------------------------------------------------------------
// Tipe: skema JSON yang diharapkan dari Gemini (sesuai PRD Bagian 3.4)
// ---------------------------------------------------------------------------

// Import Spec D4 validator — dijalankan di dalam callGemini sebelum return
import { validateAndCorrectExtraction } from '@/lib/validateExtraction'

export interface RuleField {
  value: string | number | boolean | null
  detected: boolean
  /**
   * Kutipan verbatim dari teks dokumen yang menjadi dasar deteksi field ini.
   * Diisi oleh Gemini hanya jika detected:true dan AI yakin dengan kalimat sumbernya.
   * null jika detected:false atau AI tidak yakin persis kalimat sumbernya.
   */
  source_quote?: string | null
  /** Opsional — diisi Spec C2 untuk fallback XML, bukan oleh callGemini */
  source?: 'ai_extraction' | 'docx_property_fallback'
}

export interface ExtractionRules {
  paper_size: RuleField
  margin_left_cm: RuleField
  margin_right_cm: RuleField
  margin_top_cm: RuleField
  margin_bottom_cm: RuleField
  font_family: RuleField
  font_size: RuleField
  line_spacing: RuleField
  font_color: RuleField
  page_number_position: RuleField
  front_matter_numbering: RuleField
  main_body_numbering: RuleField
  chapter_title_case: RuleField
  chapter_title_align: RuleField
  chapter_number_format: RuleField
  subchapter_number_format: RuleField
}

export interface GeminiExtractionResult {
  is_relevant: boolean
  confidence_note: string
  rules: ExtractionRules
  missing_fields: string[]
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export interface GeminiCallError {
  type: 'error'
  code:
    | 'api_error'       // HTTP error dari Gemini
    | 'parse_error'     // Respons Gemini tidak bisa di-parse sebagai JSON
    | 'missing_key'     // GEMINI_API_KEY tidak di-set
  error: string
}

// ---------------------------------------------------------------------------
// Pesan error user-facing (PRD Bagian 6 Skenario 6)
// ---------------------------------------------------------------------------

/**
 * Pesan yang ditampilkan ke user untuk semua kegagalan komunikasi dengan
 * Gemini API: 503 overloaded, 429 rate limit, timeout, error jaringan, dll.
 * Detail teknis di-log ke server console — tidak pernah dikirim ke client.
 */
const AI_UNAVAILABLE_MSG =
  'Mohon maaf, layanan AI kami sedang penuh atau mengalami gangguan. Silakan coba lagi dalam beberapa menit.'

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

/**
 * System prompt: instruksikan Gemini untuk selalu membalas dengan JSON
 * valid tanpa markdown code block (supaya mudah di-parse langsung).
 *
 * Spec D3: ditambahkan scoping eksplisit — hanya ekstrak aturan dari
 * bagian Laporan/Skripsi/TA utama; abaikan naskah publikasi, jurnal,
 * lampiran, dan bagian lain yang bukan format dokumen utama.
 * PRD v6, Bagian 3.3 "Catatan penting — scoping ekstraksi".
 */
const SYSTEM_PROMPT = `You are a document format extraction assistant.
Your task is to analyze an academic guideline document and extract formatting rules.

ALWAYS respond with a single raw JSON object — no markdown, no code fences, no explanation.
The JSON must match this exact schema:

{
  "is_relevant": boolean,
  "confidence_note": string,
  "rules": {
    "paper_size":              { "value": string|null,  "detected": boolean, "source_quote": string|null },
    "margin_left_cm":          { "value": number|null,  "detected": boolean, "source_quote": string|null },
    "margin_right_cm":         { "value": number|null,  "detected": boolean, "source_quote": string|null },
    "margin_top_cm":           { "value": number|null,  "detected": boolean, "source_quote": string|null },
    "margin_bottom_cm":        { "value": number|null,  "detected": boolean, "source_quote": string|null },
    "font_family":             { "value": string|null,  "detected": boolean, "source_quote": string|null },
    "font_size":               { "value": number|null,  "detected": boolean, "source_quote": string|null },
    "line_spacing":            { "value": number|null,  "detected": boolean, "source_quote": string|null },
    "font_color":              { "value": string|null,  "detected": boolean, "source_quote": string|null },
    "page_number_position":    { "value": string|null,  "detected": boolean, "source_quote": string|null },
    "front_matter_numbering":  { "value": string|null,  "detected": boolean, "source_quote": string|null },
    "main_body_numbering":     { "value": string|null,  "detected": boolean, "source_quote": string|null },
    "chapter_title_case":      { "value": string|null,  "detected": boolean, "source_quote": string|null },
    "chapter_title_align":     { "value": string|null,  "detected": boolean, "source_quote": string|null },
    "chapter_number_format":   { "value": string|null,  "detected": boolean, "source_quote": string|null },
    "subchapter_number_format":{ "value": string|null,  "detected": boolean, "source_quote": string|null }
  },
  "missing_fields": [array of field names where detected is false]
}

== FONT COLOR FIELD ==
The "font_color" field refers to the ink/text color mandated for the main body text of the
thesis/final-report (NOT headings, NOT cover page decoration).
- If the document explicitly states the ink/text color (e.g. "tinta hitam", "warna tinta hitam",
  "black ink"), set "detected": true and "value" to one of: "black", "white", "red", "blue",
  "green".
- Map "hitam" / "tinta hitam" / "black" → "black".
- If the document does NOT explicitly state an ink/text color, set "detected": false,
  "value": null. The default "black" will be applied automatically by the system.
- This is separate from cover color (sampul), which is irrelevant here.

== SOURCE QUOTE RULE (MANDATORY) ==
For EVERY field where "detected": true, you MUST also fill "source_quote" with a verbatim
excerpt (10–25 words) copied directly from the document text — the exact sentence or phrase
that is the basis for your detection. Do NOT paraphrase. Do NOT rewrite. Copy the exact
wording from the document.

Rules for source_quote:
- "detected": true  → "source_quote" must be a verbatim string (10–25 words from the document).
- "detected": false → "source_quote" must be null.
- If you are NOT sure which exact sentence the value came from, set "source_quote": null.
  NEVER fabricate or invent a quote. An empty/null source_quote is always safer than a
  made-up one.
- The quote must come from the same section that satisfies the SCOPING RULE below
  (main-report section only, not Naskah Publikasi or Lampiran).

Example of a correct source_quote:
  "margin_left_cm": { "value": 4, "detected": true,
    "source_quote": "Margin kiri dan atas masing-masing berjarak 4 cm dari tepi kertas" }

Example of an incorrect source_quote (paraphrase — NEVER do this):
  "source_quote": "Left margin is 4 centimeters"   ← WRONG if document says something different

== RELEVANCE RULE ==
Set "is_relevant": true only if the document contains academic writing format guidelines
for a main thesis / final project report / Laporan Tugas Akhir / Skripsi.

== SCOPING RULE (CRITICAL) ==
Academic guideline documents often contain MORE THAN ONE set of formatting rules in the
same file — for example: rules for the main Report/Thesis/Tugas Akhir AND separate rules
for a Publication Manuscript / Journal Article / Naskah Publikasi (often in an appendix).
These two sections can have DIFFERENT and CONFLICTING values for the same fields.

YOU MUST:
1. Extract rules ONLY from the section that governs the main Report / Thesis / Tugas Akhir
   / Skripsi (typically titled something like "Petunjuk Teknis Pengetikan", "Format
   Penulisan Laporan", "Tata Cara Penulisan", or similar).
2. COMPLETELY IGNORE formatting rules found in sections for other deliverables, including
   but not limited to: Naskah Publikasi, Artikel Ilmiah, Jurnal, Poster, Abstrak, or any
   section explicitly marked as "Lampiran" (Appendix) that describes a separate format.
3. If a field is NOT explicitly mentioned in the relevant main-report section, set
   "detected": false and "value": null for that field — even if a similar or matching
   number appears elsewhere in the document for a different purpose. Do NOT borrow values
   from irrelevant sections.

== PER-FIELD VERIFICATION RULE (MANDATORY) ==
Before setting "detected": true for ANY field, you MUST verify ALL of the following:
  a. The value was found in the section governing the main Laporan/Skripsi/Tugas Akhir
     (e.g. a chapter titled "Petunjuk Teknis Pengetikan", "Format Penulisan Laporan",
     "Tata Cara Penulisan Laporan", or equivalent).
  b. The value was NOT found only in a section for Naskah Publikasi, Artikel Ilmiah,
     Jurnal, Poster, Abstrak, or a Lampiran describing a separate deliverable.
  c. You are CERTAIN the section it came from is the main-report section — not a
     section that merely appears near it or shares similar topic headings.

If you cannot confirm ALL three conditions for a field, you MUST set:
  "detected": false, "value": null

WHEN IN DOUBT → detected: false. Never guess or infer from adjacent or thematically
similar sections. A wrong "detected: false" is always safer than a wrong "detected: true"
with a value borrowed from the wrong section.

EXAMPLE of what NOT to do: If the main-report section does not mention font size, but a
Naskah Publikasi section (e.g. in BAB VI or a Lampiran) says "Times New Roman 10pt",
you MUST still set "font_size": { "value": null, "detected": false }.
The fact that font size is a formatting rule does NOT make this value valid for the
main-report section. Do NOT use values from irrelevant sections under any circumstances.

== EXTRACTION RULES ==
- For each field: set "detected": true and fill "value" ONLY when the rule is explicitly
  stated in the main-report section identified above. Otherwise set "detected": false and
  "value": null.
- "missing_fields" must list every key in "rules" where "detected" is false.
- All "source" fields must be omitted (they are added server-side, not by you).

== VALUE–QUOTE CONSISTENCY RULE (CRITICAL — fixes a known AI error pattern) ==
This rule exists because AI models are known to write source_quote and value
INDEPENDENTLY, causing them to contradict each other. You MUST NOT do this.

MANDATORY two-step procedure for every detected enum field:

  STEP 1 — Write source_quote first.
    Copy the exact verbatim phrase from the document that states the rule.
    Example: "nomor halaman bab dan sub bab menggunakan angka Arab"

  STEP 2 — Derive value FROM that quote, not from memory or assumption.
    Re-read the quote you just wrote. Ask yourself:
    "What value does THIS EXACT QUOTE describe?"
    Then write value based solely on the answer to that question.

ENUM MAPPING — apply these mappings when deriving value from source_quote:

  front_matter_numbering / main_body_numbering:
    quote contains "angka arab" / "arab" / "arabic" / "1, 2, 3"  → value: "arabic"
    quote contains "romawi kecil" / "huruf kecil" / "i, ii, iii"  → value: "lowercase-roman"
    quote contains "romawi besar" / "huruf besar" / "I, II, III"  → value: "uppercase-roman"

  chapter_number_format:
    quote contains "angka romawi" / "romawi" / "I, II, III"       → value: "roman"
    quote contains "angka arab" / "arab" / "1, 2, 3"              → value: "arabic"
    quote contains "tanpa nomor" / "tidak bernomor"               → value: "none"

  subchapter_number_format:
    quote contains "desimal" / "1.1" / "2.1"                      → value: "decimal"
    quote contains "romawi"                                        → value: "roman"
    quote contains "angka arab" / "arab" (without decimal context) → value: "arabic"

  chapter_title_case:
    quote contains "kapital" / "huruf besar" / "uppercase"        → value: "uppercase"
    quote contains "kapital tiap kata" / "title case"             → value: "capitalize"
    (no explicit case mentioned)                                   → value: "normal"

  chapter_title_align:
    quote contains "tengah" / "center"                            → value: "center"
    quote contains "kiri" / "left"                                → value: "left"
    quote contains "kanan" / "right"                              → value: "right"
    quote contains "rata kiri-kanan" / "justify"                  → value: "justify"

EXAMPLE OF THE BUG YOU MUST AVOID:
  WRONG (value and quote contradict each other — this is the exact bug to prevent):
    "main_body_numbering": {
      "value": "lowercase-roman",           ← WRONG: quote says Arab, not Roman
      "source_quote": "nomor halaman bab dan sub bab menggunakan angka Arab"
    }

  CORRECT (value derived from re-reading the quote):
    "main_body_numbering": {
      "value": "arabic",                    ← correct: quote says "angka Arab" → arabic
      "source_quote": "nomor halaman bab dan sub bab menggunakan angka Arab"
    }

If you are uncertain which value the quote maps to, set detected: false rather than
guessing. A missed detection is always safer than a wrong value.`

// ---------------------------------------------------------------------------
// Gemini REST endpoint helpers
// ---------------------------------------------------------------------------

const GEMINI_MODEL = 'gemini-2.5-flash-lite'
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

function buildGeminiUrl(apiKey: string): string {
  return `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`
}

// ---------------------------------------------------------------------------
// Multi-key loader
// ---------------------------------------------------------------------------

/**
 * Baca semua API key Gemini dari environment variables.
 *
 * Urutan prioritas:
 *   1. GEMINI_API_KEY_1 … GEMINI_API_KEY_5  (multi-key, dipakai kalau ada)
 *   2. GEMINI_API_KEY                        (single-key legacy, fallback)
 *
 * Hasil: array key yang tersedia (kosong jika tidak ada sama sekali).
 * Key duplikat dan string kosong dibuang.
 */
function loadApiKeys(): string[] {
  const keys: string[] = []

  // Slot bernomor (1–5)
  for (let i = 1; i <= 5; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`]
    if (k && k.trim()) keys.push(k.trim())
  }

  // Fallback ke key tunggal kalau tidak ada key bernomor
  if (keys.length === 0) {
    const k = process.env.GEMINI_API_KEY
    if (k && k.trim()) keys.push(k.trim())
  }

  return keys
}

/**
 * HTTP status code yang dianggap "sementara" dan layak di-skip ke key berikutnya.
 * 401/403 dimasukkan karena bisa berarti key kadaluarsa/quota habis di key itu,
 * bukan berarti semua key bermasalah.
 */
const SKIP_TO_NEXT_KEY_STATUSES = new Set([401, 403, 429, 500, 503])

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Kirim `text` ke Gemini API dan parse hasilnya sebagai GeminiExtractionResult.
 *
 * Mencoba setiap API key yang tersedia secara berurutan (opsi 2 — fallback
 * sequential). Kalau key aktif mengembalikan status yang ada di
 * SKIP_TO_NEXT_KEY_STATUSES, langsung pindah ke key berikutnya.
 *
 * Setelah berhasil, hasil divalidasi oleh validateAndCorrectExtraction (Spec D4)
 * sebelum dikembalikan ke caller.
 *
 * @param text  Teks polos hasil ekstraksi PDF atau .docx.
 * @returns  GeminiExtractionResult jika berhasil,
 *           atau GeminiCallError jika semua key gagal atau terjadi error lain.
 */
export async function callGemini(
  text: string,
): Promise<GeminiExtractionResult | GeminiCallError> {
  const keys = loadApiKeys()

  if (keys.length === 0) {
    console.error('[callGemini] Tidak ada GEMINI_API_KEY yang tersedia di environment variables.')
    return {
      type: 'error',
      code: 'missing_key',
      error: 'Terjadi kesalahan konfigurasi pada server. Silakan coba lagi nanti.',
    }
  }

  console.log(`[callGemini] ${keys.length} API key tersedia. Mencoba key-1…`)

  // Bangun request body — sama untuk semua key, hanya URL yang berbeda
  const requestBody = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Berikut adalah teks dokumen pedoman penulisan. Ekstrak aturan formatnya:\n\n${text}`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  }

  let lastError: GeminiCallError | null = null

  for (let i = 0; i < keys.length; i++) {
    const apiKey = keys[i]
    const keyLabel = `key-${i + 1}`

    let response: Response
    try {
      response = await fetch(buildGeminiUrl(apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error'
      console.error(`[callGemini] ${keyLabel} fetch error (network):`, message)
      lastError = { type: 'error', code: 'api_error', error: AI_UNAVAILABLE_MSG }
      // Network error pada key ini — coba key berikutnya
      continue
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '(no body)')
      console.error(`[callGemini] ${keyLabel} HTTP ${response.status} ${response.statusText} — body:`, body)

      lastError = { type: 'error', code: 'api_error', error: AI_UNAVAILABLE_MSG }

      if (SKIP_TO_NEXT_KEY_STATUSES.has(response.status)) {
        console.warn(`[callGemini] ${keyLabel} status ${response.status} — skip ke key berikutnya.`)
        continue
      }

      // Status lain (misal 400 bad request) — masalah bukan di key, tidak perlu coba key lain
      console.error(`[callGemini] ${keyLabel} status ${response.status} bukan transient — berhenti.`)
      return lastError
    }

    // Parse envelope
    let envelope: unknown
    try {
      envelope = await response.json()
    } catch {
      console.error(`[callGemini] ${keyLabel} gagal parse envelope sebagai JSON`)
      lastError = { type: 'error', code: 'parse_error', error: AI_UNAVAILABLE_MSG }
      continue
    }

    const rawText = extractTextFromEnvelope(envelope)
    if (rawText === null) {
      console.error(`[callGemini] ${keyLabel} struktur envelope tidak terduga:`, JSON.stringify(envelope).slice(0, 300))
      lastError = { type: 'error', code: 'parse_error', error: AI_UNAVAILABLE_MSG }
      continue
    }

    let parsed: unknown
    try {
      const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
      parsed = JSON.parse(cleaned)
    } catch {
      console.error(`[callGemini] ${keyLabel} JSON parse failed. Raw text:`, rawText.slice(0, 500))
      lastError = { type: 'error', code: 'parse_error', error: AI_UNAVAILABLE_MSG }
      continue
    }

    // Berhasil — tag source, validasi D4, kembalikan
    const tagged = tagAiSource(parsed as GeminiExtractionResult)

    console.log(`[callGemini] ${keyLabel} berhasil. is_relevant:`, tagged.is_relevant,
      '| missing_fields:', tagged.missing_fields)

    const rulesMap = tagged.rules as unknown as Record<string, RuleField>
    for (const [key, field] of Object.entries(rulesMap)) {
      if (field?.detected) {
        console.log(`[callGemini] source_quote [${key}]:`, field.source_quote ?? '(kosong)')
      }
    }

    // Spec D4: validasi dan auto-koreksi enum sebelum dikembalikan ke caller
    const { result } = validateAndCorrectExtraction(tagged)
    return result
  }

  // Semua key gagal
  console.error(`[callGemini] Semua ${keys.length} key gagal.`)
  return lastError ?? { type: 'error', code: 'api_error', error: AI_UNAVAILABLE_MSG }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Ambil teks dari envelope Gemini REST API.
 * Struktur: response.candidates[0].content.parts[0].text
 *
 * Mengembalikan null jika struktur tidak sesuai.
 */
function extractTextFromEnvelope(envelope: unknown): string | null {
  if (
    typeof envelope !== 'object' ||
    envelope === null
  ) return null

  const env = envelope as Record<string, unknown>
  const candidates = env['candidates']
  if (!Array.isArray(candidates) || candidates.length === 0) return null

  const first = candidates[0] as Record<string, unknown>
  const content = first['content'] as Record<string, unknown> | undefined
  if (!content) return null

  const parts = content['parts']
  if (!Array.isArray(parts) || parts.length === 0) return null

  const part = parts[0] as Record<string, unknown>
  const text = part['text']
  if (typeof text !== 'string') return null

  return text
}

/**
 * Sanitasi nilai source_quote dari satu field:
 * - Jika bukan string, kembalikan null (toleransi field hilang/tipe salah dari AI)
 * - Jika string kosong, kembalikan null
 * - Jika panjang > MAX_SOURCE_QUOTE_LENGTH, truncate (Spec D4)
 *
 * Tidak ada validasi whitelist — source_quote adalah teks bebas.
 */
const MAX_SOURCE_QUOTE_LENGTH = 300

function sanitizeSourceQuote(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  return trimmed.length > MAX_SOURCE_QUOTE_LENGTH
    ? trimmed.slice(0, MAX_SOURCE_QUOTE_LENGTH)
    : trimmed
}

/**
 * Tandai setiap field rule yang detected:true dengan source:'ai_extraction'.
 * Field dengan detected:false dibiarkan tanpa source (akan diisi oleh Spec C2 jika relevan).
 * Spec D4: sanitasi source_quote — pastikan tipe string|null, truncate > 300 char.
 */
function tagAiSource(result: GeminiExtractionResult): GeminiExtractionResult {
  const rules = result.rules as unknown as Record<string, RuleField>
  for (const key of Object.keys(rules)) {
    const field = rules[key]
    if (!field) continue

    // Spec D4: sanitasi source_quote pada semua field (detected true maupun false)
    field.source_quote = sanitizeSourceQuote(field.source_quote)

    if (field.detected) {
      field.source = 'ai_extraction'
    }
  }
  return result
}
