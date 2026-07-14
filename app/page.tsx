import FileUpload from '@/components/FileUpload'

export const metadata = {
  title: 'DocuForma AI — Generator Template Dokumen Akademik',
  description:
    'Upload pedoman format kampus, sistem ekstrak aturannya otomatis, dan download template .docx siap pakai — tanpa perlu menulis instruksi AI apa pun.',
}

// ---------------------------------------------------------------------------
// How-it-works steps data
// ---------------------------------------------------------------------------

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Upload dokumen pedoman',
    description:
      'Drag & drop file pedoman format kampus kamu — PDF atau DOCX. Tidak perlu isi form apa pun.',
    icon: (
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="w-6 h-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
        />
      </svg>
    ),
  },
  {
    step: '2',
    title: 'Sistem baca aturan format',
    description:
      'AI menganalisis teks pedoman dan mengekstrak semua aturan: margin, font, spasi, penomoran halaman, dan format judul bab.',
    icon: (
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="w-6 h-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"
        />
      </svg>
    ),
  },
  {
    step: '3',
    title: 'Download template .docx',
    description:
      'Review hasil deteksi, koreksi kalau perlu, lalu download file template .docx yang sudah diatur sesuai standar kampus kamu.',
    icon: (
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="w-6 h-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M12 3v13.5m0 0-4.5-4.5M12 16.5l4.5-4.5"
        />
      </svg>
    ),
  },
] as const

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <main className="flex-1">
        {/* ── 1. Hero section ── */}
        <section className="px-4 pt-20 pb-12 text-center">
          <div className="mx-auto max-w-2xl">
            {/* Eyebrow label */}
            <p className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 mb-6">
              <span
                aria-hidden="true"
                className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500"
              />
              Zero-Prompting · Proyek UAS
            </p>

            <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl leading-tight">
              Template .docx dari pedoman kampus,{' '}
              <span className="text-indigo-600">otomatis.</span>
            </h1>

            <p className="mt-5 text-base text-zinc-500 leading-relaxed max-w-xl mx-auto">
              Cukup upload dokumen pedoman format kampus — PDF atau DOCX. DocuForma AI membaca
              aturannya sendiri dan menghasilkan file template siap pakai, tanpa kamu perlu
              menulis satu instruksi AI pun.
            </p>
          </div>
        </section>

        {/* ── 2. Upload area ── */}
        <section
          aria-label="Area upload dokumen"
          className="px-4 pb-6"
        >
          <div className="mx-auto max-w-lg">
            <FileUpload />
          </div>
        </section>

        {/* ── 3. Notice AI pihak ketiga (Spec D7 / PRD Bagian 10 poin 7) ── */}
        <section
          aria-label="Informasi privasi"
          className="px-4 pb-16"
        >
          <div className="mx-auto max-w-lg">
            <div className="flex items-start gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <svg
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4 text-zinc-400 shrink-0 mt-px"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Dokumen yang kamu upload akan diproses menggunakan{' '}
                <strong className="font-medium text-zinc-600">AI pihak ketiga (Google Gemini)</strong>.
                Pada free tier, Google dapat menggunakan data yang dikirim untuk peningkatan model.
                Jangan upload dokumen yang mengandung data pribadi atau informasi sensitif.
              </p>
            </div>
          </div>
        </section>

        {/* ── 4. Cara kerja (3 langkah) ── */}
        <section
          aria-labelledby="how-heading"
          className="border-t border-zinc-100 bg-zinc-50 px-4 py-16"
        >
          <div className="mx-auto max-w-3xl">
            <h2
              id="how-heading"
              className="text-center text-xl font-bold text-zinc-900 mb-10"
            >
              Cara kerja
            </h2>

            <ol className="grid gap-6 sm:grid-cols-3" role="list">
              {HOW_IT_WORKS.map(({ step, title, description, icon }) => (
                <li
                  key={step}
                  className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white px-6 py-6 shadow-sm"
                >
                  {/* Icon + step badge */}
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      {icon}
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-2xl font-extrabold text-zinc-100 select-none leading-none"
                    >
                      {step}
                    </span>
                  </div>

                  {/* Text */}
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 mb-1">{title}</p>
                    <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      {/* ── 5. Footer ── */}
      <footer className="border-t border-zinc-100 px-4 py-6">
        <div className="mx-auto max-w-3xl flex flex-col items-center gap-1 text-center">
          <p className="text-sm font-semibold text-zinc-700">DocuForma AI</p>
          <p className="text-xs text-zinc-400">
            Proyek non-komersial · Tugas UAS Mata Kuliah AI · Tidak berafiliasi dengan institusi mana pun.
          </p>
        </div>
      </footer>
    </div>
  )
}
