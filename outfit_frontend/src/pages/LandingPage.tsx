import { useNavigate } from 'react-router-dom'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <main className='glow-shell relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden px-4 py-6 text-[color:var(--text)] sm:px-8'>
      <div className='pointer-events-none absolute right-[9%] top-[11%] hidden h-28 w-28 rounded-full bg-[color:var(--accent-warm)]/55 blur-2xl md:block' />
      <div className='pointer-events-none absolute bottom-[12%] left-[7%] hidden h-36 w-36 rounded-full bg-[color:var(--accent-soft)]/70 blur-3xl md:block' />

      <section className='glass-panel relative grid w-full max-w-[1120px] gap-8 rounded-[38px] p-5 sm:p-7 lg:grid-cols-[0.95fr_1.05fr] lg:p-9'>
        <div className='flex min-h-[500px] flex-col justify-between rounded-[30px] bg-white/34 p-6 sm:p-8'>
          <nav className='flex items-center justify-between gap-4'>
            <span className='brand-mark text-[28px] leading-none tracking-[-0.055em]'>fitme</span>
            <span className='glass-chip px-4 text-[11px] font-medium uppercase tracking-[0.18em]'>AI Stylist</span>
          </nav>

          <div className='py-8 sm:py-10'>
            <div className='glass-chip px-4 text-[12px]'>一份更贴近你的穿搭报告</div>
            <h1 className='mt-6 max-w-[9.5em] text-[clamp(44px,6vw,72px)] font-light leading-[1.02] tracking-[-0.06em] text-[color:var(--text)] [text-wrap:balance]'>
              Own the look, before you wear it.
            </h1>
            <p className='mt-6 max-w-[35rem] text-[15px] leading-7 text-[color:var(--text-2)]'>
              上传基础信息，fitme 会生成个人风格诊断、7 天 Lookbook、真实商品参考与可选 AI 试穿图。
            </p>
            <div className='mt-9 flex flex-wrap gap-3'>
              <button
                type='button'
                onClick={() => navigate('/generate')}
                className='btn-primary-glow inline-flex h-12 items-center justify-center rounded-full px-7 text-[14px] font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0'
              >
                开始生成穿搭
              </button>
              <button
                type='button'
                onClick={() => navigate('/generate')}
                className='btn-secondary-glass inline-flex h-12 items-center justify-center rounded-full px-7 text-[14px] font-medium transition-all duration-200 hover:-translate-y-0.5 hover:text-[color:var(--accent)]'
              >
                先看填写项
              </button>
            </div>
          </div>

          <div className='grid grid-cols-3 gap-3 text-xs text-[color:var(--text-2)]'>
            {['风格诊断', 'Lookbook', 'AI 试穿'].map((item) => (
              <div key={item} className='glass-chip justify-center px-3 py-2'>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className='relative min-h-[500px] overflow-hidden rounded-[30px] bg-[linear-gradient(145deg,rgba(255,255,255,0.62),rgba(177,227,255,0.28))] p-5'>
          <div className='absolute right-8 top-8 h-24 w-24 rounded-full bg-[color:var(--accent-warm)]/70 blur-2xl' />
          <div className='absolute bottom-10 left-8 h-32 w-32 rounded-full bg-[color:var(--glow-blue)]/35 blur-3xl' />

          <div className='relative grid h-full grid-rows-[1fr_auto] gap-4'>
            <div className='glass-card overflow-hidden rounded-[30px] p-5'>
              <div className='flex items-center justify-between'>
                <span className='text-[11px] font-medium uppercase tracking-[0.2em] text-[color:var(--text-3)]'>Style Report</span>
                <span className='rounded-full bg-[color:var(--accent)] px-3 py-1 text-[11px] font-semibold text-white'>Ready</span>
              </div>
              <div className='mt-8 grid grid-cols-[0.8fr_1.2fr] gap-5'>
                <div className='aspect-[3/4] rounded-[26px] border border-white/70 bg-[linear-gradient(180deg,#ffffff,rgba(177,227,255,0.42))] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]' />
                <div className='space-y-4 pt-2'>
                  <div>
                    <div className='text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-3)]'>Signature</div>
                    <div className='mt-1 text-[28px] font-light tracking-[-0.04em]'>Clean street fit</div>
                  </div>
                  <div className='grid gap-2'>
                    {['宽松短夹克', '直筒牛仔裤', '低饱和蓝白配色'].map((item) => (
                      <div key={item} className='glass-chip px-4 py-2 text-[13px] text-[color:var(--text)]'>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className='grid grid-cols-3 gap-4'>
              {['Day 01', 'Day 04', 'Day 07'].map((day, index) => (
                <div
                  key={day}
                  className='glass-card rounded-[24px] p-4 transition-transform duration-300 hover:-translate-y-1'
                  style={{ animation: `fitme-float ${5 + index}s ease-in-out infinite` }}
                >
                  <div className='text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-3)]'>{day}</div>
                  <div className='mt-8 h-2 rounded-full bg-[color:var(--accent)]/70' />
                  <div className='mt-2 h-2 w-2/3 rounded-full bg-[color:var(--accent-soft)]' />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
