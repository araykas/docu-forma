import { useState } from 'react'
import UploadPage from './pages/UploadPage'
import LoadingPage from './pages/LoadingPage'
import WorkspacePage from './pages/WorkspacePage'

// Page states: 'upload' | 'loading' | 'workspace'
export default function App() {
  const [page, setPage] = useState('upload')
  const [uploadedFile, setUploadedFile] = useState(null)

  const handleFileAccepted = (file) => {
    setUploadedFile(file)
    setPage('loading')

    // Simulate AI processing delay (3–5 seconds)
    setTimeout(() => {
      setPage('workspace')
    }, 4000)
  }

  const handleBack = () => {
    setUploadedFile(null)
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
        <WorkspacePage file={uploadedFile} onBack={handleBack} />
      )}
    </div>
  )
}
