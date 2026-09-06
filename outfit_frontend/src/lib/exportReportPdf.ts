import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const PAGE = {
  widthMm: 210,
  heightMm: 297,
  marginMm: 10,
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function buildFileName() {
  const now = new Date()
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  return `fitme-style-report-${stamp}.pdf`
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })
}

function measureSections(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-pdf-section]')).map(
    (section) => ({
      top: section.offsetTop,
      bottom: section.offsetTop + section.offsetHeight,
      height: section.offsetHeight,
    }),
  )
}

function pickPageBreak(
  sectionBounds: Array<{ top: number; bottom: number; height: number }>,
  currentTop: number,
  idealBottom: number,
  pageHeightPx: number,
) {
  const minChunk = Math.max(220, pageHeightPx * 0.22)

  const crossingSection = sectionBounds.find(
    (section) =>
      section.top < idealBottom &&
      section.bottom > idealBottom &&
      section.top - currentTop > minChunk &&
      section.height < pageHeightPx * 0.92,
  )

  if (crossingSection) {
    return crossingSection.top
  }

  return idealBottom
}

export async function exportReportPdf(container: HTMLElement) {
  if (document.fonts?.ready) {
    await document.fonts.ready
  }
  await nextFrame()

  const usableWidthMm = PAGE.widthMm - PAGE.marginMm * 2
  const usableHeightMm = PAGE.heightMm - PAGE.marginMm * 2
  const sectionBounds = measureSections(container)

  const canvas = await html2canvas(container, {
    backgroundColor: '#F6F1E7',
    scale: 2,
    useCORS: true,
    logging: false,
    windowWidth: container.scrollWidth,
    windowHeight: container.scrollHeight,
  })

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  const pageHeightPx = (canvas.width * usableHeightMm) / usableWidthMm
  const totalHeightPx = canvas.height
  let offsetY = 0
  let pageIndex = 0

  while (offsetY < totalHeightPx - 1) {
    const idealBottom = Math.min(totalHeightPx, offsetY + pageHeightPx)
    const targetBottom =
      idealBottom >= totalHeightPx
        ? totalHeightPx
        : pickPageBreak(sectionBounds, offsetY, idealBottom, pageHeightPx)

    const sliceHeight = Math.max(1, Math.floor(targetBottom - offsetY))
    const sliceCanvas = document.createElement('canvas')
    sliceCanvas.width = canvas.width
    sliceCanvas.height = sliceHeight

    const ctx = sliceCanvas.getContext('2d')
    if (!ctx) {
      throw new Error('PDF 画布初始化失败')
    }

    ctx.fillStyle = '#F6F1E7'
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)
    ctx.drawImage(
      canvas,
      0,
      offsetY,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight,
    )

    if (pageIndex > 0) {
      pdf.addPage()
    }

    const imageData = sliceCanvas.toDataURL('image/png')
    const pageHeightMm = (sliceHeight * usableWidthMm) / canvas.width
    pdf.addImage(
      imageData,
      'PNG',
      PAGE.marginMm,
      PAGE.marginMm,
      usableWidthMm,
      pageHeightMm,
      undefined,
      'FAST',
    )

    offsetY += sliceHeight
    pageIndex += 1
  }

  const fileName = buildFileName()
  pdf.save(fileName)
  return { fileName, pageCount: pageIndex }
}
