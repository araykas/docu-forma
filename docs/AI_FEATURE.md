# AI Feature — DocuForma AI

**Versi:** 1.0  
**Terakhir diperbarui:** Juli 2026  
**File utama:** `lib/callGemini.ts`, `lib/validateExtraction.ts`

---

## 1. Model dan API yang Dipakai

| Atribut | Nilai |
|---|---|
| Provider | Google Gemini (via REST API) |
| Model | `gemini-2.5-flash-lite` |
| Endpoint | `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent` |
| Autentikasi | API key via query parameter `?key=` |
| Response format | `application/json` (dikonfigurasi di `generationConfig.responseMimeType`) |
| Temperature | `0.1` (mendekati deterministik) |

### Alasan Pemilihan

**Gemini Flash Lite** dipilih dengan pertimbangan:

- **Kecepatan:** Flash Lite adalah varian yang dioptimasi untuk latensi rendah, penting karena setiap upload menunggu respons AI secara sinkron di satu request HTTP.
- **Kemampuan JSON mode:** Mendukung `responseMimeType: 'application/json'` sehingga respons dijamin berupa JSON valid tanpa markup tambahan, menghilangkan kebutuhan parsing markdown code fence.
- **Biaya:** Gratis pada tier penggunaan normal, sesuai skala proyek akademik.
- **Kualitas untuk task ekstraksi:** Task ini adalah ekstraksi terstruktur dari teks, bukan generasi kreatif — Flash Lite cukup mampu dengan temperature rendah.

**Temperature 0.1** dipilih (bukan 0) karena:
- Nilai 0 bisa menghasilkan deterministic output yang kaku dan gagal menangani variasi phrasing di dokumen
- 0.1 memberikan sedikit fleksibilitas untuk menangani parafrase tanpa mengorbankan konsistensi output

---

## 2. Desain Prompt

Prompt diimplementasi sebagai `SYSTEM_PROMPT` konstan di `lib/callGemini.ts`. Terdiri dari beberapa bagian fungsional:

### 2.1 Instruksi Format Output

```
You are a document format extraction assistant.
ALWAYS respond with a single raw JSON object — no markdown, no code fences, no explanation.
The JSON must match this exact schema: { ... }
```

Mewajibkan AI mengembalikan JSON mentah tanpa pembungkus apapun. Dikombinasikan dengan `responseMimeType: 'application/json'` di `generationConfig` sebagai double enforcement.

### 2.2 Skema Output

16 field dalam objek `rules`, masing-masing dengan tiga sub-field:

```json
"field_name": {
  "value": <string|number|null>,
  "detected": <boolean>,
  "source_quote": <string|null>
}
```

Selain `rules`, output juga memiliki:
- `is_relevant` — boolean, apakah dokumen adalah pedoman format akademik
- `confidence_note` — string, catatan kepercayaan AI
- `missing_fields` — array nama field yang `detected: false`

### 2.3 Relevance Rule

```
Set "is_relevant": true only if the document contains academic writing format guidelines
for a main thesis / final project report / Laporan Tugas Akhir / Skripsi.
```

Dokumen yang bukan pedoman format (misalnya silabus, kontrak, berita) menghasilkan `is_relevant: false` dan pipeline dihentikan sebelum halaman review.

### 2.4 Scoping Rule (Kritis)

Banyak dokumen pedoman memuat lebih dari satu set aturan format dalam satu file — misalnya aturan untuk Laporan Tugas Akhir utama **dan** aturan terpisah untuk Naskah Publikasi atau Jurnal di bagian Lampiran. Dua set ini bisa memiliki nilai yang berbeda untuk field yang sama.

Prompt secara eksplisit menginstruksikan:

```
Extract rules ONLY from the section that governs the main Report / Thesis / Tugas Akhir.
COMPLETELY IGNORE formatting rules found in sections for: Naskah Publikasi, Artikel Ilmiah,
Jurnal, Poster, Abstrak, or any Lampiran describing a separate format.
```

Disertai contoh anti-pattern agar AI tidak meminjam nilai dari bagian yang salah.

### 2.5 Source Quote Rule

Setiap field yang `detected: true` **wajib** menyertakan kutipan verbatim 10–25 kata dari dokumen sebagai bukti:

```
For EVERY field where "detected": true, you MUST fill "source_quote" with a verbatim
excerpt copied directly from the document — the exact sentence or phrase that is the
basis for your detection. Do NOT paraphrase. Do NOT rewrite.
```

Ini digunakan untuk dua tujuan:
1. Ditampilkan ke user di halaman review sebagai bukti yang bisa diverifikasi
2. Dipakai oleh Spec D4 (`validateExtraction.ts`) untuk mendeteksi mismatch antara kutipan dan nilai

### 2.6 Value–Quote Consistency Rule

LLM diketahui bisa menghasilkan `value` dan `source_quote` secara independen sehingga keduanya kontradiksi (misalnya kutipan berkata "angka Arab" tapi value = "lowercase-roman"). Prompt memuat prosedur wajib dua langkah:

```
STEP 1 — Write source_quote first. Copy the exact verbatim phrase from the document.
STEP 2 — Derive value FROM that quote, not from memory or assumption.
```

Disertai tabel mapping kata kunci → nilai enum dan contoh bug yang harus dihindari.

### 2.7 Enum Mapping yang Disertakan di Prompt

Prompt menyertakan tabel mapping eksplisit untuk semua field enum, contoh:

```
front_matter_numbering / main_body_numbering:
  quote contains "angka arab" / "arab" / "1, 2, 3"  → value: "arabic"
  quote contains "romawi kecil" / "i, ii, iii"       → value: "lowercase-roman"
  quote contains "romawi besar" / "I, II, III"       → value: "uppercase-roman"
```

---

## 3. Validasi dan Parsing Output AI

Pipeline validasi berlapis di `lib/callGemini.ts` dan `lib/validateExtraction.ts`:

### Layer 1 — Parse JSON

```typescript
const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
parsed = JSON.parse(cleaned)
```

Walaupun `responseMimeType: 'application/json'` sudah menjamin JSON valid dari sisi API, pembersihan code fence tetap dilakukan sebagai defense-in-depth. Jika `JSON.parse` gagal → error `parse_error` dikembalikan ke caller.

### Layer 2 — Envelope Extraction

Fungsi `extractTextFromEnvelope()` memvalidasi struktur respons Gemini REST:

```
response.candidates[0].content.parts[0].text
```

Jika struktur tidak sesuai (field hilang, tipe salah, candidates kosong) → error `parse_error`.

### Layer 3 — Source Tag

Fungsi `tagAiSource()` menandai setiap field yang `detected: true` dengan `source: 'ai_extraction'` dan memvalidasi `source_quote`:

- Jika bukan string → dijadikan `null`
- Jika string kosong → dijadikan `null`
- Jika panjang > 300 karakter → dipotong (truncate)

### Layer 4 — Spec D4: Enum Mismatch Correction

`validateAndCorrectExtraction()` di `lib/validateExtraction.ts` adalah safeguard terakhir. Untuk 6 field enum yang rawan:

1. Ambil `source_quote` dari field
2. Cari kecocokan dengan 19 pattern regex yang didefinisikan di `FIELD_RULES`
3. Jika pattern cocok, bandingkan nilai yang diindikasikan pattern dengan `value` yang dikembalikan AI
4. Jika berbeda → log warning ke server console + auto-koreksi `value`

Field yang divalidasi: `front_matter_numbering`, `main_body_numbering`, `chapter_number_format`, `subchapter_number_format`, `chapter_title_case`, `chapter_title_align`.

**Contoh koreksi yang tertangkap:**

```
source_quote: "nomor halaman bab dan sub bab menggunakan angka Arab"
value (AI)  : "lowercase-roman"  ← SALAH
auto-correct: "arabic"           ← BENAR
```

### Layer 5 — Whitelist di Generate Route

Sebelum diteruskan ke `generateDocx()`, semua field divalidasi ulang di `app/api/generate/route.ts` melalui fungsi `validateRules()`:

- Field enum: whitelist string
- Field numerik: clamp ke range yang valid (margin 0–10, font_size 8–24, dll.)
- Nilai di luar whitelist diganti fallback, bukan error — generator tidak akan menerima nilai berbahaya

---

## 4. Mekanisme Fallback saat AI Gagal

### 4.1 Multi-Key Rotation

`callGemini()` membaca hingga 5 API key dari environment variables (`GEMINI_API_KEY_1` s.d. `_5`). Mekanisme fallback sequential:

```
Coba key-1
  → Jika HTTP 429 / 503 / 401 / 403 → skip ke key-2
  → Jika HTTP 400 (bad request) → berhenti, tidak coba key lain
  → Jika network error → coba key berikutnya
  → Jika berhasil → return hasil

Coba key-2, key-3, ..., key-N (jika tersedia)

Semua gagal → return GeminiCallError { code: 'api_error' }
```

Status yang dianggap "transient per-key" (layak di-skip): `401, 403, 429, 500, 503`.  
Status yang dianggap "fatal" (berhenti langsung): `400` (bad request — masalah di payload, bukan di key).

### 4.2 Error Types yang Dikembalikan

| Kode | Penyebab | HTTP ke Client |
|---|---|---|
| `missing_key` | Tidak ada env var `GEMINI_API_KEY_*` | 500 |
| `api_error` | Semua key gagal (rate limit, overload, network) | 502 |
| `parse_error` | Respons Gemini tidak bisa di-parse | 502 |

Pesan error ke client selalu generik ("layanan AI sedang penuh") — detail teknis hanya di-log ke server console.

### 4.3 Frontend Timeout

AbortController dengan timeout 27 detik di `FileUpload.tsx`. Jika backend tidak merespons dalam 27 detik, request dibatalkan dan user mendapat pesan "Proses memakan waktu terlalu lama."

### 4.4 Bukti di Unit Test

Semua skenario fallback di atas dicakup di `__tests__/lib/callGemini.test.ts`:

| Test | Skenario yang Diuji |
|---|---|
| `missing_key → error` | Tidak ada env var → `code: 'missing_key'` |
| `429 pada key-1 → mencoba key-2` | HTTP 429 → skip, key-2 berhasil, `fetch` dipanggil 2x |
| `503 pada key-1 → mencoba key-2` | HTTP 503 → skip, key-2 berhasil |
| `401 pada key-1 → mencoba key-2` | HTTP 401 → dianggap transient, skip ke key-2 |
| `semua key 429 → error api_error` | 3 key semua 429 → `code: 'api_error'`, `fetch` dipanggil 3x |
| `HTTP 400 → berhenti langsung` | HTTP 400 → tidak coba key-2, `fetch` dipanggil 1x saja |
| `JSON tidak valid → parse_error` | Teks acak → `code: 'parse_error'` |
| `envelope struktur salah → parse_error` | `{ unexpected: 'structure' }` → `code: 'parse_error'` |
| `network error → api_error` | `fetch` throw → `code: 'api_error'` |
| `Spec D4 koreksi` | Mismatch value/quote → nilai dikoreksi sebelum dikembalikan |

Jalankan: `npx jest __tests__/lib/callGemini.test.ts`

---

## 5. Batasan Akurasi dan Reliabilitas

### Akurasi Deteksi

| Kondisi Dokumen | Ekspektasi Akurasi |
|---|---|
| Dokumen pedoman yang jelas, terstruktur, berbahasa Indonesia | Tinggi — field utama hampir selalu terdeteksi |
| Dokumen menggunakan gambar/screenshot untuk contoh format | Rendah untuk field tersebut — AI tidak bisa "melihat" gambar dalam teks |
| Dokumen dengan dua set aturan tanpa heading yang jelas | Sedang — scoping rule membantu tapi tidak sempurna |
| Dokumen yang tidak konsisten secara internal | Sedang — AI mengikuti aturan "detected: false jika tidak yakin" |
| Dokumen berbahasa Inggris | Sedang — prompt dalam BI, tapi Gemini multilingual |

### Kasus yang Diketahui Bisa Salah

1. **Margin dalam satuan selain cm** — Jika pedoman menyebutkan margin dalam mm atau inci, AI perlu mengkonversi. Tidak selalu akurat.
2. **Format penomoran hibrida** — Pedoman yang menggunakan format campuran atau tidak standar bisa membingungkan mapping enum.
3. **Scoping ambigu** — Jika bagian Naskah Publikasi dan bagian laporan utama tidak dipisahkan dengan heading yang jelas, AI bisa mengambil nilai dari bagian yang salah meski ada scoping rule.
4. **Nilai implisit** — Jika pedoman tidak menyebut suatu aturan secara eksplisit (misalnya warna tinta yang "sudah jelas hitam" tanpa disebutkan), AI akan mengembalikan `detected: false` dan sistem memakai nilai default.

### Safeguard yang Ada

- Spec D4 auto-koreksi menangani bug mismatch value/quote yang paling umum
- Nilai default berbasis Pedoman FTI UNISBANK memastikan output yang reasonable meski banyak field tidak terdeteksi
- Halaman review memungkinkan user mengoreksi setiap nilai sebelum template di-generate
- `source_quote` yang ditampilkan memungkinkan user memverifikasi dasar deteksi AI

### Yang Tidak Ada (Belum)

- Tidak ada confidence score per-field dari AI
- Tidak ada mekanisme "feedback loop" untuk memperbaiki prompt dari kasus yang gagal
- Tidak ada fallback ke model lain jika Gemini tidak tersedia
