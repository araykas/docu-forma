# Architecture — DocuForma AI

**Versi:** 1.0  
**Terakhir diperbarui:** Juli 2026

---

## 1. Gambaran Arsitektur

DocuForma AI adalah aplikasi Next.js dengan arsitektur monolitik. Frontend dan backend berjalan dalam satu proses Node.js — tidak ada service terpisah, tidak ada database, tidak ada message queue.

```
Browser
  │
  │  HTTP (multipart/form-data)
  ▼
Next.js App Router (Node.js)
  ├── app/                 ← React Server Components + Client Components
  │   ├── page.tsx         ← Halaman upload (SSR)
  │   ├── review/page.tsx  ← Halaman review (SSR, konten diisi client)
  │   └── api/             ← API Routes (Node.js serverless functions)
  │       ├── upload/      ← Pipeline utama: validasi + ekstraksi + AI
  │       ├── generate/    ← Generator .docx
  │       └── analyze/     ← Endpoint analisis mandiri
  │
  ├── components/          ← Client Components (React, browser)
  │   ├── FileUpload.tsx   ← State upload + fetch ke /api/upload
  │   └── ReviewPage.tsx   ← Form review + preview + fetch ke /api/generate
  │
  └── lib/                 ← Pure functions (business logic, tanpa Next.js dependency)
      ├── callGemini.ts
      ├── validateExtraction.ts
      ├── extractionToGroups.ts
      ├── fieldConfig.ts
      ├── generateDocx.ts
      ├── extractPdfText.ts
      ├── extractDocxText.ts
      ├── validateFile.ts
      └── rateLimit.ts
```

Tidak ada koneksi ke database eksternal. Tidak ada file storage. Semua data diproses in-memory dan tidak ada yang dipersist setelah request selesai.

---

## 2. Separation of Concerns

### lib/ — Business Logic

Seluruh logika bisnis ada di `lib/` sebagai pure TypeScript functions yang tidak bergantung pada Next.js atau browser API. Desain ini memiliki dua implikasi penting:

1. **Testable secara independen** — semua unit test di `__tests__/lib/` dapat menjalankan fungsi-fungsi ini tanpa harus menjalankan server Next.js
2. **Portabel** — jika stack diganti (misalnya ke Express atau Fastify), `lib/` tidak perlu diubah

Tanggung jawab tiap file:

| File | Tanggung Jawab Tunggal |
|---|---|
| `callGemini.ts` | Komunikasi dengan Gemini API, multi-key rotation, parsing envelope |
| `validateExtraction.ts` | Koreksi mismatch value vs source_quote (post-processing AI) |
| `extractionToGroups.ts` | Transformasi output AI → struktur FieldGroup[] untuk UI |
| `fieldConfig.ts` | Sumber kebenaran tunggal untuk semua konstanta enum, range, label |
| `generateDocx.ts` | Pembuatan binary .docx dari rules |
| `extractPdfText.ts` | Ekstraksi teks dari PDF |
| `extractDocxText.ts` | Ekstraksi teks dari DOCX |
| `validateFile.ts` | Validasi file: magic bytes, ukuran, password, zip-bomb |
| `rateLimit.ts` | Rate limiting per IP (sliding window in-memory) |

### app/api/ — HTTP Layer

API routes hanya bertanggung jawab atas:
- Parsing request HTTP (form-data, JSON body)
- Memanggil fungsi dari `lib/`
- Membentuk response HTTP (status code, headers, body)
- Menangani error dan selalu mengembalikan response terstruktur

API routes tidak mengandung business logic. Contoh: `app/api/upload/route.ts` memanggil `validateFileBuffer()`, `extractPdfText()`, `callGemini()` — semua logika ada di lib, bukan di route.

### components/ — UI Layer

Client components hanya bertanggung jawab atas:
- State management UI (drag state, loading state, form state)
- Menampilkan data ke user
- Memanggil API routes via `fetch`
- Navigasi antar halaman

Components tidak mengandung business logic. Transformasi data ekstraksi AI → form fields dilakukan di `lib/extractionToGroups.ts`, bukan di dalam component.

---

## 3. Alur Data

```
FileUpload.tsx
  │
  │ FormData (file binary)
  ▼
POST /api/upload
  │
  ├─→ validateFileBuffer()     [magic bytes, ukuran, zip-bomb]
  ├─→ isPdfPasswordProtected() [khusus PDF]
  ├─→ extractPdfText()         [PDF → string]
  │   atau extractDocxText()   [DOCX → string]
  └─→ callGemini(text)
        │
        ├─→ loadApiKeys()            [env vars]
        ├─→ fetch Gemini REST API
        ├─→ extractTextFromEnvelope()
        ├─→ tagAiSource()
        └─→ validateAndCorrectExtraction()  [Spec D4]
              │
              ▼
        GeminiExtractionResult
              │
              ▼
  Response JSON { ok: true, extraction: ... }
              │
              ▼ (disimpan ke sessionStorage)
              │
ReviewPage.tsx
  │
  ├─→ loadInitialGroups()
  │     └─→ extractionToGroups()   [mapping AI result → FieldGroup[]]
  │
  │ (user review + koreksi)
  │
  │ POST { rules, content }
  ▼
POST /api/generate
  │
  ├─→ validateRules()     [whitelist + clamp]
  └─→ generateDocx()
        │
        ▼
  Response: binary .docx
        │
        ▼ (browser download)
```

---

## 4. Keamanan

### 4.1 Validasi Input File

Validasi file tidak bergantung pada ekstensi atau MIME type yang dikirim browser (keduanya mudah dipalsukan). Sebaliknya, `validateFileBuffer()` di `lib/validateFile.ts` memeriksa:

- **Magic bytes:** 4 byte pertama dibandingkan dengan signature PDF (`%PDF` = `25 50 44 46`) dan ZIP (`PK\x03\x04` = `50 4b 03 04`). File yang bukan keduanya langsung ditolak.
- **Ukuran:** Buffer diperiksa sebelum diproses lebih lanjut. File > 10 MB ditolak.
- **Struktur DOCX:** File ZIP kemudian dibuka dengan JSZip dan diperiksa keberadaan `[Content_Types].xml` dan `word/document.xml`. ZIP yang tidak mengandung keduanya (misalnya `.zip` biasa, `.xlsx`, `.pptx`) ditolak.
- **Zip-bomb prevention:** Total ukuran semua entry setelah dekompresi dihitung dari metadata tanpa benar-benar mendekompresi isi. Jika melampaui 50 MB, file ditolak dengan pesan spesifik.
- **PDF password:** `isPdfPasswordProtected()` mencoba membuka PDF dengan PDF.js. Error `PasswordException` berarti file terkunci.

### 4.2 Sanitasi Data dari AI

Output dari Gemini tidak dipercaya langsung. Sebelum digunakan:

- `source_quote` disanitasi: nilai non-string dijadikan `null`, string kosong dijadikan `null`, panjang di-truncate ke 300 karakter (`callGemini.ts`, fungsi `sanitizeSourceQuote`)
- Sebelum diteruskan ke generator, semua 16 field divalidasi ulang di `validateRules()` (`app/api/generate/route.ts`):
  - Field string enum dicek terhadap whitelist (nilai di luar whitelist → fallback)
  - Field numerik di-clamp ke range valid (nilai NaN atau di luar range → fallback)
  - Tidak ada field yang diteruskan mentah-mentah ke library docx

### 4.3 Proteksi API Key

API key Gemini tidak pernah dikirim ke browser. Alurnya:

```
Browser → POST /api/upload (tidak ada key) → Server membaca process.env → fetch ke Gemini
```

- Key disimpan di `.env.local` yang ada di `.gitignore`
- Key dibaca hanya di server-side code (`lib/callGemini.ts`)
- Jika request dari browser mencoba membaca `GEMINI_API_KEY_*`, Next.js tidak akan meneruskan environment variable server ke client

Untuk multi-key, semua key ada di environment variables dan tidak ada yang hard-coded.

### 4.4 Rate Limiting

`lib/rateLimit.ts` mengimplementasikan sliding window rate limiter in-memory:

- **Batas:** 10 request per IP per 60 detik
- **Scope:** Per instance Node.js (di Vercel: per serverless function instance)
- **Cleanup:** Timer setiap 5 menit membersihkan entry IP yang sudah tidak aktif untuk mencegah memory leak
- **IP extraction:** Membaca `x-forwarded-for` (ambil entry pertama dari chain) atau `x-real-ip`, dengan fallback ke string `'unknown'`

Diterapkan di ketiga route: `/api/upload`, `/api/generate`, `/api/analyze`.

### 4.5 Tidak Ada SQL Injection

Aplikasi ini tidak memiliki database, sehingga SQL injection tidak relevan. Tidak ada query builder, ORM, atau koneksi database yang dipakai.

Risiko injeksi yang relevan adalah **prompt injection** — teks dari dokumen yang diupload bisa mengandung instruksi tersembunyi untuk AI ("ignore previous instructions"). Mitigasi yang ada:

- Teks dokumen ditempatkan sebagai konten user message, bukan sebagai bagian dari system prompt
- System prompt diset secara terpisah dan tidak bisa ditimpa oleh user message
- Respons AI selalu divalidasi terhadap skema JSON yang ketat — instruksi yang tidak membentuk JSON valid akan gagal di layer parsing

### 4.6 Error Handling dan Information Disclosure

Detail error teknis (stack trace, pesan dari library, nama file internal) tidak pernah dikirim ke browser. Semua route API menangkap exception di `try-catch` level atas dan mengembalikan pesan generik:

```typescript
return Response.json({
  ok: false,
  error: 'Terjadi kesalahan pada server. Silakan coba lagi.',
}, { status: 500 })
```

Detail error di-log ke `console.error` untuk server-side observability.

---

## 5. Keputusan Teknis

### 5.1 Kenapa Next.js App Router

Next.js App Router dipilih karena menyatukan frontend (React) dan backend (API Routes) dalam satu proyek tanpa setup terpisah. Untuk proyek skala MVP ini, overhead mengelola dua repository atau dua deployment tidak sebanding manfaatnya.

App Router (bukan Pages Router) dipilih karena:
- Mendukung React Server Components untuk halaman yang bisa dirender di server
- Co-location yang lebih jelas antara route dan komponen terkait
- `export const runtime = 'nodejs'` dan `export const maxDuration` per-route memberikan kontrol granular atas eksekusi serverless

### 5.2 Kenapa Tidak Menyimpan File

Seluruh pipeline didesain in-memory (tidak ada disk write) karena:
- Deployment ke Vercel (dan platform serverless lainnya) tidak memiliki persistent disk storage
- Menyimpan file membutuhkan object storage eksternal (S3, GCS) yang menambah kompleksitas, biaya, dan tanggung jawab privasi
- File yang diupload hanya dibutuhkan selama satu request — tidak ada alasan untuk mempersistnya

### 5.3 Kenapa sessionStorage untuk Data Ekstraksi

Hasil ekstraksi AI disimpan di `sessionStorage` browser (bukan URL params, bukan cookies, bukan server state) karena:
- Data cukup besar (JSON dengan 16 field + kutipan) — tidak praktis di URL
- Data hanya dibutuhkan selama satu sesi browser — `sessionStorage` otomatis dibersihkan saat tab ditutup
- Tidak ada kebutuhan untuk persist data antar sesi atau antar device
- Menghindari round-trip tambahan ke server untuk mengambil data kembali

### 5.4 Kenapa Library `docx` (bukan templating)

Dua pendekatan utama untuk generate `.docx`:
1. **Template-based:** Mulai dari file `.docx` template dan isi placeholder
2. **Programmatic (library `docx`):** Bangun dokumen dari awal secara programatis

Pendekatan programatic dipilih karena:
- Setiap user bisa memiliki kombinasi setting yang berbeda — tidak ada satu template yang cocok untuk semua
- Menghindari kebutuhan menyimpan file template di server
- Library `docx` v9 mendukung semua fitur yang dibutuhkan: multi-section, header/footer per section, penomoran halaman custom, format heading

Tradeoff: override warna heading harus dilakukan eksplisit di setiap `TextRun` karena library mewarisi style Word default (biru untuk Heading 1). Ini sudah ditangani di `generateDocx.ts`.

### 5.5 Kenapa Multi-Key Rotation (Bukan Single Key)

Gemini free tier memiliki rate limit per key. Untuk proyek yang diujikan ke banyak pengguna sekaligus (misalnya demo di kelas), satu key mudah terkena 429. Multi-key rotation memungkinkan throughput lebih tinggi tanpa biaya tambahan (cukup daftarkan beberapa akun Google).

Implementasi sequential (bukan round-robin) dipilih karena:
- Lebih sederhana
- Key-1 selalu diutamakan — jika key-1 sehat, key lain tidak terpakai dan tidak menghabiskan kuota mereka
- Memudahkan debugging (selalu tahu key mana yang dipakai pertama)

### 5.6 Kenapa Jest + ts-jest (Bukan Vitest)

Vitest lebih modern dan lebih cepat untuk proyek Vite. Namun proyek ini menggunakan Next.js (Webpack/Turbopack), bukan Vite. Jest + ts-jest adalah kombinasi yang paling mature dan paling banyak dokumentasinya untuk Next.js + TypeScript, dengan dukungan modul mock yang kuat (dibutuhkan untuk mock `fetch`, `unpdf`, `mammoth`, dan `jszip`).
