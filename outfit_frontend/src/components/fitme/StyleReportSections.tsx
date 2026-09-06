import type { ReactNode } from 'react'

import type { ColorSwatch, SeasonBlock, StyleReport } from '@/lib/fitme'
import { safeHex } from '@/lib/fitme'

type Props = {
  report: StyleReport
}

export function StyleReportSections({ report }: Props) {
  return (
    <>
      <section className='glass-panel rounded-[30px] p-5 sm:p-6'>
        <SectionLabel>Summary</SectionLabel>
        <p className='mt-4 max-w-[62ch] font-serif text-[22px] leading-[1.55] tracking-[-0.005em] text-[color:var(--text)]'>
          {report.summary}
        </p>
      </section>

      <section className='glass-panel rounded-[30px] p-5 sm:p-6'>
        <SectionLabel>Body analysis</SectionLabel>
        <div className='mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          <AnalysisCell k='Shape' v={report.body_analysis?.shape} />
          <AnalysisCell k='Proportion' v={report.body_analysis?.proportion} />
          <AnalysisList k='Strengths' items={report.body_analysis?.strengths} />
          <AnalysisList k='Cautions' items={report.body_analysis?.cautions} tone='muted' />
        </div>
      </section>

      <section className='glass-panel rounded-[30px] p-5 sm:p-6'>
        <SectionLabel>Color palette</SectionLabel>
        <div className='mt-5 grid grid-cols-1 gap-6 lg:grid-cols-3'>
          <PaletteBlock title='Best' swatches={report.color_palette?.best} tone='primary' />
          <PaletteBlock title='Accent' swatches={report.color_palette?.accent} tone='accent' />
          <PaletteBlock title='Avoid' swatches={report.color_palette?.avoid} tone='avoid' />
        </div>
      </section>

      <section className='glass-panel rounded-[30px] p-5 sm:p-6'>
        <SectionLabel>Silhouette</SectionLabel>
        <div className='mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5'>
          <SilList k='Tops' items={report.silhouette?.tops} />
          <SilList k='Bottoms' items={report.silhouette?.bottoms} />
          <SilList k='Outerwear' items={report.silhouette?.outerwear} />
          <SilList k='Shoes' items={report.silhouette?.shoes} />
          <SilList k='Avoid' items={report.silhouette?.avoid_fits} tone='muted' />
        </div>
      </section>

      <section className='glass-panel rounded-[30px] p-5 sm:p-6'>
        <SectionLabel>Seasonal</SectionLabel>
        <div className='mt-5 grid grid-cols-1 gap-4 md:grid-cols-2'>
          <SeasonCard name='Spring' data={report.seasonal?.spring} />
          <SeasonCard name='Summer' data={report.seasonal?.summer} />
          <SeasonCard name='Autumn' data={report.seasonal?.autumn} />
          <SeasonCard name='Winter' data={report.seasonal?.winter} />
        </div>
      </section>

      <section className='glass-panel rounded-[30px] p-5 sm:p-6'>
        <SectionLabel>Style keywords</SectionLabel>
        <div className='mt-4 flex flex-wrap gap-2'>
          {(report.style_keywords || []).map((keyword) => (
            <span
              key={keyword}
              className='glass-chip min-h-[32px] px-3 py-1 text-xs tracking-wide text-[color:var(--text)]'
            >
              {keyword}
            </span>
          ))}
        </div>
      </section>
    </>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className='flex items-center gap-3'>
      <span className='glass-chip px-3 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-2)]'>
        {children}
      </span>
      <span className='h-px flex-1 bg-[color:var(--hairline)]' />
    </div>
  )
}

function AnalysisCell({ k, v }: { k: string; v?: string }) {
  return (
    <div className='rounded-[22px] border border-white/70 bg-white/54 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-xl'>
      <div className='text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-3)]'>{k}</div>
      <div className='mt-2 font-serif text-[17px] leading-snug text-[color:var(--text)]'>
        {v || '—'}
      </div>
    </div>
  )
}

function AnalysisList({
  k,
  items,
  tone,
}: {
  k: string
  items?: string[]
  tone?: 'muted'
}) {
  const list = items || []

  return (
    <div className='rounded-[22px] border border-white/70 bg-white/54 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-xl'>
      <div className='text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-3)]'>{k}</div>
      <ul className='mt-2 space-y-1'>
        {list.length ? (
          list.map((item) => (
            <li
              key={item}
              className={
                'flex items-start gap-2 text-[14px] leading-relaxed ' +
                (tone === 'muted' ? 'text-[color:var(--text-2)]' : 'text-[color:var(--text)]')
              }
            >
              <span
                className='mt-2 h-1 w-1 shrink-0 rounded-[2px]'
                style={{ background: tone === 'muted' ? 'var(--text-3)' : 'var(--accent)' }}
              />
              <span>{item}</span>
            </li>
          ))
        ) : (
          <li className='text-sm text-[color:var(--text-3)]'>—</li>
        )}
      </ul>
    </div>
  )
}

function PaletteBlock({
  title,
  swatches,
  tone,
}: {
  title: string
  swatches?: ColorSwatch[]
  tone: 'primary' | 'accent' | 'avoid'
}) {
  const list = swatches || []

  return (
    <div className='glass-card rounded-[24px] p-5'>
      <div className='flex items-baseline justify-between'>
        <div className='text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-3)]'>
          {title}
        </div>
        <div className='font-mono text-[10px] text-[color:var(--text-3)]'>
          {String(list.length).padStart(2, '0')}
        </div>
      </div>
      <div className='mt-4 space-y-3'>
        {list.length ? (
          list.map((swatch) => (
            <SwatchRow key={`${swatch.name}-${swatch.hex}-${swatch.note || ''}`} swatch={swatch} tone={tone} />
          ))
        ) : (
          <div className='text-sm text-[color:var(--text-3)]'>—</div>
        )}
      </div>
    </div>
  )
}

function SwatchRow({
  swatch,
  tone,
}: {
  swatch: ColorSwatch
  tone: 'primary' | 'accent' | 'avoid'
}) {
  const hex = safeHex(swatch.hex)

  return (
    <div className='flex items-start gap-3'>
      <div
        className={
          'relative h-12 w-12 shrink-0 overflow-hidden rounded-[16px] border border-white/80 shadow-sm ' +
          (tone === 'avoid' ? 'opacity-80' : '')
        }
      >
        <div className='absolute inset-0' style={{ background: hex }} />
        {tone === 'avoid' ? (
          <div
            className='absolute inset-0'
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, rgba(0,0,0,0.22) 0 1px, transparent 1px 6px)',
            }}
          />
        ) : null}
      </div>
      <div className='min-w-0 flex-1'>
        <div className='flex items-baseline justify-between gap-3'>
          <div className='truncate text-[14px] font-medium text-[color:var(--text)]'>
            {swatch.name || '未命名'}
          </div>
          <div className='shrink-0 font-mono text-[11px] uppercase text-[color:var(--text-2)]'>
            {swatch.hex}
          </div>
        </div>
        {swatch.note ? (
          <div className='mt-0.5 line-clamp-2 text-xs leading-relaxed text-[color:var(--text-2)]'>
            {swatch.note}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SilList({
  k,
  items,
  tone,
}: {
  k: string
  items?: string[]
  tone?: 'muted'
}) {
  const list = items || []

  return (
    <div className='rounded-[22px] border border-white/70 bg-white/54 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-xl'>
      <div className='text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-3)]'>{k}</div>
      <ul className='mt-3 space-y-1.5'>
        {list.length ? (
          list.map((item) => (
            <li
              key={item}
              className={
                'text-[14px] leading-snug ' +
                (tone === 'muted'
                  ? 'text-[color:var(--text-3)] line-through decoration-[color:var(--text-3)]/40'
                  : 'text-[color:var(--text)]')
              }
            >
              {item}
            </li>
          ))
        ) : (
          <li className='text-sm text-[color:var(--text-3)]'>—</li>
        )}
      </ul>
    </div>
  )
}

function SeasonCard({ name, data }: { name: string; data?: SeasonBlock }) {
  const block = data || { vibe: '', key_items: [], fabrics: [], colors: [] }

  return (
    <div className='glass-card rounded-[24px] p-6'>
      <div className='flex items-baseline justify-between'>
        <div className='font-serif text-[22px] tracking-tight text-[color:var(--text)]'>
          {name}
        </div>
        <div className='max-w-[60%] truncate text-right text-xs text-[color:var(--text-2)]'>
          {block.vibe}
        </div>
      </div>
      <div className='mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3'>
        <MiniList k='Items' items={block.key_items} />
        <MiniList k='Fabrics' items={block.fabrics} />
        <MiniList k='Colors' items={block.colors} />
      </div>
    </div>
  )
}

function MiniList({ k, items }: { k: string; items?: string[] }) {
  const list = items || []

  return (
    <div>
      <div className='text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-3)]'>{k}</div>
      <ul className='mt-2 space-y-1'>
        {list.length ? (
          list.map((item) => (
            <li key={item} className='text-[13px] leading-snug text-[color:var(--text)]'>
              {item}
            </li>
          ))
        ) : (
          <li className='text-xs text-[color:var(--text-3)]'>—</li>
        )}
      </ul>
    </div>
  )
}
