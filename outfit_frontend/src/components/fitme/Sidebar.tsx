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
  loadingReport: boolean
  loadingPlan: boolean
  hasReport: boolean
  errorText?: string
}

const DEFAULT_STYLE_OPTIONS = [
  'oversize / 街头风 / 韩系 / 机能风 / Y2K',
  'oversize / 街头风 / 机能风',
  '韩系 / clean fit / 美式复古',
  'Y2K / 出片感 / 街头混搭',
]

const SKIN_TONE_OPTIONS = ['自然偏白', '冷白皮', '暖白皮', '自然肤色', '小麦肤色', '偏深肤色']
const OCCASION_OPTIONS = ['日常出街 / 周末出片', '通勤 / 下班约会', '旅行 / 城市漫游', '校园 / 日常拍照']
const BUDGET_OPTIONS = ['单品 100-500 元', '单品 300-800 元', '单品 500-1500 元', '预算不限，优先质感']

export function Sidebar({
  profile,
  setProfile,
  faceImage,
  faceFileName,
  onPickImage,
  onClearImage,
  onSubmit,
  onReset,
  loadingReport,
  loadingPlan,
  hasReport,
  errorText,
}: Props) {
  const isBusy = loadingReport || loadingPlan
  const submitText = hasReport
    ? '重新生成 Lookbook'
    : loadingReport
      ? '正在分析风格…'
      : loadingPlan
        ? '正在匹配单品…'
        : '生成一周穿搭'

  const requestReset = () => {
    if (!hasReport || window.confirm('重置会清空当前报告、穿搭方案和试穿图，确认继续吗？')) {
      onReset()
    }
  }

  if (hasReport) {
    return (
      <div className='glass-panel flex h-full flex-col rounded-[30px] p-5 text-[color:var(--text)]'>
        <div>
          <div className='glass-chip px-3 font-mono text-[10px] uppercase tracking-[0.2em]'>
            fit profile
          </div>
          <h2 className='mt-4 text-[26px] font-light leading-tight tracking-[-0.05em]'>
            用户画像摘要
          </h2>
          <p className='mt-3 text-sm leading-6 text-[color:var(--text-2)]'>
            表单已折叠，结果区优先展示。需要大改资料时可重置后重新填写。
          </p>
        </div>

        <div className='mt-6 space-y-3'>
          <CompactRow label='身高 / 体重' value={`${profile.height}cm / ${profile.weight}kg`} />
          <CompactRow label='肤色' value={profile.skinTone} />
          <CompactRow label='风格' value={profile.stylePreference} />
          <CompactRow label='场景' value={profile.occasion} />
          <CompactRow label='预算' value={profile.budget} />
          <CompactRow label='照片' value={faceImage ? faceFileName || '已上传照片' : '未上传，可后续补充'} />
        </div>

        {errorText ? (
          <div className='mt-4 rounded-[18px] border border-orange-200 bg-orange-50/80 px-3 py-2 text-xs leading-5 text-[color:var(--danger)]'>
            {errorText}
          </div>
        ) : null}

        <div className='mt-auto space-y-3 pt-6'>
          <Button className='w-full' onClick={onSubmit} disabled={isBusy}>
            {submitText}
          </Button>
          <Button variant='secondary' className='w-full' onClick={requestReset}>
            重新填写资料
          </Button>
        </div>
      </div>
    )
  }

  return (
    <aside className='glass-panel h-full overflow-y-auto rounded-[30px] p-5 text-[color:var(--text)]'>
      <div className='glass-chip px-3 font-mono text-[10px] uppercase tracking-[0.2em]'>fit profile</div>
      <h2 className='mt-4 text-[28px] font-light leading-tight tracking-[-0.05em]'>
        输入你的穿搭画像
      </h2>
      <p className='mt-3 text-sm leading-6 text-[color:var(--text-2)]'>
        先生成个人风格报告，再输出 7 天 Lookbook 与真实商品参考。
      </p>

      <div className='mt-6 grid grid-cols-2 gap-3'>
        <Field label='身高'>
          <Input value={profile.height} onChange={(e) => setProfile({ ...profile, height: e.target.value })} />
        </Field>
        <Field label='体重'>
          <Input value={profile.weight} onChange={(e) => setProfile({ ...profile, weight: e.target.value })} />
        </Field>
      </div>

      <div className='mt-4 space-y-4'>
        <Field label='肤色'>
          <Select value={profile.skinTone} onValueChange={(v) => setProfile({ ...profile, skinTone: v })}>
            <SelectTrigger>
              <SelectValue />
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

        <Field label='风格偏好'>
          <Select value={profile.stylePreference} onValueChange={(v) => setProfile({ ...profile, stylePreference: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEFAULT_STYLE_OPTIONS.map((option) => (
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
              <SelectValue />
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
              <SelectValue />
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
      </div>

      <div className='mt-5 rounded-[24px] border border-white/70 bg-white/50 p-4 backdrop-blur-xl'>
        {faceImage ? (
          <div className='flex items-center gap-3'>
            <img src={faceImage} alt='已上传照片' className='h-14 w-14 rounded-[18px] object-cover shadow-sm' />
            <div className='min-w-0 flex-1'>
              <div className='truncate text-sm font-medium'>{faceFileName || '已上传照片'}</div>
              <button className='mt-1 inline-flex items-center gap-1 text-xs text-[color:var(--text-3)] hover:text-[color:var(--danger)]' onClick={onClearImage}>
                <X className='h-3.5 w-3.5' /> 移除照片
              </button>
            </div>
          </div>
        ) : (
          <label className='btn-secondary-glass flex cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-3 text-sm transition hover:text-[color:var(--accent)]'>
            <Camera className='h-4 w-4' /> 上传照片（可选）
            <input
              type='file'
              className='hidden'
              accept='image/*'
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onPickImage(file)
                e.currentTarget.value = ''
              }}
            />
          </label>
        )}
      </div>

      {errorText ? (
        <div className='mt-4 rounded-[18px] border border-orange-200 bg-orange-50/80 px-3 py-2 text-xs leading-5 text-[color:var(--danger)]'>
          {errorText}
        </div>
      ) : null}

      <div className='mt-6 space-y-3'>
        <Button className='w-full' onClick={onSubmit} disabled={isBusy}>
          {submitText}
        </Button>
        <Button variant='secondary' className='w-full' onClick={requestReset}>
          重置资料
        </Button>
      </div>
    </aside>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className='space-y-2'>
      <Label className='text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-3)]'>
        {label}
      </Label>
      {children}
    </div>
  )
}

function CompactRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className='glass-card rounded-[18px] px-3 py-3'>
      <div className='text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-3)]'>{label}</div>
      <div className='mt-1 text-sm leading-5 text-[color:var(--text)]'>{value || '—'}</div>
    </div>
  )
}
