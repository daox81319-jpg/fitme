const BANNED_PRODUCT_TITLE_TERMS = [
  '海澜之家',
  '班尼路',
  '佐丹奴',
  '名创优品',
  '森马',
  '凡客诚品',
  'VANCL',
  'VANCAMEL',
  '西域骆驼',
]

export function isAllowedProductTitle(title: string) {
  const text = (title || '').toLowerCase()
  return !BANNED_PRODUCT_TITLE_TERMS.some((term) => text.includes(term.toLowerCase()))
}

export type ProductCard = {
  platform: '淘宝' | '京东' | '拼多多' | '小红书' | string
  title: string
  price?: string
  image_url?: string
  buy_url: string
  description?: string
}

export type OutfitItem = {
  category: string
  name: string
  fit: string
  material: string
  color: string
  query?: string
  products?: ProductCard[]
}

export type Outfit = {
  id: string
  day_index: number
  day_label: string
  title: string
  vibe: string
  colors: {
    primary: string[]
    accent: string[]
    avoid: string[]
  }
  items: OutfitItem[]
  reason: string
  image_prompt_en?: string
  shopping_keywords?: string[]
  products?: ProductCard[]
}

export type RecommendResponse = {
  plan_id: string
  outfits: Outfit[]
}

export type TryOnState = { loading: boolean; image?: string; error?: string }

// ---------- Style Report ----------
export type ColorSwatch = {
  name: string
  hex: string
  note?: string
}

export type StyleReport = {
  report_id: string
  summary: string
  body_analysis: {
    shape: string
    proportion: string
    strengths: string[]
    cautions: string[]
  }
  color_palette: {
    best: ColorSwatch[]
    accent: ColorSwatch[]
    avoid: ColorSwatch[]
  }
  silhouette: {
    tops: string[]
    bottoms: string[]
    outerwear: string[]
    shoes: string[]
    avoid_fits: string[]
  }
  seasonal: {
    spring: SeasonBlock
    summer: SeasonBlock
    autumn: SeasonBlock
    winter: SeasonBlock
  }
  style_keywords: string[]
}

export type SeasonBlock = {
  vibe: string
  key_items: string[]
  fabrics: string[]
  colors: string[]
}

export type Profile = {
  height: string
  weight: string
  skinTone: string
  gender: '男' | '女'
  stylePreference: string
  occasion: string
  budget: string
}

export function safeHex(color: string) {
  const c = (color || '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c
  if (/^#[0-9a-fA-F]{3}$/.test(c)) return c
  return '#E2D9C8'
}

function readFileAsDataURL(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

export async function compressImageFileToDataURL(
  file: File,
  opts?: { maxSide?: number; quality?: number },
) {
  const maxSide = opts?.maxSide ?? 768
  const quality = opts?.quality ?? 0.86

  const raw = await readFileAsDataURL(file)

  try {
    const img = new Image()
    img.decoding = 'async'

    const objectUrl = URL.createObjectURL(file)

    const loaded = await new Promise<HTMLImageElement>((resolve, reject) => {
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('图片解码失败'))
      img.src = objectUrl
    })

    const w = loaded.naturalWidth || loaded.width
    const h = loaded.naturalHeight || loaded.height
    if (!w || !h) {
      URL.revokeObjectURL(objectUrl)
      return raw
    }

    const scale = Math.min(1, maxSide / Math.max(w, h))
    const tw = Math.max(1, Math.round(w * scale))
    const th = Math.max(1, Math.round(h * scale))

    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      URL.revokeObjectURL(objectUrl)
      return raw
    }

    ctx.drawImage(loaded, 0, 0, tw, th)
    URL.revokeObjectURL(objectUrl)

    const compressed = canvas.toDataURL('image/jpeg', quality)
    return compressed || raw
  } catch {
    return raw
  }
}

export function platformLabel(p: string) {
  if (p === '淘宝') return 'Taobao'
  if (p === '京东') return 'JD'
  if (p === '拼多多') return 'PDD'
  return p
}
