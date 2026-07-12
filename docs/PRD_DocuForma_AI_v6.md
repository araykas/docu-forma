# Product Requirements Document (PRD) — v6
**Nama Proyek:** DocuForma AI
**Platform:** Web Application (Next.js, deploy ke Vercel)
**Konteks:** Proyek UAS / tugas mata kuliah, dikerjakan dalam satu semester
**Revisi:** v6 — mencabut langkah klasifikasi "template vs naratif" berbasis jumlah kata (v5) karena terbukti rapuh: pedoman padat/berbentuk poin bisa punya kata sedikit tapi tetap berisi aturan eksplisit yang butuh AI, sehingga salah rute ke jalur baca-XML. Sekarang **semua** `.docx` diperlakukan sama seperti `.pdf` — teks selalu diekstrak dan dikirim ke AI. Baca metadata XML `.docx` tetap ada, tapi perannya jadi fallback pelengkap untuk field yang tidak terdeteksi AI, ditandai eksplisit sebagai "saran otomatis" bukan hasil eksplisit (lihat Bagian 3.2 & 3.4).

---

## 1. Latar Belakang & Tujuan Project

**Latar Belakang Masalah:**
Penyusunan dokumen dengan format standar akademik sering kali memakan waktu. Panduan format kampus biasanya berbentuk dokumen PDF atau Word yang menyulitkan mahasiswa untuk mengatur margin, line spacing, jenis font, penomoran halaman, dan format judul bab secara manual. Di sisi lain, AI generatif umum (ChatGPT dll.) tidak cocok untuk menghasilkan file `.docx` terstruktur karena mengharuskan prompting teknis dan hasilnya tidak konsisten.

**Tujuan & Solusi (DocuForma AI):**
DocuForma AI adalah *dedicated tool* berbasis web untuk mengotomatisasi pembuatan template dokumen `.docx`. Dengan pendekatan *Zero-Prompting*, pengguna tinggal mengunggah dokumen pedoman kampus. Sistem mengekstrak aturan tata letak dari dokumen tersebut (dibantu AI untuk PDF berbasis teks) dan menghasilkan file template `.docx` kosong yang sudah diatur sesuai standar itu — dengan tahap review agar pengguna bisa memeriksa dan mengoreksi hasil deteksi sebelum mengunduh.

---

## 2. User Persona & Target Pengguna

**Target Pengguna Utama:**
Mahasiswa tingkat akhir, dosen, dan peneliti yang membutuhkan standardisasi format dokumen secara cepat dan presisi.

**User Persona:**
* **Nama:** Budi (21 Tahun), Mahasiswa Tingkat Akhir.
* **Kebutuhan:** Memulai penulisan skripsi sesuai format kampus (margin 4-4-3-3, Times New Roman 12, spasi 2, penomoran romawi/angka, judul bab kapital rata tengah).
* **Pain Point:** Malas membaca buku pedoman skripsi yang tebal, kebingungan mengatur heading dan page number berbeda-beda di setiap section Microsoft Word, dan tidak paham cara membuat prompt AI yang rumit untuk hasil yang konsisten.

---

## 3. Arsitektur Teknis

> **Catatan revisi:** Versi sebelumnya mengusulkan arsitektur dua layanan terpisah (Next.js di Vercel + backend Python/FastAPI di Railway/Render) dengan alasan library Python lebih matang untuk pengolahan dokumen. Setelah dipertimbangkan ulang, pendekatan ini **diganti dengan single-stack** karena dua layanan terpisah menambah kompleksitas deployment (dua kali deploy, CORS, dua bahasa) yang tidak sepadan manfaatnya untuk proyek skala satu semester yang dikerjakan dengan bantuan AI coding tool.

### 3.1. Komponen Teknologi (Single-Stack)

* **Framework:** Next.js (App Router, TypeScript), satu codebase untuk frontend + backend (API Routes / Server Actions).
* **Styling:** Tailwind CSS.
* **Deployment:** Vercel (free tier).
* **Ekstraksi & pembuatan file `.docx`:**
  * Library `docx` (npm) — membangun file `.docx` output: margin, font, spasi, section break untuk penomoran halaman berbeda, heading style untuk judul bab.
  * Pembacaan `.docx` sumber — parsing properti dokumen (margin, font, spasi tersimpan sebagai XML di dalam file `.docx`, yang merupakan arsip ZIP berisi XML).
* **Ekstraksi teks PDF:** library `pdf-parse` atau `unpdf` (Node) untuk PDF berbasis teks.
* **Model AI:** Google Gemini API (model **Gemini Flash / Flash-Lite**, free tier) dipanggil lewat fetch biasa dari API Route. Alasan pemilihan: free tier gratis tanpa kartu kredit dengan limit harian yang cukup untuk pengembangan dan demo, serta cukup andal untuk tugas ekstraksi teks → JSON terstruktur.
  * **Catatan penggunaan:** pada free tier, Google dapat menggunakan data yang dikirim untuk peningkatan model, sehingga tidak disarankan mengirim data pribadi/sensitif — untuk kasus proyek ini (teks pedoman kampus yang bersifat publik) hal ini bukan masalah.
* **Penyimpanan:** Tidak wajib untuk MVP (alur upload → proses → download tanpa histori).

### 3.2. Alur Pemrosesan Dokumen

**Revisi v6 — koreksi lanjutan:** v5 memperkenalkan langkah "deteksi jenis .docx" (template vs naratif) berdasarkan jumlah kata naratif. Pendekatan ini **terbukti rapuh**: pedoman yang ditulis padat/berbentuk poin-poin (mis. "font = Times New Roman, margin 3-3-3-3, ukuran 11") tetap berisi aturan eksplisit yang butuh AI untuk dibaca, walau jumlah katanya sedikit. Threshold angka berapa pun akan selalu punya kasus yang salah rute — masalahnya bukan di angkanya, tapi di premisnya: **jumlah kata bukan sinyal yang valid** untuk menentukan apakah sebuah dokumen "template" atau "naratif".

**Perbaikan v6 — hilangkan percabangan, satukan pipeline:**

| Jenis Dokumen Sumber | Cara Ekstraksi | Butuh AI? |
|---|---|---|
| `.docx` (semua jenis, tanpa kecuali) | Extract teks (mis. pakai `mammoth`) -> kirim ke pipeline AI yang **identik** dengan `.pdf` (klasifikasi relevansi + ekstraksi aturan ke JSON) | Ya |
| `.pdf` (berbasis teks, bukan hasil scan) | Ekstrak teks, kirim ke AI untuk (a) klasifikasi relevansi dan (b) ekstraksi aturan format ke JSON terstruktur | Ya |
| `.pdf` hasil scan / gambar | **Di luar scope MVP** (lihat Bagian 9) | Ya, dan jauh lebih kompleks (perlu OCR + vision) |

**Peran baca metadata XML `.docx` (fallback, bukan jalur utama):** setelah AI selesai memproses teks dari `.docx`, untuk **setiap field yang AI kembalikan sebagai `detected: false`**, sistem boleh mencoba membaca nilai yang sesuai dari properti XML dokumen `.docx` tersebut (margin, font, spasi) sebagai **saran tambahan** -- BUKAN dianggap sebagai hasil terdeteksi yang setara dengan ekstraksi AI. Nilai dari fallback ini harus ditandai berbeda di skema data (lihat Bagian 3.4, field `source`) dan ditampilkan di halaman Review dengan indikator visual berbeda (mis. "saran dari setting file, mohon verifikasi manual") -- supaya user tidak salah percaya ini sama validnya dengan aturan yang eksplisit disebutkan di teks pedoman.

Kenapa fallback ini tetap berguna meski tidak otoritatif: kalau dokumen `.docx` memang benar-benar template kosong (tidak ada teks aturan sama sekali, AI akan menandai hampir semua field `detected: false`), maka setting XML dokumen itu adalah petunjuk terbaik yang tersedia -- lebih baik ditawarkan sebagai saran yang bisa diterima/ditolak user, daripada dibiarkan kosong total atau (lebih buruk) dipaksakan sebagai fakta.

### 3.3. Peran AI (Dipersempit & Dipertegas)

Untuk menjaga scope realistis dalam satu semester, AI **hanya** bertanggung jawab atas dua hal, dan berlaku **generik** untuk teks yang berasal dari `.pdf` maupun `.docx` naratif (lihat Bagian 3.2) — kode pipeline-nya harus satu, tidak digandakan per tipe file:

1. **Klasifikasi relevansi** — menentukan apakah dokumen yang diunggah memang berisi pedoman format penulisan akademik, atau dokumen lain yang tidak relevan (mis. draf skripsi, jurnal, file yang salah unggah).
2. **Ekstraksi aturan dari kalimat bebas** — membaca kalimat pedoman yang bervariasi antar kampus dan mengubahnya menjadi data terstruktur (JSON) sesuai skema pada Bagian 3.4.

**Di luar tanggung jawab AI (sengaja disederhanakan):**
- Struktur bab (BAB I – BAB VI/VII) menggunakan **template generik** yang sudah didefinisikan di kode, bukan hasil deteksi otomatis dari dokumen sumber. Ini karena deteksi hierarki bab secara umum jauh lebih kompleks dan rawan salah, sementara struktur bab skripsi/TA relatif standar antar kampus.

**Catatan penting — scoping ekstraksi (ditambahkan v4):**
Dokumen pedoman kampus sering memuat **lebih dari satu spesifikasi format** dalam satu file yang sama — misalnya aturan pengetikan Laporan/Skripsi utama, DAN aturan format terpisah untuk Naskah Publikasi/Jurnal/Artikel Ilmiah yang biasanya jadi lampiran. Kedua spesifikasi ini bisa punya nilai margin, spasi, dan ukuran font yang **berbeda dan saling bertentangan** untuk field yang sama.

AI **wajib** diinstruksikan secara eksplisit untuk:
1. Mengekstrak aturan **hanya** dari bagian yang mengatur format pengetikan Laporan/Skripsi/Tugas Akhir utama (biasanya berjudul semacam "Petunjuk Teknis Pengetikan", "Format Penulisan", atau serupa).
2. **Mengabaikan** aturan format untuk deliverable lain yang muncul di dokumen yang sama (naskah publikasi/jurnal/artikel/poster), maupun contoh visual di lampiran (cover, form, daftar isi contoh).
3. Kalau satu field memang tidak disebutkan secara eksplisit **di bagian yang relevan**, field itu harus tetap `"detected": false` — walaupun ada angka yang mirip/relevan muncul di bagian lain dokumen untuk keperluan berbeda. Jangan meminjam nilai dari bagian yang tidak relevan.

Contoh nyata dari uji coba (Pedoman TA FTI UNISBANK 2019): bagian aturan pengetikan Laporan Tugas Akhir tidak menyebutkan ukuran font sama sekali (harus `detected: false`), sementara di bagian lain dokumen (aturan Naskah Publikasi) disebutkan "Times New Roman 10 point" — nilai ini **tidak boleh** dipakai untuk field `font_size` laporan utama.

### 3.4. Skema JSON Hasil Ekstraksi AI

Satu kali pemanggilan API mengembalikan JSON dengan struktur berikut:

```json
{
  "is_relevant": true,
  "confidence_note": "Dokumen berisi pedoman penulisan tugas akhir",
  "rules": {
    "paper_size": { "value": "A4", "detected": true },
    "margin_left_cm": { "value": 4, "detected": true },
    "margin_right_cm": { "value": 3, "detected": true },
    "margin_top_cm": { "value": 4, "detected": true },
    "margin_bottom_cm": { "value": 3, "detected": true },
    "font_family": { "value": "Times New Roman", "detected": true },
    "font_size": { "value": 12, "detected": true },
    "line_spacing": { "value": 2, "detected": false },
    "page_number_position": { "value": "bottom-center", "detected": true },
    "front_matter_numbering": { "value": "lowercase-roman", "detected": true },
    "main_body_numbering": { "value": "arabic", "detected": true },
    "chapter_title_case": { "value": "uppercase", "detected": true },
    "chapter_title_align": { "value": "center", "detected": true },
    "chapter_number_format": { "value": "roman", "detected": true },
    "subchapter_number_format": { "value": "decimal", "detected": false }
  },
  "missing_fields": ["line_spacing", "subchapter_number_format"]
}
```

Field dengan `"detected": false` otomatis diisi nilai default dan ditandai di halaman review agar pengguna tahu mana yang perlu diperiksa ulang.

**Tambahan v6 — field `source` untuk hasil fallback:** setiap object di dalam `rules` boleh punya field opsional `source` dengan nilai salah satu dari:
- `"ai_extraction"` (default kalau tidak ditulis) — nilai berasal dari AI membaca teks pedoman secara eksplisit. Ini yang paling bisa dipercaya.
- `"docx_property_fallback"` — nilai berasal dari properti XML dokumen `.docx` sumber, dipakai HANYA ketika AI menandai field itu `detected: false`. Field ini tetap harus dianggap **belum terverifikasi** di halaman Review (badge berbeda dari hasil `ai_extraction`, meski secara teknis field ini bisa saja bernilai `detected: true` untuk keperluan tampilan — yang penting badge visualnya membedakan sumbernya secara jelas ke user).

Contoh field dengan fallback:
```json
"font_size": { "value": 11, "detected": true, "source": "docx_property_fallback" }
```
Ini beda perlakuan visual di Review dari:
```json
"font_size": { "value": 12, "detected": true, "source": "ai_extraction" }
```
meski keduanya `detected: true` — yang kedua eksplisit disebut di teks pedoman, yang pertama cuma "kebetulan" begitu setting file `.docx`-nya.

---

## 4. Daftar Fitur Prioritas (MVP)

1. **Zero-Prompt Document Uploader** — antarmuka drag-and-drop untuk mengunggah dokumen pedoman kampus (`.pdf` atau `.docx`), tanpa perlu input teks instruksi.
2. **Rule Extraction Engine** — sesuai alur pada Bagian 3.2 dan 3.4.
3. **Deteksi Relevansi Dokumen** — menolak dokumen yang tidak relevan sebelum masuk tahap review (lihat Bagian 6, Skenario 3).
4. **Halaman Review** — menampilkan dan mengizinkan pengeditan seluruh aturan format yang terdeteksi, dikelompokkan menjadi 4 kelompok:
   - Kertas & margin (ukuran kertas, margin kiri/kanan/atas/bawah)
   - Font & spasi (jenis font, ukuran font, spasi baris)
   - Penomoran halaman (posisi nomor, format bagian awal, format bagian utama)
   - Format judul bab (gaya huruf judul bab, perataan, format nomor bab, format nomor sub-bab)
   Setiap kelompok menampilkan indikator jumlah field yang terdeteksi otomatis vs default.
5. **Pilihan Isi Bab** — di halaman review, pengguna memilih apakah isi tiap bab diisi teks lorem ipsum atau dikosongkan (hanya heading & struktur, tanpa isi).
6. **Auto-Template Generator** — membangun struktur file `.docx` baru berdasarkan aturan yang telah dikonfirmasi pengguna, termasuk section break untuk penomoran halaman berbeda antara bagian awal dan bagian utama.
7. **One-Click Download** — tombol unduh file `.docx` siap pakai.

---

## 5. User Flow (Alur Pengguna)

1. **Start:** Pengguna membuka halaman utama (Landing Page).
2. **Upload:** Pengguna drag-and-drop atau memilih file pedoman kampus (`.pdf` atau `.docx`).
3. **Proses & Cek AI:** Sistem memvalidasi file, lalu (untuk PDF) memanggil AI untuk mengecek relevansi dan mengekstrak aturan.
4. **Percabangan:**
   - **Jika tidak relevan** → sistem menampilkan pesan penolakan dan meminta pengguna mengunggah ulang dokumen yang sesuai (alur berhenti di sini).
   - **Jika relevan** (lengkap maupun sebagian) → lanjut ke tahap Review.
5. **Review:** Pengguna melihat seluruh aturan format dalam 4 kelompok field, mengedit bila perlu, dan memilih opsi isi bab (lorem ipsum/kosong).
6. **Finish:** Pengguna menekan "Download .docx".
7. **End:** File `.docx` terunduh.

---

## 6. Skenario Error Handling

* **Skenario 1: File Tidak Valid / Terlalu Besar**
  - *Pemicu:* Pengguna mengunggah `.png` atau PDF berukuran 15 MB.
  - *Penanganan:* Tombol "Generate" dinonaktifkan. Toast merah: *"Gagal: Harap unggah file PDF/DOCX dengan ukuran maksimal 10 MB."*
* **Skenario 2: Dokumen Rusak / Terkunci**
  - *Pemicu:* File tidak dapat dibaca parser, atau PDF terkunci password.
  - *Penanganan:* Proses dibatalkan. Notifikasi: *"Dokumen tidak dapat dibaca. Pastikan file tidak rusak atau terkunci kata sandi."*
* **Skenario 3: Dokumen Tidak Relevan**
  - *Pemicu:* AI mengklasifikasikan dokumen sebagai bukan pedoman format penulisan (mis. pengguna salah unggah draf skripsi, jurnal, atau file lain).
  - *Penanganan:* Proses dihentikan sebelum masuk tahap review. Notifikasi: *"Dokumen ini tampaknya bukan pedoman format penulisan. Silakan unggah dokumen pedoman yang sesuai."*
* **Skenario 4: PDF Hasil Scan Terdeteksi**
  - *Pemicu:* PDF tidak mengandung teks yang bisa diekstrak (kemungkinan hasil foto/scan).
  - *Penanganan:* Notifikasi: *"Dokumen ini tampaknya berupa hasil scan gambar. Saat ini kami hanya mendukung PDF berbasis teks atau file DOCX."*
* **Skenario 5: Dokumen Relevan tapi Sebagian Aturan Tidak Ditemukan**
  - *Pemicu:* Dokumen adalah pedoman format yang sah, tapi tidak menyebutkan sebagian aturan secara eksplisit (mis. tidak menyebut spasi atau format nomor sub-bab).
  - *Penanganan:* Sistem tetap lanjut ke halaman review dengan nilai default untuk field yang hilang, ditandai jelas dengan indikator "default" agar pengguna tahu perlu memeriksa ulang.
* **Skenario 6: Layanan AI Down / Rate Limit Tercapai**
  - *Pemicu:* Kegagalan respons dari Gemini API.
  - *Penanganan:* Tombol "Generate Template" dinonaktifkan sementara. Pesan: *"Mohon maaf, layanan AI kami sedang penuh atau mengalami gangguan. Silakan coba lagi dalam beberapa menit."*
* **Skenario 7: Proses macet tanpa respons (timeout/error tak tertangani)** *(ditambahkan v4)*
  - *Pemicu:* API Route gagal merespons dalam waktu wajar — timeout server, exception yang tidak tertangkap, atau JSON dari AI gagal di-parse.
  - *Penanganan:* Frontend wajib punya timeout sendiri (mis. batalkan request setelah ±25-30 detik) dan menampilkan pesan error yang jelas + tombol coba lagi — **bukan loading spinner tanpa batas waktu**. Server wajib membungkus seluruh proses (extract teks → panggil AI → validasi) dalam satu try-catch besar yang selalu mengembalikan response terstruktur (sukses atau gagal), tidak pernah membiarkan request menggantung tanpa jawaban.

---

## 7. Skema & Validasi Input Data

* **Tipe File:** Hanya menerima `.pdf` dan `.docx`.
* **Ukuran File:** Maksimal 10 MB.
* **Proteksi File:** Sistem mengecek apakah PDF terkunci password. Jika terkunci, proses dihentikan sebelum tahap ekstraksi.
* **Deteksi PDF Hasil Scan:** Sistem mengecek apakah PDF mengandung teks yang bisa diekstrak. Jika tidak ada teks yang terbaca, sistem menampilkan pesan bahwa jenis dokumen ini belum didukung.

---

## 8. Nilai Tambah Dibanding AI Generatif Umum

Pain point ini nyata: format skripsi/laporan berbeda-beda antar kampus dan sering membingungkan mahasiswa (margin, penomoran romawi/angka, hierarki bab, format judul). Dibanding AI generatif umum (ChatGPT dll.), keunggulan DocuForma AI adalah keluarannya berupa file `.docx` terstruktur yang presisi dan konsisten — termasuk section break untuk penomoran halaman berbeda dan heading style otomatis — bukan sekadar teks yang perlu diformat ulang secara manual. Sebagai proof-of-concept untuk UAS, cukup mendemonstrasikan kemampuan menangani 1–2 format kampus dengan baik dan jujur soal keterbatasannya.

---

## 9. Batasan Scope MVP (Out of Scope)

Untuk menjaga proyek ini realistis dikerjakan dalam satu semester, hal-hal berikut **sengaja tidak** dikerjakan di versi MVP:

* PDF hasil scan/foto (butuh OCR + vision AI, jauh lebih kompleks dan kurang akurat).
* Deteksi otomatis struktur/hierarki bab dari dokumen sumber (memakai template generik, lihat Bagian 3.3).
* Format sitasi/daftar pustaka (APA, dll.) — ini soal gaya kutipan konten, bukan format dokumen struktural.
* Elemen visual seperti logo kampus, kop surat, atau watermark otomatis.
* Dukungan multi-bahasa aturan format (fokus ke Bahasa Indonesia dulu).
* Penyimpanan histori/akun pengguna.
* Dukungan template dengan struktur sangat kompleks (mis. jurnal dengan kolom ganda).

Poin-poin ini bisa disebutkan di bagian "Pengembangan Selanjutnya" saat presentasi, supaya terlihat sebagai keputusan sadar, bukan kekurangan yang tidak disadari.

---

## 10. Keamanan

Meskipun proyek ini berskala UAS, beberapa aspek keamanan dasar tetap perlu diterapkan karena sistem menerima file upload dari publik dan memanggil API pihak ketiga.

1. **Validasi file di server, bukan hanya client.** Tipe file, ukuran maksimal (10 MB), dan status proteksi password harus divalidasi ulang di API Route. Validasi di JavaScript browser saja tidak cukup karena mudah dilewati (mis. request langsung lewat `curl`).

2. **Penanganan file berbahaya/malformed.** File `.docx` pada dasarnya adalah arsip ZIP, sehingga rentan terhadap file yang sengaja dirusak untuk membuat parser crash atau melakukan *decompression* berlebihan ("zip bomb"). Perlu ada batas ukuran hasil decompress, serta proses parsing dibungkus try-catch dan timeout agar file yang aneh tidak membuat server hang.

3. **Tanpa penyimpanan permanen.** File yang diunggah diproses *in-memory* dan langsung dibuang setelah response dikirim ke pengguna — tidak disimpan ke disk/storage, sesuai dengan keputusan MVP untuk tidak memiliki fitur histori (Bagian 9).

4. **API key AI hanya di server.** Pemanggilan Gemini API wajib dilakukan dari API Route (server-side), dengan key disimpan sebagai environment variable di Vercel. Key tidak boleh muncul di kode frontend atau pada request yang terlihat di browser DevTools.

5. **Rate limiting.** Karena tidak ada sistem akun/login, dibutuhkan rate limit sederhana per alamat IP (mis. maksimal 10 request per menit per IP) di API Route untuk mencegah penyalahgunaan kuota AI atau pembebanan server secara berlebihan.

6. **Validasi ketat terhadap hasil ekstraksi AI (mitigasi prompt injection).** Isi dokumen yang diunggah pengguna menjadi bagian dari prompt yang dikirim ke AI, sehingga berpotensi disisipi instruksi tersembunyi oleh pengguna jahat (mis. teks yang mencoba memaksa AI menganggap dokumen tidak relevan menjadi relevan). Mitigasinya bukan mencegah sepenuhnya, melainkan memvalidasi setiap nilai pada JSON hasil ekstraksi AI di server sebelum dipakai — misalnya `font_family` harus cocok dengan daftar font yang diizinkan, nilai margin harus berada dalam rentang wajar (0–10 cm), dan format penomoran harus sesuai enum yang telah ditentukan. Dengan begitu, walau AI "tertipu", dampaknya tetap terbatas karena output tidak dipercaya mentah-mentah.

7. **Transparansi penggunaan data ke pihak ketiga.** Karena memakai free tier Gemini API yang datanya dapat digunakan Google untuk peningkatan model, halaman upload perlu menampilkan notice singkat, mis. *"Dokumen akan diproses menggunakan AI pihak ketiga (Google Gemini)."*

8. **HTTPS & pembatasan akses API.** HTTPS otomatis tersedia lewat Vercel. Jika diperlukan, akses ke API Route dapat dibatasi hanya dari domain aplikasi sendiri untuk mengurangi risiko penyalahgunaan endpoint dari luar.

9. **Batas waktu eksekusi & fail-fast** *(ditambahkan v4)*. API Route yang memanggil AI harus mengatur `maxDuration` secara eksplisit sesuai batas platform deploy (Vercel). Seluruh alur (parsing file → ekstraksi teks → panggilan AI → validasi) dibungkus try-catch tunggal yang **selalu** mengirim response terstruktur — tidak boleh ada jalur kode yang membuat request menggantung tanpa response ke client. Ini penting karena kegagalan yang tidak fail-fast akan terlihat identik dengan "aplikasi macet" dari sudut pandang pengguna, padahal sebenarnya server sudah gagal di belakang layar.