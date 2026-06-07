/**
 * DocumentPreview — Renders a Microsoft Word-style document preview.
 * Accepts either live `analysisData` from Groq API or renders a
 * static fallback template when no data is available.
 */

// ─── Static fallback (used when no analysisData) ────────────────────────────
const STATIC_TOC = [
  { label: 'Kata Pengantar', page: 'i' },
  { label: 'Daftar Isi', page: 'ii' },
  { label: 'BAB I PENDAHULUAN', page: '1' },
  { label: '1.1 Latar Belakang', page: '1', indent: true },
  { label: '1.2 Rumusan Masalah', page: '2', indent: true },
  { label: '1.3 Tujuan', page: '2', indent: true },
  { label: 'BAB II TINJAUAN PUSTAKA', page: '3' },
  { label: 'BAB III METODOLOGI', page: '6' },
  { label: 'BAB IV PEMBAHASAN', page: '9' },
  { label: 'BAB V PENUTUP', page: '14' },
  { label: '5.1 Kesimpulan', page: '14', indent: true },
  { label: '5.2 Saran', page: '15', indent: true },
  { label: 'DAFTAR PUSTAKA', page: '16' },
]

// ─── Sub-components ──────────────────────────────────────────────────────────

function Placeholder({ children }) {
  return (
    <span
      style={{
        color: '#6B7280',
        fontStyle: 'italic',
        backgroundColor: '#F3F4F6',
        borderRadius: '4px',
        padding: '2px 6px',
        display: 'inline-block',
      }}
    >
      {children}
    </span>
  )
}

function TocTable({ items, docStyle }) {
  return (
    <>
      <table style={{ width: '100%', borderCollapse: 'collapse', ...docStyle }}>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td style={{ paddingLeft: item.indent ? '24px' : '0', paddingTop: '2px', paddingBottom: '2px', width: '90%' }}>
                {item.label}
              </td>
              <td style={{ textAlign: 'right', width: '10%', whiteSpace: 'nowrap' }}>
                {item.page}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p
        style={{
          marginTop: '10px',
          backgroundColor: '#FEF9C3',
          color: '#92400E',
          fontFamily: 'Inter, sans-serif',
          fontSize: '11px',
          lineHeight: '1.5',
          padding: '6px 8px',
          borderRadius: '4px',
        }}
      >
        💡 Tips: Setelah file Word dibuka, klik kanan pada area Daftar Isi lalu pilih &ldquo;Update Field&rdquo; untuk menyinkronkan nomor halaman secara otomatis.
      </p>
    </>
  )
}

// ─── Dynamic renderer (data dari Groq) ───────────────────────────────────────

function renderSection(section, docStyle, headingStyle, i) {
  switch (section.type) {
    case 'cover':
      return (
        <div key={i} className="text-center mb-8" style={{ paddingBottom: '24px', borderBottom: '1px solid #e5e7eb' }}>
          <p style={{ ...docStyle, marginBottom: '4px' }}>LAPORAN / MAKALAH</p>
          <h1 style={{ fontFamily: docStyle.fontFamily, fontSize: '16pt', fontWeight: 'bold', margin: '12px 0', lineHeight: '1.4' }}>
            {section.title || <Placeholder>[JUDUL DOKUMEN DI SINI]</Placeholder>}
          </h1>
          <p style={{ ...docStyle, marginTop: '16px', color: '#4B5563' }}>Diajukan sebagai tugas mata kuliah</p>
          <p style={{ ...docStyle, marginTop: '32px' }}>Dosen Pengampu:</p>
          <p style={{ ...docStyle, fontWeight: 'bold' }}>
            {section.supervisor || <Placeholder>[Nama Dosen Pengampu]</Placeholder>}
          </p>
          <p style={{ ...docStyle, marginTop: '32px', color: '#4B5563' }}>Disusun oleh:</p>
          <p style={{ ...docStyle, fontWeight: 'bold' }}>
            <Placeholder>{section.author || '[Nama Penyusun]'}</Placeholder>
          </p>
          <p style={{ ...docStyle }}><Placeholder>{section.nim || '[NIM / NPM]'}</Placeholder></p>
          <p style={{ ...docStyle, marginTop: '32px' }}>
            <Placeholder>{section.institution || '[Nama Institusi]'}</Placeholder>
          </p>
          <p style={{ ...docStyle }}><Placeholder>{section.year || '[Tahun]'}</Placeholder></p>
        </div>
      )

    case 'preface':
      return (
        <div key={i} className="mb-6">
          <p style={headingStyle}>{section.heading || 'KATA PENGANTAR'}</p>
          {(section.content || '').split('\n\n').map((para, j) => (
            <p key={j} style={{ ...docStyle, textAlign: 'justify', marginBottom: '8px' }}>
              {para || <Placeholder>[Isi Kata Pengantar Selengkapnya]</Placeholder>}
            </p>
          ))}
        </div>
      )

    case 'toc':
      return (
        <div key={i} className="mb-6">
          <p style={headingStyle}>{section.heading || 'DAFTAR ISI'}</p>
          <TocTable items={section.items || STATIC_TOC} docStyle={docStyle} />
        </div>
      )

    case 'chapter':
      return (
        <div key={i} className="mb-6">
          <p style={headingStyle}>BAB {section.number}</p>
          <p style={{ ...headingStyle, marginTop: 0 }}>{section.title}</p>
          {(section.subsections || []).map((sub, j) => (
            <div key={j}>
              <p style={{ ...docStyle, fontWeight: 'bold', marginTop: '12px' }}>
                {sub.number} {sub.title}
              </p>
              <p style={{ ...docStyle, textAlign: 'justify' }}>
                <Placeholder>{sub.content || `[Isi ${sub.title} di sini]`}</Placeholder>
              </p>
            </div>
          ))}
          {!section.subsections?.length && (
            <p style={{ ...docStyle }}>
              <Placeholder>[Isi bagian ini di sini]</Placeholder>
            </p>
          )}
        </div>
      )

    case 'bibliography':
      return (
        <div key={i} className="mb-2">
          <p style={headingStyle}>{section.heading || 'DAFTAR PUSTAKA'}</p>
          <p style={{ ...docStyle }}>
            <Placeholder>{section.content || '[Daftar referensi / pustaka yang digunakan]'}</Placeholder>
          </p>
        </div>
      )

    default:
      // Generic section
      return (
        <div key={i} className="mb-6">
          {section.heading && <p style={headingStyle}>{section.heading}</p>}
          {section.title && <p style={{ ...docStyle, fontWeight: 'bold', marginTop: '12px' }}>{section.title}</p>}
          <p style={{ ...docStyle, textAlign: 'justify' }}>
            <Placeholder>{section.content || '[Isi bagian ini di sini]'}</Placeholder>
          </p>
        </div>
      )
  }
}

// ─── Static fallback renderer ─────────────────────────────────────────────────

function StaticPreview({ title, supervisorName, docStyle, headingStyle }) {
  const ph = (text) => <Placeholder>{text}</Placeholder>

  return (
    <>
      {/* Cover */}
      <div className="text-center mb-8" style={{ paddingBottom: '24px', borderBottom: '1px solid #e5e7eb' }}>
        <p style={{ ...docStyle, marginBottom: '4px' }}>LAPORAN / MAKALAH</p>
        <h1 style={{ fontFamily: docStyle.fontFamily, fontSize: '16pt', fontWeight: 'bold', margin: '12px 0', lineHeight: '1.4' }}>
          {title || ph('[JUDUL DOKUMEN DI SINI]')}
        </h1>
        <p style={{ ...docStyle, marginTop: '16px', color: '#4B5563' }}>Diajukan sebagai tugas mata kuliah</p>
        <p style={{ ...docStyle, marginTop: '32px' }}>Dosen Pengampu:</p>
        <p style={{ ...docStyle, fontWeight: 'bold' }}>
          {supervisorName || ph('[Nama Dosen Pengampu]')}
        </p>
        <p style={{ ...docStyle, marginTop: '32px', color: '#4B5563' }}>Disusun oleh:</p>
        <p style={{ ...docStyle, fontWeight: 'bold' }}>{ph('[Nama Penyusun]')}</p>
        <p style={{ ...docStyle }}>{ph('[NIM / NPM]')}</p>
        <p style={{ ...docStyle, marginTop: '32px' }}>{ph('[Nama Institusi]')}</p>
        <p style={{ ...docStyle }}>{ph('[Tahun]')}</p>
      </div>

      {/* Kata Pengantar */}
      <div className="mb-6">
        <p style={headingStyle}>KATA PENGANTAR</p>
        <p style={{ ...docStyle, textAlign: 'justify' }}>
          Puji syukur kehadirat Tuhan Yang Maha Esa atas segala rahmat-Nya sehingga laporan ini dapat tersusun hingga selesai.
        </p>
        <br />
        <p style={docStyle}>{ph('[Isi Kata Pengantar Selengkapnya]')}</p>
      </div>

      {/* Daftar Isi */}
      <div className="mb-6">
        <p style={headingStyle}>DAFTAR ISI</p>
        <TocTable items={STATIC_TOC} docStyle={docStyle} />
      </div>

      {/* BAB I */}
      <div className="mb-6">
        <p style={headingStyle}>BAB I</p>
        <p style={{ ...headingStyle, marginTop: 0 }}>PENDAHULUAN</p>
        {[['1.1', 'Latar Belakang'], ['1.2', 'Rumusan Masalah'], ['1.3', 'Tujuan']].map(([num, judul]) => (
          <div key={num}>
            <p style={{ ...docStyle, fontWeight: 'bold', marginTop: '12px' }}>{num} {judul}</p>
            <p style={{ ...docStyle, textAlign: 'justify' }}>{ph(`[Tuliskan ${judul.toLowerCase()} di sini]`)}</p>
          </div>
        ))}
      </div>

      {/* BAB II–V stub */}
      {[['II', 'TINJAUAN PUSTAKA'], ['III', 'METODOLOGI'], ['IV', 'PEMBAHASAN'], ['V', 'PENUTUP']].map(([num, judul]) => (
        <div key={num} className="mb-6">
          <p style={headingStyle}>BAB {num}</p>
          <p style={{ ...headingStyle, marginTop: 0 }}>{judul}</p>
          <p style={{ ...docStyle, textAlign: 'justify' }}>{ph(`[Isi bagian ${judul.toLowerCase()} di sini]`)}</p>
        </div>
      ))}

      {/* Daftar Pustaka */}
      <div className="mb-2">
        <p style={headingStyle}>DAFTAR PUSTAKA</p>
        <p style={docStyle}>{ph('[Daftar referensi / pustaka yang digunakan]')}</p>
      </div>
    </>
  )
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export default function DocumentPreview({
  title,
  supervisorName,
  font,
  fontSize,
  analysisData,
}) {
  const fontFamily = font || 'Times New Roman, serif'
  const size = fontSize || '12pt'

  const docStyle = { fontFamily, fontSize: size, lineHeight: '1.8', color: '#1a1a1a' }
  const headingStyle = { fontFamily, fontWeight: 'bold', textAlign: 'center', marginBottom: '12px', marginTop: '20px' }

  // Terapkan title/supervisor dari panel kiri jika ada (override deteksi AI)
  const effectiveTitle = title || analysisData?.detectedTitle || ''
  const effectiveSupervisor = supervisorName || analysisData?.detectedSupervisor || ''

  return (
    <div className="overflow-y-auto h-full pr-1" style={{ maxHeight: '100%' }}>
      <div
        className="bg-white shadow-md mx-auto rounded-sm"
        style={{ width: '100%', maxWidth: '680px', padding: '48px 56px', ...docStyle }}
      >
        {analysisData?.sections?.length > 0 ? (
          // ── Render dinamis dari Groq ──
          analysisData.sections.map((section, i) => {
            // Override cover title/supervisor dengan input user
            const sec = section.type === 'cover'
              ? { ...section, title: effectiveTitle || section.title, supervisor: effectiveSupervisor || section.supervisor }
              : section
            return renderSection(sec, docStyle, headingStyle, i)
          })
        ) : (
          // ── Static fallback ──
          <StaticPreview
            title={effectiveTitle}
            supervisorName={effectiveSupervisor}
            docStyle={docStyle}
            headingStyle={headingStyle}
          />
        )}
      </div>
    </div>
  )
}
