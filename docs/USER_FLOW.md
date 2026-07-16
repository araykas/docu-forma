# User Flow — DocuForma AI

**Versi:** 1.0  
**Terakhir diperbarui:** Juli 2026

---

## Gambaran Umum

Aplikasi ini memiliki dua halaman utama dan satu alur linear:

```
Halaman Upload (/)  →  [proses background]  →  Halaman Review (/review)  →  Download
```

Tidak ada login, tidak ada navigasi kompleks. User masuk, upload, review, download.

---

## Alur Lengkap

### Langkah 1 — Membuka Aplikasi

User membuka `http://localhost:3000` (development) atau URL production.

Yang tampil di halaman:
- Hero section dengan judul dan deskripsi singkat
- Area upload (drag-and-drop zone) di tengah halaman
- Notifikasi privasi: dokumen akan diproses oleh Google Gemini AI (free tier)
- Bagian "Cara kerja" dengan 3 langkah visual di bawah

---

### Langkah 2 — Memilih File

User memilih file pedoman format kampus dengan salah satu cara:

**Cara A — Drag and drop:**
Seret file PDF atau DOCX dari File Explorer dan lepaskan di atas area upload. Area berubah warna dan menampilkan animasi saat file melayang di atasnya.

**Cara B — Klik untuk browse:**
Klik area upload atau teks "pilih file" untuk membuka dialog file browser. Hanya file dengan ekstensi `.pdf` dan `.docx` yang bisa dipilih.

Setelah file dipilih, area upload menampilkan:
- Ikon file (merah untuk PDF, biru untuk DOCX)
- Nama file dan ukuran file
- Tombol **"Generate Template"**
- Tautan "Ganti file" dan "Hapus"

---

### Langkah 3 — Memulai Proses

User menekan tombol **"Generate Template"**.

Tombol berubah menjadi spinner dengan label yang bergerak maju sesuai progres:
1. `Memvalidasi file…`
2. `Mengirim file ke server…`
3. `Mengekstrak teks dokumen…`
4. `Menganalisis aturan format dengan AI…`
5. `Memproses hasil AI…`
6. `Membuka halaman review…`

> Proses ini melibatkan pemanggilan Gemini API dan bisa memakan waktu 5–30 detik tergantung ukuran dokumen dan kondisi jaringan. Timeout frontend diset 27 detik — jika melampaui batas, user mendapat pesan error dan bisa mencoba lagi.

---

### Langkah 4 — Skenario Validasi File (Percabangan)

Sebelum AI dipanggil, server memvalidasi file. Ada beberapa kemungkinan:

| Kondisi | Yang Terjadi | Tindakan User |
|---|---|---|
| File valid (PDF/DOCX, < 10 MB, tidak terkunci) | Lanjut ke proses AI | — |
| File > 10 MB | Error: pesan ukuran maksimal 10 MB | Upload file yang lebih kecil |
| Format bukan PDF/DOCX | Error: pesan format tidak didukung | Upload file yang sesuai |
| PDF terkunci password | Error: dokumen tidak dapat dibaca | Buka kunci PDF terlebih dahulu |
| PDF hasil scan (tanpa teks) | Error: hanya mendukung PDF berbasis teks | Gunakan versi DOCX atau PDF digital |
| Dokumen bukan pedoman format | Pesan: dokumen tidak relevan (badge kuning) | Tekan "Upload Dokumen Lain" dan coba file lain |
| Rate limit terlampaui (> 10 req/menit) | Error: terlalu banyak permintaan | Tunggu sebentar lalu coba lagi |
| Timeout (> 27 detik) | Error: proses terlalu lama | Tekan "Coba Lagi" |
| Error jaringan | Error: kesalahan jaringan | Periksa koneksi, tekan "Coba Lagi" |

Untuk semua kondisi error, user tidak perlu memilih file ulang — tombol **"Coba Lagi"** tersedia langsung di area upload dengan file yang sama masih tersimpan.

---

### Langkah 5 — Halaman Review

Setelah proses berhasil, browser berpindah ke `/review`. Halaman ini terdiri dari dua kolom:

**Kolom kiri — Form aturan (4 kartu):**

1. **Kertas & Margin** — ukuran kertas, 4 nilai margin (dalam cm)
2. **Font & Spasi** — jenis font, ukuran font (pt), spasi baris, warna tinta
3. **Penomoran Halaman** — posisi nomor, format bagian awal, format bagian utama
4. **Format Judul Bab** — gaya huruf, perataan, format nomor bab, format nomor sub-bab

Setiap field menampilkan:
- Label nama field
- Badge sumber: **Terdeteksi** (hijau) / **Default** (kuning) / **Saran file** (biru)
- Kutipan verbatim dari dokumen pedoman (hanya untuk field yang terdeteksi AI) — ditampilkan miring di bawah label sebagai bukti
- Kontrol input: dropdown untuk field enum, number input untuk nilai numerik

> **Field kuning (Default)** berarti AI tidak menemukan aturan itu di dokumen pedoman. Nilai yang tampil adalah nilai bawaan berbasis standar Pedoman FTI UNISBANK. User sebaiknya memverifikasi manual ke dokumen asli.

**Kolom kanan — Preview A4:**
- Miniatur halaman A4 (skala 50%) yang menampilkan margin, font, spasi, judul bab, dan nomor halaman sesuai nilai yang sedang aktif di form
- Toggle **Bagian Awal / Bagian Utama** untuk melihat preview section pertama atau kedua
- Preview update otomatis saat user mengubah nilai di form — tidak ada tombol "Refresh"
- Informasi font, ukuran, dan spasi ditampilkan sebagai teks di bawah preview

**Kontrol di bawah form:**
- Toggle **Isi Bab**: pilih antara "Lorem Ipsum" (teks placeholder) atau "Kerangka Kosong" (hanya struktur judul dan sub-bab) untuk isi dokumen yang dihasilkan
- Tombol **Upload Ulang** — kembali ke halaman awal untuk upload file lain
- Tombol **Download Template .docx** — memulai proses generate dan download

---

### Langkah 6 — Mengoreksi Hasil (Opsional)

Jika ada field yang nilainya salah atau menggunakan nilai default, user mengubahnya langsung di form:

- Untuk field select (dropdown): pilih nilai yang sesuai dari daftar opsi yang tersedia
- Untuk field number: ketik nilai baru atau gunakan tombol naik/turun
- Preview A4 di sebelah kanan langsung berubah mengikuti nilai baru

Tidak ada tombol "Simpan" — perubahan langsung diingat di state halaman.

---

### Langkah 7 — Download Template

User menekan **"Download Template .docx"**.

1. Tombol menampilkan spinner saat file sedang di-generate di server
2. Jika berhasil, browser memulai download otomatis file bernama `template-docuforma.docx`
3. File dapat dibuka langsung di Microsoft Word, Google Docs, atau LibreOffice

**Isi file yang didownload:**
- **Section 1 — Bagian Awal:** Halaman Judul, Persetujuan, Pengesahan, Kata Pengantar, Daftar Isi, Daftar Gambar, Daftar Tabel, Abstrak — dengan penomoran romawi kecil (atau sesuai pengaturan)
- **Section 2 — Bagian Utama:** BAB I Pendahuluan s.d. BAB VI Penutup, masing-masing dengan 3 sub-bab — dengan penomoran angka Arab (atau sesuai pengaturan)
- Semua pengaturan format sudah diterapkan: margin, font, spasi, warna tinta, posisi nomor halaman, format heading

---

### Langkah 8 — Selesai

User menggunakan file `.docx` sebagai template dasar untuk menulis Tugas Akhir atau Skripsi mereka. Mereka tidak perlu mengatur format dari awal — semua sudah sesuai standar kampus.

---

## Diagram Alur

```
User buka aplikasi
        │
        ▼
    Pilih file
    (drag-drop atau browse)
        │
        ▼
    Tekan "Generate Template"
        │
        ▼
    ┌─────────────────────────────────┐
    │   Validasi file (server)         │
    │   • Magic bytes (PDF / DOCX)     │
    │   • Ukuran ≤ 10 MB               │
    │   • Tidak terkunci password      │
    │   • Bukan PDF scan               │
    └─────────────────────────────────┘
        │                   │
      Valid               Tidak valid
        │                   │
        │            Tampilkan pesan error
        │            + tombol "Coba Lagi"
        │                   │
        │          ◄────────┘ (user coba lagi)
        │
        ▼
    ┌─────────────────────────────────┐
    │   Ekstraksi teks                 │
    │   PDF → unpdf/PDF.js             │
    │   DOCX → mammoth                 │
    └─────────────────────────────────┘
        │
        ▼
    ┌─────────────────────────────────┐
    │   Gemini AI                      │
    │   Ekstrak 16 field + source_quote│
    │   Koreksi mismatch (Spec D4)     │
    └─────────────────────────────────┘
        │                   │
    Relevan           Tidak relevan
        │                   │
        │            Tampilkan pesan
        │            "dokumen tidak relevan"
        │            + tombol "Upload Dokumen Lain"
        │
        ▼
    Navigasi ke /review
    (data disimpan di sessionStorage)
        │
        ▼
    User review 16 field
    (koreksi jika perlu)
        │
        ▼
    Pilih isi bab
    (Lorem Ipsum / Kerangka Kosong)
        │
        ▼
    Tekan "Download Template .docx"
        │
        ▼
    Server generate file .docx
        │
        ▼
    Browser download otomatis
    template-docuforma.docx
        │
        ▼
       SELESAI
```

---

## State UI FileUpload

Komponen upload memiliki 5 state yang masing-masing menampilkan UI berbeda:

| State | Tampilan | Tindakan Tersedia |
|---|---|---|
| `idle` | Area upload kosong, instruksi drag-and-drop | Drag file atau klik untuk browse |
| `dragging` | Area berubah warna biru, animasi bouncing | Lepaskan file |
| `selected` | Nama file + ukuran + tombol "Generate Template" | Generate, Ganti File, Hapus |
| `processing` | Spinner + label langkah progres | — (tidak bisa interaksi) |
| `failed` | Pesan error merah + tombol "Coba Lagi" | Coba Lagi, Ganti File |
| `irrelevant` | Pesan kuning "dokumen tidak relevan" + tombol "Upload Dokumen Lain" | Upload file lain |

---

## Catatan Navigasi

- Jika user membuka `/review` langsung (tanpa melalui alur upload), halaman menampilkan data dummy sebagai fallback — tidak ada crash
- Tombol "Upload Ulang" di halaman review membawa user kembali ke `/` dan menghapus data di `sessionStorage`
- Tidak ada tombol Back yang dikelola aplikasi — browser Back berfungsi normal

---

## Validasi User

> ⚠️ **Bagian ini perlu diisi secara manual.**
>
> Tempatkan di sini catatan hasil uji coba dengan calon pengguna nyata, mencakup:
>
> - **Tanggal dan metode pengujian** (misalnya: usability test, wawancara, observasi)
> - **Profil partisipan** (semester berapa, jurusan, sudah/belum mulai TA)
> - **Task yang diujikan** (misalnya: "Coba upload pedoman kampus kamu dan download hasilnya")
> - **Temuan utama:** apa yang membingungkan, apa yang berjalan lancar, berapa lama tiap langkah
> - **Kutipan langsung dari pengguna** jika ada
> - **Perubahan yang dilakukan berdasarkan feedback**
>
> Contoh format yang bisa dipakai:
>
> ```
> ### Sesi 1 — [Tanggal]
> Partisipan: [deskripsi singkat, tanpa nama]
> Metode: [observasi / think-aloud / wawancara]
>
> Temuan:
> - [temuan 1]
> - [temuan 2]
>
> Perubahan yang diimplementasi:
> - [perubahan 1]
> ```
