import { useState } from 'react'
import { Settings } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  apiBase: string
  onChange: (v: string) => void
}

export function SettingsSheet({ apiBase, onChange }: Props) {
  const [value, setValue] = useState(apiBase)
  const [status, setStatus] = useState<string>('')

  const save = () => {
    const v = value.trim()
    onChange(v)
    try {
      window.localStorage.setItem('fitme_api_base', v)
      setStatus('已保存')
      setTimeout(() => setStatus(''), 1500)
    } catch {
      setStatus('保存失败')
    }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='h-9 w-9 text-[color:var(--text-2)] hover:bg-white/62 hover:text-[color:var(--accent)]'
          aria-label='设置'
        >
          <Settings className='h-4 w-4' />
        </Button>
      </SheetTrigger>
      <SheetContent className='glass-panel w-[380px] border-l border-white/70 bg-white/72 text-[color:var(--text)] backdrop-blur-2xl'>
        <SheetHeader>
          <SheetTitle className='text-[color:var(--text)]'>设置</SheetTitle>
        </SheetHeader>
        <div className='mt-6 space-y-4'>
          <div className='space-y-2'>
            <Label className='text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-3)]'>
              API base
            </Label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder='https://…'
            />
          </div>
          <div className='flex items-center gap-3'>
            <Button className='h-9 px-5' onClick={save}>
              保存
            </Button>
            {status ? (
              <span className='text-xs text-[color:var(--text-2)]'>{status}</span>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
