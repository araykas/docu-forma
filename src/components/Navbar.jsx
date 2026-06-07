import { FileText } from 'lucide-react'

export default function Navbar({ showBack = false, onBack }) {
  return (
    <nav
      className="w-full border-b px-6 py-4 flex items-center justify-between"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2">
        {showBack && (
          <button
            onClick={onBack}
            className="mr-2 text-sm font-medium flex items-center gap-1 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-primary)' }}
          >
            ← Kembali
          </button>
        )}
        <FileText size={22} style={{ color: 'var(--color-primary)' }} />
        <span className="text-lg font-bold" style={{ color: 'var(--color-text-main)' }}>
          DocuForma <span style={{ color: 'var(--color-primary)' }}>AI</span>
        </span>
      </div>

      {/* Right side badge */}
      <div
        className="text-xs font-medium px-3 py-1.5 rounded-full border"
        style={{
          color: 'var(--color-primary)',
          borderColor: 'var(--color-primary)',
          backgroundColor: '#EFF6FF',
        }}
      >
        Groq Powered
      </div>
    </nav>
  )
}
