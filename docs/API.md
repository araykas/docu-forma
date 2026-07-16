# API Reference — DocuForma AI

**Versi:** 1.0  
**Terakhir diperbarui:** Juli 2026  
**Base URL (development):** `http://localhost:3000`

Semua endpoint:
- Hanya menerima method yang disebutkan — method lain mengembalikan 405
- Diterapkan rate limiting: **10 request per IP per 60 detik** (lintas semua endpoint)
- `maxDuration` diset eksplisit di setiap route untuk deployment Vercel

---

## Daftar Endpoint

| Method | Path | Fungsi |
|---|---|---|
| `POST` | `/api/upload` | Pipeline utama: validasi file + ekstraksi teks + analisis AI |
| `POST` | `/api/generate` | Generate dan download file `.docx` |
| `POST` | `/api/analyze` | Analisis teks polos yang sudah diekstrak (tanpa upload file) |

---

## POST /api/upload

Pipeline utama. Menerima file PDF atau DOCX, memvalidasi, mengekstrak teks, dan memanggil Gemini AI untuk mengekstrak 16 aturan format.

**Konfigurasi:**
- `runtime: 'nodejs'`
- `maxDuration: 55` detik

### Request

```
Content-Type: multipart/form-data
```

| Field | Tipe | Keterangan |
|---|---|---|
| `file` | File | File PDF atau DOCX, maks. 10 MB |

### Response — Sukses (PDF)

```
HTTP 200 OK
Content-Type: application/json
```

```json
{
  "ok": true,
  "mimeType": "application/pdf",
  "totalPages": 42,
  "extraction": {
    "is_relevant": true,
    "confidence_note": "Dokumen pedoman TA terdeteksi...",
    "missing_fields": ["font_color", "page_number_position"],
    "rules": {
      "paper_size": {
        "value": "A4",
        "detected": true,
        "source_quote": "Pengetikan naskah menggunakan kertas A4",
        "source": "ai_extraction"
      },
      "margin_left_cm": {
        "value": 4,
        "detected": true,
        "source_quote": "dari samping kiri: 4 cm",
        "source": "ai_extraction"
      },
      "margin_right_cm":         { "value": 3,    "detected": true,  "source_quote": "...", "source": "ai_extraction" },
      "margin_top_cm":           { "value": 4,    "detected": true,  "source_quote": "...", "source": "ai_extraction" },
      "margin_bottom_cm":        { "value": 3,    "detected": true,  "source_quote": "...", "source": "ai_extraction" },
      "font_family":             { "value": "Times New Roman", "detected": true, "source_quote": "...", "source": "ai_extraction" },
      "font_size":               { "value": 12,   "detected": true,  "source_quote": "...", "source": "ai_extraction" },
      "line_spacing":            { "value": 2,    "detected": true,  "source_quote": "...", "source": "ai_extraction" },
      "font_color":              { "value": null, "detected": false, "source_quote": null },
      "page_number_position":    { "value": null, "detected": false, "source_quote": null },
      "front_matter_numbering":  { "value": "lowercase-roman", "detected": true, "source_quote": "...", "source": "ai_extraction" },
      "main_body_numbering":     { "value": "arabic", "detected": true, "source_quote": "...", "source": "ai_extraction" },
      "chapter_title_case":      { "value": "uppercase",  "detected": true, "source_quote": "...", "source": "ai_extraction" },
      "chapter_title_align":     { "value": "center",     "detected": true, "source_quote": "...", "source": "ai_extraction" },
      "chapter_number_format":   { "value": "roman",      "detected": true, "source_quote": "...", "source": "ai_extraction" },
      "subchapter_number_format":{ "value": "decimal",    "detected": true, "source_quote": "...", "source": "ai_extraction" }
    }
  }
}
```

> `totalPages` hanya ada untuk PDF. Untuk DOCX, field ini tidak disertakan.

### Response — Sukses (DOCX)

Identik dengan PDF kecuali tidak ada `totalPages`.

```json
{
  "ok": true,
  "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "extraction": { ... }
}
```

### Response — Error

Semua error mengikuti format:

```json
{
  "ok": false,
  "error": "<pesan yang bisa ditampilkan ke user>"
}
```

Khusus untuk dokumen tidak relevan, ada field `code` tambahan:

```json
{
  "ok": false,
  "code": "not_relevant",
  "error": "Dokumen ini tampaknya bukan pedoman format penulisan..."
}
```

| HTTP | Kondisi | `error` (contoh) |
|---|---|---|
| 400 | Field `file` tidak ada di form-data | `"Harap unggah file PDF/DOCX..."` |
| 422 | File > 10 MB | `"Harap unggah file PDF/DOCX dengan ukuran maksimal 10 MB."` |
| 422 | Format bukan PDF/DOCX (magic bytes tidak cocok) | `"Harap unggah file PDF/DOCX..."` |
| 422 | PDF terkunci password | `"Dokumen tidak dapat dibaca. Pastikan file tidak rusak atau terkunci kata sandi."` |
| 422 | PDF scan (teks < 50 karakter) | `"Dokumen ini tampaknya berupa hasil scan gambar..."` |
| 422 | ZIP bukan DOCX valid | `"file terdeteksi sebagai arsip ZIP tapi bukan dokumen .docx yang valid."` |
| 422 | Zip-bomb terdeteksi | `"file tidak dapat diproses karena ukurannya terlalu besar setelah dibuka."` |
| 422 | Dokumen tidak relevan | `code: "not_relevant"`, `"Dokumen ini tampaknya bukan pedoman format penulisan."` |
| 429 | Rate limit terlampaui | `"Terlalu banyak permintaan. Silakan tunggu sebentar dan coba lagi."` |
| 500 | GEMINI_API_KEY tidak dikonfigurasi | `"Terjadi kesalahan konfigurasi pada server."` |
| 502 | Gemini API gagal (semua key) | `"Mohon maaf, layanan AI kami sedang penuh atau mengalami gangguan."` |
| 500 | Error tidak terduga | `"Terjadi kesalahan pada server. Silakan coba lagi."` |

---

## POST /api/generate

Menerima rules yang sudah divalidasi user, menghasilkan file `.docx`, dan mengembalikannya sebagai binary download.

**Konfigurasi:**
- `maxDuration: 25` detik

### Request

```
Content-Type: application/json
```

```json
{
  "rules": {
    "paper_size": "A4",
    "margin_left_cm": 4,
    "margin_right_cm": 3,
    "margin_top_cm": 4,
    "margin_bottom_cm": 3,
    "font_family": "Times New Roman",
    "font_size": 12,
    "line_spacing": 2,
    "font_color": "black",
    "page_number_position": "bottom-center",
    "front_matter_numbering": "lowercase-roman",
    "main_body_numbering": "arabic",
    "chapter_title_case": "uppercase",
    "chapter_title_align": "center",
    "chapter_number_format": "roman",
    "subchapter_number_format": "decimal"
  },
  "content": "lorem"
}
```

**Field `rules`:**

| Field | Tipe | Nilai yang Valid |
|---|---|---|
| `paper_size` | string | `"A4"`, `"Letter"`, `"Legal"` |
| `margin_left_cm` | number | `0–10` |
| `margin_right_cm` | number | `0–10` |
| `margin_top_cm` | number | `0–10` |
| `margin_bottom_cm` | number | `0–10` |
| `font_family` | string | `"Times New Roman"`, `"Arial"`, `"Calibri"`, `"Georgia"`, `"Garamond"`, `"Helvetica"`, `"Palatino Linotype"`, `"Tahoma"`, `"Verdana"` |
| `font_size` | number | `8–24` |
| `line_spacing` | number | `1–3` |
| `font_color` | string | `"black"`, `"white"`, `"red"`, `"blue"`, `"green"` |
| `page_number_position` | string | `"bottom-center"`, `"bottom-right"`, `"bottom-left"`, `"top-center"`, `"top-right"`, `"top-left"` |
| `front_matter_numbering` | string | `"lowercase-roman"`, `"uppercase-roman"`, `"arabic"` |
| `main_body_numbering` | string | `"lowercase-roman"`, `"uppercase-roman"`, `"arabic"` |
| `chapter_title_case` | string | `"uppercase"`, `"capitalize"`, `"normal"` |
| `chapter_title_align` | string | `"left"`, `"center"`, `"right"`, `"justify"` |
| `chapter_number_format` | string | `"roman"`, `"arabic"`, `"none"` |
| `subchapter_number_format` | string | `"decimal"`, `"roman"`, `"arabic"`, `"none"` |

**Field `content`:**

| Nilai | Keterangan |
|---|---|
| `"lorem"` | Isi bab dengan teks lorem ipsum |
| `"empty"` | Hanya kerangka judul dan sub-bab, tanpa teks isi |

> Nilai di luar yang valid untuk field enum akan di-fallback ke nilai default, bukan error. Nilai numerik di luar range akan di-clamp. Perilaku ini diimplementasi di `validateRules()` dalam route handler.

### Response — Sukses

```
HTTP 200 OK
Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
Content-Disposition: attachment; filename="template-docuforma.docx"
Content-Length: <ukuran dalam bytes>

<binary .docx file>
```

### Response — Error

```
Content-Type: application/json
```

| HTTP | Kondisi | Body |
|---|---|---|
| 400 | Body bukan JSON valid | `{ "error": "Request body tidak valid — harap kirim JSON." }` |
| 400 | Field `rules` tidak ada | `{ "error": "Field \"rules\" tidak ditemukan atau tidak valid." }` |
| 429 | Rate limit | `{ "error": "Terlalu banyak permintaan..." }` |
| 500 | Error saat generate | `{ "error": "Terjadi kesalahan saat membuat dokumen. Silakan coba lagi." }` |

---

## POST /api/analyze

Endpoint mandiri yang menerima teks polos (sudah diekstrak sebelumnya) dan langsung memanggil Gemini untuk analisis. Berguna untuk testing pipeline AI secara terpisah dari pipeline upload file.

**Konfigurasi:**
- `runtime: 'nodejs'`
- `maxDuration: 55` detik

### Request

```
Content-Type: application/json
```

```json
{
  "text": "Teks dokumen pedoman penulisan yang sudah diekstrak..."
}
```

| Field | Tipe | Keterangan |
|---|---|---|
| `text` | string | Teks polos hasil ekstraksi, tidak boleh kosong |

### Response — Sukses

```
HTTP 200 OK
Content-Type: application/json
```

```json
{
  "ok": true,
  "data": {
    "is_relevant": true,
    "confidence_note": "...",
    "missing_fields": [...],
    "rules": { ... }
  }
}
```

Struktur `data` identik dengan field `extraction` di response `/api/upload`.

### Response — Error

| HTTP | Kondisi | Body |
|---|---|---|
| 400 | Body bukan JSON | `{ "ok": false, "error": "Request body harus berupa JSON dengan field \"text\"." }` |
| 400 | Field `text` tidak ada atau bukan string | `{ "ok": false, "error": "Field \"text\" (string) wajib ada di request body." }` |
| 400 | Field `text` kosong | `{ "ok": false, "error": "Field \"text\" tidak boleh kosong." }` |
| 429 | Rate limit | `{ "ok": false, "error": "Terlalu banyak permintaan..." }` |
| 500 | API key tidak dikonfigurasi | `{ "ok": false, "error": "Terjadi kesalahan konfigurasi pada server." }` |
| 502 | Gemini gagal | `{ "ok": false, "error": "Mohon maaf, layanan AI kami sedang penuh..." }` |
| 500 | Error tidak terduga | `{ "ok": false, "error": "Terjadi kesalahan pada server. Silakan coba lagi." }` |

---

## Tipe Data Lengkap

### RuleField

```typescript
interface RuleField {
  value: string | number | boolean | null
  detected: boolean
  source_quote?: string | null
  source?: 'ai_extraction' | 'docx_property_fallback'
}
```

- `detected: true` → AI berhasil menemukan nilai ini di dokumen
- `detected: false` → nilai tidak ditemukan; sistem akan menggunakan nilai default
- `source_quote` → kutipan verbatim dari dokumen (hanya jika `detected: true`)
- `source` → ditag oleh server, bukan oleh AI

### GeminiExtractionResult

```typescript
interface GeminiExtractionResult {
  is_relevant: boolean
  confidence_note: string
  rules: {
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
  missing_fields: string[]
}
```

---

## Contoh Penggunaan (curl)

**Upload file:**

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@/path/to/pedoman.pdf"
```

**Generate .docx:**

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "rules": {
      "paper_size": "A4",
      "margin_left_cm": 4,
      "margin_right_cm": 3,
      "margin_top_cm": 4,
      "margin_bottom_cm": 3,
      "font_family": "Times New Roman",
      "font_size": 12,
      "line_spacing": 2,
      "font_color": "black",
      "page_number_position": "bottom-center",
      "front_matter_numbering": "lowercase-roman",
      "main_body_numbering": "arabic",
      "chapter_title_case": "uppercase",
      "chapter_title_align": "center",
      "chapter_number_format": "roman",
      "subchapter_number_format": "decimal"
    },
    "content": "lorem"
  }' \
  --output template-docuforma.docx
```

**Analisis teks langsung:**

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Margin kiri 4 cm, margin kanan 3 cm, font Times New Roman 12pt, spasi 2."}'
```
