/**
 * fallback.js
 * Template struktur dokumen akademik standar yang digunakan
 * jika Groq API tidak tersedia (rate limit / timeout / error).
 */
const FALLBACK_TEMPLATE = {
  source: 'fallback',
  docType: 'academic',
  sections: [
    {
      type: 'cover',
      title: '[JUDUL DOKUMEN DI SINI]',
      subtitle: '[Sub-judul jika ada]',
      author: '[Nama Penyusun]',
      nim: '[NIM / NPM]',
      supervisor: '[Nama Dosen Pengampu]',
      institution: '[Nama Institusi / Universitas]',
      year: '[Tahun]',
    },
    {
      type: 'preface',
      heading: 'KATA PENGANTAR',
      content:
        'Puji syukur kehadirat Tuhan Yang Maha Esa atas segala rahmat-Nya sehingga laporan ini dapat tersusun hingga selesai.\n\n[Isi kata pengantar selengkapnya di sini]\n\n[Kota], [Tanggal]\n\nPenulis,\n\n[Nama Penulis]',
    },
    {
      type: 'toc',
      heading: 'DAFTAR ISI',
      items: [
        { label: 'Kata Pengantar', page: 'i' },
        { label: 'Daftar Isi', page: 'ii' },
        { label: 'BAB I PENDAHULUAN', page: '1' },
        { label: '1.1 Latar Belakang', page: '1', indent: true },
        { label: '1.2 Rumusan Masalah', page: '2', indent: true },
        { label: '1.3 Tujuan', page: '2', indent: true },
        { label: '1.4 Manfaat', page: '3', indent: true },
        { label: 'BAB II TINJAUAN PUSTAKA', page: '4' },
        { label: 'BAB III METODOLOGI', page: '7' },
        { label: 'BAB IV PEMBAHASAN', page: '10' },
        { label: 'BAB V PENUTUP', page: '15' },
        { label: '5.1 Kesimpulan', page: '15', indent: true },
        { label: '5.2 Saran', page: '16', indent: true },
        { label: 'DAFTAR PUSTAKA', page: '17' },
      ],
    },
    {
      type: 'chapter',
      number: 'I',
      title: 'PENDAHULUAN',
      subsections: [
        { number: '1.1', title: 'Latar Belakang', content: '[Tuliskan latar belakang permasalahan di sini]' },
        { number: '1.2', title: 'Rumusan Masalah', content: '[Tuliskan rumusan masalah dalam bentuk pertanyaan]' },
        { number: '1.3', title: 'Tujuan', content: '[Tuliskan tujuan penulisan]' },
        { number: '1.4', title: 'Manfaat', content: '[Tuliskan manfaat penelitian]' },
      ],
    },
    {
      type: 'chapter',
      number: 'II',
      title: 'TINJAUAN PUSTAKA',
      subsections: [
        { number: '2.1', title: 'Landasan Teori', content: '[Tuliskan landasan teori yang relevan]' },
        { number: '2.2', title: 'Penelitian Terdahulu', content: '[Tuliskan kajian penelitian terdahulu]' },
      ],
    },
    {
      type: 'chapter',
      number: 'III',
      title: 'METODOLOGI',
      subsections: [
        { number: '3.1', title: 'Metode Penelitian', content: '[Jelaskan metode penelitian yang digunakan]' },
        { number: '3.2', title: 'Teknik Pengumpulan Data', content: '[Jelaskan teknik pengumpulan data]' },
        { number: '3.3', title: 'Alur Penelitian', content: '[Jelaskan alur / tahapan penelitian]' },
      ],
    },
    {
      type: 'chapter',
      number: 'IV',
      title: 'PEMBAHASAN',
      subsections: [
        { number: '4.1', title: 'Hasil Penelitian', content: '[Tuliskan hasil penelitian di sini]' },
        { number: '4.2', title: 'Analisis', content: '[Tuliskan analisis terhadap hasil yang diperoleh]' },
        { number: '4.3', title: 'Diskusi', content: '[Tuliskan diskusi dan perbandingan dengan teori / penelitian lain]' },
      ],
    },
    {
      type: 'chapter',
      number: 'V',
      title: 'PENUTUP',
      subsections: [
        { number: '5.1', title: 'Kesimpulan', content: '[Tuliskan kesimpulan dari penelitian]' },
        { number: '5.2', title: 'Saran', content: '[Tuliskan saran untuk penelitian selanjutnya]' },
      ],
    },
    {
      type: 'bibliography',
      heading: 'DAFTAR PUSTAKA',
      content: '[Daftar referensi / pustaka yang digunakan]',
    },
  ],
}

module.exports = FALLBACK_TEMPLATE
