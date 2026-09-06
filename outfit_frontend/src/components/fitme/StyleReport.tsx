import { useRef, useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'

import { ReportPdfDocument } from '@/components/fitme/ReportPdfDocument'
import { StyleReportSections } from '@/components/fitme/StyleReportSections'
import { exportReportPdf } from '@/lib/exportReportPdf'
import type { StyleReport } from '@/lib/fitme'

type Props = {
  report: StyleReport
}

export function StyleReportView({ report }: Props) {
  const pdfRef = useRef<HTMLDivElement | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [exportSuccess, setExportSuccess] = useState('')

  async function handleExportPdf() {
    if (!pdfRef.current || exporting) return

    try {
      setExporting(true)
      setExportError('')
      setExportSuccess('')
      await exportReportPdf(pdfRef.current)
      setExportSuccess('PDF 已下载')
    } catch (error) {
      console.error('fitme pdf export failed', error)
      setExportError('导出 PDF 失败，请稍后重试。')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <div className='space-y-6'>
        <div className='glass-panel flex flex-col gap-4 rounded-[30px] p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6'>
          <div>
            <div className='text-[10px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-3)]'>
              fitme · style report
            </div>
            <h2 className='mt-2 text-[30px] font-light leading-tight tracking-[-0.05em] text-[color:var(--text)]'>
              个人穿搭报告
            </h2>
          </div>
          <div className='flex flex-col items-start gap-2 sm:items-end'>
            <button
              type='button'
              onClick={handleExportPdf}
              disabled={exporting}
              className='btn-secondary-glass inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm transition hover:-translate-y-0.5 hover:text-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60'
            >
              {exporting ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <FileDown className='h-4 w-4' />
              )}
              <span>{exporting ? '导出中…' : '导出 PDF'}</span>
            </button>
            {exportError ? (
              <div className='text-xs text-[color:var(--danger)]'>{exportError}</div>
            ) : exportSuccess ? (
              <div className='text-xs text-black'>{exportSuccess}</div>
            ) : (
              <div className='text-xs text-[color:var(--text-3)]'>A4 · PDF 下载</div>
            )}
          </div>
        </div>

        <StyleReportSections report={report} />
      </div>

      <div
        aria-hidden='true'
        className='pointer-events-none fixed left-[-200vw] top-0 opacity-0'
      >
        <div ref={pdfRef}>
          <ReportPdfDocument report={report} />
        </div>
      </div>
    </>
  )
}
