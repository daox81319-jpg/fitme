import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import type { ProductCard as Product } from '@/lib/fitme'
import { platformLabel } from '@/lib/fitme'

const CLEAN_TITLE_PATTERNS = [
  /\s*[A-Z]{0,3}\d{1,3}[A-Z]?\s*$/i,
  /\s*\d{2,3}\/\d{2,3}A?\s*$/i,
  /\s*京东自营\s*/g,
  /\s*建议\d+-\d+斤\s*/g,
]

function compactTitle(title: string) {
  let next = (title || '').trim()
  CLEAN_TITLE_PATTERNS.forEach((pattern) => {
    next = next.replace(pattern, ' ')
  })
  next = next.replace(/\s+/g, ' ').trim()
  return next.length > 34 ? `${next.slice(0, 34)}…` : next
}

export function ProductRow({ p }: { p: Product }) {
  const [imgOk, setImgOk] = useState(true)
  const title = compactTitle(p.title)

  return (
    <a
      href={p.buy_url}
      target='_blank'
      rel='noreferrer'
      className='group flex items-start gap-3 rounded-[22px] border border-white/70 bg-white/54 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--accent)]/35 hover:bg-white/72'
    >
      <div className='flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-white/80 bg-[color:var(--bg-soft)] shadow-sm'>
        {p.image_url && imgOk ? (
          <img
            src={p.image_url}
            alt={title}
            className='h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]'
            onError={() => setImgOk(false)}
          />
        ) : (
          <span className='text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-3)]'>
            {platformLabel(p.platform).slice(0, 3)}
          </span>
        )}
      </div>

      <div className='min-w-0 flex-1'>
        <div className='line-clamp-2 text-[13px] font-medium leading-5 text-[color:var(--text)] group-hover:text-[color:var(--accent)]'>
          {title}
        </div>
        {p.description ? (
          <div className='mt-1 line-clamp-1 text-[11px] leading-4 text-[color:var(--text-3)]'>
            {p.description}
          </div>
        ) : null}
        <div className='mt-2 flex items-center gap-2 text-xs'>
          <span className='font-medium text-[color:var(--text)]'>{p.price || '—'}</span>
          <span className='text-[color:var(--accent)]'>·</span>
          <span className='text-[color:var(--text-2)]'>{platformLabel(p.platform)}</span>
        </div>
      </div>

      <ArrowUpRight className='mt-1 h-4 w-4 shrink-0 text-[color:var(--text-3)] transition group-hover:text-[color:var(--accent)]' />
    </a>
  )
}
