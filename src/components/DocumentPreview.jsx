/**
 * DocumentPreview — Simulates a Microsoft Word document preview.
 * Uses Times New Roman font and a clean white "paper" layout.
 */
export default function DocumentPreview({ title, supervisorName, font, fontSize }) {
  const fontFamily = font || 'Times New Roman, serif'
  const size = fontSize || '12pt'

  const tocItems = [
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

  const docStyle = {
    fontFamily,
    fontSize: size,
    lineHeight: '1.8',
    color: '#1a1a1a',
  }

  const headingStyle = {
    fontFamily,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: '12px',
    marginTop: '20px',
  }

  const placeholderStyle = {
    color: '#6B7280',
    fontStyle: 'italic',
    backgroundColor: '#F3F4F6',
    borderRadius: '4px',
    padding: '2px 6px',
    display: 'inline-block',
  }

  return (
    <div className="overflow-y-auto h-full pr-1" style={{ maxHeight: '100%' }}>
      {/* Paper / Page */}
      <div
        className="bg-white shadow-md mx-auto rounded-sm"
        style={{
          width: '100%',
          maxWidth: '680px',
          padding: '48px 56px',
          ...docStyle,
        }}
      >
        {/* ── COVER PAGE ── */}
        <div className="text-center mb-8" style={{ paddingBottom: '24px', borderBottom: '1px solid #e5e7eb' }}>
          <p style={{ ...docStyle, marginBottom: '4px' }}>LAPORAN / MAKALAH</p>
          <h1
            style={{
              fontFamily,
              fontSize: '16pt',
              fontWeight: 'bold',
              margin: '12px 0',
              lineHeight: '1.4',
            }}
          >
            {title || '[JUDUL DOKUMEN DI SINI]'}
          </h1>
          <p style={{ ...docStyle, marginTop: '16px', color: '#4B5563' }}>
            Diajukan sebagai tugas mata kuliah
          </p>
          <p style={{ ...docStyle, marginTop: '32px' }}>
            Dosen Pengampu:
          </p>
          <p style={{ ...docStyle, fontWeight: 'bold' }}>
            {supervisorName || (
              <span style={placeholderStyle}>[Nama Dosen Pengampu]</span>
            )}
          </p>
          <p style={{ ...docStyle, marginTop: '32px', color: '#4B5563' }}>
            Disusun oleh:
          </p>
          <p style={{ ...docStyle, fontWeight: 'bold' }}>
            <span style={placeholderStyle}>[Nama Penyusun]</span>
          </p>
          <p style={{ ...docStyle }}>
            <span style={placeholderStyle}>[NIM / NPM]</span>
          </p>
          <p style={{ ...docStyle, marginTop: '32px' }}>
            <span style={placeholderStyle}>[Nama Institusi]</span>
          </p>
          <p style={{ ...docStyle }}>
            <span style={placeholderStyle}>[Tahun]</span>
          </p>
        </div>

        {/* ── KATA PENGANTAR ── */}
        <div className="mb-6">
          <p style={headingStyle}>KATA PENGANTAR</p>
          <p style={{ ...docStyle, textAlign: 'justify' }}>
            Puji syukur kehadirat Tuhan Yang Maha Esa atas segala rahmat-Nya sehingga laporan ini dapat tersusun hingga selesai. Tidak lupa penulis mengucapkan terima kasih terhadap bantuan dari pihak yang telah berkontribusi dalam penyusunan laporan ini.
          </p>
          <br />
          <p style={{ ...docStyle, textAlign: 'justify' }}>
            <span style={placeholderStyle}>[Isi Kata Pengantar Selengkapnya]</span>
          </p>
          <br />
          <p style={{ ...docStyle }}>
            <span style={placeholderStyle}>[Kota]</span>, <span style={placeholderStyle}>[Tanggal]</span>
          </p>
          <br />
          <p style={{ ...docStyle }}>Penulis,</p>
          <br />
          <p style={{ ...docStyle, fontWeight: 'bold' }}>
            <span style={placeholderStyle}>[Nama Penulis]</span>
          </p>
        </div>

        {/* ── DAFTAR ISI ── */}
        <div className="mb-6">
          <p style={headingStyle}>DAFTAR ISI</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', ...docStyle }}>
            <tbody>
              {tocItems.map((item, i) => (
                <tr key={i}>
                  <td
                    style={{
                      paddingLeft: item.indent ? '24px' : '0',
                      paddingTop: '2px',
                      paddingBottom: '2px',
                      width: '90%',
                    }}
                  >
                    {item.label}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      width: '10%',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.page}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p
            className="mt-3 text-xs px-2 py-1.5 rounded"
            style={{
              backgroundColor: '#FEF9C3',
              color: '#92400E',
              fontFamily: 'Inter, sans-serif',
              fontSize: '11px',
              lineHeight: '1.5',
            }}
          >
            💡 Tips: Setelah file Word dibuka, klik kanan pada area Daftar Isi lalu pilih &ldquo;Update Field&rdquo; untuk menyinkronkan nomor halaman secara otomatis.
          </p>
        </div>

        {/* ── BAB I ── */}
        <div className="mb-6">
          <p style={headingStyle}>BAB I</p>
          <p style={{ ...headingStyle, marginTop: 0 }}>PENDAHULUAN</p>

          <p style={{ ...docStyle, fontWeight: 'bold', marginTop: '12px' }}>1.1 Latar Belakang</p>
          <p style={{ ...docStyle, textAlign: 'justify' }}>
            <span style={placeholderStyle}>[Tuliskan latar belakang permasalahan di sini. Jelaskan kondisi saat ini, masalah yang ada, dan alasan mengapa topik ini penting untuk diteliti atau dibahas.]</span>
          </p>

          <p style={{ ...docStyle, fontWeight: 'bold', marginTop: '12px' }}>1.2 Rumusan Masalah</p>
          <p style={{ ...docStyle }}>
            <span style={placeholderStyle}>[Tuliskan rumusan masalah dalam bentuk pertanyaan penelitian]</span>
          </p>

          <p style={{ ...docStyle, fontWeight: 'bold', marginTop: '12px' }}>1.3 Tujuan</p>
          <p style={{ ...docStyle }}>
            <span style={placeholderStyle}>[Tuliskan tujuan penulisan laporan/makalah ini]</span>
          </p>
        </div>

        {/* ── BAB II stub ── */}
        <div className="mb-6">
          <p style={headingStyle}>BAB II</p>
          <p style={{ ...headingStyle, marginTop: 0 }}>TINJAUAN PUSTAKA</p>
          <p style={{ ...docStyle, textAlign: 'justify' }}>
            <span style={placeholderStyle}>[Isi tinjauan pustaka dan landasan teori yang mendukung penelitian ini]</span>
          </p>
        </div>

        {/* ── Remaining chapters stub ── */}
        {['III — METODOLOGI', 'IV — PEMBAHASAN', 'V — PENUTUP'].map((bab, i) => (
          <div key={i} className="mb-6">
            <p style={headingStyle}>BAB {bab.split('—')[0].trim()}</p>
            <p style={{ ...headingStyle, marginTop: 0 }}>{bab.split('—')[1].trim()}</p>
            <p style={{ ...docStyle, textAlign: 'justify' }}>
              <span style={placeholderStyle}>[Isi bagian {bab.split('—')[1].trim().toLowerCase()} di sini]</span>
            </p>
          </div>
        ))}

        {/* ── Daftar Pustaka ── */}
        <div className="mb-2">
          <p style={headingStyle}>DAFTAR PUSTAKA</p>
          <p style={{ ...docStyle }}>
            <span style={placeholderStyle}>[Daftar referensi / pustaka yang digunakan]</span>
          </p>
        </div>
      </div>
    </div>
  )
}
