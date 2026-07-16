/**
 * __tests__/lib/callGemini.test.ts
 *
 * Unit/Integration tests untuk lib/callGemini.ts (Spec D2, D3, D4)
 * Menggunakan Jest manual mock untuk `fetch` global.
 *
 * Mencakup:
 *   - Missing API key → error 'missing_key'
 *   - Respons sukses dari Gemini → parse benar
 *   - HTTP 429 → skip ke key berikutnya (multi-key rotation)
 *   - HTTP 503 → skip ke key berikutnya
 *   - Semua key gagal → error 'api_error'
 *   - Respons non-JSON dari Gemini → error 'parse_error'
 *   - Respons JSON tapi struktur envelope salah → error 'parse_error'
 *   - is_relevant:false dikembalikan apa adanya
 *   - Spec D4 validasi dipanggil (koreksi enum mismatch)
 *   - HTTP 400 (non-transient) → berhenti langsung (tidak coba key lain)
 */

import { callGemini } from '@/lib/callGemini'

// ---------------------------------------------------------------------------
// Setup: mock fetch global
// ---------------------------------------------------------------------------

const mockFetch = jest.fn()

beforeAll(() => {
  global.fetch = mockFetch
})

afterEach(() => {
  mockFetch.mockReset()
})

afterAll(() => {
  // Restore
  delete (global as Record<string, unknown>).fetch
})

// ---------------------------------------------------------------------------
// Helper: buat envelope response Gemini yang valid
// ---------------------------------------------------------------------------

function makeGeminiEnvelope(content: unknown): unknown {
  return {
    candidates: [
      {
        content: {
          parts: [{ text: JSON.stringify(content) }],
        },
      },
    ],
  }
}

/** Buat GeminiExtractionResult minimal yang valid */
function makeValidExtraction(overrides: Record<string, unknown> = {}): unknown {
  const defaultField = { value: null, detected: false, source_quote: null }
  return {
    is_relevant: true,
    confidence_note: 'ok',
    missing_fields: [],
    rules: {
      paper_size:              { ...defaultField },
      margin_left_cm:          { ...defaultField },
      margin_right_cm:         { ...defaultField },
      margin_top_cm:           { ...defaultField },
      margin_bottom_cm:        { ...defaultField },
      font_family:             { ...defaultField },
      font_size:               { ...defaultField },
      line_spacing:            { ...defaultField },
      font_color:              { ...defaultField },
      page_number_position:    { ...defaultField },
      front_matter_numbering:  { ...defaultField },
      main_body_numbering:     { ...defaultField },
      chapter_title_case:      { ...defaultField },
      chapter_title_align:     { ...defaultField },
      chapter_number_format:   { ...defaultField },
      subchapter_number_format:{ ...defaultField },
    },
    ...overrides,
  }
}

function makeOkResponse(content: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => makeGeminiEnvelope(content),
    text: async () => JSON.stringify(makeGeminiEnvelope(content)),
  }
}

function makeErrorResponse(status: number) {
  return {
    ok: false,
    status,
    statusText: `HTTP ${status}`,
    text: async () => `Error ${status}`,
  }
}

// ---------------------------------------------------------------------------
// Konfigurasi env keys
// ---------------------------------------------------------------------------

const ORIGINAL_ENV = process.env

beforeEach(() => {
  // Reset env sebelum setiap test
  process.env = { ...ORIGINAL_ENV }
  delete process.env.GEMINI_API_KEY
  for (let i = 1; i <= 5; i++) delete process.env[`GEMINI_API_KEY_${i}`]
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

// ---------------------------------------------------------------------------
// Missing key
// ---------------------------------------------------------------------------

describe('callGemini — missing API key', () => {
  test('mengembalikan error missing_key jika tidak ada env var API key', async () => {
    const result = await callGemini('dokumen pedoman test')
    expect('type' in result).toBe(true)
    if ('type' in result) {
      expect(result.type).toBe('error')
      expect(result.code).toBe('missing_key')
    }
  })

  test('GEMINI_API_KEY legacy dipakai sebagai fallback', async () => {
    process.env.GEMINI_API_KEY = 'test-legacy-key'
    const extraction = makeValidExtraction()
    mockFetch.mockResolvedValueOnce(makeOkResponse(extraction))

    const result = await callGemini('test')
    // Tidak boleh error missing_key
    expect('type' in result ? result.code : '').not.toBe('missing_key')
    // fetch harus dipanggil sekali
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Respons sukses
// ---------------------------------------------------------------------------

describe('callGemini — respons sukses', () => {
  test('mengembalikan GeminiExtractionResult saat Gemini merespons dengan benar', async () => {
    process.env.GEMINI_API_KEY_1 = 'key-1'
    const extraction = makeValidExtraction()
    mockFetch.mockResolvedValueOnce(makeOkResponse(extraction))

    const result = await callGemini('dokumen pedoman')
    expect('type' in result).toBe(false)
    if (!('type' in result)) {
      expect(result.is_relevant).toBe(true)
      expect(result.rules).toBeDefined()
      expect(result.missing_fields).toBeDefined()
    }
  })

  test('is_relevant:false dikembalikan apa adanya', async () => {
    process.env.GEMINI_API_KEY_1 = 'key-1'
    const extraction = makeValidExtraction({ is_relevant: false })
    mockFetch.mockResolvedValueOnce(makeOkResponse(extraction))

    const result = await callGemini('dokumen tidak relevan')
    if (!('type' in result)) {
      expect(result.is_relevant).toBe(false)
    }
  })

  test('source "ai_extraction" di-tag untuk field detected:true', async () => {
    process.env.GEMINI_API_KEY_1 = 'key-1'
    const extraction = makeValidExtraction()
    // Override satu field agar detected:true
    ;(extraction as Record<string, unknown>).rules = {
      ...(extraction as Record<string, { rules: unknown }>).rules,
      paper_size: { value: 'A4', detected: true, source_quote: 'ukuran kertas A4' },
    }
    mockFetch.mockResolvedValueOnce(makeOkResponse(extraction))

    const result = await callGemini('test')
    if (!('type' in result)) {
      expect(result.rules.paper_size.source).toBe('ai_extraction')
    }
  })
})

// ---------------------------------------------------------------------------
// Multi-key rotation
// ---------------------------------------------------------------------------

describe('callGemini — multi-key rotation', () => {
  test('429 pada key-1 → mencoba key-2 dan berhasil', async () => {
    process.env.GEMINI_API_KEY_1 = 'key-1'
    process.env.GEMINI_API_KEY_2 = 'key-2'

    mockFetch
      .mockResolvedValueOnce(makeErrorResponse(429))       // key-1 gagal
      .mockResolvedValueOnce(makeOkResponse(makeValidExtraction())) // key-2 berhasil

    const result = await callGemini('test')
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect('type' in result).toBe(false)
  })

  test('503 pada key-1 → mencoba key-2 dan berhasil', async () => {
    process.env.GEMINI_API_KEY_1 = 'key-1'
    process.env.GEMINI_API_KEY_2 = 'key-2'

    mockFetch
      .mockResolvedValueOnce(makeErrorResponse(503))
      .mockResolvedValueOnce(makeOkResponse(makeValidExtraction()))

    const result = await callGemini('test')
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect('type' in result).toBe(false)
  })

  test('401 pada key-1 → mencoba key-2 (401 dianggap transient per-key)', async () => {
    process.env.GEMINI_API_KEY_1 = 'key-1'
    process.env.GEMINI_API_KEY_2 = 'key-2'

    mockFetch
      .mockResolvedValueOnce(makeErrorResponse(401))
      .mockResolvedValueOnce(makeOkResponse(makeValidExtraction()))

    const result = await callGemini('test')
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect('type' in result).toBe(false)
  })

  test('semua key 429 → mengembalikan error api_error', async () => {
    process.env.GEMINI_API_KEY_1 = 'key-1'
    process.env.GEMINI_API_KEY_2 = 'key-2'
    process.env.GEMINI_API_KEY_3 = 'key-3'

    mockFetch
      .mockResolvedValueOnce(makeErrorResponse(429))
      .mockResolvedValueOnce(makeErrorResponse(429))
      .mockResolvedValueOnce(makeErrorResponse(429))

    const result = await callGemini('test')
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect('type' in result).toBe(true)
    if ('type' in result) {
      expect(result.code).toBe('api_error')
    }
  })

  test('HTTP 400 (non-transient) → berhenti langsung, tidak coba key-2', async () => {
    process.env.GEMINI_API_KEY_1 = 'key-1'
    process.env.GEMINI_API_KEY_2 = 'key-2'

    mockFetch.mockResolvedValueOnce(makeErrorResponse(400))

    const result = await callGemini('test')
    // Hanya 1 fetch call — tidak coba key-2
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect('type' in result).toBe(true)
    if ('type' in result) {
      expect(result.code).toBe('api_error')
    }
  })
})

// ---------------------------------------------------------------------------
// Parse errors
// ---------------------------------------------------------------------------

describe('callGemini — parse errors', () => {
  test('Gemini respons berisi JSON tidak valid → error parse_error', async () => {
    process.env.GEMINI_API_KEY_1 = 'key-1'

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: 'ini bukan JSON valid {{{' }],
            },
          },
        ],
      }),
      text: async () => 'bukan json',
    })

    const result = await callGemini('test')
    expect('type' in result).toBe(true)
    if ('type' in result) {
      expect(result.code).toBe('parse_error')
    }
  })

  test('envelope Gemini tidak memiliki candidates → error parse_error', async () => {
    process.env.GEMINI_API_KEY_1 = 'key-1'

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ unexpected: 'structure' }),
      text: async () => '{}',
    })

    const result = await callGemini('test')
    expect('type' in result).toBe(true)
    if ('type' in result) {
      expect(result.code).toBe('parse_error')
    }
  })

  test('network error (fetch throw) → error api_error', async () => {
    process.env.GEMINI_API_KEY_1 = 'key-1'

    mockFetch.mockRejectedValueOnce(new Error('Network failure'))

    const result = await callGemini('test')
    expect('type' in result).toBe(true)
    if ('type' in result) {
      expect(result.code).toBe('api_error')
    }
  })
})

// ---------------------------------------------------------------------------
// Spec D4 — validasi enum otomatis dipanggil
// ---------------------------------------------------------------------------

describe('callGemini — Spec D4 post-processing', () => {
  test('mismatch source_quote vs value di-koreksi oleh validateAndCorrectExtraction', async () => {
    process.env.GEMINI_API_KEY_1 = 'key-1'

    // AI mengembalikan nilai yang salah: value "arabic" padahal quote menyebut "romawi kecil"
    const extraction = makeValidExtraction()
    ;(extraction as Record<string, unknown>).rules = {
      paper_size:              { value: null, detected: false, source_quote: null },
      margin_left_cm:          { value: null, detected: false, source_quote: null },
      margin_right_cm:         { value: null, detected: false, source_quote: null },
      margin_top_cm:           { value: null, detected: false, source_quote: null },
      margin_bottom_cm:        { value: null, detected: false, source_quote: null },
      font_family:             { value: null, detected: false, source_quote: null },
      font_size:               { value: null, detected: false, source_quote: null },
      line_spacing:            { value: null, detected: false, source_quote: null },
      font_color:              { value: null, detected: false, source_quote: null },
      page_number_position:    { value: null, detected: false, source_quote: null },
      front_matter_numbering:  {
        value: 'arabic',  // SALAH
        detected: true,
        source_quote: 'bagian awal menggunakan romawi kecil i, ii, iii',
      },
      main_body_numbering:     { value: null, detected: false, source_quote: null },
      chapter_title_case:      { value: null, detected: false, source_quote: null },
      chapter_title_align:     { value: null, detected: false, source_quote: null },
      chapter_number_format:   { value: null, detected: false, source_quote: null },
      subchapter_number_format:{ value: null, detected: false, source_quote: null },
    }
    mockFetch.mockResolvedValueOnce(makeOkResponse(extraction))

    const result = await callGemini('test')
    if (!('type' in result)) {
      // Setelah Spec D4 koreksi, harusnya 'lowercase-roman', bukan 'arabic'
      expect(result.rules.front_matter_numbering.value).toBe('lowercase-roman')
    }
  })
})

// ---------------------------------------------------------------------------
// URL building
// ---------------------------------------------------------------------------

describe('callGemini — URL construction', () => {
  test('fetch dipanggil dengan URL yang mengandung API key', async () => {
    process.env.GEMINI_API_KEY_1 = 'my-secret-key-123'

    mockFetch.mockResolvedValueOnce(makeOkResponse(makeValidExtraction()))

    await callGemini('test')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('my-secret-key-123')
    expect(calledUrl).toContain('generativelanguage.googleapis.com')
  })

  test('fetch menggunakan method POST dengan Content-Type application/json', async () => {
    process.env.GEMINI_API_KEY_1 = 'test-key'

    mockFetch.mockResolvedValueOnce(makeOkResponse(makeValidExtraction()))

    await callGemini('test')

    const calledOptions = mockFetch.mock.calls[0][1] as RequestInit
    expect(calledOptions.method).toBe('POST')
    expect((calledOptions.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })
})
