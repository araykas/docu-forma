/**
 * DocuForma AI — Backend Entry Point
 * Node.js + Express 4 + Multer 2 + Groq SDK
 * Vercel Serverless Function: module.exports = app
 */

'use strict'

const express = require('express')
const cors = require('cors')
const multer = require('multer')
const mammoth = require('mammoth')
const pdfParse = require('pdf-parse')
const FALLBACK_TEMPLATE = require('./fallback')

// Groq SDK ships as ESM-only in newer versions — handle both export styles
let GroqClass
try {
  const groqModule = require('groq-sdk')
  // groq-sdk may export as { default: Groq } or directly as Groq
  GroqClass = groqModule.default ?? groqModule
} catch (e) {
  console.error('[DocuForma] groq-sdk load error:', e.message)
  GroqClass = null
}

// ─────────────────────────────────────────────
// App Setup
// ─────────────────────────────────────────────
const app = express()

// CORS — izinkan semua origin (frontend Vercel & localhost)
app.use(
  cors({
    origin: true, // Reflect request origin — aman untuk deployment publik read-only API
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  })
)

// Handle preflight OPTIONS
app.options('*', cors())

app.use(express.json({ limit: '1mb' }))

// ─────────────────────────────────────────────
// Multer — Memory Storage
// ─────────────────────────────────────────────
const ALLOWED_MIMETYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
  'image/png',
  'image/jpeg',
])

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMETYPES.has(file.mimetype)) {
      cb(null, true)
    } else {
      cb(
        Object.assign(new Error('Format file tidak didukung. Gunakan .docx, .pdf, .png, atau .jpg.'), {
          code: 'INVALID_FILETYPE',
        })
      )
    }
  },
})

// ─────────────────────────────────────────────
// Groq System Prompt
// ─────────────────────────────────────────────
const GROQ_SYSTEM_PROMPT = `Kamu adalah AI ekstraksi struktur dokumen akademik.

TUGAS UTAMA:
Analisis teks dokumen yang diberikan dan kembalikan struktur kerangkanya TANPA isi informasi sensitif/spesifik.

ATURAN KETAT:
1. HAPUS semua nama orang, nama institusi, tanggal spesifik, data angka, hasil penelitian, dan informasi personal.
2. GANTI semua isi tersebut dengan placeholder dalam format [Deskripsi Singkat di Sini].
3. PERTAHANKAN struktur heading, sub-heading, dan urutan BAB/bagian dokumen.
4. DETEKSI jenis dokumen: "academic", "letter", atau "proposal".

FORMAT RESPONS — kembalikan HANYA objek JSON ini, tanpa markdown, tanpa penjelasan:
{
  "source": "groq",
  "docType": "academic",
  "detectedTitle": "",
  "detectedSupervisor": "",
  "sections": [
    {
      "type": "cover|preface|toc|chapter|bibliography|section",
      "number": "I",
      "title": "JUDUL BAB",
      "heading": "heading jika bukan chapter",
      "subsections": [{ "number": "1.1", "title": "Sub-judul", "content": "[placeholder]" }],
      "content": "[placeholder jika tidak ada subsections]",
      "items": [{ "label": "Kata Pengantar", "page": "i", "indent": false }]
    }
  ]
}`

// ─────────────────────────────────────────────
// Helper: Ekstrak teks dari file
// ─────────────────────────────────────────────
async function extractText(file) {
  const { mimetype, buffer } = file

  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer })
    if (!result.value || result.value.trim().length < 10) {
      throw new Error('File .docx kosong atau tidak dapat dibaca.')
    }
    return { text: result.value, isImage: false }
  }

  if (mimetype === 'application/pdf') {
    const result = await pdfParse(buffer)
    if (!result.text || result.text.trim().length < 10) {
      throw new Error('File PDF kosong, terproteksi, atau hanya berisi gambar scan.')
    }
    return { text: result.text, isImage: false }
  }

  if (mimetype === 'image/png' || mimetype === 'image/jpeg') {
    const base64 = buffer.toString('base64')
    return {
      base64: `data:${mimetype};base64,${base64}`,
      isImage: true,
    }
  }

  throw new Error('Format file tidak dikenali.')
}

// ─────────────────────────────────────────────
// Helper: Panggil Groq API
// ─────────────────────────────────────────────
async function analyzeWithGroq(extractedData) {
  if (!GroqClass) throw new Error('Groq SDK tidak tersedia.')

  const groq = new GroqClass({ apiKey: process.env.GROQ_API_KEY })

  if (extractedData.isImage) {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.2-11b-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: GROQ_SYSTEM_PROMPT + '\n\nAnalisis gambar dokumen ini:' },
            { type: 'image_url', image_url: { url: extractedData.base64 } },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1,
    })
    return completion.choices[0]?.message?.content ?? null
  }

  // Teks — potong agar tidak overflow context window (±12k karakter ≈ 3k token)
  const truncated = extractedData.text.slice(0, 12000)

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: GROQ_SYSTEM_PROMPT },
      { role: 'user', content: `Analisis dokumen berikut dan kembalikan JSON strukturnya:\n\n${truncated}` },
    ],
    max_tokens: 4096,
    temperature: 0.1,
    response_format: { type: 'json_object' },
  })
  return completion.choices[0]?.message?.content ?? null
}

// ─────────────────────────────────────────────
// Helper: Parse JSON respons Groq (robustly)
// ─────────────────────────────────────────────
function parseGroqResponse(raw) {
  if (!raw) return null
  try {
    const cleaned = raw
      .replace(/^```json\s*/im, '')
      .replace(/^```\s*/im, '')
      .replace(/```\s*$/im, '')
      .trim()
    const parsed = JSON.parse(cleaned)
    // Validasi minimal
    if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) return null
    return parsed
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────
app.get('/api', (_req, res) => {
  res.json({ status: 'ok', version: '2.0', message: 'DocuForma AI API is running' })
})

app.post('/api/analyze', upload.single('file'), async (req, res) => {
  // Multer error akan ditangani oleh error handler di bawah
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file yang diunggah.' })
    }

    // Tanpa API key → langsung fallback (jangan 500)
    if (!process.env.GROQ_API_KEY) {
      console.warn('[DocuForma] GROQ_API_KEY tidak ditemukan — fallback diaktifkan.')
      return res.status(200).json({
        ...FALLBACK_TEMPLATE,
        warning: 'GROQ_API_KEY belum dikonfigurasi di server. Menggunakan template standar.',
      })
    }

    // Ekstrak teks
    let extracted
    try {
      extracted = await extractText(req.file)
    } catch (err) {
      console.warn('[DocuForma] Gagal ekstrak file:', err.message)
      // File bermasalah tapi kita tetap beri template standar
      return res.status(200).json({
        ...FALLBACK_TEMPLATE,
        warning: `Gagal membaca isi file: ${err.message}. Menggunakan template standar.`,
      })
    }

    // Panggil Groq
    let raw
    try {
      raw = await analyzeWithGroq(extracted)
    } catch (err) {
      console.warn('[DocuForma] Groq error:', err.status, err.message)
      const isRateLimit = err.status === 429 || /rate.?limit|quota|capacity/i.test(err.message ?? '')
      return res.status(200).json({
        ...FALLBACK_TEMPLATE,
        warning: isRateLimit
          ? 'Groq API sedang kelebihan beban (rate limit). Menggunakan template standar.'
          : `Groq API tidak tersedia (${err.message ?? 'unknown'}). Menggunakan template standar.`,
      })
    }

    // Parse respons
    const parsed = parseGroqResponse(raw)
    if (!parsed) {
      console.warn('[DocuForma] Respons Groq tidak valid — fallback.')
      return res.status(200).json({
        ...FALLBACK_TEMPLATE,
        warning: 'Respons AI tidak dapat diproses. Menggunakan template standar.',
      })
    }

    return res.status(200).json(parsed)
  } catch (err) {
    // Absolute last resort — TIDAK BOLEH 500
    console.error('[DocuForma] Unhandled error di /api/analyze:', err)
    return res.status(200).json({
      ...FALLBACK_TEMPLATE,
      warning: 'Terjadi kesalahan tak terduga di server. Menggunakan template standar.',
    })
  }
})

// ─────────────────────────────────────────────
// Global error handler (Multer errors, dsb)
// ─────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[DocuForma] Express error handler:', err.message)

  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? 'Ukuran file melebihi batas 5MB.'
      : `Upload error: ${err.message}`
    return res.status(400).json({ error: msg })
  }

  if (err.code === 'INVALID_FILETYPE') {
    return res.status(400).json({ error: err.message })
  }

  // Fallback untuk error lain yang lolos
  return res.status(200).json({
    ...FALLBACK_TEMPLATE,
    warning: 'Terjadi kesalahan di server. Menggunakan template standar.',
  })
})

// ─────────────────────────────────────────────
// Export untuk Vercel Serverless
// ─────────────────────────────────────────────
module.exports = app
