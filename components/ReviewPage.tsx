'use client'

/**
 * components/ReviewPage.tsx
 *
 * Spec E1 — Layout review dengan data dummy.
 * Spec E2 — Panel pratinjau visual (mockup A4, update real-time, toggle bagian awal/utama).
 * Spec E3 — Kontrol tambahan: toggle isi bab (Lorem ipsum/Kosong), tombol Upload ulang,
 *            tombol Download (dummy/disabled — akan diaktifkan di Spec F3).
 * Spec E4 — Hubungkan ke data ekstraksi asli: baca sessionStorage hasil /api/upload,
 *            petakan ke FieldGroup[] via extractionToGroups(). Fallback ke dummy
 *            jika tidak ada data (navigasi langsung ke /review).
 * PRD v6, Bagian 4 (fitur 4 & 5), Bagian 3.4.
 *
 * Menampilkan 4 kelompok field hasil ekstraksi (hardcoded dummy untuk sekarang):
 *   1. Kertas & Margin
 *   2. Font & Spasi
 *   3. Penomoran Halaman
 *   4. Format Judul Bab
 *
 * Setiap field memiliki badge sumber:
 *   - Hijau  "Terdeteksi"   → source: 'ai_extraction',           detected: true
 *   - Biru   "Saran file"   → source: 'docx_property_fallback',  detected: true
 *   - Kuning "Default"      → detected: false
 *
 * Setiap kelompok menampilkan counter "X terdeteksi / Y total".
 *
 * Data real (dari hasil AI) disambungkan di Spec E4 via sessionStorage.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  PAPER_SIZE_OPTIONS,
  FONT_FAMILY_OPTIONS,
  FONT_COLOR_OPTIONS,
  PAGE_NUMBER_POSITION_OPTIONS,
  NUMBERING_FORMAT_OPTIONS,
  CHAPTER_TITLE_CASE_OPTIONS,
  CHAPTER_TITLE_ALIGN_OPTIONS,
  CHAPTER_NUMBER_FORMAT_OPTIONS,
  SUBCHAPTER_NUMBER_FORMAT_OPTIONS,
  MARGIN_RANGE,
  FONT_SIZE_RANGE,
  LINE_SPACING_RANGE,
  OPTION_LABELS,
} from '@/lib/fieldConfig'
import { extractionToGroups, EXTRACTION_STORAGE_KEY } from '@/lib/extractionToGroups'
import type { GeminiExtractionResult } from '@/lib/callGemini'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FieldSource = 'ai_extraction' | 'docx_property_fallback' | 'default'

interface ReviewField {
  /** Key sesuai skema PRD Bagian 3.4 */
  key: string
  /** Label bahasa Indonesia untuk tampilan */
  label: string
  /** Nilai saat ini (bisa diubah user) */
  value: string
  /** Sumber nilai — menentukan badge */
  source: FieldSource
  /** Jenis kontrol UI */
  type: 'text' | 'select' | 'number'
  /** Opsi untuk select (hanya relevan jika type === 'select') */
  options?: readonly string[]
  /** Batas minimum untuk number input */
  min?: number
  /** Batas maksimum untuk number input */
  max?: number
  /** Langkah increment untuk number input */
  step?: number
  /** Deskripsi singkat opsi yang valid (untuk placeholder/tooltip) */
  hint?: string
  /**
   * Kutipan verbatim dari dokumen pedoman yang menjadi dasar deteksi field ini.
   * Hanya diisi saat source === 'ai_extraction' dan AI yakin dengan kalimat sumbernya.
   * null / undefined jika sumber bukan ai_extraction atau kutipan tidak tersedia.
   */
  source_quote?: string | null
}

interface FieldGroup {
  id: string
  title: string
  fields: ReviewField[]
}

// ---------------------------------------------------------------------------
// Dummy data (Spec E1 — fallback jika tidak ada data ekstraksi di sessionStorage)
// ---------------------------------------------------------------------------

const DUMMY_GROUPS: FieldGroup[] = [
  {
    id: 'kertas-margin',
    title: 'Kertas & Margin',
    fields: [
      {
        key: 'paper_size',
        label: 'Ukuran kertas',
        value: 'A4',
        source: 'ai_extraction',
        type: 'select',
        options: PAPER_SIZE_OPTIONS,
      },
      {
        key: 'margin_left_cm',
        label: 'Margin kiri (cm)',
        value: '4',
        source: 'ai_extraction',
        type: 'number',
        ...MARGIN_RANGE,
        hint: '0–10 cm',
      },
      {
        key: 'margin_right_cm',
        label: 'Margin kanan (cm)',
        value: '3',
        source: 'ai_extraction',
        type: 'number',
        ...MARGIN_RANGE,
        hint: '0–10 cm',
      },
      {
        key: 'margin_top_cm',
        label: 'Margin atas (cm)',
        value: '4',
        source: 'ai_extraction',
        type: 'number',
        ...MARGIN_RANGE,
        hint: '0–10 cm',
      },
      {
        key: 'margin_bottom_cm',
        label: 'Margin bawah (cm)',
        value: '3',
        source: 'docx_property_fallback',
        type: 'number',
        ...MARGIN_RANGE,
        hint: '0–10 cm',
      },
    ],
  },
  {
    id: 'font-spasi',
    title: 'Font & Spasi',
    fields: [
      {
        key: 'font_family',
        label: 'Jenis font',
        value: 'Times New Roman',
        source: 'ai_extraction',
        type: 'select',
        options: FONT_FAMILY_OPTIONS,
      },
      {
        key: 'font_size',
        label: 'Ukuran font (pt)',
        value: '12',
        source: 'default',
        type: 'number',
        ...FONT_SIZE_RANGE,
        hint: '8–24 pt',
      },
      {
        key: 'line_spacing',
        label: 'Spasi baris',
        value: '2',
        source: 'ai_extraction',
        type: 'number',
        ...LINE_SPACING_RANGE,
        hint: '1–3',
      },
      {
        key: 'font_color',
        label: 'Warna tinta',
        value: 'black',
        source: 'default',
        type: 'select',
        options: FONT_COLOR_OPTIONS,
        hint: 'Hampir semua pedoman TA mewajibkan hitam',
      },
    ],
  },
  {
    id: 'penomoran-halaman',
    title: 'Penomoran Halaman',
    fields: [
      {
        key: 'page_number_position',
        label: 'Posisi nomor halaman',
        value: 'bottom-center',
        source: 'ai_extraction',
        type: 'select',
        options: PAGE_NUMBER_POSITION_OPTIONS,
      },
      {
        key: 'front_matter_numbering',
        label: 'Format bagian awal',
        value: 'lowercase-roman',
        source: 'ai_extraction',
        type: 'select',
        options: NUMBERING_FORMAT_OPTIONS,
      },
      {
        key: 'main_body_numbering',
        label: 'Format bagian utama',
        value: 'arabic',
        source: 'default',
        type: 'select',
        options: NUMBERING_FORMAT_OPTIONS,
      },
    ],
  },
  {
    id: 'judul-bab',
    title: 'Format Judul Bab',
    fields: [
      {
        key: 'chapter_title_case',
        label: 'Gaya huruf judul bab',
        value: 'uppercase',
        source: 'ai_extraction',
        type: 'select',
        options: CHAPTER_TITLE_CASE_OPTIONS,
      },
      {
        key: 'chapter_title_align',
        label: 'Perataan judul bab',
        value: 'center',
        source: 'ai_extraction',
        type: 'select',
        options: CHAPTER_TITLE_ALIGN_OPTIONS,
      },
      {
        key: 'chapter_number_format',
        label: 'Format nomor bab',
        value: 'roman',
        source: 'ai_extraction',
        type: 'select',
        options: CHAPTER_NUMBER_FORMAT_OPTIONS,
      },
      {
        key: 'subchapter_number_format',
        label: 'Format nomor sub-bab',
        value: 'decimal',
        source: 'default',
        type: 'select',
        options: SUBCHAPTER_NUMBER_FORMAT_OPTIONS,
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Spec E4 — Load initial groups from sessionStorage (extraction result)
// Falls back to DUMMY_GROUPS if no extraction data is present.
// ---------------------------------------------------------------------------

function loadInitialGroups(): FieldGroup[] {
  try {
    const raw = sessionStorage.getItem(EXTRACTION_STORAGE_KEY)
    if (!raw) return DUMMY_GROUPS
    const parsed = JSON.parse(raw) as GeminiExtractionResult
    if (!parsed || !parsed.rules) return DUMMY_GROUPS
    return extractionToGroups(parsed) as FieldGroup[]
  } catch {
    return DUMMY_GROUPS
  }
}

// ---------------------------------------------------------------------------
// Badge component
// ---------------------------------------------------------------------------

function SourceBadge({ source }: { source: FieldSource }) {
  if (source === 'ai_extraction') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 ring-1 ring-inset ring-green-200">
        <svg aria-hidden="true" className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="currentColor">
          <circle cx="5" cy="5" r="5" className="text-green-400" />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M7.5 3.5 4.25 7 2.5 5.25l.7-.7 1.05 1.05L6.8 2.8l.7.7Z"
            fill="white"
          />
        </svg>
        Terdeteksi
      </span>
    )
  }

  if (source === 'docx_property_fallback') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
        <svg aria-hidden="true" className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="currentColor">
          <circle cx="5" cy="5" r="5" fill="#93c5fd" />
          <text x="5" y="7.5" textAnchor="middle" fontSize="7" fill="white" fontWeight="bold">i</text>
        </svg>
        Saran file
      </span>
    )
  }

  // default
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
      <svg aria-hidden="true" className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="5" cy="5" r="4" stroke="#d97706" />
        <path d="M5 3v2.5M5 7h.01" strokeLinecap="round" stroke="#d97706" />
      </svg>
      Default
    </span>
  )
}

// ---------------------------------------------------------------------------
// Group counter chip
// ---------------------------------------------------------------------------

function GroupCounter({ fields }: { fields: ReviewField[] }) {
  const detected = fields.filter((f) => f.source !== 'default').length
  const total = fields.length
  return (
    <span className="text-xs text-zinc-500 tabular-nums">
      <span className="text-zinc-700 font-medium">{detected}</span>/{total} terdeteksi
    </span>
  )
}

// ---------------------------------------------------------------------------
// Single field row
// ---------------------------------------------------------------------------

/** Shared base classes for all input controls — keeps styling consistent. */
const INPUT_BASE =
  'w-full sm:w-48 rounded-lg border px-3 py-1.5 text-sm text-zinc-800 ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ' +
  'transition-colors'

function inputColorClass(source: FieldSource): string {
  if (source === 'default') return 'border-amber-300 bg-amber-50'
  if (source === 'docx_property_fallback') return 'border-blue-300 bg-blue-50'
  return 'border-zinc-200 bg-white'
}

function FieldRow({
  field,
  onChange,
}: {
  field: ReviewField
  onChange: (key: string, value: string) => void
}) {
  const colorCls = inputColorClass(field.source)
  const inputId = `field-${field.key}`

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-b border-zinc-100 last:border-0">
      {/* Label + badge */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={inputId} className="text-sm font-medium text-zinc-800">
            {field.label}
          </label>
          <SourceBadge source={field.source} />
        </div>
        {field.source === 'docx_property_fallback' && (
          <p className="mt-0.5 text-[11px] text-blue-600 leading-snug">
            Saran dari setting file .docx — mohon verifikasi manual
          </p>
        )}
        {field.source === 'default' && (
          <p className="mt-0.5 text-[11px] text-amber-600 leading-snug">
            Tidak terdeteksi dari dokumen — nilai default dipakai
          </p>
        )}
        {field.source === 'ai_extraction' && field.source_quote && (
          <p className="mt-0.5 text-[11px] text-zinc-400 italic leading-snug">
            💬 &ldquo;{field.source_quote}&rdquo;
          </p>
        )}
      </div>

      {/* Control — select, number, or text */}
      {field.type === 'select' && field.options ? (
        <select
          id={inputId}
          value={field.value}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={`${INPUT_BASE} ${colorCls} pr-8 appearance-none cursor-pointer`}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
          }}
        >
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {OPTION_LABELS[opt] ?? opt}
            </option>
          ))}
        </select>
      ) : field.type === 'number' ? (
        <input
          id={inputId}
          type="number"
          value={field.value}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.hint}
          className={`${INPUT_BASE} ${colorCls} placeholder:text-zinc-400`}
        />
      ) : (
        <input
          id={inputId}
          type="text"
          value={field.value}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.hint}
          className={`${INPUT_BASE} ${colorCls} placeholder:text-zinc-400`}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Field group card
// ---------------------------------------------------------------------------

function FieldGroupCard({
  group,
  onFieldChange,
}: {
  group: FieldGroup
  onFieldChange: (groupId: string, key: string, value: string) => void
}) {
  return (
    <section
      aria-labelledby={`group-heading-${group.id}`}
      className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden"
    >
      {/* Group header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-50 border-b border-zinc-200">
        <h2
          id={`group-heading-${group.id}`}
          className="text-sm font-semibold text-zinc-900"
        >
          {group.title}
        </h2>
        <GroupCounter fields={group.fields} />
      </div>

      {/* Fields */}
      <div className="px-5 divide-y divide-zinc-100">
        {group.fields.map((field) => (
          <FieldRow
            key={field.key}
            field={field}
            onChange={(key, value) => onFieldChange(group.id, key, value)}
          />
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Preview helpers
// ---------------------------------------------------------------------------

/** Ambil nilai field dari groups berdasarkan key. Kembalikan fallback jika tidak ada. */
function getFieldValue(groups: FieldGroup[], key: string, fallback = ''): string {
  for (const g of groups) {
    const f = g.fields.find((x) => x.key === key)
    if (f) return f.value
  }
  return fallback
}

/**
 * Konversi nilai margin (string cm) ke persen relatif terhadap lebar A4 (21 cm).
 * Dipakai untuk padding dalam preview yang lebarnya dikecilkan ke fixed px.
 * Preview lebar 210px → 1 cm = ~10px (skala 1/10 dari actual 21 cm).
 */
function cmToPx(cmStr: string, scale = 10): number {
  const v = parseFloat(cmStr)
  if (isNaN(v) || v < 0) return 30
  return Math.round(Math.max(4, Math.min(v * scale, 80)))
}

/** Teks placeholder baris berdasarkan jenis (untuk efek visual). */
const BODY_LINES = [70, 100, 90, 100, 80, 100, 65, 100, 95, 55]

/** Penggalan lorem ipsum untuk preview isi bab. Dipotong agar muat di preview kecil. */
const LOREM_LINES = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod',
  'tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim',
  'veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea',
  'commodo consequat. Duis aute irure dolor in reprehenderit in voluptate',
  'velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat',
  'cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id',
  'est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem',
  'accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab',
  'illo inventore veritatis et quasi architecto beatae vitae dicta sunt.',
  'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.',
]

/** Pilihan isi bab di preview */
type ChapterContent = 'lorem' | 'empty'

// ---------------------------------------------------------------------------
// PreviewPanel — mockup A4 skala kecil
// ---------------------------------------------------------------------------

type PreviewSection = 'front' | 'main'

function PreviewPanel({
  groups,
  section,
  onSectionChange,
  chapterContent,
}: {
  groups: FieldGroup[]
  section: PreviewSection
  onSectionChange: (s: PreviewSection) => void
  chapterContent: ChapterContent
}) {
  // Baca nilai dari form (dengan fallback yang masuk akal)
  const marginLeft  = getFieldValue(groups, 'margin_left_cm',  '3')
  const marginRight = getFieldValue(groups, 'margin_right_cm', '3')
  const marginTop   = getFieldValue(groups, 'margin_top_cm',   '3')
  const marginBottom = getFieldValue(groups, 'margin_bottom_cm', '3')
  const fontFamily  = getFieldValue(groups, 'font_family',     'Times New Roman')
  const fontSize    = getFieldValue(groups, 'font_size',       '12')
  const lineSpacing = parseFloat(getFieldValue(groups, 'line_spacing', '2'))

  const pageNumPos       = getFieldValue(groups, 'page_number_position',   'bottom-center')
  const frontNumbering   = getFieldValue(groups, 'front_matter_numbering', 'lowercase-roman')
  const mainNumbering    = getFieldValue(groups, 'main_body_numbering',    'arabic')

  const titleCase   = getFieldValue(groups, 'chapter_title_case',   'uppercase')
  const titleAlign  = getFieldValue(groups, 'chapter_title_align',  'center')
  const chapterNumFormat = getFieldValue(groups, 'chapter_number_format', 'roman')

  // ---------------------------------------------------------------------------
  // Kalkulasi visual
  // ---------------------------------------------------------------------------

  // Preview A4: 210 × 297 mm, kita render 210 × 297 px (skala 1mm = 1px)
  // lalu shrink ke 50% via transform-scale untuk muat di sidebar/panel
  const PAGE_W = 210  // px
  const PAGE_H = 297  // px
  const SCALE  = 10   // 1 cm = 10px

  const pLeft   = cmToPx(marginLeft, SCALE)
  const pRight  = cmToPx(marginRight, SCALE)
  const pTop    = cmToPx(marginTop, SCALE)
  const pBottom = cmToPx(marginBottom, SCALE)

  // Effective body width & height
  const bodyW = PAGE_W - pLeft - pRight
  const bodyH = PAGE_H - pTop - pBottom

  // Font size: scale down proportionally (original 12pt ≈ 3px in preview)
  const previewFontSize = Math.max(2, Math.round((parseFloat(fontSize) || 12) * 0.27))

  // Line height factor
  const lineH = Math.max(1, isNaN(lineSpacing) ? 2 : lineSpacing)
  const lineHeightPx = previewFontSize * lineH * 1.15

  // Chapter title text transform
  const titleText = chapterNumFormat === 'roman'
    ? (section === 'main' ? 'BAB I PENDAHULUAN' : 'KATA PENGANTAR')
    : (section === 'main' ? 'BAB 1 PENDAHULUAN' : 'KATA PENGANTAR')

  const displayTitle = titleCase === 'uppercase'
    ? titleText.toUpperCase()
    : titleCase === 'capitalize'
      ? titleText.replace(/\b\w/g, (c) => c.toUpperCase())
      : titleText.charAt(0).toUpperCase() + titleText.slice(1).toLowerCase()

  const titleAlignCSS: React.CSSProperties['textAlign'] =
    titleAlign === 'center' ? 'center'
    : titleAlign === 'right' ? 'right'
    : 'left'

  // Page number
  const pageNum = section === 'front'
    ? (frontNumbering === 'lowercase-roman' ? 'ii'
      : frontNumbering === 'uppercase-roman' ? 'II'
      : '2')
    : (mainNumbering === 'arabic' ? '1' : 'I')

  const pageNumStyle: React.CSSProperties =
    pageNumPos === 'bottom-center' ? { textAlign: 'center' }
    : pageNumPos === 'bottom-right' ? { textAlign: 'right' }
    : pageNumPos === 'top-right'   ? { textAlign: 'right' }
    : pageNumPos === 'top-center'  ? { textAlign: 'center' }
    : { textAlign: 'center' }

  const isTopNumber = pageNumPos.startsWith('top')

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-50 border-b border-zinc-200">
        <h2 className="text-sm font-semibold text-zinc-900">Pratinjau Dokumen</h2>

        {/* Toggle: Bagian Awal / Bagian Utama */}
        <div
          role="group"
          aria-label="Pilih bagian dokumen"
          className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 text-xs font-medium"
        >
          <button
            type="button"
            onClick={() => onSectionChange('front')}
            aria-pressed={section === 'front'}
            className={[
              'rounded-md px-3 py-1 transition-colors',
              section === 'front'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700',
            ].join(' ')}
          >
            Bagian Awal
          </button>
          <button
            type="button"
            onClick={() => onSectionChange('main')}
            aria-pressed={section === 'main'}
            className={[
              'rounded-md px-3 py-1 transition-colors',
              section === 'main'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700',
            ].join(' ')}
          >
            Bagian Utama
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex flex-col items-center gap-3 px-5 py-5 bg-zinc-100">

        {/* Margin labels — atas */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-400 tabular-nums">
            ↑ {marginTop} cm
          </span>
        </div>

        {/* Page + margin left/right labels */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-400 tabular-nums whitespace-nowrap">
            ← {marginLeft} cm
          </span>

          {/*
           * Wrapper sized to the VISUAL (scaled) dimensions so the document
           * flow respects the 105×148.5px footprint, not the original 210×297px.
           * The inner div is scaled from its top-left corner to fill the wrapper.
           */}
          <div
            style={{
              width: PAGE_W / 2,
              height: PAGE_H / 2,
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
          <div
            aria-label={`Pratinjau halaman A4 — ${section === 'front' ? 'bagian awal' : 'bagian utama'}`}
            style={{
              width: PAGE_W,
              height: PAGE_H,
              transform: 'scale(0.5)',
              transformOrigin: 'top left',
            }}
          >
            {/* Paper */}
            <div
              style={{
                width: '100%',
                height: '100%',
                background: '#fff',
                boxShadow: '0 2px 12px rgba(0,0,0,0.13)',
                position: 'relative',
                overflow: 'hidden',
                fontFamily: `"${fontFamily}", serif`,
              }}
            >
              {/* Margin guides (subtle lines) */}
              <div
                style={{
                  position: 'absolute',
                  left: pLeft,
                  right: pRight,
                  top: pTop,
                  bottom: pBottom,
                  border: '0.5px dashed rgba(99,102,241,0.25)',
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              />

              {/* Content area */}
              <div
                style={{
                  position: 'absolute',
                  left: pLeft,
                  right: pRight,
                  top: pTop,
                  bottom: pBottom,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                {/* Top page number (if position is top) */}
                {isTopNumber && (
                  <div
                    style={{
                      ...pageNumStyle,
                      fontSize: previewFontSize,
                      fontFamily: `"${fontFamily}", serif`,
                      color: '#374151',
                      marginBottom: 3,
                      lineHeight: 1.4,
                    }}
                  >
                    {pageNum}
                  </div>
                )}

                {/* Chapter title */}
                <div
                  style={{
                    width: '100%',
                    textAlign: titleAlignCSS,
                    fontSize: previewFontSize + 1,
                    fontWeight: 'bold',
                    fontFamily: `"${fontFamily}", serif`,
                    color: '#111827',
                    marginBottom: lineHeightPx * 0.8,
                    lineHeight: 1.4,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {displayTitle}
                </div>

                {/* Body text lines */}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  {chapterContent === 'lorem'
                    ? LOREM_LINES.map((text, i) => (
                        <div
                          key={i}
                          style={{
                            height: previewFontSize,
                            marginBottom: lineHeightPx - previewFontSize,
                            fontSize: previewFontSize,
                            fontFamily: `"${fontFamily}", serif`,
                            color: 'rgba(55,65,81,0.75)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'clip',
                            lineHeight: 1,
                          }}
                        >
                          {text}
                        </div>
                      ))
                    : BODY_LINES.map((widthPct, i) => {
                        const isLastLine = i === BODY_LINES.length - 1
                        const lineWidth = isLastLine ? widthPct * 0.6 : widthPct
                        return (
                          <div
                            key={i}
                            style={{
                              height: previewFontSize,
                              marginBottom: lineHeightPx - previewFontSize,
                              width: `${lineWidth}%`,
                              borderRadius: 1,
                              background: 'rgba(200,200,200,0.35)',
                            }}
                          />
                        )
                      })
                  }
                </div>

                {/* Bottom page number */}
                {!isTopNumber && (
                  <div
                    style={{
                      ...pageNumStyle,
                      fontSize: previewFontSize,
                      fontFamily: `"${fontFamily}", serif`,
                      color: '#374151',
                      marginTop: 3,
                      lineHeight: 1.4,
                    }}
                  >
                    {pageNum}
                  </div>
                )}
              </div>
            </div>
          </div>{/* end scaled inner */}
          </div>{/* end scaling wrapper */}

          <span className="text-[10px] text-zinc-400 tabular-nums whitespace-nowrap">
            {marginRight} cm →
          </span>
        </div>

        {/* Margin label — bawah */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-400 tabular-nums">
            ↓ {marginBottom} cm
          </span>
        </div>

        {/* Info strip */}
        <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px] text-zinc-400">
          <span>Font: <strong className="text-zinc-600">{fontFamily}</strong></span>
          <span>Ukuran: <strong className="text-zinc-600">{fontSize} pt</strong></span>
          <span>Spasi: <strong className="text-zinc-600">{isNaN(lineSpacing) ? '—' : lineSpacing}×</strong></span>
          <span>Nomor: <strong className="text-zinc-600">{pageNumPos}</strong></span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
      <span className="font-medium text-zinc-600">Keterangan:</span>
      <span className="flex items-center gap-1.5">
        <SourceBadge source="ai_extraction" />
        <span>— aturan eksplisit dari dokumen</span>
      </span>
      <span className="flex items-center gap-1.5">
        <SourceBadge source="docx_property_fallback" />
        <span>— saran dari setting file .docx (perlu verifikasi)</span>
      </span>
      <span className="flex items-center gap-1.5">
        <SourceBadge source="default" />
        <span>— tidak terdeteksi, nilai default dipakai</span>
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ReviewPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<FieldGroup[]>(loadInitialGroups)
  const [previewSection, setPreviewSection] = useState<PreviewSection>('main')
  const [chapterContent, setChapterContent] = useState<ChapterContent>('lorem')
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  /** H1: 'real' jika data berasal dari hasil ekstraksi, 'dummy' jika tidak ada sessionStorage */
  const [dataSource, setDataSource] = useState<'real' | 'dummy'>('dummy')

  // H1: deteksi apakah data real tersedia (harus dijalankan di client)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(EXTRACTION_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.rules) {
          setDataSource('real')
        }
      }
    } catch {
      // sessionStorage tidak tersedia — tetap 'dummy'
    }
  }, [])

  async function handleDownload() {
    setDownloadError(null)
    setIsDownloading(true)

    // Kumpulkan semua field ke flat object
    const rulesFlat: Record<string, string | number> = {}
    for (const group of groups) {
      for (const field of group.fields) {
        rulesFlat[field.key] = field.value
      }
    }

    // Konversi field numerik ke number
    const numericFields = [
      'margin_left_cm', 'margin_right_cm', 'margin_top_cm', 'margin_bottom_cm',
      'font_size', 'line_spacing',
    ]
    const rules: Record<string, string | number> = {}
    for (const [k, v] of Object.entries(rulesFlat)) {
      rules[k] = numericFields.includes(k) ? Number(v) : v
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30_000)

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules, content: chapterContent }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: 'Gagal membuat dokumen.' }))
        throw new Error((json as { error?: string }).error ?? 'Gagal membuat dokumen.')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'template-docuforma.docx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      // H1: bersihkan sessionStorage setelah download berhasil — alur selesai
      try { sessionStorage.removeItem(EXTRACTION_STORAGE_KEY) } catch { /* noop */ }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setDownloadError('Waktu habis. Silakan coba lagi.')
      } else {
        const msg = err instanceof Error ? err.message : 'Terjadi kesalahan. Coba lagi.'
        setDownloadError(msg)
      }
    } finally {
      setIsDownloading(false)
    }
  }

  function handleFieldChange(groupId: string, key: string, value: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              fields: g.fields.map((f) => (f.key === key ? { ...f, value } : f)),
            },
      ),
    )
  }

  // Total summary counts
  const allFields = groups.flatMap((g) => g.fields)
  const totalDetected = allFields.filter((f) => f.source === 'ai_extraction').length
  const totalFallback = allFields.filter((f) => f.source === 'docx_property_fallback').length
  const totalDefault = allFields.filter((f) => f.source === 'default').length

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10">
      {/* Outer container: wider to accommodate 2-column layout */}
      <div className="mx-auto max-w-6xl">

        {/* Page header — full width above both columns */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Review Aturan Format
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500 leading-relaxed">
            Periksa dan koreksi aturan yang terdeteksi dari dokumen pedoman.
            Field yang tidak terdeteksi sudah diisi nilai default — silakan ubah jika perlu.
          </p>
        </div>

        {/* H1: banner saat halaman dibuka tanpa data ekstraksi (navigasi langsung ke /review) */}
        {dataSource === 'dummy' && (
          <div
            role="status"
            className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
          >
            <svg
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-500"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
              />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">Menampilkan data contoh</p>
              <p className="mt-0.5 text-xs text-amber-700 leading-snug">
                Halaman ini dibuka tanpa hasil ekstraksi. Unggah dokumen pedoman terlebih dahulu
                untuk melihat aturan format yang terdeteksi.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 active:bg-amber-800 transition-colors"
            >
              Upload dokumen
            </button>
          </div>
        )}

        {/*
         * Two-column grid on md+ screens.
         * Left  col (1fr)  : form fields — scrollable.
         * Right col (auto) : preview panel — sticky.
         * On mobile (<md)  : single stack, preview first (order-first).
         */}
        <div className="md:grid md:grid-cols-[1fr_auto] md:items-start md:gap-8">

          {/* ── LEFT COLUMN: form ── */}
          <div className="space-y-6 md:order-2">

            {/* Summary chips */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-medium text-green-700">
                <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" stroke="#16a34a" strokeWidth="1.5" />
                  <path d="M4.5 7 6.5 9l3-4" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {totalDetected} terdeteksi AI
              </div>
              {totalFallback > 0 && (
                <div className="flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700">
                  <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6" stroke="#2563eb" strokeWidth="1.5" />
                    <path d="M7 6v4M7 4.5h.01" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  {totalFallback} saran file
                </div>
              )}
              <div className="flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-medium text-amber-700">
                <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" stroke="#d97706" strokeWidth="1.5" />
                  <path d="M7 4.5v3M7 9.5h.01" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {totalDefault} default
              </div>
            </div>

            {/* Legend */}
            <Legend />

            {/* Accuracy disclaimer banner */}
            <div
              role="note"
              className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3"
            >
              <svg
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0 text-amber-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                />
              </svg>
              <p className="text-sm text-amber-800 leading-relaxed">
                Hasil ekstraksi AI ini belum tentu 100% akurat — terutama untuk dokumen yang
                formatnya tidak standar atau memuat beberapa aturan berbeda. Periksa kutipan
                (<em>source_quote</em>) di setiap field yang bertanda{' '}
                <strong>Terdeteksi</strong>, dan cocokkan manual ke dokumen pedoman asli
                sebelum download.
              </p>
            </div>

            {/* Field groups */}
            {groups.map((group) => (
              <FieldGroupCard
                key={group.id}
                group={group}
                onFieldChange={handleFieldChange}
              />
            ))}

            {/* Action row — Upload ulang + Download */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 pb-4">
              {/* Download error banner */}
              {downloadError && (
                <div
                  role="alert"
                  className="w-full flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
                >
                  <svg aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" clipRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-.75-8.75a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5ZM10 7a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
                  </svg>
                  <span>{downloadError}</span>
                  <button
                    type="button"
                    aria-label="Tutup pesan error"
                    onClick={() => setDownloadError(null)}
                    className="ml-auto shrink-0 text-red-400 hover:text-red-600"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Chapter content toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600">Isi bab:</span>
                <div
                  role="group"
                  aria-label="Pilih isi bab di pratinjau"
                  className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 text-xs font-medium"
                >
                  <button
                    type="button"
                    onClick={() => setChapterContent('lorem')}
                    aria-pressed={chapterContent === 'lorem'}
                    className={[
                      'rounded-md px-3 py-1 transition-colors',
                      chapterContent === 'lorem'
                        ? 'bg-white text-zinc-900 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-700',
                    ].join(' ')}
                  >
                    Lorem ipsum
                  </button>
                  <button
                    type="button"
                    onClick={() => setChapterContent('empty')}
                    aria-pressed={chapterContent === 'empty'}
                    className={[
                      'rounded-md px-3 py-1 transition-colors',
                      chapterContent === 'empty'
                        ? 'bg-white text-zinc-900 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-700',
                    ].join(' ')}
                  >
                    Kosong
                  </button>
                </div>
              </div>

              {/* Right side: Upload ulang + Download */}
              <div className="flex items-center gap-3">
                {/* Upload ulang — navigates back to the upload page */}
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 active:bg-zinc-100 transition-colors"
                >
                  <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" clipRule="evenodd" d="M9.707 16.707a1 1 0 0 1-1.414 0l-6-6a1 1 0 0 1 0-1.414l6-6a1 1 0 0 1 1.414 1.414L5.414 9H17a1 1 0 1 1 0 2H5.414l4.293 4.293a1 1 0 0 1 0 1.414Z" />
                  </svg>
                  Upload ulang
                </button>

                {/* Download — Spec F1: dihubungkan ke /api/generate */}
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  aria-disabled={isDownloading}
                  aria-label={isDownloading ? 'Sedang membuat dokumen…' : 'Download template .docx'}
                  className={[
                    'inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors',
                    isDownloading
                      ? 'bg-indigo-400 cursor-not-allowed opacity-70'
                      : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 cursor-pointer',
                  ].join(' ')}
                >
                  {isDownloading ? (
                    <>
                      <svg
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Membuat…
                    </>
                  ) : (
                    <>
                      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
                        <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                      </svg>
                      Download .docx
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>{/* end left column */}

          {/* ── RIGHT COLUMN: preview (sticky) ── */}
          {/*
           * On mobile this renders first (order-1 < order-2) as a normal block.
           * On md+ it becomes a sticky sidebar aligned to the top of the viewport
           * while the left column scrolls past it.
           */}
          <div className="mb-6 md:mb-0 md:order-1 md:sticky md:top-6 md:w-72">
            <PreviewPanel
              groups={groups}
              section={previewSection}
              onSectionChange={setPreviewSection}
              chapterContent={chapterContent}
            />
          </div>{/* end right column */}

        </div>{/* end grid */}
      </div>{/* end outer container */}
    </main>
  )
}
