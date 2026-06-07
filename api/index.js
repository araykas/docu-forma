/**
 * DocuForma AI — Backend Entry Point
 * Node.js + Express + Multer + Groq SDK
 * Dirancang sebagai Vercel Serverless Function (module.exports = app)
 */

const express = require('express')
const cors = require('cors')
const multer = require('multer')
const mammoth = require('mammoth')
const pdfParse = require('pdf-parse')
const Groq = require('groq-sdk')
const FALLBACK_TEMPLATE = require('./fallback')

// ─────────────────────────────────────────────
// App Setup
// ─────────────────────────────────────────────
const app = express()

// CORS — izinkan request dari domain frontend Vercel
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.FRONTEND_URL, // Set di Vercel env vars: https://docu-forma.vercel.app
].filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      // Izinkan request tanpa origin (Postman, curl) dan origin yang terdaftar
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error(`CORS: origin '${origin}' tidak diizinkan`))
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

app.use(express.json())

// ─────────────────────────────────────────────
// Multer — Memory Storage (file tidak disimpan ke disk)
// ─────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf',
      'image/png',
      'image/jpeg',
    ]
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Format file tidak didukung. Gunakan .docx, .pdf, .png, atau .jpg.'))
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
4. DETEKSI jenis dokumen: 'academic' (makalah/laporan/skripsi), 'letter' (surat resmi), atau 'proposal'.

FORMAT RESPONS:
Kembalikan HANYA JSON murni tanpa markdown, tanpa penjelasan, tanpa kode fence.
Struktur JSON wajib:
{
  "source": "groq",
  "docType": "academic|letter|proposal",
  "detectedTitle": "judul yang terdeteksi atau string kosong",
  "detectedSupervisor": "nama dosen yang terdeteksi atau string kosong",
  "sections": [
    {
      "type": "cover|preface|toc|chapter|bibliography|section",
      "number": "I (hanya untuk chapter)",
      "title": "JUDUL BAGIAN",
      "heading": "heading jika bukan chapter",
      "subsections": [
        {
          "number": "1.1",
          "title": "Judul Sub-bagian",
          "content": "[Placeholder isi sub-bagian ini]"
        }
      ],
      "content": "[Placeholder konten jika tidak ada subsections]"
    }
  ]
}

PENTING: Jika dokumen tidak memiliki struktur BAB yang jelas, buat struktur minimal dengan bagian-bagian yang terdeteksi.`

// ─────────────────────────────────────────────
// Helper: Ekstrak teks dari file
// ─────────────────────────────────────────────
async function extractText(file) {
  const { mimetype, buffer } = file

  // .docx
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer })
    return { text: result.value, isImage: false }
  }

  // .pdf
  if (mimetype === 'application/pdf') {
    const result = await pdfParse(buffer)
    return { text: result.text, isImage: false }
  }

  // gambar — konversi ke base64 untuk vision model
  if (mimetype === 'image/png' || mimetype === 'image/jpeg') {
    const base64 = buffer.toString('base64')
    const mimePrefix = mimetype === 'image/png' ? 'image/png' : 'image/jpeg'
    return { base64: `data:${mimePrefix};base64,${base64}`, isImage: true }
  }

  throw new Error('Format file tidak dikenali')
}

// ─────────────────────────────────────────────
// Helper: Panggil Groq API
// ─────────────────────────────────────────────
async function analyzeWithGroq(extractedData) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  let messages

  if (extractedData.isImage) {
    // Gunakan vision model untuk gambar
    messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: GROQ_SYSTEM_PROMPT + '\n\nAnalisis gambar dokumen ini dan ekstrak strukturnya:',
          },
          {
            type: 'image_url',
            image_url: { url: extractedData.base64 },
          },
        ],
      },
    ]

    const completion = await groq.chat.completions.create({
      model: 'llama-3.2-11b-vision-preview',
      messages,
      max_tokens: 4096,
      temperature: 0.1,
    })

    return completion.choices[0]?.message?.content || null
  } else {
    // Model teks untuk .docx dan .pdf
    // Batasi teks agar tidak melebihi konteks model (~6000 kata)
    const truncatedText = extractedData.text.slice(0, 12000)

    messages = [
      { role: 'system', content: GROQ_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Analisis dokumen berikut dan kembalikan struktur JSON-nya:\n\n${truncatedText}`,
      },
    ]

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      messages,
      max_tokens: 4096,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    })

    return completion.choices[0]?.message?.content || null
  }
}

// ─────────────────────────────────────────────
// Helper: Parse JSON dari respons Groq
// ─────────────────────────────────────────────
function parseGroqResponse(rawText) {
  if (!rawText) return null
  try {
    // Bersihkan kemungkinan markdown code fence
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────
// Route: Health check
// ─────────────────────────────────────────────
app.get('/api', (req, res) => {
  res.json({ status: 'ok', message: 'DocuForma AI API is running' })
})

// ─────────────────────────────────────────────
// Route: POST /api/analyze
// ─────────────────────────────────────────────
app.post('/api/analyze', upload.single('file'), async (req, res) => {
  try {
    // Validasi: file wajib ada
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file yang diunggah.' })
    }

    // Validasi: GROQ_API_KEY harus tersedia
    if (!process.env.GROQ_API_KEY) {
      console.warn('[DocuForma] GROQ_API_KEY tidak ditemukan — menggunakan fallback template.')
      return res.json({
        ...FALLBACK_TEMPLATE,
        warning: 'GROQ_API_KEY belum dikonfigurasi. Menggunakan template standar.',
      })
    }

    // Step 1: Ekstrak teks dari file
    let extractedData
    try {
      extractedData = await extractText(req.file)
    } catch (extractErr) {
      console.error('[DocuForma] Gagal ekstrak file:', extractErr.message)
      return res.status(422).json({ error: `Gagal membaca file: ${extractErr.message}` })
    }

    // Step 2: Kirim ke Groq API
    let groqRaw
    try {
      groqRaw = await analyzeWithGroq(extractedData)
    } catch (groqErr) {
      // Rate limit / timeout / network error → fallback
      console.warn('[DocuForma] Groq API error:', groqErr.message)

      const isRateLimit =
        groqErr.status === 429 ||
        groqErr.message?.toLowerCase().includes('rate limit') ||
        groqErr.message?.toLowerCase().includes('quota')

      return res.json({
        ...FALLBACK_TEMPLATE,
        warning: isRateLimit
          ? 'Groq API rate limit tercapai. Menggunakan template standar.'
          : 'Groq API tidak tersedia saat ini. Menggunakan template standar.',
      })
    }

    // Step 3: Parse JSON dari Groq
    const parsed = parseGroqResponse(groqRaw)

    if (!parsed || !parsed.sections || !Array.isArray(parsed.sections)) {
      // Groq mengembalikan respons tapi format salah → fallback
      console.warn('[DocuForma] Respons Groq tidak valid, fallback diaktifkan.')
      return res.json({
        ...FALLBACK_TEMPLATE,
        warning: 'Respons AI tidak dapat diproses. Menggunakan template standar.',
      })
    }

    // Step 4: Sukses — kirim hasil
    return res.json(parsed)
  } catch (err) {
    console.error('[DocuForma] Unhandled error:', err)
    // Last resort fallback — server tidak boleh crash
    return res.json({
      ...FALLBACK_TEMPLATE,
      warning: 'Terjadi kesalahan tak terduga. Menggunakan template standar.',
    })
  }
})

// ─────────────────────────────────────────────
// Error handler Multer
// ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Ukuran file melebihi batas 5MB.' })
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` })
  }
  if (err.message) {
    return res.status(400).json({ error: err.message })
  }
  next(err)
})

// ─────────────────────────────────────────────
// Export untuk Vercel Serverless
// ─────────────────────────────────────────────
module.exports = app
