import FileUpload from '@/components/FileUpload'

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center min-h-screen px-4 py-16 gap-10">
      {/* Hero */}
      <div className="text-center max-w-xl">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
          DocuForma AI
        </h1>
        <p className="mt-3 text-base text-zinc-500 leading-relaxed">
          Upload pedoman format kampus (.pdf atau .docx) — kami ekstrak aturannya dan buatkan
          template .docx siap pakai, tanpa perlu prompt manual.
        </p>
      </div>

      {/* Upload component */}
      <div className="w-full max-w-lg">
        <FileUpload />
      </div>

      {/* Footer note */}
      <p className="text-xs text-zinc-400 text-center max-w-sm">
        Dokumen akan diproses menggunakan AI pihak ketiga (Google Gemini). Jangan unggah
        dokumen yang mengandung data pribadi sensitif.
      </p>
    </main>
  )
}
