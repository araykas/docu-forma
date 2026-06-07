import Navbar from '../components/Navbar'
import DropZone from '../components/DropZone'
import { FileText, Zap, Shield } from 'lucide-react'

const FEATURES = [
  {
    icon: <Zap size={18} />,
    title: 'AI Otomatis',
    desc: 'Groq AI membaca & mengekstrak struktur dokumen dalam hitungan detik.',
  },
  {
    icon: <FileText size={18} />,
    title: 'Template Word Siap Pakai',
    desc: 'Hasil berupa file .docx dengan Daftar Isi dinamis, siap diedit.',
  },
  {
    icon: <Shield size={18} />,
    title: 'Data Aman',
    desc: 'Isi sensitif dokumen Anda otomatis diganti dengan placeholder.',
  },
]

export default function UploadPage({ onFileAccepted }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-background)' }}>
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        {/* Hero text */}
        <div className="text-center mb-10 max-w-2xl">
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-4"
            style={{ backgroundColor: '#EFF6FF', color: 'var(--color-primary)' }}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Didukung Groq AI · Gratis
          </div>
          <h1
            className="text-4xl font-bold leading-tight mb-4"
            style={{ color: 'var(--color-text-main)' }}
          >
            Ubah Dokumen Apapun Menjadi{' '}
            <span style={{ color: 'var(--color-primary)' }}>Template Word</span> Instan
          </h1>
          <p className="text-lg" style={{ color: 'var(--color-text-muted)' }}>
            Unggah laporan, surat, atau makalah lama Anda. AI akan membersihkan isinya
            dan menyisakan kerangka formatnya yang rapi siap diisi ulang.
          </p>
        </div>

        {/* Drop zone */}
        <DropZone onFileAccepted={onFileAccepted} />

        {/* Info note */}
        <p className="mt-4 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
          ⓘ AI akan otomatis menghapus data sensitif/isi utama dokumen dan menggantinya dengan placeholder.
        </p>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 w-full max-w-2xl">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="rounded-xl p-4 border flex flex-col gap-2"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: '#EFF6FF', color: 'var(--color-primary)' }}
              >
                {f.icon}
              </div>
              <p className="font-semibold text-sm" style={{ color: 'var(--color-text-main)' }}>
                {f.title}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
