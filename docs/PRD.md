# Product Requirements Document — DocuForma AI

**Versi:** 1.0  
**Status:** MVP — Selesai  
**Terakhir diperbarui:** Juli 2026

---

## 1. Problem Statement

Setiap mahasiswa yang menulis Tugas Akhir atau Skripsi harus menyesuaikan dokumen Word mereka dengan pedoman format kampus masing-masing. Proses ini melibatkan pembacaan dokumen pedoman secara manual, lalu menerjemahkan setiap aturan ke pengaturan Word satu per satu: margin, jenis dan ukuran font, spasi baris, format penomoran halaman, gaya judul bab, dan seterusnya.

Masalah utamanya ada tiga:

1. **Berulang dan membuang waktu.** Setiap mahasiswa di kampus yang sama mengerjakan hal yang identik dari awal.
2. **Rawan salah.** Dokumen pedoman sering panjang dan tidak konsisten. Mudah terlewat atau salah baca.
3. **Tidak ada standar yang langsung bisa dipakai.** Kampus menyediakan dokumen pedoman, bukan file template yang sudah jadi.

Akibatnya, banyak mahasiswa menghabiskan waktu untuk urusan format yang seharusnya bisa diotomasi, dan tetap menghasilkan dokumen yang tidak sesuai standar karena kesalahan interpretasi pedoman.

---

## 2. Target User & Use Case Utama

### Target User

**Mahasiswa S1 / D3 / D4** yang sedang mengerjakan Tugas Akhir, Skripsi, atau Laporan Akhir di perguruan tinggi Indonesia, dengan karakteristik:

- Memiliki dokumen pedoman format dari kampus dalam bentuk PDF atau file Word (DOCX)
- Menggunakan Microsoft Word atau aplikasi kompatibel untuk menulis dokumen akhir
- Tidak harus memiliki keahlian teknis; cukup bisa upload file dan mengisi formulir sederhana

### Use Case Utama

| # | Use Case | Kondisi Awal | Kondisi Akhir |
|---|---|---|---|
| UC-1 | Upload dan analisis pedoman PDF | User punya file PDF pedoman format kampus | Sistem menampilkan 16 aturan format hasil deteksi AI |
| UC-2 | Upload dan analisis pedoman DOCX | User punya file DOCX pedoman format kampus | Sistem menampilkan 16 aturan format hasil deteksi AI |
| UC-3 | Review dan koreksi hasil deteksi | AI menampilkan aturan yang terdeteksi | User memverifikasi setiap field dan mengoreksi yang salah |
| UC-4 | Download template `.docx` | User sudah puas dengan aturan yang ditampilkan | User mendapat file `.docx` dengan format yang sudah diatur |

---

## 3. Fitur MVP

### 3.1 Upload dan Validasi File

**Apa yang ada di kode:**
- Komponen drag-and-drop di `components/FileUpload.tsx`
- Validasi server-side via magic bytes (bukan ekstensi file) di `lib/validateFile.ts`
- Batas ukuran 10 MB
- Deteksi PDF yang terkunci password (`isPdfPasswordProtected`)
- Deteksi PDF scan/gambar (threshold teks < 50 karakter)
- Deteksi zip-bomb untuk file DOCX (batas 50 MB decompressed)
- Pesan error spesifik per skenario kegagalan

**Mengapa fitur ini menjawab pain point:**
Tanpa validasi yang ketat, pipeline AI akan menerima input yang tidak bisa diproses dan menghasilkan error yang membingungkan. Validasi awal memastikan user mendapat pesan jelas sebelum proses panjang dimulai, menghemat waktu tunggu.

---

### 3.2 Ekstraksi Teks Dokumen

**Apa yang ada di kode:**
- Ekstraksi teks PDF via `unpdf` (PDF.js) di `lib/extractPdfText.ts`
- Ekstraksi teks DOCX via `mammoth` di `lib/extractDocxText.ts`
- Seluruh proses in-memory — tidak ada file yang ditulis ke disk

**Mengapa fitur ini menjawab pain point:**
Agar AI bisa membaca isi pedoman, teks harus diekstrak terlebih dahulu dari format biner (PDF/DOCX). Tanpa tahap ini tidak ada yang bisa dikirim ke model.

---

### 3.3 Analisis AI — Ekstraksi 16 Aturan Format

**Apa yang ada di kode:**
- Integrasi Google Gemini REST API di `lib/callGemini.ts`
- Model yang dipakai: `gemini-3.1-flash-lite`
- Rotasi multi-key: mendukung hingga 5 API key (`GEMINI_API_KEY_1` s.d. `_5`), fallback sequential jika satu key kena rate limit atau error
- Prompt engineering dengan scoping rule: AI hanya mengekstrak aturan dari bagian laporan/skripsi utama, mengabaikan bagian Naskah Publikasi atau Lampiran yang sering punya aturan berbeda
- Untuk setiap field yang terdeteksi, AI wajib mengisi `source_quote` — kutipan verbatim dari dokumen yang menjadi dasar deteksi
- Deteksi relevansi dokumen (`is_relevant`): dokumen yang bukan pedoman format langsung ditolak sebelum masuk halaman review
- Post-processing Spec D4 di `lib/validateExtraction.ts`: koreksi otomatis jika `value` yang dikembalikan AI tidak konsisten dengan `source_quote`-nya (bug yang diketahui pada LLM)

**16 Field yang Diekstrak:**

| Kelompok | Field |
|---|---|
| Kertas & Margin | `paper_size`, `margin_left_cm`, `margin_right_cm`, `margin_top_cm`, `margin_bottom_cm` |
| Font & Spasi | `font_family`, `font_size`, `line_spacing`, `font_color` |
| Penomoran Halaman | `page_number_position`, `front_matter_numbering`, `main_body_numbering` |
| Format Judul Bab | `chapter_title_case`, `chapter_title_align`, `chapter_number_format`, `subchapter_number_format` |

**Nilai default (ketika field tidak terdeteksi):**
Setiap field yang tidak ditemukan di dokumen pedoman diisi dengan nilai default berbasis Pedoman Penyusunan Tugas Akhir FTI UNISBANK — bukan tebakan, melainkan nilai yang memiliki landasan dokumen nyata (lihat `lib/extractionToGroups.ts` untuk detail per field).

**Mengapa fitur ini menjawab pain point:**
Ini adalah inti solusi. Tanpa kemampuan membaca dan memahami teks pedoman secara otomatis, seluruh proses tetap manual. Scoping rule dan source_quote mengurangi risiko AI mengambil nilai dari bagian dokumen yang salah.

---

### 3.4 Halaman Review — Verifikasi dan Koreksi Manual

**Apa yang ada di kode:**
- `components/ReviewPage.tsx` dan `app/review/page.tsx`
- Form 16 field dikelompokkan dalam 4 kartu: Kertas & Margin, Font & Spasi, Penomoran Halaman, Format Judul Bab
- Badge sumber per field:
  - **Hijau "Terdeteksi"** — AI berhasil mengidentifikasi nilai dari dokumen
  - **Kuning "Default"** — field tidak ditemukan, nilai default dipakai
  - **Biru "Saran file"** — nilai diambil dari properti dokumen DOCX (dipersiapkan untuk Spec C2)
- Kutipan verbatim (`source_quote`) ditampilkan di bawah setiap field yang terdeteksi sebagai bukti
- Counter "X/Y terdeteksi" per grup
- Preview A4 real-time (skala 50%) yang update langsung saat user mengubah nilai: margin, font, spasi, posisi nomor halaman, format judul bab
- Toggle tampilan preview: Bagian Awal / Bagian Utama
- Pilihan isi bab untuk preview dan hasil generate: Lorem Ipsum atau Kerangka Kosong
- Data ekstraksi disimpan di `sessionStorage` dan dibaca saat halaman review dimuat

**Mengapa fitur ini menjawab pain point:**
AI tidak selalu benar 100%, terutama untuk dokumen pedoman yang ambigu atau tidak konsisten. Halaman review memberi user kontrol penuh untuk memverifikasi dan mengoreksi sebelum template di-generate, sehingga hasil akhir akurat meski AI salah deteksi.

---

### 3.5 Generate dan Download Template `.docx`

**Apa yang ada di kode:**
- `lib/generateDocx.ts` menggunakan library `docx` v9
- `app/api/generate/route.ts` menerima 16 field yang sudah divalidasi dan memanggil generator
- File `.docx` yang dihasilkan terdiri dari 2 section terpisah:
  - **Section 1 — Bagian awal (front matter):** 8 halaman placeholder (Halaman Judul, Persetujuan, Pengesahan, Kata Pengantar, Daftar Isi, Daftar Gambar, Daftar Tabel, Abstrak) dengan penomoran sesuai `front_matter_numbering`, dimulai dari halaman 1
  - **Section 2 — Bagian utama (main body):** BAB I–VI dengan 3 sub-bab masing-masing, penomoran sesuai `main_body_numbering`, dimulai ulang dari 1, diawali section break `NEXT_PAGE`
- Semua pengaturan dokumen diterapkan: ukuran kertas, margin, font, spasi, warna tinta, posisi nomor halaman, format judul dan sub-bab
- Override warna teks eksplisit pada semua `TextRun` (mencegah heading mengambil warna biru default theme Word)
- Validasi input server-side: whitelist untuk semua field enum, clamp untuk nilai numerik

**Mengapa fitur ini menjawab pain point:**
Ini adalah output yang langsung bisa dipakai. User tidak perlu lagi mengatur pengaturan Word secara manual — semua sudah ada di file yang didownload. Cukup buka, mulai menulis.

---

### 3.6 Rate Limiting dan Keamanan

**Apa yang ada di kode:**
- Rate limiting per IP di `lib/rateLimit.ts`: sliding window 1 menit, maksimum 10 request per IP
- `maxDuration` eksplisit di setiap API route: 55 detik untuk route AI, 25 detik untuk route generate
- Timeout AbortController 27 detik di frontend (`FileUpload.tsx`)
- Validasi whitelist dan range clamp di `app/api/generate/route.ts` untuk semua field sebelum diteruskan ke generator
- Pesan error user-facing generik — detail teknis hanya di-log ke server console

**Mengapa fitur ini menjawab pain point:**
Tanpa rate limiting, satu pengguna atau bot bisa menghabiskan kuota Gemini API seluruh sistem. Tanpa timeout, spinner bisa berputar tanpa batas saat Gemini lambat merespons. Kedua mekanisme ini memastikan pengalaman yang terprediksi.

---

## 4. Batasan dan Limitasi Sistem

### Limitasi Teknis

| Batasan | Detail |
|---|---|
| Format file | Hanya PDF dan DOCX. File `.doc` (format lama), ODT, RTF, atau format lain tidak didukung. |
| Ukuran file | Maksimum 10 MB per upload. |
| PDF scan | PDF yang isinya gambar (hasil scan fisik) tidak bisa diekstrak teksnya dan akan ditolak. |
| PDF terkunci | PDF yang dilindungi password tidak bisa diproses. |
| Akurasi AI | AI mengekstrak berdasarkan teks — jika pedoman menggunakan gambar untuk menunjukkan contoh format, nilai tersebut tidak akan terdeteksi. |
| Scoping AI | Jika pedoman tidak membedakan dengan jelas bagian untuk laporan utama vs. Naskah Publikasi, AI bisa mengambil nilai dari bagian yang salah meski ada scoping rule di prompt. |
| Penyimpanan | Tidak ada. Semua data diproses in-memory dan hilang setelah sesi berakhir. |
| Autentikasi | Tidak ada sistem login. Siapa pun yang punya URL bisa menggunakan aplikasi. |

### Limitasi Produk

| Batasan | Detail |
|---|---|
| Field yang diekstrak | Terbatas pada 16 field yang didefinisikan. Aturan format lain yang ada di pedoman (misalnya format tabel, catatan kaki, daftar pustaka) tidak diekstrak. |
| Template yang dihasilkan | Hanya menghasilkan kerangka dokumen (BAB I–VI dengan sub-bab). Tidak mengisi konten akademik yang sebenarnya. |
| Pengeditan online | Tidak ada editor teks di dalam aplikasi. User harus membuka hasil di Word atau aplikasi kompatibel. |
| Multi-bahasa | Prompt AI dan UI ditulis dalam Bahasa Indonesia. Pedoman berbahasa Inggris kemungkinan tetap bisa diproses, tapi belum diuji secara sistematis. |
| Offline | Membutuhkan koneksi internet untuk memanggil Gemini API. |
