import { useState } from 'react'
import { Download, RefreshCw, FileText, Info } from 'lucide-react'
import Navbar from '../components/Navbar'
import DocumentPreview from '../components/DocumentPreview'

const FONT_OPTIONS = [
  'Times New Roman',
  'Arial',
  'Calibri',
  'Georgia',
  'Garamond',
]

const SIZE_OPTIONS = ['10pt', '11pt', '12pt', '14pt']

const DOC_TYPES = [
  { id: 'academic', label: 'Makalah / Laporan Akademik' },
  { id: 'letter', label: 'Surat Resmi' },
  { id: 'proposal', label: 'Proposal Penelitian' },
]

export default function WorkspacePage({ file, onBack }) {
  const [docType, setDocType] = useState('academic')
  const [title, setTitle] = useState('')
  const [supervisor, setSupervisor] = useState('')
  const [font, setFont] = useState('Times New Roman')
  const [fontSize, setFontSize] = useState('12pt')
  const [isGenerating, setIsGenerating] = useState(false)

  const handleDownload = () => {
    setIsGenerating(true)
    // Placeholder: backend integration comes on Day 3
    setTimeout(() => {
      setIsGenerating(false)
      alert('⚙️ Fitur download .docx akan diintegrasikan pada Hari ke-3 (backend /api/export-docx).')
    }, 1500)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-background)' }}>
      <Navbar showBack onBack={onBack} />

      {/* Upload info bar */}
      {file && (
        <div
          className="px-6 py-2 text-xs flex items-center gap-2 border-b"
          style={{
            backgroundColor: '#ECFDF5',
            borderColor: '#A7F3D0',
            color: '#065F46',
          }}
        >
          <FileText size={13} />
          File diunggah: <strong>{file.name}</strong>
          <span style={{ color: '#6B7280' }}>·</span>
          <span style={{ color: '#6B7280' }}>
            {(file.size / 1024).toFixed(1)} KB
          </span>
        </div>
      )}

      {/* Main workspace — split screen */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT PANEL: Settings ── */}
        <aside
          className="w-80 flex-shrink-0 overflow-y-auto p-5 border-r flex flex-col gap-5"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          {/* Doc type */}
          <section>
            <label
              className="block text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: 'var(--color-secondary)' }}
            >
              Jenis Dokumen
            </label>
            <div className="flex flex-col gap-2">
              {DOC_TYPES.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                  style={{ color: 'var(--color-text-main)' }}
                >
                  <input
                    type="radio"
                    name="docType"
                    value={t.id}
                    checked={docType === t.id}
                    onChange={() => setDocType(t.id)}
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </section>

          <hr style={{ borderColor: 'var(--color-border)' }} />

          {/* Metadata */}
          <section>
            <label
              className="block text-xs font-semibold uppercase tracking-wide mb-3"
              style={{ color: 'var(--color-secondary)' }}
            >
              Metadata Otomatis
            </label>

            <div className="flex flex-col gap-3">
              <div>
                <label
                  className="block text-xs font-medium mb-1"
                  style={{ color: 'var(--color-text-main)' }}
                >
                  Judul Proyek / Laporan
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Laporan UAS Basis Data"
                  className="w-full text-sm px-3 py-2 rounded-lg border outline-none transition-all"
                  style={{
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-main)',
                    backgroundColor: 'var(--color-background)',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
                />
              </div>

              <div>
                <label
                  className="block text-xs font-medium mb-1"
                  style={{ color: 'var(--color-text-main)' }}
                >
                  Nama Dosen Pengampu
                </label>
                <input
                  type="text"
                  value={supervisor}
                  onChange={(e) => setSupervisor(e.target.value)}
                  placeholder="Budi Santoso, M.Kom"
                  className="w-full text-sm px-3 py-2 rounded-lg border outline-none transition-all"
                  style={{
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-main)',
                    backgroundColor: 'var(--color-background)',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
                />
              </div>
            </div>
          </section>

          <hr style={{ borderColor: 'var(--color-border)' }} />

          {/* Style settings */}
          <section>
            <label
              className="block text-xs font-semibold uppercase tracking-wide mb-3"
              style={{ color: 'var(--color-secondary)' }}
            >
              Pengaturan Gaya
            </label>

            <div className="flex flex-col gap-3">
              <div>
                <label
                  className="block text-xs font-medium mb-1"
                  style={{ color: 'var(--color-text-main)' }}
                >
                  Font
                </label>
                <select
                  value={font}
                  onChange={(e) => setFont(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
                  style={{
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-main)',
                    backgroundColor: 'var(--color-background)',
                  }}
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="block text-xs font-medium mb-1"
                  style={{ color: 'var(--color-text-main)' }}
                >
                  Ukuran Font
                </label>
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
                  style={{
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-main)',
                    backgroundColor: 'var(--color-background)',
                  }}
                >
                  {SIZE_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Download button */}
          <div>
            <button
              onClick={handleDownload}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-60"
              style={{
                backgroundColor: isGenerating ? '#6EE7B7' : 'var(--color-accent)',
                color: '#FFFFFF',
              }}
              onMouseEnter={(e) => {
                if (!isGenerating) e.currentTarget.style.backgroundColor = 'var(--color-accent-dark)'
              }}
              onMouseLeave={(e) => {
                if (!isGenerating) e.currentTarget.style.backgroundColor = 'var(--color-accent)'
              }}
            >
              {isGenerating ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Menyiapkan File…
                </>
              ) : (
                <>
                  <Download size={16} />
                  Download File .DOCX
                </>
              )}
            </button>

            {/* Hint */}
            <div
              className="mt-2 flex gap-2 px-3 py-2 rounded-lg text-xs leading-relaxed"
              style={{ backgroundColor: '#FEF9C3', color: '#92400E' }}
            >
              <Info size={12} className="mt-0.5 flex-shrink-0" />
              <span>
                Setelah file dibuka di Word, klik kanan pada Daftar Isi lalu pilih{' '}
                <strong>&ldquo;Update Field&rdquo;</strong> untuk menyinkronkan nomor halaman.
              </span>
            </div>
          </div>
        </aside>

        {/* ── RIGHT PANEL: Live Preview ── */}
        <main
          className="flex-1 overflow-hidden flex flex-col"
          style={{ backgroundColor: '#E8EDF2' }}
        >
          {/* Preview header */}
          <div
            className="px-5 py-3 border-b flex items-center justify-between flex-shrink-0"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-secondary)' }}>
              Live Preview Template .docx
            </p>
            <span
              className="text-xs px-2 py-1 rounded-full"
              style={{ backgroundColor: '#F1F5F9', color: 'var(--color-text-muted)' }}
            >
              {font} · {fontSize}
            </span>
          </div>

          {/* Document preview */}
          <div className="flex-1 overflow-y-auto p-6">
            <DocumentPreview
              title={title}
              supervisorName={supervisor}
              font={`${font}, serif`}
              fontSize={fontSize}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
