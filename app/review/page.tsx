/**
 * app/review/page.tsx
 *
 * Spec E1 — Layout review dengan data dummy.
 * PRD v6, Bagian 4 (fitur 4 & 5), Bagian 3.4.
 *
 * Route: /review
 * Renders the ReviewPage client component.
 */

import ReviewPage from '@/components/ReviewPage'

export const metadata = {
  title: 'Review Aturan Format — DocuForma AI',
  description: 'Periksa dan koreksi aturan format yang terdeteksi dari dokumen pedoman.',
}

export default function ReviewRoute() {
  return <ReviewPage />
}
