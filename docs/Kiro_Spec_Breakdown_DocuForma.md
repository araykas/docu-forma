# DocuForma AI — Breakdown Spec untuk Kiro (versi lebih kecil)

## Cara kerja Kiro yang perlu kamu tahu dulu

Kiro punya 3 lapisan:
- **Steering** (`.kiro/steering/` atau `AGENTS.md` yang kamu sudah punya — Kiro otomatis baca ini) → aturan project yang selalu diingat.
- **Specs** → satu unit kerja: kamu kasih deskripsi singkat, Kiro bikinkan `requirements.md` → `design.md` → `tasks.md` (daftar tugas kecil bercentang). Kamu **review & approve tiap tahap** sebelum lanjut ke tahap berikutnya.
- **Tasks** di dalam satu spec → dieksekusi **satu per satu**, bukan sekaligus. Ini kuncinya buat menghindari masalah kemarin.

**Aturan main yang kita pakai di sini:**
1. Satu spec = satu potongan kerja kecil (bukan satu fase besar kayak sebelumnya).
2. Di dalam satu spec, jalankan task satu-satu — abis satu task selesai, kamu test manual dulu, baru task berikutnya.
3. Tiap bikin spec baru, suruh Kiro baca bagian PRD yang relevan (sudah saya tandain di bawah) supaya dia nggak menebak.
4. `git commit` setiap satu spec selesai penuh (semua task-nya beres & sudah dites).

---

## Daftar Spec (urutan wajib, jangan lompat)

### KELOMPOK A — Setup

**Spec A1 — Inisialisasi project**
- Deskripsi ke Kiro: "Inisialisasi project Next.js App Router + TypeScript + Tailwind untuk DocuForma AI. Buat struktur folder app/, app/api/, lib/, components/, docs/. Jangan install dependency PDF/docx/AI dulu."
- Baca: AGENTS.md (otomatis)
- Test: `npm run dev` jalan, halaman kosong tampil tanpa error.

**Spec A2 — Progress tracker**
- Deskripsi: "Buat docs/progress.md checklist markdown untuk seluruh spec di file ini (list di bawah), dikelompokkan per Kelompok A-H."
- Test: file muncul, isinya masuk akal.

---

### KELOMPOK B — Upload (dulu Fase 1, dipecah jadi 3)

**Spec B1 — UI upload saja (tanpa validasi server)**
- Baca: PRD bagian 4 (fitur 1)
- Deskripsi: "Buat landing page dengan komponen drag-and-drop upload untuk .pdf/.docx. FOKUS UI SAJA — validasi lengkap belum, cukup terima file dan tampilkan nama file yang dipilih."
- Test: buka browser, drag file apapun, nama file muncul di layar.

**Spec B2 — Validasi tipe & ukuran file (server-side)**
- Baca: PRD bagian 6 Skenario 1, bagian 10 poin 1 & 3
- Deskripsi: "Buat API Route yang menerima file dari Spec B1, validasi tipe file berdasarkan magic bytes (bukan ekstensi nama), maksimal 10MB, proses in-memory saja. Tampilkan pesan sesuai Skenario 1 PRD kalau gagal."
- Test: upload file .txt yang di-rename jadi .pdf → harus ditolak. Upload file >10MB → ditolak.

**Spec B3 — Deteksi PDF terkunci password**
- Baca: PRD bagian 6 Skenario 2
- Deskripsi: "Tambahkan deteksi PDF ber-password di API Route upload, hentikan proses dan tampilkan pesan sesuai Skenario 2."
- Test: upload PDF yang di-protect password → pesan yang benar muncul.

---

### KELOMPOK C — Baca pedoman .docx (Fase 2, direvisi jadi 2 spec + koreksi penting)

**⚠️ Koreksi dari versi sebelumnya:** file `.docx` **tidak selalu** boleh dibaca langsung dari XML-nya. Kalau `.docx` itu isinya teks naratif ("margin harus 4cm...") — persis kayak PDF, cuma beda kontainer — baca XML-nya akan salah, karena yang kebaca cuma setting Word dokumen itu sendiri (bisa jadi cuma default 2.54cm), bukan aturan yang dideskripsikan. Baca PRD bagian 3.2 (sudah direvisi ke v5) sebelum mulai spec ini.

**Spec C1 — Deteksi jenis .docx: template siap pakai vs pedoman naratif**
- Baca: PRD bagian 3.2 (tabel yang sudah direvisi)
- Deskripsi: "Buat modul yang menerima buffer .docx, extract teks polos pakai library mammoth, hitung jumlah kata naratif di luar heading/placeholder pendek. Kalau di bawah ambang (mis. <150 kata) → tandai sebagai 'template'. Kalau di atas ambang → tandai sebagai 'naratif'. Modul ini HANYA mengklasifikasikan, belum mengekstrak aturan."
- Test: coba dengan .docx yang isinya cuma judul+placeholder kosong → harus ke-tag 'template'. Coba dengan .docx yang isinya paragraf penjelasan panjang (mis. copy-paste isi BAB V dari PDF UNISBANK ke Word) → harus ke-tag 'naratif'.

**Spec C2 — Baca metadata .docx (khusus jalur "template")**
- Baca: PRD bagian 3.2 (baris .docx template), bagian 3.4 (skema JSON)
- Deskripsi: "Untuk file yang ke-tag 'template' di Spec C1, buat modul baca properti .docx langsung dari XML internal (margin, font, ukuran font, spasi) TANPA AI. Field yang tidak ada di properti dasar .docx diberi detected:false + default."
- Test: upload .docx template kosong yang kamu tahu setting-nya, cek hasil JSON sesuai isi file aslinya.

**Catatan penting untuk file yang ke-tag 'naratif' di Spec C1:** file ini **tidak** dapat spec baru sendiri — dia langsung dilempar ke pipeline Kelompok D (spec D2 dst.) yang sama persis dengan PDF, cuma sumber teksnya dari hasil extract mammoth, bukan dari unpdf. Makanya di Kelompok D nanti, pastikan input pipeline-nya digeneralisasi jadi "terima teks polos dari sumber manapun", bukan cuma PDF.

---

### KELOMPOK D — Ekstraksi teks + AI (dulu Fase 3, PALING BERISIKO — dipecah jadi 7 spec kecil)

**Catatan:** kelompok ini sekarang jadi pipeline **generik** — dipakai untuk teks dari PDF (Spec D1) **maupun** teks dari .docx naratif (hasil Spec C1). Spec D2 dan seterusnya harus menerima input berupa string teks polos, tidak peduli asalnya, supaya tidak ada kode dobel.

**Spec D1 — Ekstraksi teks PDF saja (tanpa AI)**
- Baca: PRD bagian 3.2 (baris PDF)
- Deskripsi: "Buat modul ekstraksi teks PDF pakai library unpdf. Deteksi apakah PDF hasil scan (tidak ada teks) → kalau ya, return error sesuai Skenario 4 PRD. Belum ada pemanggilan AI di spec ini — cukup return teks mentahnya dulu ke console/log untuk verifikasi."
- Test: upload PDF UNISBANK, cek log — teksnya harus keluar utuh. Upload PDF hasil scan/foto → error Skenario 4 muncul.

**Spec D2 — Wiring dasar ke Gemini API (tanpa scoping/validasi dulu)**
- Baca: PRD bagian 3.4 (skema JSON), bagian 10 poin 4
- Deskripsi: "Buat API Route yang kirim teks dari Spec D1 ke Gemini API, API key dari environment variable. Minta output JSON sesuai skema di bagian 3.4. Set maxDuration di route ini. FOKUS: pastikan komunikasi ke Gemini jalan dan JSON berhasil di-parse — belum perlu scoping khusus atau validasi rentang di spec ini."
- Test: coba dengan PDF sederhana dulu (bukan yang UNISBANK), pastikan JSON balik dan ke-parse tanpa error.

**Spec D3 — Scoping prompt: dokumen dengan spesifikasi ganda**
- Baca: PRD bagian 3.3 (catatan "scoping ekstraksi") — ini bagian paling penting
- Deskripsi: "Perkuat system prompt Gemini di Spec D2: instruksikan AI untuk HANYA mengekstrak aturan Laporan/Skripsi utama, mengabaikan aturan format naskah publikasi/jurnal/lampiran meski ada di dokumen yang sama. Field yang tidak disebut eksplisit di bagian relevan harus tetap detected:false walau ada angka mirip di bagian lain."
- **Test wajib:** upload PDF Pedoman TA FTI UNISBANK. Hasil yang benar: margin 4/3/4/3, spasi 2, **font_size harus detected:false** (bukan 10). Kalau salah, jangan lanjut ke spec berikutnya — perbaiki prompt di spec ini dulu.

**Spec D4 — Validasi & sanitasi hasil JSON dari AI**
- Baca: PRD bagian 10 poin 6
- Deskripsi: "Tambahkan validasi server terhadap JSON dari Spec D3: font_family harus whitelist, margin 0-10cm, field enum harus cocok daftar yang ditentukan — fallback ke default kalau di luar rentang."
- Test: coba akali dengan PDF aneh, pastikan tidak ada nilai liar yang lolos ke frontend.

**Spec D5 — Error handling fail-fast**
- Baca: PRD bagian 6 Skenario 6 & 7, bagian 10 poin 9
- Deskripsi: "Bungkus seluruh proses Spec D1-D4 (extract → AI → parse → validasi) dalam satu try-catch besar yang SELALU mengembalikan response terstruktur. Tambahkan timeout di frontend (AbortController ±25-30 detik) dengan pesan error + tombol coba lagi — jangan biarkan spinner tanpa batas waktu."
- Test: coba matikan koneksi internet sesaat / pakai API key salah sengaja → pastikan muncul pesan error di UI, bukan diam/stuck.

**Spec D6 — Penanganan dokumen tidak relevan**
- Baca: PRD bagian 6 Skenario 3
- Deskripsi: "Kalau is_relevant:false dari hasil AI, hentikan alur dan tampilkan pesan sesuai Skenario 3, jangan lanjut ke halaman review."
- Test: upload dokumen yang jelas bukan pedoman format (misal resep masakan) → pesan penolakan muncul.

**Spec D7 — Notice AI pihak ketiga**
- Baca: PRD bagian 10 poin 7
- Deskripsi: "Tambahkan notice singkat di halaman upload sesuai bagian 10 poin 7."
- Test: notice muncul di halaman upload.

---

### KELOMPOK E — Halaman Review (dulu Fase 4, dipecah jadi 4)

**Spec E1 — Layout review dengan data dummy**
- Baca: PRD bagian 4 (fitur 4 & 5), bagian 3.4
- Deskripsi: "Buat halaman review dengan 4 kelompok field (kertas&margin, font&spasi, penomoran halaman, format judul bab) pakai DATA DUMMY dulu (hardcode), belum terhubung ke hasil ekstraksi asli. Termasuk badge terdeteksi/default."
- Test: halaman tampil rapi dengan data dummy.

**Spec E2 — Panel pratinjau visual**
- Baca: PRD bagian 4 (detail panel pratinjau)
- Deskripsi: "Tambahkan panel pratinjau visual (mockup A4) di atas form, update client-side tiap form berubah, plus toggle Bagian awal/Bagian utama."
- Test: ubah nilai margin/font di form, panel berubah real-time.

**Spec E3 — Kontrol tambahan**
- Deskripsi: "Tambahkan toggle isi bab (Lorem ipsum/Kosong), tombol Upload ulang, tombol Download (dummy/disabled dulu)."
- Test: semua kontrol muncul dan berfungsi (kecuali download, masih dummy).

**Spec E4 — Hubungkan ke data ekstraksi asli**
- Deskripsi: "Ganti data dummy di Spec E1-E3 dengan hasil asli dari Kelompok C (.docx) atau Kelompok D (PDF)."
- Test: upload dokumen asli, cek data yang tampil di review sesuai hasil ekstraksi.

---

### KELOMPOK F — Generator .docx (dulu Fase 5, dipecah jadi 3)

**Spec F1 — Generator dasar (margin, font, kertas)**
- Baca: PRD bagian 3.1, 3.4
- Deskripsi: "Buat modul generateDocx pakai library docx (npm). Terapkan margin, ukuran kertas, font, ukuran font, spasi baris ke dokumen. Struktur bab pakai template generik BAB I-VI. Belum perlu section break/penomoran berbeda di spec ini."
- Test: download file, buka di Word, cek margin & font sesuai review.

**Spec F2 — Section break & penomoran halaman**
- Deskripsi: "Tambahkan section break antara bagian awal & utama sesuai front_matter_numbering & main_body_numbering, heading style sesuai chapter_title_case/align/number_format."
- Test: buka file, cek nomor halaman romawi di bagian awal, arab di bagian utama.

**Spec F3 — Isi bab & hubungkan tombol Download**
- Deskripsi: "Isi tiap bab dengan lorem ipsum atau kosong sesuai pilihan user di Review. Hubungkan tombol Download di halaman Review (Spec E3) ke endpoint ini."
- Test: klik Download di halaman review sungguhan, file ke-download dan sesuai pilihan.

---

### KELOMPOK G — Keamanan (dulu Fase 6, tetap 1 spec karena isinya review-only)

**Spec G1 — Hardening**
- Baca: PRD bagian 10 seluruh poin
- Deskripsi: "Terapkan rate limiting per IP, batas ukuran hasil decompress .docx (anti zip-bomb), cek ulang tidak ada API key bocor ke client bundle."
- Test: minta Kiro jelaskan apa yang diterapkan + celah yang masih ada untuk skala produksi.

---

### KELOMPOK H — Wiring akhir & Deploy (dulu Fase 7-8, dipecah jadi 3)

**Spec H1 — Wiring end-to-end**
- Baca: PRD bagian 5 (User Flow)
- Deskripsi: "Sambungkan seluruh alur upload → proses → review → download sesuai urutan bagian 5. Loading state jelas di tiap tahap."
- Test: jalani alur lengkap dari awal sampai akhir, 1x dengan dokumen relevan, 1x tidak relevan.

**Spec H2 — Uji dengan dokumen kompleks**
- Deskripsi: "Tidak perlu spec baru — ini murni testing manual kamu sendiri."
- Test: **wajib** pakai PDF Pedoman TA FTI UNISBANK dari awal (upload) sampai akhir (download .docx), pastikan semua benar termasuk font_size yang seharusnya default (bukan ke-detect 10pt).

**Spec H3 — Persiapan deploy**
- Baca: PRD bagian 9 (Out of Scope)
- Deskripsi: "Pastikan API key hanya dari environment variable, buat .env.example, pastikan tidak ada fitur out-of-scope yang ter-expose di UI."
- Test: cek `.env.example` ada dan tidak berisi key asli.

---

## Setelah semua spec di atas selesai → lanjut ke deploy manual

(Push ke GitHub → Import ke Vercel → isi environment variable → Deploy — langkah persis sudah ada di file `00_MULAI_DARI_SINI_Windows.md` yang saya buat sebelumnya, itu masih berlaku sama persis untuk Kiro, cuma bagian "Claude Code"-nya diganti kerjaan pakai Kiro seperti di atas.)

---

## Kenapa dipecah sedetail ini

Spec D (ekstraksi PDF+AI) sengaja dipecah paling banyak (7 spec) karena itu **persis bagian yang kemarin gagal**. Dengan dipecah begini:
- Kalau ada yang salah, kamu tahu persis di spec mana masalahnya muncul (bukan nebak dari satu blok besar).
- Spec D3 (scoping) bisa kamu ulang-ulang sendiri tanpa perlu bongkar bagian lain, karena D1/D2/D4/D5 sudah stabil duluan.
- Tiap spec kecil = lebih cepat direview sebelum di-approve, jadi kamu nggak keteteran baca rencana yang kepanjangan.
