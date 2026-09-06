import { Wand2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Outfit, ProductCard, TryOnState } from '@/lib/fitme'
import { safeHex } from '@/lib/fitme'
import { ProductRow } from './ProductRow'

type Props = {
  outfit: Outfit
  tryon?: TryOnState
  hasFace: boolean
  onGenerateTryOn: () => void
}

export function OutfitView({ outfit, tryon, hasFace, onGenerateTryOn }: Props) {
  const isLoading = !!tryon?.loading
  const image = tryon?.image
  const err = tryon?.error

  return (
    <div className='grid grid-cols-1 gap-6 lg:grid-cols-12'>
      <div className='space-y-5 lg:col-span-5'>
        <div className='glass-panel rounded-[30px] p-5'>
          <div className='glass-chip px-3 text-[10px] uppercase tracking-[0.18em]'>
            <span>Day {outfit.day_index}</span>
            <span className='text-[color:var(--accent)]'>·</span>
            <span>{outfit.vibe}</span>
          </div>
          <h2 className='mt-4 text-[28px] font-light leading-tight tracking-[-0.05em] text-[color:var(--text)]'>
            {outfit.title}
          </h2>
        </div>

        <div className='glass-panel overflow-hidden rounded-[30px]'>
          <div className='relative aspect-[3/4] w-full bg-[linear-gradient(180deg,#ffffff,rgba(177,227,255,0.30))]'>
            {image ? (
              <img
                src={image}
                alt='AI 试穿图'
                className='h-full w-full object-cover'
              />
            ) : isLoading ? (
              <div className='absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-[color:var(--text-2)]'>
                <Loader2 className='h-5 w-5 animate-spin text-[color:var(--accent)]' />
                <span>生成中</span>
              </div>
            ) : (
              <div className='absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-[color:var(--text-3)]'>
                {hasFace ? '未生成试穿图' : '上传照片以生成试穿图'}
              </div>
            )}
          </div>
          <div className='flex items-center justify-between gap-3 border-t border-white/70 px-4 py-3'>
            <span className='text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-3)]'>
              Try-on
            </span>
            <Button
              size='sm'
              variant='secondary'
              className='h-8 gap-1.5 px-3 text-xs disabled:text-[color:var(--text-3)]'
              onClick={onGenerateTryOn}
              disabled={isLoading || !hasFace}
            >
              <Wand2 className='h-3.5 w-3.5' />
              {image ? '重新生成' : '生成试穿图'}
            </Button>
          </div>
          {err ? (
            <div className='border-t border-orange-200 bg-orange-50/80 px-4 py-2 text-xs text-[color:var(--danger)]'>
              {err}
            </div>
          ) : null}
        </div>

        <ColorSystem outfit={outfit} />
      </div>

      <div className='lg:col-span-7'>
        <div className='mb-4 flex items-center justify-between gap-4'>
          <span className='glass-chip px-3 text-[10px] uppercase tracking-[0.18em]'>
            Items · {outfit.items?.length || 0}
          </span>
          {outfit.reason ? (
            <span className='max-w-[65%] truncate text-right text-xs text-[color:var(--text-2)]'>
              {outfit.reason}
            </span>
          ) : null}
        </div>
        <div className='space-y-4'>
          {(outfit.items || []).map((it) => (
            <ItemBlock
              key={`${it.name}-${it.category}-${it.color}`}
              name={it.name}
              category={it.category}
              color={it.color}
              fit={it.fit}
              material={it.material}
              products={it.products}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ColorSystem({ outfit }: { outfit: Outfit }) {
  const primary = outfit.colors?.primary || []
  const accent = outfit.colors?.accent || []
  const avoid = outfit.colors?.avoid || []

  return (
    <div className='glass-card rounded-[28px] p-5'>
      <div className='text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-3)]'>
        Palette
      </div>
      <div className='mt-4 space-y-4'>
        <ColorRow label='Primary' colors={primary} />
        <ColorRow label='Accent' colors={accent} />
        {avoid.length ? (
          <div>
            <div className='text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-3)]'>
              Avoid
            </div>
            <div className='mt-2 flex flex-wrap gap-2'>
              {avoid.map((t) => (
                <span key={t} className='glass-chip min-h-[30px] px-3 py-1 text-[11px]'>
                  {t}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ColorRow({ label, colors }: { label: string; colors: string[] }) {
  if (!colors.length) return null
  return (
    <div>
      <div className='text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-3)]'>
        {label}
      </div>
      <div className='mt-2 flex flex-wrap gap-2'>
        {colors.map((c) => (
          <span key={`${label}-${c}`} className='glass-chip min-h-[34px] gap-2 px-3 py-1 text-[11px] text-[color:var(--text)]'>
            <span
              className='h-3.5 w-3.5 rounded-full border border-white/80 shadow-sm'
              style={{ background: safeHex(c) }}
            />
            <span className='font-mono text-[10px] uppercase text-[color:var(--text-2)]'>
              {c}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

function ItemBlock(props: {
  name: string
  category: string
  color: string
  fit: string
  material: string
  products?: ProductCard[]
}) {
  const products = props.products || []
  const grouped = products.reduce<Record<string, ProductCard[]>>((acc, p) => {
    const k = p.platform || '其他'
    acc[k] = acc[k] || []
    acc[k].push(p)
    return acc
  }, {})

  return (
    <div className='glass-card rounded-[28px] p-5'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <div className='text-[18px] font-medium tracking-[-0.02em] text-[color:var(--text)]'>{props.name}</div>
          <div className='mt-2 flex flex-wrap gap-2 text-xs text-[color:var(--text-2)]'>
            {[props.category, props.color, props.fit, props.material].map((item) => (
              <span key={item} className='glass-chip min-h-[28px] px-3 py-0.5 text-[11px]'>
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {products.length ? (
        <div className='mt-5 space-y-4'>
          {Object.entries(grouped).map(([platform, list]) => (
            <div key={platform}>
              <div className='mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-3)]'>
                <span>{platform}</span>
                <span className='text-[color:var(--accent)]'>·</span>
                <span className='font-mono text-[10px]'>
                  {Math.min(list.length, 5)}/{list.length}
                </span>
              </div>
              <div className='grid grid-cols-1 gap-3 xl:grid-cols-2'>
                {list.slice(0, 5).map((p) => (
                  <ProductRow key={p.buy_url || p.title} p={p} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
