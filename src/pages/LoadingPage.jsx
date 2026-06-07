import { FileText } from 'lucide-react'

const STEPS = [
  { label: 'Membaca struktur dokumen…', delay: '0s' },
  { label: 'Mengekstrak format & heading…', delay: '1s' },
  { label: 'Membersihkan isi sensitif…', delay: '2s' },
  { label: 'Menyusun template kerangka…', delay: '3s' },
]

export default function LoadingPage({ fileName }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      {/* Spinner */}
      <div className="relative mb-8">
        <div
          className="w-20 h-20 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: '#DBEAFE', borderTopColor: 'var(--color-primary)' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <FileText size={24} style={{ color: 'var(--color-primary)' }} />
        </div>
      </div>

      {/* Main message */}
      <h2
        className="text-2xl font-bold mb-2 text-center"
        style={{ color: 'var(--color-text-main)' }}
      >
        Menganalisis Struktur Dokumen…
      </h2>
      <p className="text-sm mb-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
        Groq AI sedang memisahkan isi utama dengan format
        {fileName && (
          <>
            {' '}· <span className="font-medium">{fileName}</span>
          </>
        )}
      </p>

      {/* Step indicators */}
      <div className="flex flex-col gap-3 w-full max-w-sm">
        {STEPS.map((step, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-muted)',
              animationDelay: step.delay,
              animation: `fadeIn 0.4s ease forwards ${step.delay}`,
              opacity: 0,
            }}
          >
            {/* Animated dot */}
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                backgroundColor: 'var(--color-primary)',
                animation: `pulse 1.5s ease-in-out infinite ${step.delay}`,
              }}
            />
            {step.label}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
