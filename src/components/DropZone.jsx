import { useState, useRef } from 'react'
import { UploadCloud, FileText, AlertCircle, CheckCircle } from 'lucide-react'

const ACCEPTED_TYPES = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg/.jpeg',
}

const MAX_SIZE_MB = 5
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

export default function DropZone({ onFileAccepted }) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const inputRef = useRef(null)

  const validateFile = (file) => {
    if (!Object.keys(ACCEPTED_TYPES).includes(file.type)) {
      return 'Format file tidak didukung. Gunakan .docx, .pdf, .png, atau .jpg.'
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `Ukuran file terlalu besar. Maksimal ${MAX_SIZE_MB}MB.`
    }
    return null
  }

  const processFile = (file) => {
    const err = validateFile(file)
    if (err) {
      setError(err)
      setSelectedFile(null)
      return
    }
    setError(null)
    setSelectedFile(file)
    // Small delay for UX feedback before transitioning
    setTimeout(() => onFileAccepted(file), 800)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const handleInputChange = (e) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className="relative cursor-pointer rounded-2xl border-2 border-dashed p-12 flex flex-col items-center gap-4 transition-all duration-200 select-none"
        style={{
          borderColor: isDragging
            ? 'var(--color-primary)'
            : selectedFile
            ? 'var(--color-accent)'
            : 'var(--color-border)',
          backgroundColor: isDragging
            ? '#EFF6FF'
            : selectedFile
            ? '#ECFDF5'
            : 'var(--color-surface)',
        }}
      >
        {/* Icon */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: isDragging ? '#DBEAFE' : selectedFile ? '#D1FAE5' : '#F1F5F9',
          }}
        >
          {selectedFile ? (
            <CheckCircle size={32} style={{ color: 'var(--color-accent)' }} />
          ) : (
            <UploadCloud
              size={32}
              style={{ color: isDragging ? 'var(--color-primary)' : 'var(--color-secondary)' }}
            />
          )}
        </div>

        {/* Text */}
        {selectedFile ? (
          <div className="text-center">
            <p className="font-semibold text-base" style={{ color: 'var(--color-accent)' }}>
              File siap diproses!
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              <FileText size={14} className="inline mr-1" />
              {selectedFile.name} ({formatFileSize(selectedFile.size)})
            </p>
          </div>
        ) : (
          <div className="text-center">
            <p className="font-semibold text-base" style={{ color: 'var(--color-text-main)' }}>
              {isDragging ? 'Lepaskan file di sini' : 'Tarik & Lepas File Anda di Sini'}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              atau{' '}
              <span style={{ color: 'var(--color-primary)' }} className="font-medium underline">
                klik untuk memilih dari komputer
              </span>
            </p>
          </div>
        )}

        {/* Accepted formats */}
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Format: .docx, .pdf, .png, .jpg, .jpeg &nbsp;·&nbsp; Maks. {MAX_SIZE_MB}MB
        </p>

        {/* Hidden input */}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".docx,.pdf,.png,.jpg,.jpeg"
          onChange={handleInputChange}
        />
      </div>

      {/* Error toast */}
      {error && (
        <div
          className="mt-3 flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
          style={{
            backgroundColor: '#FEF2F2',
            color: '#DC2626',
            border: '1px solid #FECACA',
          }}
        >
          <AlertCircle size={16} />
          {error}
        </div>
      )}
    </div>
  )
}
