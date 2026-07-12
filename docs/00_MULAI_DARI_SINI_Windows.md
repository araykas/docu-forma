# DocuForma AI — Dari Folder Kosong Sampai Deploy (Windows)

Ikuti urutan ini persis. Jangan lompat. Tiap "Checkpoint" harus berhasil sebelum lanjut ke bagian berikutnya.

File pendukung yang sudah disiapkan untuk kamu (taruh nanti di Langkah 4):
- `PRD_DocuForma_AI_v4.md` — spesifikasi produk yang sudah direvisi
- `AGENTS.md` — ringkasan project untuk AI
- `PROMPTS_DocuForma_AI_v2.md` — kumpulan prompt per fase yang sudah direvisi

---

## LANGKAH 1 — Install software (sekali saja)

Install satu-satu, urut dari atas. Tiap habis install, **tutup dan buka ulang PowerShell** sebelum lanjut ke langkah cek berikutnya (Windows perlu refresh supaya command baru dikenali).

### 1a. Node.js
1. Buka https://nodejs.org
2. Download versi **LTS** (yang direkomendasikan, bukan "Current")
3. Jalankan installer, next-next-next sampai selesai
4. Buka **PowerShell** (klik Start, ketik "PowerShell", Enter)
5. Ketik: `node --version`
6. **Checkpoint:** harus muncul angka versi (misal `v22.x.x`). Kalau muncul "not recognized", tutup PowerShell, buka lagi, coba sekali lagi.

### 1b. Git
1. Buka https://git-scm.com/downloads
2. Download & install versi Windows (opsi default saat instalasi sudah aman dipakai, tinggal next terus)
3. Cek: `git --version`
4. **Checkpoint:** muncul angka versi git.

### 1c. Claude Code
1. Di PowerShell, jalankan:
   ```powershell
   irm https://claude.ai/install.ps1 | iex
   ```
2. Tutup dan buka ulang PowerShell
3. Cek: `claude --version`
4. **Checkpoint:** muncul angka versi. Kalau "not recognized", jalankan ulang perintah instalasi di atas.
5. Kamu butuh akun Claude (Pro/Max) atau API key dari console.anthropic.com untuk login pertama kali — nanti akan diminta login lewat browser saat pertama kali menjalankan `claude`.

### 1d. VS Code (opsional tapi sangat membantu)
1. Download di https://code.visualstudio.com
2. Install seperti biasa. Ini cuma buat kamu **melihat** file/kode, kamu tidak perlu menulis kode manual di sini.

### 1e. Akun-akun yang perlu dibuat (gratis semua)
- **GitHub** — https://github.com (untuk menyimpan kode & menyambungkannya ke Vercel)
- **Vercel** — https://vercel.com (bisa langsung "Sign up with GitHub")
- **Google AI Studio** — https://aistudio.google.com/app/apikey → buat API key Gemini, **simpan di Notepad dulu**, jangan hilang, jangan ditaruh di chat manapun.

---

## LANGKAH 2 — Siapkan folder project

Kamu sudah punya folder `docuforma`. Buka PowerShell, arahkan ke situ:

```powershell
cd "C:\lokasi\folder\docuforma"
```
(ganti dengan lokasi folder kamu yang sebenarnya — kalau bingung, buka folder itu di File Explorer, klik address bar, copy path-nya)

**Checkpoint:** ketik `dir` — harus muncul isi folder (kosong juga tidak apa-apa).

---

## LANGKAH 3 — Jalankan Claude Code

Masih di folder yang sama, ketik:

```powershell
claude
```

Ini akan membuka sesi interaktif. Kalau ini pertama kali, akan diminta login lewat browser — ikuti saja.

**Checkpoint:** muncul prompt Claude Code siap menerima instruksi (biasanya ada indikator kayak `>` menunggu input kamu).

---

## LANGKAH 4 — Fase 0: Setup Project

Buka file `PROMPTS_DocuForma_AI_v2.md` yang sudah disiapkan, cari bagian **"Fase 0"**, copy seluruh isi kode di dalamnya, paste ke Claude Code, Enter.

Ingat instruksi dari file itu: sebelum tempel prompt, ketik dulu:
```
jangan langsung coding, susun rencana implementasinya dulu
```
Baca rencananya. Kalau masuk akal, ketik `lanjut`.

Setelah Claude Code selesai bikin struktur project:

1. **Copy manual** file `PRD_DocuForma_AI_v4.md` ke folder `docs/` di dalam project (Claude Code sudah bikinkan foldernya di Fase 0). Bisa drag-drop lewat File Explorer.
2. Cek juga apakah `AGENTS.md` (atau `CLAUDE.md`) di root project sudah ada isinya — kalau Claude Code bikin file `CLAUDE.md`, itu oke, sama fungsinya.

**Checkpoint:** folder project sekarang punya struktur `app/`, `docs/`, `package.json`, dll. Coba jalankan:
```powershell
npm run dev
```
Buka browser ke `http://localhost:3000` — harus muncul halaman (boleh masih kosong/sederhana, yang penting tidak error).

Tekan `Ctrl+C` di PowerShell untuk mematikan server sebelum lanjut prompt berikutnya.

**Simpan progress ke git:**
```powershell
git init
git add -A
git commit -m "Fase 0: setup project"
```

---

## LANGKAH 5 — Fase 1 sampai Fase 7

Ulangi pola yang sama untuk tiap fase di `PROMPTS_DocuForma_AI_v2.md`, **satu per satu, jangan digabung**:

Untuk tiap fase:
1. Ketik ke Claude Code: `jangan langsung coding, susun rencana implementasinya dulu`, tempel prompt fase itu
2. Baca rencananya, kalau oke ketik `lanjut`
3. Setelah selesai: `npm run dev`, buka `http://localhost:3000`, **coba fiturnya sendiri seperti pengguna asli**
4. Khusus Fase 3: **wajib** coba upload PDF `PEDOMAN_TA_FTI_2019` (yang kemarin kita analisis) sebagai test. Hasil ekstraksi yang benar seharusnya: margin 4/3/4/3, spasi 2, font size **tidak terdeteksi** (`detected: false`). Kalau hasilnya beda, jangan lanjut ke Fase 4 — bilang ke Claude Code persis apa yang salah, minta perbaiki prompt Gemini-nya.
5. Kalau semua oke: `git add -A && git commit -m "Fase X: <nama fase>"`
6. Baru mulai fase berikutnya

**Jangan skip test manual di tiap fase.** Ini bagian paling penting supaya bug ketahuan sedini mungkin, bukan menumpuk di akhir.

---

## LANGKAH 6 — Push ke GitHub

Setelah semua fase (0-7) selesai dan sudah kamu test:

1. Buka https://github.com, klik "New repository", kasih nama misal `docuforma-ai`, biarkan **kosong** (jangan centang "add README"), klik Create.
2. GitHub akan kasih beberapa baris perintah. Di PowerShell (masih di folder project), jalankan (sesuaikan URL dengan punya kamu):
   ```powershell
   git remote add origin https://github.com/USERNAME_KAMU/docuforma-ai.git
   git branch -M main
   git push -u origin main
   ```
3. **Checkpoint:** refresh halaman GitHub repo kamu, harus muncul semua file project.

---

## LANGKAH 7 — Deploy ke Vercel (Fase 8)

1. Buka https://vercel.com, login pakai akun GitHub kamu.
2. Klik "Add New..." → "Project"
3. Pilih repo `docuforma-ai` yang barusan kamu push, klik "Import"
4. **Sebelum klik Deploy**, buka bagian "Environment Variables":
   - Name: `GEMINI_API_KEY` (atau nama variable yang dipakai Claude Code di kode — cek isi file `.env.example` yang harusnya sudah dibuat di Fase 8)
   - Value: paste API key Gemini yang kamu simpan di Notepad tadi
   - Klik "Add"
5. Klik **Deploy**. Tunggu beberapa menit.
6. **Checkpoint:** Vercel kasih URL (misal `docuforma-ai.vercel.app`). Buka URL itu, coba upload PDF pedoman kampus beneran, ikuti sampai download file `.docx`.

---

## LANGKAH 8 — Kalau ada masalah setelah deploy

Kadang sesuatu yang jalan di `localhost` ternyata error setelah deploy (biasanya soal environment variable atau timeout). Kalau ini terjadi:

1. Di dashboard Vercel, buka tab **"Logs"** atau **"Runtime Logs"** di project kamu — ini nunjukkan error asli dari server.
2. Copy pesan errornya, tempel ke Claude Code, minta dia jelasin dulu akar masalahnya sebelum minta perbaiki (sama seperti prinsip debug yang sudah kita bahas).
3. Setelah perbaiki, commit & push lagi (`git add -A && git commit -m "fix: ..." && git push`) — Vercel otomatis deploy ulang tiap ada push baru ke `main`.

---

## Ringkasan urutan besar

```
Install software → buka folder di Claude Code → Fase 0 → Fase 1 → ... → Fase 7
→ test tiap fase manual → git commit tiap fase → push ke GitHub → import ke Vercel
→ isi environment variable → Deploy → test di URL asli
```

Kalau macet di step manapun, kasih tahu aku persis kamu ada di step berapa dan apa yang muncul di layar (pesan error, atau screenshot) — jangan cuma bilang "error", biar aku bisa bantu diagnosis persis kayak kita bedah PDF kemarin.
