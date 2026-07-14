/**
 * lib/callGemini.ts
 *
 * Spec D2 — Wiring dasar ke Gemini API.
 * Spec D3 — Scoping prompt: dokumen dengan spesifikasi ganda.
 * PRD v6, Bagian 3.3 (catatan scoping ekstraksi) & Bagian 3.4 (skema JSON output)
 *           & Bagian 10 poin 4.
 *
 * Mengirim teks polos (dari PDF maupun .docx) ke Gemini Flash dan
 * meminta balikan JSON terstruktur sesuai skema Bagian 3.4.
 *
 * D3 menambahkan instruksi scoping eksplisit di SYSTEM_PROMPT:
 * AI hanya boleh mengekstrak aturan dari bagian Laporan/Skripsi/TA utama,
 * mengabaikan aturan Naskah Publikasi/Jurnal/Lampiran meski ada di dokumen
 * yang sama. Field tidak tersebut di bagian relevan → detected: false,
 * walau angka mirip muncul di bagian lain.
 *
 * Validasi rentang nilai dikerjakan di Spec D4.
 */

// ---------------------------------------------------------------------------
// Tipe: skema JSON yang diharapkan dari Gemini (sesuai PRD Bagian 3.4)
// ---------------------------------------------------------------------------

export interface RuleField {
  value: string | number | boolean | null
  detected: boolean
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
    "paper_size":              { "value": string|null,  "detected": boolean },
    "margin_left_cm":          { "value": number|null,  "detected": boolean },
    "margin_right_cm":         { "value": number|null,  "detected": boolean },
    "margin_top_cm":           { "value": number|null,  "detected": boolean },
    "margin_bottom_cm":        { "value": number|null,  "detected": boolean },
    "font_family":             { "value": string|null,  "detected": boolean },
    "font_size":               { "value": number|null,  "detected": boolean },
    "line_spacing":            { "value": number|null,  "detected": boolean },
    "page_number_position":    { "value": string|null,  "detected": boolean },
    "front_matter_numbering":  { "value": string|null,  "detected": boolean },
    "main_body_numbering":     { "value": string|null,  "detected": boolean },
    "chapter_title_case":      { "value": string|null,  "detected": boolean },
    "chapter_title_align":     { "value": string|null,  "detected": boolean },
    "chapter_number_format":   { "value": string|null,  "detected": boolean },
    "subchapter_number_format":{ "value": string|null,  "detected": boolean }
  },
  "missing_fields": [array of field names where detected is false]
}

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
- All "source" fields must be omitted (they are added server-side, not by you).`

// ---------------------------------------------------------------------------
// Gemini REST endpoint helpers
// ---------------------------------------------------------------------------

const GEMINI_MODEL = 'gemini-2.5-flash-lite'
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

function buildGeminiUrl(apiKey: string): string {
  return `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Kirim `text` ke Gemini API dan parse hasilnya sebagai GeminiExtractionResult.
 *
 * @param text  Teks polos hasil ekstraksi PDF atau .docx (dari Spec D1 / C1).
 *              Tidak ada batasan panjang di spec ini — Spec D3+ yang menangani
 *              truncation atau chunking jika diperlukan.
 *
 * @returns  GeminiExtractionResult jika berhasil,
 *           atau GeminiCallError jika API error atau JSON tidak bisa di-parse.
 */
export async function callGemini(
  text: string,
): Promise<GeminiExtractionResult | GeminiCallError> {
  // Pastikan API key tersedia
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return {
      type: 'error',
      code: 'missing_key',
      error: 'GEMINI_API_KEY tidak ditemukan di environment variables.',
    }
  }

  // Bangun request body sesuai Gemini REST API v1beta
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
      // Minta Gemini menghasilkan JSON langsung
      responseMimeType: 'application/json',
      temperature: 0.1,  // rendah untuk konsistensi ekstraksi
    },
  }

  let response: Response
  try {
    response = await fetch(buildGeminiUrl(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error'
    console.error('[callGemini] fetch error:', message)
    return {
      type: 'error',
      code: 'api_error',
      error: `Gagal menghubungi Gemini API: ${message}`,
    }
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '(no body)')
    console.error(`[callGemini] HTTP ${response.status}:`, body)
    return {
      type: 'error',
      code: 'api_error',
      error: `Gemini API mengembalikan status ${response.status}.`,
    }
  }

  // Parse response envelope
  let envelope: unknown
  try {
    envelope = await response.json()
  } catch {
    return {
      type: 'error',
      code: 'parse_error',
      error: 'Respons Gemini API tidak bisa di-parse sebagai JSON.',
    }
  }

  // Ekstrak teks kandidat dari envelope Gemini
  const rawText = extractTextFromEnvelope(envelope)
  if (rawText === null) {
    console.error('[callGemini] Unexpected envelope structure:', JSON.stringify(envelope).slice(0, 300))
    return {
      type: 'error',
      code: 'parse_error',
      error: 'Struktur respons Gemini API tidak dikenali.',
    }
  }

  // Parse JSON hasil ekstraksi
  let parsed: unknown
  try {
    // Gemini kadang membungkus JSON dengan backtick fences meski sudah
    // diminta responseMimeType json — bersihkan kalau ada.
    const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
    parsed = JSON.parse(cleaned)
  } catch {
    console.error('[callGemini] JSON parse failed. Raw text:', rawText.slice(0, 500))
    return {
      type: 'error',
      code: 'parse_error',
      error: 'JSON dari Gemini tidak bisa di-parse. Coba unggah ulang dokumen.',
    }
  }

  // Tag semua field yang terdeteksi dengan source: 'ai_extraction'
  const result = tagAiSource(parsed as GeminiExtractionResult)

  console.log('[callGemini] Berhasil. is_relevant:', result.is_relevant,
    '| missing_fields:', result.missing_fields)

  return result
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
 * Tandai setiap field rule yang detected:true dengan source:'ai_extraction'.
 * Field dengan detected:false dibiarkan tanpa source (akan diisi oleh Spec C2 jika relevan).
 */
function tagAiSource(result: GeminiExtractionResult): GeminiExtractionResult {
  const rules = result.rules as unknown as Record<string, RuleField>
  for (const key of Object.keys(rules)) {
    const field = rules[key]
    if (field && field.detected) {
      field.source = 'ai_extraction'
    }
  }
  return result
}
