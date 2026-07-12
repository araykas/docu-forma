# DocuForma AI

Web app Next.js (TypeScript) untuk generate template .docx dari pedoman kampus.
Spesifikasi lengkap: docs/PRD_DocuForma_AI_v4.md

## Stack
- Next.js App Router + Tailwind, deploy Vercel
- Library docx (npm) untuk generate file, pdf-parse untuk baca PDF
- AI: Gemini Flash/Flash-Lite lewat API Route (server-side only)

## Aturan penting
- API key AI HARUS di environment variable, jangan pernah di client
- Validasi hasil JSON dari AI di server sebelum dipakai (lihat Bagian 10 PRD)
- File upload diproses in-memory, tidak disimpan ke disk
- Prompt ekstraksi AI wajib scoping ke bagian format Laporan/Skripsi utama saja; abaikan aturan format naskah publikasi/jurnal & contoh di lampiran jika dokumen sumber memuat lebih dari satu spesifikasi format (lihat Bagian 3.3 PRD)
- Semua proses server (parse file, panggil AI, validasi) dibungkus try-catch tunggal yang SELALU balas response terstruktur — tidak boleh ada request yang menggantung tanpa jawaban ke client (lihat Skenario 7 & Bagian 10 poin 9 PRD)