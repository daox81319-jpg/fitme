import type { ReactNode } from 'react'
import { Camera, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Profile } from '@/lib/fitme'

type Props = {
  profile: Profile
  setProfile: (p: Profile) => void
  faceImage: string | null
  faceFileName: string
  onPickImage: (file: File) => void
  onClearImage: () => void
  onSubmit: () => void
  onReset: () => void
  isBusy: boolean
  errorText?: string
}

const SKIN_TONE_OPTIONS = ['自然偏白', '冷白皮', '暖白皮', '自然肤色', '小麦肤色', '偏深肤色']
const OCCASION_OPTIONS = ['日常出街 / 周末出片', '通勤 / 下班约会', '旅行 / 城市漫游', '校园 / 日常拍照']
const BUDGET_OPTIONS = ['单品 100-500 元', '单品 300-800 元', '单品 500-1500 元', '预算不限，优先质感']
const STYLE_TAGS = [
  'oversize',
  '街头风',
  '韩系',
  '机能风',
  'Y2K',
  'clean fit',
  '美式复古',
  '出片感',
]

export function FormPage({
  profile,
  setProfile,
  faceImage,
  faceFileName,
  onPickImage,
  onClearImage,
  onSubmit,
  onReset,
  isBusy,
  errorText,
}: Props) {
  const submitText = isBusy ? '正在生成...' : '生成一周穿搭'

  const selectedStyles = profile.stylePreference
    ? profile.stylePreference.split('/').map((s) => s.trim()).filter(Boolean)
    : []

  function toggleStyle(tag: string) {
    const set = new Set(selectedStyles)
    if (set.has(tag)) set.delete(tag)
    else set.add(tag)
    setProfile({ ...profile, stylePreference: Array.from(set).join(' / ') })
  }

  return (
    <section className='glow-shell flex min-h-[calc(100vh-4rem)] flex-col justify-center px-5 py-8 sm:px-8 lg:px-14'>
      <div className='mx-auto grid w-full max-w-[1180px] gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-center'>
        <div className='relative overflow-hidden rounded-[34px] p-7 sm:p-9'>
          <div className='glass-chip px-4 text-[11px] font-medium uppercase tracking-[0.22em]'>Fit profile</div>
          <h1 className='mt-7 max-w-[9em] text-[clamp(38px,5vw,64px)] font-light leading-[1.02] tracking-[-0.06em] text-[color:var(--text)] [text-wrap:balance]'>
            先把你的身材与风格说清楚
          </h1>
          <p className='mt-5 max-w-[36rem] text-[15px] leading-7 text-[color:var(--text-2)]'>
            输入基础信息，fitme 会先生成个人风格报告，再给出 7 天 Lookbook 与真实商品参考。
          </p>
          <div className='mt-8 grid max-w-[520px] grid-cols-3 gap-3'>
            {['报告', '单品', '试穿'].map((item) => (
              <div key={item} className='glass-card rounded-[22px] px-4 py-5'>
                <div className='text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-3)]'>fitme</div>
                <div className='mt-5 text-[20px] font-light tracking-[-0.04em]'>{item}</div>
              </div>
            ))}
          </div>
        </div>

        <div className='glass-panel rounded-[34px] p-5 sm:p-7 lg:p-8'>
          <div className='grid grid-cols-1 gap-x-7 gap-y-5 md:grid-cols-2'>
            <div className='grid grid-cols-2 gap-4 md:col-span-2'>
              <Field label='身高 CM'>
                <Input
                  value={profile.height}
                  inputMode='numeric'
                  placeholder='175'
                  onChange={(e) => setProfile({ ...profile, height: e.target.value })}
                />
              </Field>
              <Field label='体重 KG'>
                <Input
                  value={profile.weight}
                  inputMode='numeric'
                  placeholder='70'
                  onChange={(e) => setProfile({ ...profile, weight: e.target.value })}
                />
              </Field>
            </div>

            <Field label='性别'>
              <Select
                value={profile.gender}
                onValueChange={(v) => setProfile({ ...profile, gender: v as Profile['gender'] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder='选择性别' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='男'>男</SelectItem>
                  <SelectItem value='女'>女</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label='肤色'>
              <Select value={profile.skinTone} onValueChange={(v) => setProfile({ ...profile, skinTone: v })}>
                <SelectTrigger>
                  <SelectValue placeholder='选择肤色' />
                </SelectTrigger>
                <SelectContent>
                  {SKIN_TONE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label='场景'>
              <Select value={profile.occasion} onValueChange={(v) => setProfile({ ...profile, occasion: v })}>
                <SelectTrigger>
                  <SelectValue placeholder='选择穿搭场景' />
                </SelectTrigger>
                <SelectContent>
                  {OCCASION_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label='预算'>
              <Select value={profile.budget} onValueChange={(v) => setProfile({ ...profile, budget: v })}>
                <SelectTrigger>
                  <SelectValue placeholder='选择预算范围' />
                </SelectTrigger>
                <SelectContent>
                  {BUDGET_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className='md:col-span-2'>
              <Field label='风格偏好（可多选）'>
                <div className='flex flex-wrap gap-2'>
                  {STYLE_TAGS.map((tag) => {
                    const active = selectedStyles.includes(tag)
                    return (
                      <button
                        key={tag}
                        type='button'
                        onClick={() => toggleStyle(tag)}
                        className={
                          'glass-chip min-h-[34px] cursor-pointer px-4 py-1.5 text-[12px] transition-all duration-200 hover:-translate-y-0.5 ' +
                          (active
                            ? 'border-[color:var(--accent)]/45 bg-[color:var(--accent)] text-white shadow-[0_10px_24px_rgba(0,135,235,0.18)]'
                            : 'hover:border-[color:var(--accent)]/35 hover:text-[color:var(--accent)]')
                        }
                      >
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </Field>
            </div>
          </div>

          <div className='mt-6 rounded-[24px] border border-white/70 bg-white/46 p-4 backdrop-blur-xl'>
            <div className='flex flex-wrap items-center gap-3'>
              <span className='text-[11px] font-medium tracking-[0.08em] text-[color:var(--text-3)]'>
                照片（可选）
              </span>
              {faceImage ? (
                <div className='flex min-w-0 items-center gap-2 text-[13px] text-[color:var(--text)]'>
                  <img src={faceImage} alt='预览' className='h-9 w-9 rounded-[14px] object-cover shadow-sm' />
                  <span className='max-w-[220px] truncate'>{faceFileName || '已上传照片'}</span>
                  <button
                    type='button'
                    className='inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] text-[color:var(--text-2)] transition hover:bg-white/70 hover:text-[color:var(--danger)]'
                    onClick={onClearImage}
                  >
                    <X className='h-3.5 w-3.5' /> 移除
                  </button>
                </div>
              ) : (
                <label className='btn-secondary-glass inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-[13px] transition hover:-translate-y-0.5 hover:text-[color:var(--accent)]'>
                  <Camera className='h-4 w-4' />
                  上传照片，开启 1:1 AI 试穿
                  <input
                    type='file'
                    accept='image/*'
                    className='hidden'
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) onPickImage(file)
                      e.currentTarget.value = ''
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          {errorText ? (
            <div className='mt-5 rounded-[20px] border border-orange-200 bg-orange-50/80 px-4 py-3 text-[13px] text-[color:var(--danger)]'>
              {errorText}
            </div>
          ) : null}

          <div className='mt-7 flex flex-col items-center gap-3 sm:flex-row'>
            <Button className='h-12 w-full sm:flex-1' onClick={onSubmit} disabled={isBusy}>
              {submitText}
            </Button>
            <button
              type='button'
              className='btn-secondary-glass inline-flex h-12 w-full items-center justify-center rounded-full px-6 text-[14px] font-medium transition hover:-translate-y-0.5 hover:text-[color:var(--accent)] sm:w-auto'
              onClick={onReset}
            >
              重置资料
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className='space-y-2'>
      <Label className='text-[11px] font-medium tracking-[0.08em] text-[color:var(--text-3)]'>
        {label}
      </Label>
      {children}
    </div>
  )
}
