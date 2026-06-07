import { useState } from 'react'
import UploadPage from './pages/UploadPage'
import LoadingPage from './pages/LoadingPage'
import WorkspacePage from './pages/WorkspacePage'

// Page states: 'upload' | 'loading' | 'workspace'
export default function App() {
  const [page, setPage] = useState('upload')
  const [uploadedFile, setUploadedFile] = useState(null)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [analysisError, setAnalysisError] = useState(null)

  const handleFileAccepted = async (file) => {
    setUploadedFile(file)
    setAnalysisResult(null)
    setAnalysisError(null)
    setPage('loading')

    try {
      const apiBase = import.meta.env.VITE_API_URL || ''
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${apiBase}/api/analyze`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Server error ${res.status}`)
      }

      const data = await res.json()
      setAnalysisResult(data)
    } catch (err) {
      console.error('[DocuForma] Fetch /api/analyze error:', err.message)
      // Simpan pesan error tapi tetap lanjut ke workspace dengan fallback
      setAnalysisError(err.message)
      setAnalysisResult(null) // WorkspacePage akan pakai static fallback
    } finally {
      setPage('workspace')
    }
  }

  const handleBack = () => {
    setUploadedFile(null)
    setAnalysisResult(null)
    setAnalysisError(null)
    setPage('upload')
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      {page === 'upload' && (
        <UploadPage onFileAccepted={handleFileAccepted} />
      )}
      {page === 'loading' && (
        <LoadingPage fileName={uploadedFile?.name} />
      )}
      {page === 'workspace' && (
        <WorkspacePage
          file={uploadedFile}
          analysisResult={analysisResult}
          analysisError={analysisError}
          onBack={handleBack}
        />
      )}
    </div>
  )
}
