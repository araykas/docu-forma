# DocuForma AI — Progress Tracker

> Checklist seluruh spec per kelompok. Centang (`[x]`) setelah spec selesai & sudah di-`git commit`.

---

## Kelompok A — Setup

- [x] **A1** — Inisialisasi project (Next.js + TypeScript + Tailwind, struktur folder dasar)
- [x] **A2** — Progress tracker (file `docs/progress.md` ini)

---

## Kelompok B — Upload

- [x] **B1** — UI upload saja (drag-and-drop, tampilkan nama file, tanpa validasi server)
- [x] **B2** — Validasi tipe & ukuran file server-side (magic bytes, maks 10MB)
- [x] **B3** — Deteksi PDF terkunci password

---

## Kelompok C — Baca pedoman .docx

- [x] **C1** — Ekstraksi teks dari .docx pakai mammoth (tanpa klasifikasi/threshold), teks diperlakukan identik dengan hasil ekstraksi PDF untuk pipeline AI
- [x] **C2** — Baca metadata XML .docx sebagai fallback pelengkap (jalan SETELAH AI, hanya isi field yang `detected:false`, ditandai `source: "docx_property_fallback"`)

---

## Kelompok D — Ekstraksi teks + AI

- [x] **D1** — Ekstraksi teks PDF saja (tanpa AI, deteksi PDF scan)
- [x] **D2** — Wiring dasar ke Gemini API (komunikasi & parse JSON)
- [x] **D3** — Scoping prompt: dokumen dengan spesifikasi ganda ⚠️ *wajib test PDF UNISBANK sebelum lanjut*
- [x] **D4** — Validasi & sanitasi hasil JSON dari AI
- [x] **D5** — Error handling fail-fast (timeout AbortController, pesan error + tombol coba lagi)
- [x] **D6** — Penanganan dokumen tidak relevan (is_relevant:false)
- [x] **D7** — Notice AI pihak ketiga di halaman upload

---

## Kelompok E — Halaman Review

- [ ] **E1** — Layout review dengan data dummy (4 kelompok field, badge terdeteksi/default)
- [ ] **E2** — Panel pratinjau visual (mockup A4, update real-time, toggle bagian awal/utama)
- [ ] **E3** — Kontrol tambahan (toggle isi bab, tombol Upload ulang, tombol Download dummy)
- [ ] **E4** — Hubungkan ke data ekstraksi asli (ganti dummy dengan hasil C/D)

---

## Kelompok F — Generator .docx

- [ ] **F1** — Generator dasar (margin, font, kertas, struktur bab generik)
- [ ] **F2** — Section break & penomoran halaman (romawi bagian awal, arab bagian utama)
- [ ] **F3** — Isi bab & hubungkan tombol Download ke endpoint

---

## Kelompok G — Keamanan

- [ ] **G1** — Hardening (rate limiting per IP, anti zip-bomb, cek API key tidak bocor ke client)

---

## Kelompok H — Wiring akhir & Deploy

- [ ] **H1** — Wiring end-to-end (upload → proses → review → download, loading state tiap tahap)
- [ ] **H2** — Uji dengan dokumen kompleks *(testing manual — PDF Pedoman TA FTI UNISBANK)*
- [ ] **H3** — Persiapan deploy (.env.example, API key dari env var, fitur out-of-scope tidak ter-expose)

---

## Deploy

- [ ] Push ke GitHub
- [ ] Import ke Vercel
- [ ] Isi environment variable di Vercel
- [ ] Deploy & verifikasi production

---

*Total spec: 22 spec + 1 sesi testing manual (H2) + deploy.*
