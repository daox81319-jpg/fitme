import { useMemo, useState } from 'react'
import './App.css'

import { OutfitView } from '@/components/fitme/OutfitView'
import { FormPage } from '@/pages/FormPage'
import { SettingsSheet } from '@/components/fitme/SettingsSheet'
import { StyleReportView } from '@/components/fitme/StyleReport'
import {
  compressImageFileToDataURL,
  type Profile,
  type RecommendResponse,
  type StyleReport,
  type TryOnState,
} from '@/lib/fitme'

// 小红书穿搭灵感（来自后端缓存 /api/xiaohongshu-inspo）
type XhsNote = {
  title: string
  image_url: string
  author: string
  likes?: string
  url?: string
  keyword?: string
}

const DEFAULT_PROFILE: Profile = {
  height: '175',
  weight: '70',
  skinTone: '自然偏白',
  gender: '男',
  stylePreference: 'oversize / 街头风 / 韩系 / 机能风 / Y2K',
  occasion: '日常出街 / 周末出片',
  budget: '单品 100-500 元',
}

function useInitialApiBase() {
  const defaultApiBase =
    import.meta.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
  try {
    const u = new URL(window.location.href)
    const q = u.searchParams.get('api')
    if (q && q.trim()) return q.trim()
    const saved = window.localStorage.getItem('fitme_api_base')
    if (saved && saved.trim()) return saved.trim()
  } catch {
    // ignore
  }
  return defaultApiBase
}

export default function App() {
  const [apiBase, setApiBase] = useState<string>(useInitialApiBase)

  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE)
  const [faceImage, setFaceImage] = useState<string | null>(null)
  const [faceFileName, setFaceFileName] = useState<string>('')

  const [report, setReport] = useState<StyleReport | null>(null)
  const [plan, setPlan] = useState<RecommendResponse | null>(null)
  const [activeOutfitId, setActiveOutfitId] = useState<string>('')

  const [loadingReport, setLoadingReport] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [error, setError] = useState<string>('')

  const [tryonMap, setTryonMap] = useState<Record<string, TryOnState>>({})
  const [contentTab, setContentTab] = useState<'report' | 'plan' | 'inspo'>('plan')

  // 小红书穿搭灵感（后端缓存数据）
  const [inspoItems, setInspoItems] = useState<XhsNote[]>([])
  const [loadingInspo, setLoadingInspo] = useState(false)

  const outfits = useMemo(() => plan?.outfits || [], [plan])
  const activeOutfit = useMemo(
    () => outfits.find((o) => o.id === activeOutfitId) || outfits[0],
    [outfits, activeOutfitId],
  )

  async function handlePickImage(file: File) {
    setError('')
    const dataUrl = await compressImageFileToDataURL(file, {
      maxSide: 768,
      quality: 0.86,
    })
    setFaceImage(dataUrl)
    setFaceFileName(file.name)
  }

  function buildProfilePayload() {
    return {
      height_cm: Number(profile.height),
      weight_kg: Number(profile.weight),
      skin_tone: profile.skinTone,
      gender: profile.gender,
      style_keywords: profile.stylePreference,
      occasion: profile.occasion,
      budget: profile.budget,
    }
  }

  async function generateReport(): Promise<StyleReport | null> {
    setError('')
    setLoadingReport(true)
    setReport(null)
    setPlan(null)
    setTryonMap({})
    setActiveOutfitId('')

    try {
      const res = await fetch(`${apiBase}/api/style-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: buildProfilePayload() }),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(`${res.status} ${t.slice(0, 200)}`)
      }
      const data = (await res.json()) as StyleReport
      setReport(data)
      return data
    } catch (e) {
      setError(e instanceof Error ? e.message : '穿搭报告生成失败')
      return null
    } finally {
      setLoadingReport(false)
    }
  }

  async function generatePlan(currentReport: StyleReport): Promise<RecommendResponse | null> {
    setLoadingPlan(true)

    try {
      const payload: Record<string, unknown> = {
        profile: buildProfilePayload(),
      }
      if (currentReport?.report_id) {
        payload.report_id = currentReport.report_id
      }
      if (currentReport) {
        payload.report = {
          color_palette: currentReport.color_palette,
          silhouette: currentReport.silhouette,
          style_keywords: currentReport.style_keywords,
        }
      }

      const res = await fetch(`${apiBase}/api/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const t = await res.text()
        throw new Error(`${res.status} ${t.slice(0, 200)}`)
      }

      const data = (await res.json()) as RecommendResponse
      setPlan(data)
      setTryonMap({})
      setActiveOutfitId(data.outfits?.[0]?.id || '')
      return data
    } catch (e) {
      setError(e instanceof Error ? e.message : '一周穿搭生成失败')
      return null
    } finally {
      setLoadingPlan(false)
    }
  }

  async function generateAllTryOns(planData: RecommendResponse) {
    if (!faceImage || !planData?.plan_id) return

    const outfitIds = planData.outfits.map((o) => o.id)
    // Set all to loading
    const initMap: Record<string, TryOnState> = {}
    for (const id of outfitIds) {
      initMap[id] = { loading: true, image: '', error: '' }
    }
    setTryonMap(initMap)

    // 逐一生成：一次只请求一天，避免 7 张并发把图像服务打满、
    // 单次 serverless 调用超时（504 function_invoke_timeout）导致只生成两三张。
    // 每天生成完立即回填 UI，用户可渐进看到结果。
    for (const outfitId of outfitIds) {
      try {
        const res = await fetch(`${apiBase}/api/tryon`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan_id: planData.plan_id,
            outfit_id: outfitId,
            face_image: faceImage,
          }),
        })
        if (!res.ok) {
          const t = await res.text()
          throw new Error(`${res.status} ${t.slice(0, 200)}`)
        }
        const data = (await res.json()) as { image_data_url: string }
        setTryonMap((prev) => ({
          ...prev,
          [outfitId]: { loading: false, image: data.image_data_url, error: '' },
        }))
      } catch (e) {
        setTryonMap((prev) => ({
          ...prev,
          [outfitId]: {
            loading: false,
            image: '',
            error: e instanceof Error ? e.message : '试穿图生成失败',
          },
        }))
      }
    }
  }

  // Main submit: report → plan → try-on, all triggered automatically
  async function handleSubmit() {
    setError('')

    // Step 1: Generate report
    const reportData = await generateReport()
    if (!reportData) return

    // Step 2: Auto-generate plan from report
    const planData = await generatePlan(reportData)
    if (!planData) return
    setContentTab('plan')

    // Step 3: Auto-generate all try-on images
    if (faceImage) {
      generateAllTryOns(planData)
    }

    // Step 4: 加载小红书穿搭灵感（后端缓存数据）
    const kw = reportData?.style_keywords?.[0] || ''
    loadXiaohongshuInspo(kw)
  }

  async function generateTryOn(outfitId: string) {
    if (!plan?.plan_id) return
    if (!faceImage) {
      setError('请先上传照片')
      return
    }

    setError('')
    setTryonMap((m) => ({
      ...m,
      [outfitId]: { loading: true, image: m[outfitId]?.image, error: '' },
    }))

    try {
      const res = await fetch(`${apiBase}/api/tryon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: plan.plan_id,
          outfit_id: outfitId,
          face_image: faceImage,
        }),
      })

      if (!res.ok) {
        const t = await res.text()
        throw new Error(`${res.status} ${t.slice(0, 200)}`)
      }

      const data = (await res.json()) as { image_data_url: string }
      setTryonMap((m) => ({
        ...m,
        [outfitId]: { loading: false, image: data.image_data_url, error: '' },
      }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : '试穿图生成失败'
      setTryonMap((m) => ({
        ...m,
        [outfitId]: { loading: false, image: m[outfitId]?.image, error: msg },
      }))
    }
  }

  function resetAll() {
    setPlan(null)
    setReport(null)
    setTryonMap({})
    setError('')
    setActiveOutfitId('')
    setInspoItems([])
  }

  // 小红书穿搭灵感：读取后端缓存接口（穿搭生成后自动调用）
  async function loadXiaohongshuInspo(keyword?: string) {
    setLoadingInspo(true)
    try {
      const params = new URLSearchParams()
      if (keyword && keyword.trim()) params.set('keyword', keyword.trim())
      params.set('limit', '24')
      const res = await fetch(`${apiBase}/api/xiaohongshu-inspo?${params.toString()}`)
      if (!res.ok) {
        setInspoItems([])
        return
      }
      const data = await res.json()
      let items = (data.items || []) as XhsNote[]
      // 关键词无命中时兜底展示全量（不带 keyword 再取一次）
      if (items.length === 0 && keyword && keyword.trim()) {
        const res2 = await fetch(`${apiBase}/api/xiaohongshu-inspo?limit=24`)
        if (res2.ok) {
          const data2 = await res2.json()
          items = (data2.items || []) as XhsNote[]
        }
      }
      setInspoItems(items)
    } catch {
      setInspoItems([])
    } finally {
      setLoadingInspo(false)
    }
  }

  const hasReport = !!report
  const hasPlan = !!plan
  const showDebugSettings = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).has('debug')
    } catch {
      return false
    }
  }, [])
  const showProfileForm = !hasReport && !hasPlan
  const isBusy = loadingReport || loadingPlan

  return (
    <div className='glow-shell min-h-screen text-[color:var(--text)]'>
      <div className='mx-auto flex min-h-screen w-full flex-col'>
        {/* Top */}
        <header className='sticky top-0 z-30 mx-3 mt-3 flex h-16 shrink-0 items-center justify-between rounded-full border border-white/70 bg-white/62 px-5 shadow-[0_14px_38px_rgba(68,119,174,0.12)] backdrop-blur-2xl sm:mx-6 sm:px-7'>
          <div className='flex items-baseline gap-3'>
            <span className='brand-mark text-[24px] leading-none text-[color:var(--text)]'>
              fitme
            </span>
            <span className='glass-chip px-3 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]'>
              atelier
            </span>
          </div>
          <div className='flex items-center gap-2'>
            {!showProfileForm ? (
              <>
                <button
                  onClick={handleSubmit}
                  disabled={isBusy}
                  className='btn-primary-glow inline-flex h-9 items-center rounded-full px-5 text-[13px] font-medium transition-all hover:-translate-y-0.5 disabled:opacity-55'
                >
                  重新生成
                </button>
                <button
                  onClick={resetAll}
                  className='btn-secondary-glass inline-flex h-9 items-center rounded-full px-5 text-[13px] transition-all hover:-translate-y-0.5 hover:text-[color:var(--accent)]'
                >
                  重新填写资料
                </button>
              </>
            ) : null}
            {showDebugSettings ? <SettingsSheet apiBase={apiBase} onChange={setApiBase} /> : null}
          </div>
        </header>

        {/* Body */}
        <main className='flex-1'>
          {showProfileForm ? (
            <FormPage
              profile={profile}
              setProfile={setProfile}
              faceImage={faceImage}
              faceFileName={faceFileName}
              onPickImage={handlePickImage}
              onClearImage={() => {
                setFaceImage(null)
                setFaceFileName('')
              }}
              onSubmit={handleSubmit}
              onReset={resetAll}
              isBusy={isBusy}
              errorText={error}
            />
          ) : (
            <div className='mx-auto w-full max-w-[1220px] px-5 py-8 sm:px-8 lg:py-10'>
              {error ? (
                <div className='mb-6 rounded-[22px] border border-orange-200 bg-orange-50/80 px-4 py-3 text-[13px] text-[color:var(--danger)] backdrop-blur-xl'>
                  {error}
                </div>
              ) : null}

              {/* Content Tabs */}
              <div className='glass-panel inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full p-1'>
                {[
                  { key: 'plan' as const, label: '一周穿搭', sub: '7-Day Plan' },
                  { key: 'report' as const, label: '穿搭报告', sub: 'Style Report' },
                  { key: 'inspo' as const, label: '穿搭灵感', sub: 'XHS' },
                ].map((tab) => {
                  const active = contentTab === tab.key
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setContentTab(tab.key)}
                      className={
                        'rounded-full px-4 py-2.5 text-sm font-medium transition-all ' +
                        (active
                          ? 'bg-white text-[color:var(--accent)] shadow-[0_10px_24px_rgba(68,119,174,0.12)]'
                          : 'text-[color:var(--text-3)] hover:bg-white/48 hover:text-[color:var(--text)]')
                      }
                    >
                      <span>{tab.label}</span>
                      <span className='ml-1.5 text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-3)]'>
                        {tab.sub}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className='mt-8'>
                {/* Plan Tab */}
                {contentTab === 'plan' ? (
                  loadingPlan && !hasPlan ? (
                    <LoadingState />
                  ) : hasPlan ? (
                    <div className='space-y-8'>
                      <DayTabs
                        outfits={outfits.map((o) => ({
                          id: o.id,
                          label: o.day_label || `Day ${o.day_index}`,
                        }))}
                        activeId={activeOutfit?.id || ''}
                        onChange={setActiveOutfitId}
                      />
                      {activeOutfit ? (
                        <OutfitView
                          outfit={activeOutfit}
                          tryon={tryonMap[activeOutfit.id]}
                          hasFace={!!faceImage}
                          onGenerateTryOn={() => generateTryOn(activeOutfit.id)}
                        />
                      ) : null}
                    </div>
                  ) : (
                    <EmptyState />
                  )
                ) : null}

                {/* Report Tab */}
                {contentTab === 'report' ? (
                  loadingReport && !hasReport ? (
                    <LoadingState />
                  ) : report ? (
                    <StyleReportView report={report} />
                  ) : (
                    <EmptyState />
                  )
                ) : null}

                {/* Inspo Tab（穿搭灵感，独立第三 Tab） */}
                {contentTab === 'inspo' ? (
                  loadingInspo && inspoItems.length === 0 ? (
                    <LoadingState />
                  ) : inspoItems.length > 0 ? (
                    <section className='glass-panel rounded-[30px] p-5 sm:p-6'>
                      {/* 头部：左大标题 + 右侧英文小字 */}
                      <div className='flex items-end justify-between gap-3'>
                        <h2 className='font-serif text-[22px] leading-tight tracking-tight text-[color:var(--text)]'>
                          小红书穿搭灵感
                        </h2>
                        <span className='text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-3)]'>
                          XHS Inspiration
                        </span>
                      </div>
                      {/* 副标题 */}
                      <div className='mt-1.5 text-[12px] leading-5 text-[color:var(--text-3)]'>
                        来自小红书的真实穿搭笔记 · 共 {inspoItems.length} 条
                      </div>
                      {/* 极细分割线 */}
                      <div className='mt-4 border-t border-white/70' />

                      <XhsInspiration items={inspoItems} />
                    </section>
                  ) : (
                    <EmptyState />
                  )
                ) : null}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

// ---- Sub-components ----

function DayTabs({
  outfits,
  activeId,
  onChange,
}: {
  outfits: { id: string; label: string }[]
  activeId: string
  onChange: (id: string) => void
}) {
  return (
    <div className='overflow-x-auto no-scrollbar'>
      <div className='glass-panel inline-flex items-center gap-1 rounded-full p-1'>
        {outfits.map((o) => {
          const active = o.id === activeId
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              className={
                'rounded-full px-4 py-2.5 text-xs font-medium transition-all ' +
                (active
                  ? 'bg-white text-[color:var(--accent)] shadow-[0_10px_24px_rgba(68,119,174,0.12)]'
                  : 'text-[color:var(--text-3)] hover:bg-white/48 hover:text-[color:var(--text)]')
              }
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function LoadingState({ label }: { label?: string }) {
  return (
    <div className='glass-panel flex min-h-[56vh] w-full flex-col items-center justify-center gap-6 rounded-[34px] text-center'>
      <span
        className='inline-block h-10 w-10 rounded-full border-2 border-[color:var(--accent)]/20 border-t-[color:var(--accent)]'
        style={{ animation: 'fitme-spin 0.85s linear infinite' }}
      />
      <div className='text-[24px] font-light leading-tight tracking-[-0.04em] text-[color:var(--text)]'>
        {label || '正在生成你的 Lookbook'}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className='glass-panel flex min-h-[50vh] flex-col items-center justify-center gap-5 rounded-[34px] px-6 text-center'>
      <div>
        <div className='text-[30px] font-light tracking-[-0.05em] text-[color:var(--text)]'>
          fitme 个性穿搭助手
        </div>
        <div className='mt-2 max-w-[44ch] text-sm leading-relaxed text-[color:var(--text-2)]'>
          输入你的身材数据，AI 即刻为你生成专属潮流穿搭方案、一周搭配计划与穿搭参考图片。
        </div>
      </div>
      <button
        onClick={() => window.location.reload()}
        className='btn-primary-glow mt-2 inline-flex h-11 items-center rounded-full px-6 text-[14px] font-medium transition hover:-translate-y-0.5'
      >
        重新填写资料
      </button>
    </div>
  )
}

function XhsInspiration({ items }: { items: XhsNote[] }) {
  if (!items.length) return null
  return (
    // 多行网格：桌面端一行 5 个，宽度不足时自动降为 4 / 3 / 2 个，往下排多行
    <div className='mt-4 grid grid-cols-2 gap-4 pb-3 pt-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
      {items.map((item) => (
        <XhsCard key={item.url || item.title || item.image_url} note={item} />
      ))}
    </div>
  )
}

function XhsCard({ note }: { note: XhsNote }) {
  const [imgOk, setImgOk] = useState(true)
  const clickable = !!note.url

  const inner = (
    <div
      className='group glass-card flex h-full flex-col overflow-hidden rounded-[24px] transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(68,119,174,0.18)]'
    >
      <div className='relative aspect-[3/4] w-full shrink-0 overflow-hidden bg-[color:var(--bg-soft)]'>
        {note.image_url && imgOk ? (
          <img
            src={note.image_url}
            alt={note.title}
            loading='lazy'
            referrerPolicy='no-referrer'
            className='h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]'
            onError={() => setImgOk(false)}
          />
        ) : (
          // 占位图：图片加载失败时不留空白
          <div className='flex h-full w-full flex-col items-center justify-center gap-2 bg-white/48 text-[color:var(--text-3)]'>
            <span className='inline-flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--accent)] text-[15px] font-bold text-white'>
              小
            </span>
            <span className='px-3 text-center text-[11px] leading-4'>小红书穿搭灵感</span>
          </div>
        )}
        {/* 底部渐变遮罩，提升点赞数可读性 */}
        <div className='pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent' />
        {note.likes ? (
          <div className='absolute bottom-2.5 right-2.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm'>
            赞 {note.likes}
          </div>
        ) : null}
      </div>
      <div className='flex flex-1 flex-col gap-2 p-3'>
        <div className='line-clamp-2 overflow-hidden text-ellipsis text-[13px] font-bold leading-[18px] text-[color:var(--text)]'>
          {note.title}
        </div>
        {note.author ? (
          <div className='mt-auto flex items-center gap-2 text-[11px] text-[color:var(--text-3)]'>
            <span className='inline-block h-6 w-6 shrink-0 rounded-full bg-[color:var(--hairline)]' />
            <span className='truncate'>{note.author}</span>
          </div>
        ) : null}
      </div>
    </div>
  )

  // 网格模式下由 grid 列宽决定卡片宽度，卡片自身撑满单元格
  if (clickable) {
    return (
      <a
        href={note.url}
        target='_blank'
        rel='noreferrer'
        className='block h-full'
      >
        {inner}
      </a>
    )
  }
  return <div className='h-full'>{inner}</div>
}
