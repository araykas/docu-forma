'use client'

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UploadState =
  | { status: 'idle' }
  | { status: 'dragging' }
  | { status: 'selected'; file: File }
  | { status: 'validating'; file: File }

type ToastVariant = 'error' | 'success'

interface Toast {
  id: number
  message: string
  variant: ToastVariant
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCEPTED_TYPES = ['.pdf', '.docx']
const ACCEPTED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') {
    return (
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="w-8 h-8 text-red-500"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
        />
      </svg>
    )
  }
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="w-8 h-8 text-blue-500"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Toast component
// ---------------------------------------------------------------------------

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: (id: number) => void
}) {
  const isError = toast.variant === 'error'
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={[
        'flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium',
        'animate-in slide-in-from-bottom-2 duration-200',
        isError
          ? 'bg-red-600 text-white'
          : 'bg-green-600 text-white',
      ].join(' ')}
    >
      {/* icon */}
      {isError ? (
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-5 h-5 shrink-0 mt-px"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-5 h-5 shrink-0 mt-px"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
            clipRule="evenodd"
          />
        </svg>
      )}

      <span className="flex-1">{toast.message}</span>

      {/* dismiss */}
      <button
        type="button"
        aria-label="Tutup notifikasi"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 opacity-80 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
      >
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4"
        >
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FileUpload
// ---------------------------------------------------------------------------

let toastCounter = 0

export default function FileUpload() {
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const [toasts, setToasts] = useState<Toast[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // -- toast helpers --

  const addToast = useCallback((message: string, variant: ToastVariant) => {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, variant }])
    // Auto-dismiss after 6 s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 6000)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // -- file handling --

  const handleFile = useCallback((file: File) => {
    setState({ status: 'selected', file })
  }, [])

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setState((prev) => (prev.status === 'dragging' ? prev : { status: 'dragging' }))
  }, [])

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setState((prev) => (prev.status === 'dragging' ? { status: 'idle' } : prev))
  }, [])

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
      else setState({ status: 'idle' })
    },
    [handleFile],
  )

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      e.target.value = ''
    },
    [handleFile],
  )

  const reset = useCallback(() => {
    setState({ status: 'idle' })
  }, [])

  // -- server validation (Spec B2) --

  const handleGenerate = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (state.status !== 'selected') return

      const file = state.file
      setState({ status: 'validating', file })

      try {
        const form = new FormData()
        form.append('file', file)

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: form,
        })

        const data = (await res.json()) as { ok: boolean; error?: string; mimeType?: string }

        if (!data.ok) {
          // Restore selected state so the user can swap the file
          setState({ status: 'selected', file })
          addToast(
            data.error ?? 'Gagal: Harap unggah file PDF/DOCX dengan ukuran maksimal 10 MB.',
            'error',
          )
          return
        }

        // Validation passed — restore selected state for now
        // (further processing added in later specs)
        setState({ status: 'selected', file })
        addToast('File valid. Siap diproses.', 'success')
      } catch {
        setState({ status: 'selected', file })
        addToast('Terjadi kesalahan jaringan. Silakan coba lagi.', 'error')
      }
    },
    [state, addToast],
  )

  // -- derived flags --

  const isDragging = state.status === 'dragging'
  const isSelected = state.status === 'selected' || state.status === 'validating'
  const isValidating = state.status === 'validating'
  const currentFile = isSelected ? (state as { file: File }).file : null

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload area — drag and drop or click to browse"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !isSelected && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isSelected) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        className={[
          'relative flex flex-col items-center justify-center gap-4',
          'rounded-2xl border-2 border-dashed transition-all duration-200',
          'px-8 py-12 text-center outline-none',
          isDragging
            ? 'border-indigo-500 bg-indigo-50 scale-[1.01]'
            : isSelected
              ? 'border-indigo-300 bg-indigo-50/60 cursor-default'
              : 'border-zinc-300 bg-zinc-50 hover:border-indigo-400 hover:bg-indigo-50/40 cursor-pointer',
          'focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
        ].join(' ')}
      >
        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept={[...ACCEPTED_TYPES, ...ACCEPTED_MIME].join(',')}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          onChange={onChange}
        />

        {isSelected && currentFile ? (
          /* ── Selected / Validating state ── */
          <div className="flex flex-col items-center gap-3 w-full">
            {getFileIcon(currentFile.name)}
            <div className="flex flex-col items-center gap-1">
              <p className="text-sm font-semibold text-zinc-800 break-all max-w-xs">
                {currentFile.name}
              </p>
              <p className="text-xs text-zinc-500">{formatBytes(currentFile.size)}</p>
            </div>

            {/* Actions — hidden while validating */}
            {!isValidating && (
              <div className="flex items-center gap-3 mt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    inputRef.current?.click()
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                >
                  Ganti file
                </button>
                <span className="text-zinc-300" aria-hidden="true">
                  |
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    reset()
                  }}
                  className="text-xs text-zinc-500 hover:text-red-500 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                >
                  Hapus
                </button>
              </div>
            )}

            {/* Generate / loading button */}
            <button
              type="button"
              disabled={isValidating}
              aria-busy={isValidating}
              onClick={handleGenerate}
              className={[
                'mt-3 w-full max-w-xs rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
                'transition-colors',
                isValidating
                  ? 'bg-indigo-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800',
              ].join(' ')}
            >
              {isValidating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    aria-hidden="true"
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Memvalidasi…
                </span>
              ) : (
                'Generate Template'
              )}
            </button>
          </div>
        ) : isDragging ? (
          /* ── Dragging state ── */
          <div className="flex flex-col items-center gap-3 pointer-events-none">
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="w-10 h-10 text-indigo-500 animate-bounce"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
              />
            </svg>
            <p className="text-sm font-medium text-indigo-600">Lepaskan file di sini</p>
          </div>
        ) : (
          /* ── Idle state ── */
          <div className="flex flex-col items-center gap-3">
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="w-10 h-10 text-zinc-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-zinc-700">
                Drag &amp; drop file di sini, atau{' '}
                <span className="text-indigo-600 underline underline-offset-2">pilih file</span>
              </p>
              <p className="mt-1 text-xs text-zinc-400">PDF atau DOCX — maks. 10 MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Toast stack — rendered outside the drop zone to avoid z-index issues */}
      {toasts.length > 0 && (
        <div
          aria-label="Notifikasi"
          className="mt-4 flex flex-col gap-2"
        >
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismissToast} />
          ))}
        </div>
      )}
    </div>
  )
}
