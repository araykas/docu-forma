# Kumpulan Prompt Pengerjaan — DocuForma AI

Cara pakai:
1. Kerjakan berurutan dari Fase 0. Jangan lompat fase sebelum fase sebelumnya selesai & sudah dicoba jalan.
2. Sebelum tempel prompt, ketik dulu `jangan langsung coding, susun rencana implementasinya dulu` — biarkan Claude Code kasih rencana, baru kamu ketik "lanjut" kalau rencananya masuk akal.
3. Setelah tiap fase selesai, jalankan `npm run dev` dan coba fiturnya manual sebelum lanjut ke fase berikutnya.
4. Fase 0 hanya dikerjakan sekali di awal project.

---

## Fase 0 — Setup Project & Context File

```
Tolong bantu setup project baru:

1. Inisialisasi project Next.js (App Router, TypeScript) dengan Tailwind CSS.
2. Buat file CLAUDE.md di root project berisi ringkasan berikut:
   - Nama project: DocuForma AI, web app generate template .docx dari pedoman format kampus
   - Stack: Next.js App Router + TypeScript + Tailwind, deploy ke Vercel
   - Library utama: `docx` (npm) untuk generate file output, `pdf-parse` untuk ekstrak teks PDF, Gemini API untuk klasifikasi relevansi & ekstraksi aturan
   - Aturan penting: API key AI wajib di environment variable (server-side saja, tidak pernah di client), hasil JSON dari AI harus divalidasi di server sebelum dipakai, file upload diproses in-memory tanpa disimpan ke disk
   - Rujukan spesifikasi lengkap: docs/PRD_DocuForma_AI_v4.md
3. Buat folder docs/, aku akan taruh file PRD_DocuForma_AI_v4.md di situ.
4. Buat file docs/progress.md berisi checklist markdown (pakai [ ]) untuk 7 fitur MVP berikut, dikelompokkan per fase:
   - Fase 1: Upload & validasi file
   - Fase 2: Baca metadata .docx
   - Fase 3: Ekstraksi teks PDF + klasifikasi & ekstraksi AI
   - Fase 4: Halaman review
   - Fase 5: Generator template .docx
   - Fase 6: Keamanan (rate limit, validasi AI output, dll)
   - Fase 7: Wiring end-to-end & polish
5. Setup struktur folder: app/, app/api/, lib/, components/.

Jangan install dependency yang belum dibutuhkan di fase ini (docx, pdf-parse, dll akan ditambahkan di fase masing-masing).
```

**Setelah ini:** copy file `PRD_DocuForma_AI_v4.md` ke folder `docs/` di project kamu secara manual.

---

## Fase 1 — Halaman Upload & Validasi File (Server-Side)

```
Baca docs/PRD_DocuForma_AI_v4.md bagian 4 (fitur 1), bagian 6 (Skenario 1 & 2), bagian 7, dan bagian 10 poin 1 & 3.

Buat:
1. Landing page sederhana dengan komponen drag-and-drop upload untuk file .pdf dan .docx.
2. API Route (app/api/upload/route.ts atau sejenis) yang menerima file dan melakukan validasi DI SERVER (bukan cuma di client):
   - Tipe file harus .pdf atau .docx (cek berdasarkan isi file/magic bytes, bukan cuma ekstensi nama file)
   - Ukuran maksimal 10 MB
   - Untuk PDF: deteksi apakah file terkunci password, jika ya hentikan proses dan kembalikan pesan sesuai Skenario 2
   - Proses file di memory (buffer), jangan simpan ke disk
3. Tampilkan pesan error di frontend sesuai teks pada Skenario 1 & 2 di PRD kalau validasi gagal.
4. Update docs/progress.md, centang item Fase 1 yang sudah selesai.

Belum perlu implementasi ekstraksi/AI di fase ini — cukup sampai file tervalidasi dan diterima server.
```

---

## Fase 2 — Baca Metadata File .docx (Tanpa AI)

```
Baca docs/PRD_DocuForma_AI_v4.md bagian 3.2 (baris .docx) dan bagian 3.4 (skema JSON).

Buat modul (lib/parseDocxMetadata.ts atau sejenis) yang:
1. Menerima buffer file .docx yang sudah divalidasi di Fase 1.
2. Membaca properti dokumen langsung dari XML internal file .docx (margin, font, ukuran font, spasi baris) — TANPA memanggil AI, karena .docx menyimpan properti ini secara eksplisit.
3. Mengembalikan hasil dalam bentuk objek yang field-nya cocok dengan skema JSON di bagian 3.4 PRD (paper_size, margin_left_cm, dst), dengan flag "detected": true untuk field yang berhasil dibaca dan "detected": false + nilai default untuk yang tidak ditemukan di file.
4. Field yang secara struktural tidak ada di properti dasar .docx (misalnya penomoran halaman romawi/arab, format judul bab) boleh langsung diberi "detected": false dengan nilai default untuk alur .docx — jelaskan singkat di komentar kode kenapa.

Update docs/progress.md untuk item Fase 2 yang selesai.
```

---

## Fase 3 — Ekstraksi Teks PDF + Klasifikasi & Ekstraksi AI

```
Baca docs/PRD_DocuForma_AI_v4.md bagian 3.2 (baris PDF), bagian 3.3 (termasuk catatan "scoping ekstraksi"), bagian 3.4 (skema JSON lengkap), bagian 6 Skenario 3, 4, 5, 6, 7, dan bagian 10 poin 4, 6, 7, 9.

Buat:
1. Modul ekstraksi teks PDF menggunakan `unpdf` (lebih stabil di lingkungan serverless/Next.js dibanding `pdf-parse`) yang mendeteksi apakah PDF berbasis teks atau hasil scan (tidak ada teks terbaca) → jika scan, kembalikan error sesuai Skenario 4.
2. API Route server-side yang memanggil Gemini API (model Flash/Flash-Lite):
   - API key HARUS dibaca dari environment variable, jangan pernah dikirim ke client
   - Set `export const maxDuration = ...` di route ini sesuai batas platform Vercel, supaya proses yang kelamaan gagal cepat (fail-fast) alih-alih request menggantung
   - Prompt ke AI harus meminta output JSON PERSIS sesuai skema di bagian 3.4 PRD, termasuk field is_relevant dan missing_fields
   - PENTING — scoping: system prompt harus secara eksplisit menjelaskan bahwa dokumen sumber BISA memuat lebih dari satu spesifikasi format (mis. aturan Laporan/Skripsi utama vs aturan Naskah Publikasi/Jurnal/Artikel yang terpisah). Instruksikan AI untuk HANYA mengekstrak aturan Laporan/Skripsi/Tugas Akhir utama, mengabaikan aturan format deliverable lain meski ada di file yang sama, dan tetap set `detected: false` untuk field yang tidak disebut eksplisit di bagian yang relevan walau ada angka mirip di bagian lain.
   - Strip kemungkinan markdown code fence (```json ... ```) dari response Gemini sebelum JSON.parse
   - Bungkus SELURUH proses (extract teks → panggil Gemini → parse JSON → validasi) dalam SATU try-catch besar. Kegagalan di titik manapun harus selalu mengembalikan response terstruktur (mis. `{ success: false, reason: "..." }`), tidak pernah membiarkan request tanpa response (Skenario 7)
   - Jika Gemini API gagal merespons/rate limit, tangani sesuai Skenario 6 (nonaktifkan tombol generate, tampilkan pesan)
3. Validasi hasil JSON dari AI sebelum dipakai (mitigasi prompt injection, bagian 10 poin 6):
   - font_family harus ada dalam daftar font yang diizinkan (whitelist, misal: Times New Roman, Arial, Calibri)
   - nilai margin harus dalam rentang wajar (0–10 cm), tolak/reset ke default kalau di luar rentang
   - field enum (page_number_position, front_matter_numbering, dst) harus cocok salah satu nilai yang ditentukan, kalau tidak cocok fallback ke default
4. Jika is_relevant bernilai false, hentikan alur dan kembalikan pesan sesuai Skenario 3 — jangan lanjut ke tahap review.
5. Di frontend, tambahkan timeout sendiri (mis. AbortController ±25-30 detik) yang menampilkan pesan error + tombol coba lagi kalau server tidak merespons dalam waktu itu — jangan biarkan loading spinner tanpa batas waktu (Skenario 7).
6. Tambahkan notice singkat di halaman upload sesuai bagian 10 poin 7 ("Dokumen akan diproses menggunakan AI pihak ketiga...").
7. Log request/response mentah dari Gemini di server (console.log, khusus mode development) supaya gampang di-debug kalau hasil ekstraksi salah.

**Acceptance test wajib untuk fase ini:** uji pakai dokumen pedoman kampus asli yang punya lebih dari satu jenis spesifikasi format di dalamnya (body laporan + naskah publikasi/jurnal terpisah), contohnya Pedoman TA FTI UNISBANK 2019. Pastikan hasil ekstraksi TIDAK salah ambil nilai dari bagian naskah publikasi.

Update docs/progress.md untuk item Fase 3 yang selesai.
```

---

## Fase 4 — Halaman Review

```
Baca docs/PRD_DocuForma_AI_v4.md bagian 4 (fitur 4 & 5) dan bagian 3.4 (skema JSON).

Buat halaman review yang menampilkan hasil ekstraksi (dari Fase 2 untuk .docx atau Fase 3 untuk PDF) dalam 4 kelompok field yang bisa diedit user:
1. Kertas & margin: ukuran kertas, margin kiri/kanan/atas/bawah
2. Font & spasi: jenis font, ukuran font, spasi baris
3. Penomoran halaman: posisi nomor, format bagian awal, format bagian utama
4. Format judul bab: gaya huruf judul bab, perataan, format nomor bab, format nomor sub-bab

Setiap kelompok menampilkan badge kecil yang menunjukkan jumlah field yang "terdeteksi" vs "default" (pakai warna berbeda, misal hijau untuk terdeteksi dan kuning/oranye untuk default), field yang default juga ditandai supaya user sadar perlu diperiksa ulang.

Tambahkan juga di halaman ini:
- **Panel pratinjau visual** di bagian atas (sebelum form), berupa mockup kecil menyerupai satu halaman dokumen (proporsi mirip A4), yang menampilkan secara visual: padding sesuai nilai margin yang sedang dipilih, judul bab dengan font/gaya huruf/perataan/format nomor sesuai pilihan user, beberapa baris placeholder yang merepresentasikan isi paragraf (boleh berupa garis/skeleton, tidak perlu teks asli), dan nomor halaman di posisi yang dipilih. Sertakan toggle "Bagian awal" / "Bagian utama" untuk menunjukkan perbedaan gaya penomoran halaman (romawi vs angka arab) dan judul (mis. "KATA PENGANTAR" vs "BAB I"). Panel ini harus **update secara langsung (client-side)** setiap kali user mengubah nilai di form manapun — jadi bukan generate file docx sungguhan tiap kali berubah, cukup simulasi visual pakai HTML/CSS yang dipetakan dari nilai form. Beri keterangan kecil di bawah panel bahwa ini simulasi visual, bukan hasil render docx yang sebenarnya.
- Toggle pilihan isi bab: "Lorem ipsum" atau "Kosong"
- Tombol "Upload ulang" (kembali ke halaman upload)
- Tombol "Download .docx" (untuk fase berikutnya, sementara bisa dummy/disabled dulu)

Update docs/progress.md untuk item Fase 4 yang selesai.
```

---

## Fase 5 — Generator Template .docx

```
Baca docs/PRD_DocuForma_AI_v4.md bagian 3.1, bagian 3.4 (skema JSON), dan bagian 4 (fitur 6).

Buat modul (lib/generateDocx.ts atau sejenis) menggunakan library `docx` (npm) yang membangun file .docx output berdasarkan seluruh nilai yang sudah dikonfirmasi user di halaman Review:
1. Margin, ukuran kertas, font, ukuran font, spasi baris diterapkan ke seluruh dokumen.
2. Section break antara "bagian awal" dan "bagian utama" agar penomoran halaman bisa berbeda (romawi kecil di bagian awal, angka arab mulai dari BAB I) sesuai field front_matter_numbering & main_body_numbering.
3. Heading style untuk judul bab: kapital/tidak sesuai chapter_title_case, perataan sesuai chapter_title_align, format nomor bab (romawi/angka) sesuai chapter_number_format.
4. Struktur bab memakai template generik (BAB I – BAB VI, sesuai keputusan di PRD bagian 3.3 — bukan hasil deteksi AI).
5. Isi tiap bab diisi lorem ipsum ATAU dikosongkan (hanya heading), sesuai pilihan user di halaman Review.
6. Hubungkan tombol "Download .docx" di halaman Review ke endpoint yang menghasilkan file ini dan memicu download di browser.

Update docs/progress.md untuk item Fase 5 yang selesai.
```

---

## Fase 6 — Keamanan Tambahan

```
Baca docs/PRD_DocuForma_AI_v4.md bagian 10 (seluruh poin) secara lengkap.

Terapkan hal-hal yang belum tercakup di fase sebelumnya:
1. Rate limiting sederhana per IP di API Route upload dan API Route AI (misal maksimal 10 request per menit per IP).
2. Perlindungan terhadap file .docx yang berpotensi "zip bomb": batasi ukuran maksimal hasil decompress, bungkus proses parsing dengan try-catch dan timeout.
3. Pastikan seluruh pemanggilan Gemini API dan environment variable API key sudah benar-benar server-side (cek ulang tidak ada yang bocor ke client bundle).
4. Review ulang validasi hasil JSON AI di Fase 3, pastikan semua field numerik dan enum sudah divalidasi rentang/whitelist-nya.

Jelaskan di akhir apa saja yang sudah diterapkan dan apakah ada celah yang masih perlu diperhatikan untuk skala produksi (boleh dicatat di docs/progress.md sebagai catatan, bukan untuk dikerjakan sekarang kalau di luar scope MVP).

Update docs/progress.md untuk item Fase 6 yang selesai.
```

---

## Fase 7 — Wiring End-to-End & Polish

```
Baca docs/PRD_DocuForma_AI_v4.md bagian 5 (User Flow) secara lengkap.

Sambungkan seluruh alur dari awal sampai akhir sesuai urutan di bagian 5:
Upload → validasi & proses (docx metadata langsung / pdf lewat AI) → percabangan (tidak relevan = tolak & minta upload ulang, relevan = lanjut) → halaman Review → pilih isi bab → Download.

Tambahkan:
1. Loading state yang jelas di setiap tahap proses (upload, cek AI, generate), dengan timeout di frontend supaya tidak ada spinner tanpa batas waktu (Skenario 7)
2. Semua pesan error dari Skenario 1–7 di bagian 6 PRD muncul di tempat yang tepat sesuai pemicunya
3. Uji alur end-to-end minimal dengan: 1 contoh dokumen relevan sederhana, 1 contoh dokumen tidak relevan, dan 1 dokumen pedoman kampus asli yang punya lebih dari satu spesifikasi format (mis. Pedoman TA FTI UNISBANK 2019) untuk memastikan hasil ekstraksi tidak salah ambil section

Setelah selesai, tinjau ulang docs/progress.md — pastikan semua checklist dari Fase 1–6 sudah tercentang, kalau ada yang belum, sebutkan apa yang kurang.
```

---

## Fase 8 — Deploy ke Vercel

```
Siapkan project untuk deploy ke Vercel:
1. Pastikan environment variable API key Gemini terdaftar dengan benar (bukan hardcoded di kode).
2. Cek ulang docs/PRD_DocuForma_AI_v4.md bagian 9 (Out of Scope) — pastikan tidak ada fitur di luar scope yang ikut ter-expose di UI (misal jangan ada tombol/menu untuk fitur yang belum dikerjakan).
3. Buat file .env.example yang mencantumkan nama environment variable yang dibutuhkan (tanpa isi key asli).
4. Beri instruksi singkat langkah-langkah deploy manual ke Vercel (karena proses connect ke akun Vercel harus aku lakukan sendiri di dashboard).
```
