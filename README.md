# DocuForma AI

Aplikasi web berbasis Next.js yang mengekstrak aturan format penulisan dari dokumen pedoman Tugas Akhir/Skripsi (PDF atau .docx), lalu menghasilkan template .docx siap pakai dengan aturan tersebut.

---

## Stack

- **Next.js 15** (App Router)
- **Google Gemini** (ekstraksi aturan via AI)
- **docx** (generasi file .docx)
- **Tailwind CSS** (UI)

---

## Cara menjalankan

1. Salin `.env.example` ke `.env.local` dan isi `GEMINI_API_KEY`.
2. Install dependensi:
   ```bash
   npm install
   ```
3. Jalankan server development:
   ```bash
   npm run dev
   ```
4. Buka [http://localhost:3000](http://localhost:3000).

---

## Alur kerja

```
Upload PDF/DOCX → Ekstrak teks → Kirim ke Gemini → Ekstrak 16 field aturan
      → Review & koreksi manual → Download template .docx
```

---

## Nilai default field — alasan dan landasan

Ketika AI tidak mendeteksi sebuah field dari dokumen pedoman (`detected: false`), sistem memakai nilai default. Setiap nilai bukan asal dipilih — berikut landasan per field.

> Referensi utama yang dipakai: **Pedoman Penyusunan Tugas Akhir FTI UNISBANK Semarang (2019)**, disingkat *Pedoman FTI* di bawah ini.

### Kertas & Margin

| Field | Default | Alasan |
|---|---|---|
| `paper_size` | `A4` | Standar nasional Indonesia (SNI) dan ISO 216. Seluruh pedoman TA perguruan tinggi Indonesia yang diketahui menetapkan A4, bukan Letter (standar AS) atau Legal. |
| `margin_left_cm` | `4` | Pedoman FTI Bab V secara eksplisit: *"dari samping kiri: 4 cm"*. Lebih lebar karena sisi kiri dipakai untuk jilid hardcover — jika terlalu sempit, teks terpotong setelah dijilid. |
| `margin_top_cm` | `4` | Pedoman FTI Bab V: *"dari atas: 4 cm"*. Konsisten dengan margin kiri karena keduanya merupakan sisi "primer" tampilan halaman. |
| `margin_right_cm` | `3` | Pedoman FTI Bab V: *"dari samping kanan: 3 cm"*. Sisi non-jilid, 3 cm cukup untuk cetakan laser tanpa terasa sempit. |
| `margin_bottom_cm` | `3` | Pedoman FTI Bab V: *"dari bawah: 3 cm"*. Sisi non-jilid, sama dengan margin kanan. |

### Font & Spasi

| Field | Default | Alasan |
|---|---|---|
| `font_family` | `Times New Roman` | Font serif paling umum diwajibkan di pedoman TA Indonesia. Pedoman FTI Bab V secara eksplisit: *"Tipe huruf standar (huruf Times New Roman)"*. Bukan Calibri (default Word modern, jarang diwajibkan di TA Indonesia) dan bukan Arial (sans-serif, tidak lazim untuk naskah akademik formal). |
| `font_size` | `12` | **12 pt adalah konvensi standar Times New Roman untuk naskah akademik Indonesia**, bukan tiruan default Microsoft Word. Word defaultnya Calibri 11pt — font berbeda, ukuran berbeda, bukan acuan yang tepat. 12pt Times New Roman muncul konsisten di konvensi penerbitan akademik Indonesia dan internasional untuk naskah serif formal. Pedoman FTI tidak menyebut angka pt eksplisit, tapi konteks "Times New Roman 2 spasi" di naskah akademik Indonesia selalu merujuk ke 12pt. |
| `line_spacing` | `2` | Pedoman FTI Bab V secara eksplisit: *"jarak pengetikan 2 spasi"*. Spasi ganda adalah standar de facto naskah TA/skripsi Indonesia — cukup longgar untuk anotasi/koreksi dosen di margin, tidak seperti spasi 1 yang terlalu rapat. |
| `font_color` | `black` | Pedoman FTI Bab V secara eksplisit: *"Warna tinta hitam"*. Bukan default aksidental — ini persyaratan cetak yang hampir universal di perguruan tinggi Indonesia. |

### Penomoran Halaman

| Field | Default | Alasan |
|---|---|---|
| `page_number_position` | `bottom-center` | Pedoman FTI Bab V: *"Peletakan nomor halaman di bawah tengah (1,5 cm dari bawah)"* untuk bagian utama. Posisi paling umum di pedoman TA Indonesia. Bukan top-right (konvensi jurnal/artikel, bukan skripsi). |
| `front_matter_numbering` | `lowercase-roman` | Romawi kecil (i, ii, iii) adalah konvensi baku untuk bagian awal (halaman judul s.d. daftar lampiran). Pedoman FTI Bab V: *"angka romawi huruf kecil (i, ii, ...)"*. Bukan angka Arab yang dipakai bagian utama. |
| `main_body_numbering` | `arabic` | Pedoman FTI Bab V: *"nomor halaman bab dan sub bab menggunakan angka Arab (1, 2, ...)"*. Standar universal untuk bagian isi. |

### Format Judul Bab

| Field | Default | Alasan |
|---|---|---|
| `chapter_title_case` | `uppercase` | Pedoman FTI Bab V: *"setiap bab dan sub bab diketik dengan huruf kapital semua"*. Konvensi paling umum di pedoman TA Indonesia. Bukan *capitalize* (konvensi judul bahasa Inggris) dan bukan *normal* (terlalu informal). |
| `chapter_title_align` | `center` | Pedoman FTI Bab V: judul bab diketik *"di tengah halaman"*. Hampir universal di pedoman TA Indonesia. Bukan rata kiri (konvensi laporan teknis/jurnal). |
| `chapter_number_format` | `roman` | Pedoman FTI Bab V: *"nomor urut bab menggunakan Angka Romawi"* (BAB I, BAB II, ...). Konvensi TA Indonesia paling umum. Bukan angka Arab (lebih umum di buku teks dan tesis luar negeri). |
| `subchapter_number_format` | `decimal` | Pedoman FTI Bab V: *"nomor urut sub bab menggunakan Angka Arab dengan cara desimal"* (1.1, 1.2, 2.1, ...). Konvensi paling umum di pedoman TA Indonesia untuk sub-bab. |

---

## Catatan teknis: kenapa judul bab pernah berwarna biru

Library `docx` menggunakan `HeadingLevel.HEADING_1/2` yang mewarisi style bawaan Word — secara default style tersebut berwarna `#2E74B5` (biru tema Office). Karena `color` pada `TextRun` tidak pernah di-override, Word memperlihatkan warna biru meski dokumennya bukan template Office.

Solusi: setiap `TextRun` di `lib/generateDocx.ts` sekarang selalu menyertakan `color: fontColor` secara eksplisit, di mana `fontColor` berasal dari field `font_color` (default `'000000'` = hitam). Ini berlaku untuk heading level 1, heading level 2, teks isi, teks front matter, dan nomor halaman di footer/header.

---

## Struktur proyek

```
app/
  page.tsx              # Halaman upload
  review/page.tsx       # Halaman review aturan
  api/
    upload/route.ts     # POST: ekstrak teks + panggil Gemini
    generate/route.ts   # POST: hasilkan .docx
    analyze/route.ts    # POST: analisis file

components/
  FileUpload.tsx        # Komponen upload file
  ReviewPage.tsx        # Halaman review + form 16 field

lib/
  callGemini.ts         # Spec D2/D3 — wiring Gemini API + prompt
  extractionToGroups.ts # Spec E4 — petakan hasil AI ke FieldGroup[]
  fieldConfig.ts        # Enum options, range, labels, FONT_COLOR_HEX
  generateDocx.ts       # Spec F1/F2/F3 — generator .docx
  extractPdfText.ts     # Ekstrak teks dari PDF
  extractDocxText.ts    # Ekstrak teks dari .docx
  validateFile.ts       # Validasi tipe & ukuran file
  rateLimit.ts          # Rate limiting per IP

docs/
  PRD_DocuForma_AI_v6.md            # Product Requirements Document
  Kiro_Spec_Breakdown_DocuForma.md  # Breakdown spec per fitur
  progress.md                       # Log progress implementasi
```

---

## Variabel lingkungan

| Variabel | Keterangan |
|---|---|
| `GEMINI_API_KEY` | API key Google Gemini (wajib). Dapatkan di [Google AI Studio](https://aistudio.google.com/). |
