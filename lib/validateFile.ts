/**
 * lib/validateFile.ts
 *
 * Server-side file validation helpers.
 *
 * Validates file type via magic bytes (not file extension) and enforces a
 * 10 MB size ceiling.  All processing is in-memory — no writes to disk.
 *
 * For ZIP-signature files, opens the archive with jszip and confirms the
 * presence of '[Content_Types].xml' and 'word/document.xml' before accepting
 * the file as a valid .docx.  This prevents plain ZIP files (or other OOXML
 * containers like .xlsx/.pptx) from passing validation.
 *
 * For PDF files, uses unpdf (pdf.js v4, serverless build) to detect password
 * protection (Spec B3 / PRD section 6, Skenario 2).  unpdf loads lazily — no
 * side-effects on import, no test-file reads.
 */

import JSZip from 'jszip'
import { getResolvedPDFJS } from 'unpdf'

/** Maximum allowed upload size (10 MB). */
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB in bytes

// ---------------------------------------------------------------------------
// Magic byte signatures
// ---------------------------------------------------------------------------

/**
 * PDF: always starts with the 4-byte sequence  %PDF  (hex 25 50 44 46).
 */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46] // %PDF

/**
 * DOCX (and every modern Office Open XML file) is a ZIP archive.
 * ZIP local-file headers begin with the 4-byte signature PK\x03\x04.
 */
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] // PK..

export type MimeType =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export interface ValidationResult {
  valid: true
  mimeType: MimeType
}

export interface ValidationError {
  valid: false
  error: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchesSignature(buf: Uint8Array, sig: number[]): boolean {
  return sig.every((byte, i) => buf[i] === byte)
}

/**
 * Open the ZIP archive in-memory and verify it contains the two entries that
 * are mandatory in every valid .docx file:
 *   - [Content_Types].xml  (root-level Office Open XML manifest)
 *   - word/document.xml    (the actual document body)
 *
 * Returns true only when both entries are present.
 */
async function isValidDocx(buffer: ArrayBuffer): Promise<boolean> {
  try {
    const zip = await JSZip.loadAsync(buffer)
    const hasContentTypes = zip.file('[Content_Types].xml') !== null
    const hasWordDocument = zip.file('word/document.xml') !== null
    return hasContentTypes && hasWordDocument
  } catch {
    // Corrupt or unreadable ZIP
    return false
  }
}

// ---------------------------------------------------------------------------
// PDF password detection
// ---------------------------------------------------------------------------

/**
 * Attempt a lightweight load of a PDF buffer to detect whether the file is
 * password-protected.
 *
 * unpdf wraps pdf.js v4.  When `getDocument().promise` is awaited on a
 * password-locked file, pdf.js rejects with an error whose `name` property
 * equals `'PasswordException'` — before any page content is accessed.
 * We pass `{ max: 0 }` (stop after document load, render no pages) to keep
 * memory and CPU overhead minimal.
 *
 * Returns true  → file is locked (password required).
 * Returns false → file opened successfully (not locked), or threw an
 *                 unrelated parse error (corrupt file, etc.) which the
 *                 caller can handle separately.
 */
export async function isPdfPasswordProtected(buffer: ArrayBuffer): Promise<boolean> {
  try {
    const { getDocument } = await getResolvedPDFJS()
    // Pass a Uint8Array copy so pdf.js owns its own memory reference
    const loadingTask = getDocument({ data: new Uint8Array(buffer) })
    const doc = await loadingTask.promise
    // Clean up the pdf.js worker resources immediately
    await doc.destroy()
    return false
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'PasswordException') {
      return true
    }
    // Any other parse error (corrupt file, wrong format, etc.) — not a password lock
    return false
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a file supplied as an ArrayBuffer.
 *
 * Checks (in order):
 *   1. Size ≤ MAX_FILE_SIZE
 *   2. Magic bytes identify content as PDF or ZIP
 *   3. For ZIP candidates: internal structure confirms a valid .docx
 *
 * Error messages match PRD section 6, Scenario 1.
 */
export async function validateFileBuffer(
  buffer: ArrayBuffer,
): Promise<ValidationResult | ValidationError> {
  // 1. Size guard
  if (buffer.byteLength > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'Gagal: Harap unggah file PDF/DOCX dengan ukuran maksimal 10 MB.',
    }
  }

  // 2. Magic bytes — read only the first 4 bytes
  const header = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength))

  if (matchesSignature(header, PDF_MAGIC)) {
    return { valid: true, mimeType: 'application/pdf' }
  }

  if (matchesSignature(header, ZIP_MAGIC)) {
    // 3. ZIP confirmed — now verify it is actually a .docx, not just any ZIP
    const docxOk = await isValidDocx(buffer)
    if (!docxOk) {
      return {
        valid: false,
        error:
          'Gagal: file terdeteksi sebagai arsip ZIP tapi bukan dokumen .docx yang valid.',
      }
    }
    return {
      valid: true,
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }
  }

  // Unknown signature
  return {
    valid: false,
    error: 'Gagal: Harap unggah file PDF/DOCX dengan ukuran maksimal 10 MB.',
  }
}
