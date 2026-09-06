import type { CSSProperties } from 'react'

import type { ColorSwatch, SeasonBlock, StyleReport } from '@/lib/fitme'
import { safeHex } from '@/lib/fitme'

const PDF_THEME = {
  page: '#F6F1E7',
  surface: '#FBF7EF',
  surfaceMuted: '#F1EBDE',
  border: '#E2D9C8',
  borderStrong: '#D5C9B2',
  text: '#1B1A17',
  textMuted: '#6B655C',
  textSoft: '#968E84',
  accent: '#0a0a0a',
}

type Props = {
  report: StyleReport
  userName?: string
  generatedAt?: Date
}

export function ReportPdfDocument({
  report,
  userName = '孔琳凯',
  generatedAt = new Date(),
}: Props) {
  const displayDate = `${generatedAt.getFullYear()}.${String(generatedAt.getMonth() + 1).padStart(2, '0')}.${String(generatedAt.getDate()).padStart(2, '0')}`

  return (
    <div
      style={{
        width: 794,
        background: PDF_THEME.page,
        color: PDF_THEME.text,
        padding: '40px 38px 48px',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <section
        data-pdf-section
        style={{
          border: `1px solid ${PDF_THEME.borderStrong}`,
          borderRadius: 10,
          background: 'linear-gradient(180deg, #FCF8F1 0%, #F6F1E7 100%)',
          padding: '28px 30px 26px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 24,
            borderBottom: `1px solid ${PDF_THEME.border}`,
            paddingBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                fontFamily:
                  'Archivo, "Noto Sans SC", system-ui, sans-serif',
                fontSize: 34,
                fontStyle: 'italic',
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              fitme
            </div>
            <div
              style={{
                marginTop: 14,
                fontFamily:
                  'Archivo, "Noto Sans SC", system-ui, sans-serif',
                fontSize: 30,
                lineHeight: 1.18,
                letterSpacing: '-0.02em',
              }}
            >
              个人穿搭报告
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: PDF_THEME.accent,
              }}
            >
              Style Report
            </div>
          </div>
          <div style={{ minWidth: 220, textAlign: 'right' }}>
            <MetaLabel label='用户' value={userName} />
            <MetaLabel label='生成日期' value={displayDate} />
            <MetaLabel label='报告编号' value={report.report_id || '—'} compact />
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          <SectionHeading title='整体气质总结' subtitle='Summary' />
          <p
            style={{
              margin: '14px 0 0',
              fontFamily:
                'Archivo, "Noto Sans SC", system-ui, sans-serif',
              fontSize: 24,
              lineHeight: 1.6,
              color: PDF_THEME.text,
            }}
          >
            {report.summary || '—'}
          </p>
        </div>
      </section>

      <section data-pdf-section style={{ marginTop: 24 }}>
        <SectionHeading title='体型分析' subtitle='Body analysis' />
        <div
          style={{
            marginTop: 14,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 1,
            background: PDF_THEME.border,
            border: `1px solid ${PDF_THEME.border}`,
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <FactCard title='Shape' value={report.body_analysis?.shape} />
          <FactCard title='Proportion' value={report.body_analysis?.proportion} />
          <BulletCard title='Strengths' items={report.body_analysis?.strengths} />
          <BulletCard title='Cautions' items={report.body_analysis?.cautions} muted />
        </div>
      </section>

      <section data-pdf-section style={{ marginTop: 24 }}>
        <SectionHeading title='色彩方案' subtitle='Color palette' />
        <div
          style={{
            marginTop: 14,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 14,
          }}
        >
          <PaletteCard title='Best' swatches={report.color_palette?.best} />
          <PaletteCard title='Accent' swatches={report.color_palette?.accent} />
          <PaletteCard title='Avoid' swatches={report.color_palette?.avoid} avoid />
        </div>
      </section>

      <section data-pdf-section style={{ marginTop: 24 }}>
        <SectionHeading title='版型建议' subtitle='Silhouette' />
        <div
          style={{
            marginTop: 14,
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: 1,
            background: PDF_THEME.border,
            border: `1px solid ${PDF_THEME.border}`,
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <ListBlock title='Tops' items={report.silhouette?.tops} />
          <ListBlock title='Bottoms' items={report.silhouette?.bottoms} />
          <ListBlock title='Outerwear' items={report.silhouette?.outerwear} />
          <ListBlock title='Shoes' items={report.silhouette?.shoes} />
          <ListBlock title='Avoid' items={report.silhouette?.avoid_fits} muted />
        </div>
      </section>

      <section data-pdf-section style={{ marginTop: 24 }}>
        <SectionHeading title='四季穿搭建议' subtitle='Seasonal edit' />
        <div
          style={{
            marginTop: 14,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 14,
          }}
        >
          <SeasonPdfCard name='Spring' data={report.seasonal?.spring} />
          <SeasonPdfCard name='Summer' data={report.seasonal?.summer} />
          <SeasonPdfCard name='Autumn' data={report.seasonal?.autumn} />
          <SeasonPdfCard name='Winter' data={report.seasonal?.winter} />
        </div>
      </section>

      <section data-pdf-section style={{ marginTop: 24 }}>
        <SectionHeading title='风格关键词' subtitle='Style keywords' />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {(report.style_keywords || []).length ? (
            report.style_keywords.map((keyword) => (
              <span
                key={keyword}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '7px 12px',
                  borderRadius: 999,
                  border: `1px solid ${PDF_THEME.borderStrong}`,
                  background: PDF_THEME.surface,
                  fontSize: 12,
                  letterSpacing: '0.04em',
                  color: PDF_THEME.text,
                }}
              >
                {keyword}
              </span>
            ))
          ) : (
            <EmptyText />
          )}
        </div>
      </section>
    </div>
  )
}

function MetaLabel({
  label,
  value,
  compact,
}: {
  label: string
  value: string
  compact?: boolean
}) {
  return (
    <div style={{ marginTop: compact ? 8 : 10 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: PDF_THEME.textSoft,
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 4, fontSize: compact ? 11 : 13, color: PDF_THEME.text }}>
        {value}
      </div>
    </div>
  )
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: 'Archivo, "Noto Sans SC", system-ui, sans-serif',
            fontSize: 24,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            color: PDF_THEME.accent,
          }}
        >
          {subtitle}
        </div>
      </div>
      <div style={{ height: 1, flex: 1, background: PDF_THEME.border }} />
    </div>
  )
}

function FactCard({ title, value }: { title: string; value?: string }) {
  return (
    <div style={{ background: PDF_THEME.surface, padding: 18, minHeight: 118 }}>
      <div style={smallLabelStyle}>{title}</div>
      <div
        style={{
          marginTop: 10,
          fontFamily: 'Archivo, "Noto Sans SC", system-ui, sans-serif',
          fontSize: 20,
          lineHeight: 1.35,
        }}
      >
        {value || '—'}
      </div>
    </div>
  )
}

function BulletCard({
  title,
  items,
  muted,
}: {
  title: string
  items?: string[]
  muted?: boolean
}) {
  return (
    <div style={{ background: PDF_THEME.surface, padding: 18 }}>
      <div style={smallLabelStyle}>{title}</div>
      <BulletList items={items} muted={muted} />
    </div>
  )
}

function PaletteCard({
  title,
  swatches,
  avoid,
}: {
  title: string
  swatches?: ColorSwatch[]
  avoid?: boolean
}) {
  const list = swatches || []

  return (
    <div
      style={{
        border: `1px solid ${PDF_THEME.border}`,
        borderRadius: 10,
        background: PDF_THEME.surface,
        padding: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={smallLabelStyle}>{title}</div>
        <div style={{ fontSize: 10, color: PDF_THEME.textSoft }}>{String(list.length).padStart(2, '0')}</div>
      </div>
      <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
        {list.length ? list.map((swatch) => <SwatchCard key={`${swatch.name}-${swatch.hex}-${swatch.note || ''}`} swatch={swatch} avoid={avoid} />) : <EmptyText />}
      </div>
    </div>
  )
}

function SwatchCard({ swatch, avoid }: { swatch: ColorSwatch; avoid?: boolean }) {
  const hex = safeHex(swatch.hex)

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 10,
          border: `1px solid ${PDF_THEME.border}`,
          background: hex,
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          opacity: avoid ? 0.82 : 1,
        }}
      >
        {avoid ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'repeating-linear-gradient(45deg, rgba(27, 26, 23, 0.24) 0 1px, transparent 1px 7px)',
            }}
          />
        ) : null}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: PDF_THEME.text }}>{swatch.name || '未命名'}</div>
          <div style={{ fontSize: 11, color: PDF_THEME.textMuted, textTransform: 'uppercase' }}>{swatch.hex || '—'}</div>
        </div>
        <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.55, color: PDF_THEME.textMuted }}>
          {swatch.note || '—'}
        </div>
      </div>
    </div>
  )
}

function ListBlock({
  title,
  items,
  muted,
}: {
  title: string
  items?: string[]
  muted?: boolean
}) {
  return (
    <div style={{ background: PDF_THEME.surface, padding: 18 }}>
      <div style={smallLabelStyle}>{title}</div>
      <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none' }}>
        {(items || []).length ? (
          (items || []).map((item, index) => (
            <li
              key={item}
              style={{
                fontSize: 13,
                lineHeight: 1.5,
                color: muted ? PDF_THEME.textSoft : PDF_THEME.text,
                textDecoration: muted ? 'line-through' : 'none',
                textDecorationColor: muted ? PDF_THEME.borderStrong : undefined,
                marginTop: index === 0 ? 0 : 6,
              }}
            >
              {item}
            </li>
          ))
        ) : (
          <EmptyText as='li' />
        )}
      </ul>
    </div>
  )
}

function SeasonPdfCard({ name, data }: { name: string; data?: SeasonBlock }) {
  const block = data || { vibe: '', key_items: [], fabrics: [], colors: [] }

  return (
    <div
      style={{
        border: `1px solid ${PDF_THEME.border}`,
        borderRadius: 10,
        background: PDF_THEME.surface,
        padding: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
        <div
          style={{
            fontFamily: 'Archivo, "Noto Sans SC", system-ui, sans-serif',
            fontSize: 24,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
          }}
        >
          {name}
        </div>
        <div style={{ maxWidth: '58%', textAlign: 'right', fontSize: 12, lineHeight: 1.5, color: PDF_THEME.textMuted }}>
          {block.vibe || '—'}
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 14,
          marginTop: 18,
        }}
      >
        <MiniList title='Items' items={block.key_items} />
        <MiniList title='Fabrics' items={block.fabrics} />
        <MiniList title='Colors' items={block.colors} />
      </div>
    </div>
  )
}

function MiniList({ title, items }: { title: string; items?: string[] }) {
  return (
    <div>
      <div style={smallLabelStyle}>{title}</div>
      <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none' }}>
        {(items || []).length ? (
          (items || []).map((item, index) => (
            <li
              key={item}
              style={{
                fontSize: 12,
                lineHeight: 1.55,
                color: PDF_THEME.text,
                marginTop: index === 0 ? 0 : 5,
              }}
            >
              {item}
            </li>
          ))
        ) : (
          <EmptyText as='li' />
        )}
      </ul>
    </div>
  )
}

function BulletList({ items, muted }: { items?: string[]; muted?: boolean }) {
  if (!(items || []).length) {
    return <EmptyText />
  }

  return (
    <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none' }}>
      {(items || []).map((item, index) => (
        <li
          key={item}
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
            marginTop: index === 0 ? 0 : 8,
            fontSize: 13,
            lineHeight: 1.6,
            color: muted ? PDF_THEME.textMuted : PDF_THEME.text,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: muted ? PDF_THEME.textSoft : PDF_THEME.accent,
              marginTop: 7,
              flexShrink: 0,
            }}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function EmptyText({ as = 'div' }: { as?: 'div' | 'li' }) {
  const Tag = as
  return <Tag style={{ fontSize: 12, color: PDF_THEME.textSoft }}>—</Tag>
}

const smallLabelStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: PDF_THEME.textSoft,
}
