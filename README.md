## 🌐 URL Aplikasi

https://docu-forma.vercel.app/

## 👥 Personel

| Nama | NIM |
|------|-----|
| Aditya Bagas Prakoso | 24.01.53.0003 |
| Jonathan Andrean Sutanto | 24.01.53.0007 |

# DocuForma AI

Aplikasi web yang mengotomasi pembuatan template dokumen akademik. Upload dokumen pedoman format kampus (PDF atau DOCX), sistem membaca aturannya sendiri menggunakan AI, lalu hasilkan file template `.docx` siap pakai — tanpa kamu perlu menulis satu instruksi AI pun.

---

## Masalah yang Diselesaikan

Mahasiswa yang hendak menulis Tugas Akhir atau Skripsi harus menyesuaikan dokumen Word mereka secara manual dengan pedoman format kampus — mengatur margin, font, spasi, penomoran halaman, dan format judul bab satu per satu. Proses ini berulang, rawan salah, dan membuang waktu.

DocuForma AI mengekstrak semua aturan tersebut secara otomatis dari dokumen pedoman yang sudah ada, lalu menghasilkan template `.docx` yang sudah dikonfigurasi sesuai standar kampus.

---

## Target Pengguna

- **Mahasiswa S1/D3/D4** yang sedang atau akan mengerjakan Tugas Akhir/Skripsi
- Berlaku untuk kampus mana pun yang memiliki dokumen pedoman format penulisan dalam bentuk PDF atau DOCX

---

## Fitur

### Termasuk
- Upload dokumen pedoman format (PDF atau DOCX, maks. 10 MB)
- Ekstraksi otomatis 16 aturan format menggunakan Google Gemini AI:
  - Kertas & margin (ukuran kertas, 4 margin)
  - Font & spasi (jenis font, ukuran, spasi baris, warna tinta)
  - Penomoran halaman (posisi, format bagian awal, format bagian utama)
  - Format judul bab (gaya huruf, perataan, format nomor bab & sub-bab)
- Halaman review: periksa dan koreksi hasil deteksi AI sebelum generate
- Badge sumber per field: Terdeteksi AI / Default / Saran file
- Kutipan verbatim dari dokumen sebagai bukti deteksi
- Preview A4 real-time yang update saat nilai diubah
- Download template `.docx` dengan 2 section (bagian awal + bagian utama)
- Pilihan isi bab: lorem ipsum atau kosong (kerangka saja)
- Validasi file via magic bytes (bukan ekstensi), deteksi PDF scan & password
- Rate limiting per IP, timeout request, error handling menyeluruh

### Tidak Termasuk
- Login / manajemen akun pengguna
- Penyimpanan dokumen di server (semua diproses in-memory)
- Dukungan format file selain PDF dan DOCX
- Dukungan PDF hasil scan/foto (tanpa teks yang bisa diekstrak)
- Pengeditan template hasil generate secara langsung di browser

---

## Dokumentasi Lengkap

| Dokumen | Isi |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Requirements produk lengkap, user stories, skenario error |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arsitektur sistem, alur data, keputusan teknis |
| [docs/AI_FEATURE.md](docs/AI_FEATURE.md) | Detail implementasi AI, prompt design, dan **batasan akurasi** |
| [docs/API.md](docs/API.md) | Referensi endpoint API lengkap dengan contoh request/response |
| [docs/USER_FLOW.md](docs/USER_FLOW.md) | Alur pengguna lengkap dari upload hingga download |

---

## Batasan & Akurasi AI

- **16 field yang diekstrak:** kertas & margin (5 field), font & spasi (4 field), penomoran halaman (3 field), format judul bab (4 field). Setiap field bisa terdeteksi atau tidak tergantung kelengkapan dokumen sumber.
- **Akurasi bervariasi:** Dokumen pedoman yang terstruktur jelas dengan heading eksplisit menghasilkan deteksi yang hampir selalu tepat. Dokumen yang menggunakan gambar/screenshot untuk contoh format, atau tidak memisahkan aturan laporan utama dan naskah publikasi dengan heading yang jelas, bisa menghasilkan deteksi yang kurang akurat.
- **3 lapis safeguard yang ada:**
  1. `source_quote` — setiap nilai yang terdeteksi disertai kutipan verbatim dari dokumen sumber; user bisa verifikasi langsung di halaman review
  2. Auto-koreksi mismatch di `validateExtraction.ts` — mendeteksi dan memperbaiki kontradiksi antara kutipan dan nilai enum yang dikembalikan AI (bug yang diketahui pada LLM)
  3. Halaman review interaktif — semua 16 field bisa dikoreksi manual sebelum template di-generate
- Detail lengkap termasuk tabel akurasi per kondisi dokumen dan kasus yang diketahui bisa salah: lihat [docs/AI_FEATURE.md](docs/AI_FEATURE.md).

---

## Prasyarat

| Kebutuhan | Versi minimum |
|---|---|
| Node.js | 18.x atau lebih baru |
| npm | 9.x atau lebih baru |
| Google Gemini API key | — |

Dapatkan API key Gemini gratis di [Google AI Studio](https://aistudio.google.com/apikey).

---

## Instalasi

**1. Clone repository**

```bash
git clone <url-repository>
cd docuforma
```

**2. Install dependencies**

```bash
npm install
```

**3. Buat file environment**

```bash
cp .env.example .env.local
```

Buka `.env.local` dan isi nilai `GEMINI_API_KEY_1` dengan API key yang sudah didapat:

```dotenv
GEMINI_API_KEY_1=AIza...key-kamu-di-sini
```

---

## Menjalankan Aplikasi

**Development (dengan hot reload)**

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

**Production build**

```bash
npm run build
npm run start
```

---

## Menjalankan Unit Test

Project menggunakan [Jest](https://jestjs.io/) dengan `ts-jest`.

**Jalankan semua test**

```bash
npm test
```

**Jalankan dengan laporan coverage**

```bash
npm run test:coverage
```

**Jalankan satu file test tertentu**

```bash
npx jest __tests__/lib/callGemini.test.ts
```

**Output yang diharapkan**

```
Test Suites: 10 passed, 10 total
Tests:       159 passed, 0 failed
```

Coverage saat ini (semua file di `lib/`):

| Metrik | Coverage |
|---|---|
| Statements | ~94% |
| Branches | ~85% |
| Functions | ~93% |
| Lines | ~96% |

---

## Struktur Folder

```
docuforma/
├── app/                        # Next.js App Router
│   ├── page.tsx                # Halaman utama (upload)
│   ├── layout.tsx              # Root layout
│   ├── globals.css             # Global styles (Tailwind)
│   └── api/
│       ├── upload/route.ts     # POST /api/upload — ekstraksi teks + Gemini
│       ├── generate/route.ts   # POST /api/generate — generate file .docx
│       └── analyze/route.ts    # POST /api/analyze — endpoint analisis mandiri
│
├── app/review/
│   └── page.tsx                # Halaman review aturan hasil ekstraksi
│
├── components/
│   ├── FileUpload.tsx          # Komponen upload file (drag & drop, progress)
│   └── ReviewPage.tsx          # Halaman review + form 16 field + preview A4
│
├── lib/                        # Business logic (semua pure functions, testable)
│   ├── callGemini.ts           # Integrasi Google Gemini API + multi-key rotation
│   ├── validateExtraction.ts   # Post-processing: koreksi mismatch value vs quote
│   ├── extractionToGroups.ts   # Mapping hasil AI → FieldGroup[] untuk ReviewPage
│   ├── fieldConfig.ts          # Konstanta: enum options, range, label UI
│   ├── generateDocx.ts         # Generator file .docx (margin, font, section, dll.)
│   ├── extractPdfText.ts       # Ekstraksi teks dari PDF (via unpdf/PDF.js)
│   ├── extractDocxText.ts      # Ekstraksi teks dari DOCX (via mammoth)
│   ├── validateFile.ts         # Validasi file: magic bytes, ukuran, zip-bomb
│   └── rateLimit.ts            # Rate limiter in-memory per IP (sliding window)
│
├── docs/                       # Dokumentasi proyek
│   ├── PRD.md                  # Requirements produk lengkap & user stories
│   ├── ARCHITECTURE.md         # Arsitektur sistem & keputusan teknis
│   ├── AI_FEATURE.md           # Detail AI: prompt design, batasan, akurasi
│   ├── API.md                  # Referensi endpoint API
│   └── USER_FLOW.md            # Alur pengguna lengkap
│
├── __tests__/
│   └── lib/                    # Unit test untuk semua modul di lib/
│       ├── callGemini.test.ts
│       ├── validateExtraction.test.ts
│       ├── extractionToGroups.test.ts
│       ├── fieldConfig.test.ts
│       ├── generateDocx.test.ts
│       ├── extractPdfText.test.ts
│       ├── extractDocxText.test.ts
│       ├── validateFile.test.ts
│       ├── validateFile.advanced.test.ts
│       └── rateLimit.test.ts
│
├── public/                     # Aset statis
├── .env.example                # Template environment variables (aman di-commit)
├── .env.local                  # Nilai environment aktual (JANGAN di-commit)
├── jest.config.ts              # Konfigurasi Jest
├── next.config.ts              # Konfigurasi Next.js
├── package.json
└── tsconfig.json
```

---

## Alur Kerja Aplikasi

```
Upload PDF/DOCX
      │
      ▼
Validasi file (magic bytes, ukuran, password, zip-bomb)
      │
      ▼
Ekstraksi teks (unpdf untuk PDF, mammoth untuk DOCX)
      │
      ▼
Kirim ke Gemini AI → ekstrak 16 aturan format + source_quote
      │
      ▼
Post-processing: koreksi otomatis mismatch value vs source_quote
      │
      ▼
Halaman Review: tampilkan hasil, user bisa koreksi manual
      │
      ▼
Generate file .docx → download
```

---

## Stack Teknologi

| Layer | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router) |
| AI | Google Gemini 3.1 Flash-Lite |
| Generate DOCX | docx v9 |
| Ekstraksi PDF | unpdf (PDF.js) |
| Ekstraksi DOCX | mammoth |
| Validasi ZIP | jszip |
| Styling | Tailwind CSS v4 |
| Testing | Jest + ts-jest |
| Bahasa | TypeScript |

---

## Catatan

- Dokumen yang diupload diproses sepenuhnya **in-memory** — tidak ada file yang disimpan ke disk atau database.
- Pada free tier Google Gemini, Google dapat menggunakan data yang dikirim untuk peningkatan model. Jangan upload dokumen yang mengandung data pribadi atau informasi sensitif.
- Proyek ini dibuat sebagai Tugas UAS Mata Kuliah AI dan bersifat non-komersial.
