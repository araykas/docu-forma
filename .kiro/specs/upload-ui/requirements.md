# Requirements Document

## Introduction

Spec B1 dari DocuForma AI — fitur **Zero-Prompt Document Uploader** (UI-only).

Tujuan spec ini adalah membangun landing page yang menarik untuk DocuForma AI beserta komponen drag-and-drop upload file. Scope dibatasi hanya pada sisi UI: menerima file `.pdf` atau `.docx`, memvalidasi tipe file secara client-side menggunakan atribut `accept` dan pengecekan ekstensi, serta menampilkan nama file yang dipilih. Belum ada API call, belum ada validasi server-side. Stack: Next.js App Router + TypeScript + Tailwind CSS.

---

## Glossary

- **Landing_Page**: Halaman utama DocuForma AI yang dapat diakses di route `/` (`app/page.tsx`), bersifat Server Component.
- **UploadZone**: Client Component interaktif (`components/upload-zone.tsx`) yang menangani drag-and-drop dan pemilihan file via klik.
- **File_Input**: Elemen `<input type="file">` tersembunyi di dalam UploadZone yang menjadi titik penerimaan file dari browser.
- **Selected_File**: State internal UploadZone yang menyimpan objek `File` yang dipilih pengguna.
- **File_Preview**: Area di bawah UploadZone yang menampilkan nama file, ukuran, dan ikon tipe file setelah file berhasil dipilih.
- **Error_Banner**: Elemen UI di dalam UploadZone yang menampilkan pesan error validasi tipe file.
- **Accepted_Types**: Himpunan tipe file yang diizinkan: `.pdf` dan `.docx` (MIME type `application/pdf` dan `application/vnd.openxmlformats-officedocument.wordprocessingml.document`).

---

## Requirements

### Requirement 1: Landing Page

**User Story:** Sebagai mahasiswa yang pertama kali membuka DocuForma AI, saya ingin melihat landing page yang jelas dan menarik, agar saya langsung memahami fungsi aplikasi ini dan termotivasi untuk menggunakannya.

#### Acceptance Criteria

1. THE Landing_Page SHALL menampilkan judul utama "DocuForma AI" sebagai elemen teks terbesar di halaman.
2. THE Landing_Page SHALL menampilkan tagline yang menjelaskan fungsi aplikasi (menghasilkan template `.docx` dari pedoman format kampus) dengan panjang maksimal 160 karakter.
3. THE Landing_Page SHALL menampilkan komponen UploadZone di posisi yang terlihat tanpa perlu scroll pada resolusi layar minimal 1024×768px.
4. THE Landing_Page SHALL dapat merender konten lengkap tanpa memerlukan eksekusi JavaScript di sisi client (Server Component).
5. WHILE pengguna mengakses halaman di viewport 320–767px (mobile), THE Landing_Page SHALL menampilkan seluruh elemen tanpa overflow horizontal dan semua elemen tetap dapat diinteraksi.
6. WHILE pengguna mengakses halaman di viewport 1024–1920px (desktop), THE Landing_Page SHALL menampilkan seluruh elemen dalam tata letak yang optimal tanpa overflow horizontal.

---

### Requirement 2: Komponen Drag-and-Drop Upload

**User Story:** Sebagai pengguna, saya ingin dapat menyeret (drag) atau memilih (klik) file pedoman kampus saya, agar proses upload terasa intuitif tanpa perlu membaca instruksi panjang.

#### Acceptance Criteria

1. THE UploadZone SHALL merender area drop yang terlihat dengan instruksi teks dan ikon upload yang dapat dibaca pengguna.
2. THE UploadZone SHALL membatasi pemilihan file hanya pada tipe `.pdf` dan `.docx` melalui mekanisme filter file dialog sistem operasi.
3. WHEN pengguna mengklik area UploadZone, THE UploadZone SHALL membuka dialog pemilihan file sistem operasi.
4. WHEN pengguna men-drag file ke atas area UploadZone, THE UploadZone SHALL menampilkan visual feedback (perubahan warna border atau background) yang mengindikasikan drop zone aktif.
5. WHEN pengguna men-drag file keluar dari area UploadZone tanpa melepasnya, THE UploadZone SHALL mengembalikan tampilan ke kondisi normal (visual feedback drag hilang).
6. WHEN pengguna melepas (drop) satu file valid ke area UploadZone, THE UploadZone SHALL memproses file tersebut dan menampilkan nama file; WHEN file tidak valid, THE UploadZone SHALL menampilkan Error_Banner dan tidak memproses file.
7. WHEN pengguna melepas (drop) lebih dari satu file ke area UploadZone, THE UploadZone SHALL hanya memproses file pertama berdasarkan urutan indeks dari daftar file yang diterima.
8. WHEN UploadZone mendapatkan fokus keyboard (via Tab), THE UploadZone SHALL menampilkan indikator fokus yang terlihat; WHEN pengguna menekan Enter atau Space pada UploadZone yang terfokus, THE UploadZone SHALL membuka dialog pemilihan file.

---

### Requirement 3: Penerimaan File .pdf dan .docx

**User Story:** Sebagai pengguna, saya ingin sistem hanya menerima file `.pdf` atau `.docx`, agar saya mendapat umpan balik langsung jika saya salah memilih file.

#### Acceptance Criteria

1. WHEN pengguna memilih file dengan ekstensi `.pdf` atau `.docx`, THE UploadZone SHALL menerima file tersebut dan menyimpannya sebagai Selected_File.
2. WHEN pengguna memilih atau men-drop file dengan ekstensi selain `.pdf` dan `.docx`, THE UploadZone SHALL menolak file tersebut dan TIDAK menyimpannya sebagai Selected_File.
3. IF pengguna memilih atau men-drop file dengan tipe yang tidak valid, THEN THE UploadZone SHALL menampilkan Error_Banner dengan pesan: *"Format file tidak didukung. Harap unggah file PDF atau DOCX."*
4. WHEN pengguna berhasil memilih file valid setelah sebelumnya ada Error_Banner, THE UploadZone SHALL menyembunyikan Error_Banner.
5. WHEN pengguna memilih atau men-drop lebih dari satu file sekaligus, THE UploadZone SHALL hanya memproses file pertama berdasarkan urutan indeks; validasi tipe dan ukuran diterapkan pada file pertama tersebut.
6. WHEN pengguna memilih atau men-drop file berukuran lebih dari 10 MB, THE UploadZone SHALL menolak file tersebut dan menampilkan Error_Banner dengan pesan: *"Ukuran file melebihi batas 10 MB. Harap unggah file yang lebih kecil."*

---

### Requirement 4: Menampilkan Nama File yang Dipilih

**User Story:** Sebagai pengguna, saya ingin melihat konfirmasi visual berupa nama file yang telah saya pilih, agar saya yakin file yang benar sudah berhasil terpilih sebelum melanjutkan.

#### Acceptance Criteria

1. WHEN Selected_File bernilai null (belum ada file dipilih), THE UploadZone SHALL menampilkan instruksi upload (teks dan ikon) dan TIDAK menampilkan File_Preview.
2. WHEN Selected_File bukan null (ada file yang telah dipilih), THE UploadZone SHALL menampilkan File_Preview dan menyembunyikan instruksi upload utama.
3. WHEN Selected_File bukan null, THE File_Preview SHALL menampilkan nama file lengkap (termasuk ekstensi) sesuai nilai `file.name`; IF nama file melebihi 255 karakter, THE File_Preview SHALL memotong tampilan nama dan menambahkan ellipsis.
4. WHEN Selected_File bukan null, THE File_Preview SHALL menampilkan ukuran file: IF ukuran kurang dari 1024 KB (1024 × 1024 bytes), tampilkan dalam KB dibulatkan 1 desimal; IF ukuran 1024 KB atau lebih, tampilkan dalam MB dibulatkan 1 desimal.
5. WHEN Selected_File bukan null, THE File_Preview SHALL menampilkan label "PDF" untuk file `.pdf` dan label "DOCX" untuk file `.docx`; IF ekstensi tidak dikenali, THE File_Preview SHALL menampilkan label "FILE" sebagai fallback.
6. THE File_Preview SHALL menyediakan tombol atau kontrol untuk menghapus pilihan file sehingga UploadZone kembali ke kondisi awal.
7. WHEN pengguna mengaktifkan kontrol hapus pada File_Preview, THE UploadZone SHALL mengosongkan Selected_File dan mengembalikan tampilan ke kondisi instruksi upload.

---

### Requirement 5: Tombol Lanjut (Placeholder)

**User Story:** Sebagai pengguna, saya ingin ada tombol untuk melanjutkan proses setelah memilih file, agar alur penggunaan terasa lengkap meskipun fungsionalitas backend belum tersedia di spec ini.

#### Acceptance Criteria

1. WHEN Selected_File bernilai null, THE UploadZone SHALL menampilkan tombol "Proses Dokumen" dengan atribut HTML `disabled` aktif sehingga tidak dapat diklik.
2. WHEN Selected_File bukan null, THE UploadZone SHALL menampilkan tombol "Proses Dokumen" dengan atribut HTML `disabled` tidak aktif sehingga dapat diklik.
3. WHEN pengguna mengklik tombol "Proses Dokumen" dalam kondisi enabled, THE UploadZone SHALL menjalankan `console.log` yang mencetak nama file yang dipilih — belum ada navigasi atau API call di spec ini.
4. WHILE tombol "Proses Dokumen" dalam kondisi disabled, THE UploadZone SHALL menampilkan tombol dengan opacity ≤ 0.5.
5. WHILE tombol "Proses Dokumen" dalam kondisi enabled, THE UploadZone SHALL menampilkan tombol dengan opacity 1.0.
