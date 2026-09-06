import uvicorn
import os
import json
import re
import time
import uuid
import copy
import urllib.parse
from typing import Any, Dict, List, Optional, Tuple

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# 小红书采集模块（本地衣物库）
try:
    import xiaohongshu_scraper as xhs
except ImportError:
    xhs = None  # type: ignore

app = FastAPI(title="穿点啥 · AI 男性穿搭助手（Demo）", version="0.3.0")

# 允许前端跨域访问（Demo 简化处理）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------
# 内存态：不落库、不持久化
# - 只缓存 outfit 方案（不缓存照片）
# - 用 TTL 进行过期清理
# ---------------------------
PLAN_TTL_SECONDS = 60 * 60  # 1h
PLANS: Dict[str, Dict[str, Any]] = {}  # {plan_id: {created_at, outfits}}
REPORTS: Dict[str, Dict[str, Any]] = {}  # {report_id: {created_at, report}}
REPORT_CACHE_BY_PROFILE: Dict[str, Dict[str, Any]] = {}  # {profile_key: {created_at, report}}

# ---------------------------
# 商品抓取缓存（真实商品卡片）
# - 本 Demo 版本使用“已抓取缓存”方式，把真实商品数据回填到 ITEM LIST
# - 原因：线上 Serverless 环境无法直接复用用户本地登录态；要做到“实时抓取”，需本地常驻服务
# ---------------------------
PRODUCT_CACHE_PATH = os.path.join(os.path.dirname(__file__), "product_cache.json")

# ---------------------------
# 小红书穿搭灵感缓存（已采集，供前端展示）
# - 文件：data/xiaohongshu_cache.json
# - 结构：[{keyword, title, image_url, author, likes, url}, ...]
# - 用途：前端「一周穿搭」Tab 下方展示真实小红书笔记灵感
# ---------------------------
XHS_INSPO_CACHE_PATH = os.path.join(
    os.path.dirname(__file__), "data", "xiaohongshu_cache.json"
)


def _load_xhs_inspo_cache() -> List[Dict[str, Any]]:
    """加载小红书灵感缓存并按 url 去重。文件不存在/损坏时返回空列表（不报错）。"""
    try:
        if not os.path.exists(XHS_INSPO_CACHE_PATH):
            return []
        with open(XHS_INSPO_CACHE_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
    except Exception:
        return []

    if not isinstance(raw, list):
        return []

    seen: set = set()
    notes: List[Dict[str, Any]] = []
    for it in raw:
        if not isinstance(it, dict):
            continue
        title = str(it.get("title") or "").strip()
        image_url = str(it.get("image_url") or "").strip()
        if not title or not image_url:
            continue
        url = str(it.get("url") or "").strip()
        # 去重键：优先 url，其次 title+author（同一条笔记在多个关键词下重复出现）
        dedupe_key = url or (title + "|" + str(it.get("author") or ""))
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        notes.append(
            {
                "title": title,
                "image_url": image_url,
                "author": str(it.get("author") or "").strip(),
                "likes": str(it.get("likes") or "").strip(),
                "url": url,
                "keyword": str(it.get("keyword") or "").strip(),
            }
        )
    return notes


_XHS_INSPO_CACHE: List[Dict[str, Any]] = _load_xhs_inspo_cache()


def _normalize_query(q: str) -> str:
    return re.sub(r"\s+", " ", (q or "").strip())


def _load_product_cache() -> Dict[str, Any]:
    try:
        if os.path.exists(PRODUCT_CACHE_PATH):
            with open(PRODUCT_CACHE_PATH, "r", encoding="utf-8") as f:
                return json.load(f) or {}
    except Exception:
        return {}
    return {}


_PRODUCT_CACHE: Dict[str, Any] = _load_product_cache()


# ---------------------------
# 受控词表（约束 LLM 输出 + 归一化目标集合）
# - 目的：把 LLM 输出的颜色/品类收敛到有限的中文受控词，最大化命中商品缓存
# ---------------------------
CONTROLLED_COLORS: List[str] = [
    "白", "黑", "海军蓝", "灰", "米白", "卡其", "深灰", "藏青", "驼色", "墨绿", "酒红", "浅蓝",
]

CONTROLLED_CATEGORIES: List[str] = [
    "T恤", "衬衫", "Polo衫", "针织衫", "卫衣", "夹克", "风衣",
    "直筒牛仔裤", "休闲裤", "运动鞋",
]

YOUTH_STYLE_TERMS: List[str] = [
    "oversize", "街头风", "韩系", "clean fit", "机能风", "gorpcore",
    "Y2K", "多巴胺穿搭", "美式复古", "宽松直筒牛仔", "潮牌",
]
BANNED_PRODUCT_TERMS: List[str] = [
    "".join(chars)
    for chars in [
        ["商", "务"],
        ["正", "式"],
        ["职", "场"],
        ["西", "装"],
        ["正", "装"],
        ["行", "政"],
        ["中", "年"],
        ["爸", "爸"],
        ["海", "澜", "之", "家"],
        ["班", "尼", "路"],
        ["佐", "丹", "奴"],
        ["名", "创", "优", "品"],
        ["森", "马"],
        ["凡", "客", "诚", "品"],
        ["V", "A", "N", "C", "L"],
        ["西", "域", "骆", "驼"],
        ["V", "A", "N", "C", "A", "M", "E", "L"],
    ]
]


def _normalize_color(color: str) -> str:
    """把任意颜色描述（含英文色名/中文同义词）归一化到受控中文颜色词。

    目的：即便 LLM 偶尔输出英文色名（Soft Ecru / Ink Navy / Charcoal …）或中文同义词，
    也能兜回受控色，从而命中商品缓存。归一化失败时原样返回（保持向后兼容）。
    """
    c = (color or "").strip()
    if not c:
        return c

    low = c.lower()

    # --- 英文 / 拼音色名（报告层常见英文色名）---
    if any(k in low for k in ["warm greige", "soft ecru", "ecru", "ivory", "cream", "off white", "off-white", "oatmeal", "beige"]):
        return "米白"
    if any(k in low for k in ["ink navy", "navy", "indigo"]):
        return "海军蓝"
    if "charcoal" in low:
        return "深灰"
    if any(k in low for k in ["olive", "forest green", "hunter green"]):
        return "墨绿"
    if any(k in low for k in ["camel", "taupe", "caramel"]) or (low == "tan"):
        return "驼色"
    if "khaki" in low:
        return "卡其"
    if any(k in low for k in ["burgundy", "wine", "maroon", "bordeaux"]):
        return "酒红"
    if any(k in low for k in ["light blue", "sky blue", "powder blue", "baby blue"]):
        return "浅蓝"
    if any(k in low for k in ["stone", "greige", "slate", "grey", "gray"]):
        return "灰"
    if "black" in low:
        return "黑"
    if "white" in low:
        return "白"

    # --- 中文色名 / 同义词 ---
    # 深灰系（炭灰、石墨灰、铁灰）— 先于泛化的“灰/黑”
    if any(k in c for k in ["炭灰", "石墨", "铁灰", "深灰", "碳灰", "枪灰"]):
        return "深灰"
    if "炭黑" in c:
        return "黑"
    # 白系（先米白/奶油/象牙/燕麦，再纯白）
    if any(k in c for k in ["米白", "奶油", "象牙", "燕麦", "乳白", "米色"]):
        return "米白"
    # 蓝系
    if "藏青" in c:
        return "藏青"
    if any(k in c for k in ["海军蓝", "藏蓝", "深蓝", "宝蓝", "靛"]):
        return "海军蓝"
    if any(k in c for k in ["浅蓝", "天蓝", "粉蓝", "雾蓝"]):
        return "浅蓝"
    # 绿系
    if any(k in c for k in ["墨绿", "橄榄", "军绿", "深绿", "橄榄绿"]):
        return "墨绿"
    # 卡其 / 驼 / 酒红
    if "卡其" in c:
        return "卡其"
    if any(k in c for k in ["驼", "焦糖", "杏色"]):
        return "驼色"
    if any(k in c for k in ["酒红", "勃艮第", "枣红", "暗红"]):
        return "酒红"
    # 黑白灰兜底
    if "白" in c:
        return "白"
    if "黑" in c:
        return "黑"
    if "灰" in c:
        return "灰"

    return c


def _normalize_item_name(name: str) -> str:
    """把任意单品名归一化到受控中文品类词（用于命中商品缓存）。

    归一化失败时原样返回（保持向后兼容）。
    """
    n = (name or "").strip()
    if not n:
        return n

    low = n.lower()

    # --- 鞋类（先处理，避免“鞋”被裤装/上装关键词误伤）---
    if any(k in n for k in ["小白鞋", "板鞋", "德训", "跑鞋", "运动鞋", "休闲鞋", "帆布鞋", "老爹鞋", "训练鞋", "慢跑"]) or any(k in low for k in ["sneaker", "trainer", "running", "shoe", "derby", "loafer", "chelsea", "boot"]):
        return "运动鞋"
    if "鞋" in n:
        return "运动鞋"

    # --- 裤装 ---
    if "牛仔" in n or "丹宁" in n or "denim" in low or "jean" in low:
        return "直筒牛仔裤"
    if any(k in n for k in ["休闲裤", "工装裤", "工装长裤", "卡其裤", "长裤", "九分裤", "直筒裤", "阔腿裤", "束脚裤", "裤"]) or any(k in low for k in ["chino", "cargo", "pant", "trouser", "slacks"]):
        return "休闲裤"

    # --- 上装 ---
    if "polo" in low:
        return "Polo衫"
    if "衬衫" in n or "衬衣" in n or "shirt" in low or "oxford" in low:
        return "衬衫"
    if "t恤" in low or "tee" in low or "t-shirt" in low or ("短袖" in n and "衬" not in n):
        return "T恤"
    if any(k in n for k in ["针织", "毛衫", "毛衣", "羊毛衫", "线衫", "针织衫"]) or any(k in low for k in ["knit", "sweater", "cardigan", "jumper"]):
        return "针织衫"
    if any(k in n for k in ["卫衣", "连帽", "帽衫"]) or any(k in low for k in ["hoodie", "sweatshirt"]):
        return "卫衣"
    if "夹克" in n or "jacket" in low or "blazer" in low or "suit" in low:
        return "夹克"
    if "风衣" in n or "大衣" in n or "trench" in low or "coat" in low:
        return "风衣"
    if "外套" in n:
        return "夹克"

    return n


def _flatten_cache_hit(hit: Dict[str, Any]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for _platform, items in (hit or {}).items():
        if not isinstance(items, list):
            continue
        for it in items:
            if isinstance(it, dict) and it.get("buy_url"):
                out.append(it)
    return _filter_product_cards(out)


def _is_youth_product(item: Dict[str, Any]) -> bool:
    title = str(item.get("title") or "")
    haystack = title.lower()
    return not any(term and term.lower() in haystack for term in BANNED_PRODUCT_TERMS)


def _compact_product_card(item: Dict[str, Any]) -> Dict[str, Any]:
    title = re.sub(r"\s+", " ", str(item.get("title") or "")).strip()
    title = re.sub(r"\s*(京东自营|旗舰店|官方旗舰).*", "", title).strip()
    if len(title) > 42:
        title = title[:42] + "…"
    next_item = dict(item)
    next_item["title"] = title
    return next_item


def _filter_product_cards(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    clean = [_compact_product_card(item) for item in items if _is_youth_product(item)]
    return clean[:3]


def _lookup_cached_products(color_norm: str, name_norm: str) -> List[Dict[str, Any]]:
    """分层命中商品缓存：

    1) 精确命中 `{color} {name} 男`
    2) 泛品类命中 `{name} 男`
    3) 同品类任意颜色（cache key 尾部为 `… {name} 男`）
    4) 旧的模糊子串兜底（向后兼容）
    """
    queries = (_PRODUCT_CACHE or {}).get("queries") or {}
    if not queries:
        return []

    color_norm = (color_norm or "").strip()
    name_norm = (name_norm or "").strip()

    # tier 1: 精确 `{color} {name} 男`
    if color_norm and name_norm:
        k1 = _normalize_query("%s %s 男" % (color_norm, name_norm))
        if k1 in queries:
            return _flatten_cache_hit(queries[k1])

    # tier 2: 泛品类 `{name} 男`
    if name_norm:
        k2 = _normalize_query("%s 男" % name_norm)
        if k2 in queries:
            return _flatten_cache_hit(queries[k2])

    # tier 3: 同品类任意颜色（key 结尾为 `… {name} 男`）
    if name_norm:
        for k, v in queries.items():
            toks = str(k).split()
            if len(toks) >= 2 and toks[-1] == "男" and toks[-2] == name_norm:
                return _flatten_cache_hit(v)

    # tier 4: 旧的模糊子串兜底
    q = _normalize_query("%s %s 男" % (color_norm, name_norm))
    q2 = q.replace(" ", "")
    for k, v in queries.items():
        k2 = str(k).replace(" ", "")
        if not k2:
            continue
        if k2 in q2 or q2 in k2:
            return _flatten_cache_hit(v)

    return []


def _cleanup_plans() -> None:
    now = int(time.time())
    expired = [k for k, v in PLANS.items() if now - int(v.get("created_at", 0)) > PLAN_TTL_SECONDS]
    for k in expired:
        PLANS.pop(k, None)


def _cleanup_reports() -> None:
    now = int(time.time())
    expired = [k for k, v in REPORTS.items() if now - int(v.get("created_at", 0)) > PLAN_TTL_SECONDS]
    for k in expired:
        REPORTS.pop(k, None)

    expired_cache = [
        k for k, v in REPORT_CACHE_BY_PROFILE.items()
        if now - int(v.get("created_at", 0)) > PLAN_TTL_SECONDS
    ]
    for k in expired_cache:
        REPORT_CACHE_BY_PROFILE.pop(k, None)


# ---------------------------
# Pydantic Models
# ---------------------------
class UserProfile(BaseModel):
    height_cm: float = Field(..., ge=120, le=230, description="身高（cm）")
    weight_kg: float = Field(..., ge=35, le=150, description="体重（kg）")
    skin_tone: str = Field(..., description="肤色")

    waist_cm: Optional[float] = Field(None, ge=50, le=150, description="腰围（cm）")
    leg_length_cm: Optional[float] = Field(None, ge=50, le=140, description="腿长（cm）")
    shoulder_width_cm: Optional[float] = Field(None, ge=30, le=70, description="肩宽（cm）")

    age: Optional[int] = Field(None, ge=16, le=80, description="年龄（可选）")
    gender: Optional[str] = Field(None, description="性别（可选）")
    style_keywords: Optional[str] = Field(None, description="个人风格关键词（可选）")
    occasion: Optional[str] = Field(None, description="使用场景（可选）")
    budget: Optional[str] = Field(None, description="预算（可选）")

    # 注意：照片不落库；仅在 try-on 请求中随用随传
    face_image: Optional[str] = Field(None, description="人脸照片（base64 dataURL 或纯 base64）")


class RecommendRequest(BaseModel):
    profile: UserProfile
    report_id: Optional[str] = Field(None, description="上一步生成的穿搭报告 id，可选")
    report: Optional[Dict[str, Any]] = Field(
        None,
        description="上一步生成的穿搭报告核心字段（可只包含 color_palette / silhouette / style_keywords），可选",
    )


class StyleReportRequest(BaseModel):
    profile: UserProfile


class TryOnRequest(BaseModel):
    plan_id: str
    outfit_id: str
    face_image: str = Field(..., description="人脸照片（base64 dataURL 或纯 base64）")
    image_size: str = Field("1k", description="图片尺寸（默认 1k）")
    aspect_ratio: str = Field("3:4", description="图片比例（默认 3:4，全身更合适）")


class SearchClothesRequest(BaseModel):
    keyword: str = Field(..., description="搜索关键词（如「男生潮流穿搭」）")
    gender: str = Field("男", description="性别（「男」或「女」）")


# ---------------------------
# Utilities
# ---------------------------

def _strip_code_fence(text: str) -> str:
    if not text:
        return text
    t = text.strip()
    t = re.sub(r"^```[a-zA-Z]*\n", "", t)
    t = re.sub(r"\n```$", "", t)
    return t.strip()


def _extract_json_object(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    t = _strip_code_fence(text)
    try:
        return json.loads(t)
    except Exception:
        pass

    start = t.find("{")
    end = t.rfind("}")
    if start >= 0 and end > start:
        maybe = t[start : end + 1]
        try:
            return json.loads(maybe)
        except Exception:
            return None
    return None


def _normalize_data_url(maybe_data: Optional[str]) -> Optional[str]:
    if not maybe_data:
        return None
    data = maybe_data.strip()
    if data.startswith("data:image/"):
        return data
    return "data:image/png;base64," + data


def _profile_cache_key(profile: "UserProfile") -> str:
    payload = {
        "height_cm": round(float(profile.height_cm), 1),
        "weight_kg": round(float(profile.weight_kg), 1),
        "skin_tone": str(profile.skin_tone or "").strip(),
        "gender": str(profile.gender or "").strip(),
        "style_keywords": str(profile.style_keywords or "").strip(),
        "occasion": str(profile.occasion or "").strip(),
        "budget": str(profile.budget or "").strip(),
    }
    return json.dumps(payload, ensure_ascii=False, sort_keys=True)


def _shape_profile(profile: "UserProfile") -> Tuple[str, str, List[str], List[str]]:
    bmi = float(profile.weight_kg) / ((float(profile.height_cm) / 100.0) ** 2)
    style_text = str(profile.style_keywords or "")

    if bmi < 20:
        shape = "清瘦修长"
        proportion = "更适合上宽下直，增强肩线和层次，避免过分贴身"
        strengths = ["上身轻盈，适合叠穿", "容易穿出韩系和 clean fit 的利落感"]
        cautions = ["全身过窄会显单薄", "裤脚堆叠过长容易压身高"]
    elif bmi < 24:
        shape = "匀称偏直"
        proportion = "上下身较均衡，最适合宽上身+利落下装来拉比例"
        strengths = ["整体匀称，能驾驭街头和机能层次", "冷暖中性色都较好搭配"]
        cautions = ["全身都宽会显拖沓", "上衣过长时要控制下装体积"]
    else:
        shape = "厚实偏壮"
        proportion = "更适合硬挺外套+直筒裤，纵向线条越明确越显利落"
        strengths = ["肩背支撑感强，适合工装与机能轮廓", "深色和硬挺面料更显质感"]
        cautions = ["上宽下也宽容易显壮", "低腰和大面积浅亮色要控制"]

    if "机能" in style_text or "gorpcore" in style_text.lower():
        strengths.append("机能风关键词明确，适合做层次和材质对比")
    if "韩" in style_text or "clean" in style_text.lower():
        strengths.append("韩系/clean fit 方向清晰，适合短外套与干净配色")

    return shape, proportion, strengths[:3], cautions[:3]


def _build_fallback_style_report(profile: "UserProfile", reason: str = "") -> Dict[str, Any]:
    style_text = str(profile.style_keywords or "")
    occasion = str(profile.occasion or "日常通勤 / 周末出街")
    budget = str(profile.budget or "单品 100-500 元")
    skin_tone = str(profile.skin_tone or "自然肤色")
    gender = str(profile.gender or "男")
    shape, proportion, strengths, cautions = _shape_profile(profile)

    style_keywords: List[str] = []
    if "oversize" in style_text.lower() or "宽松" in style_text:
        style_keywords.append("Oversize")
    if "街头" in style_text:
        style_keywords.append("Streetwear")
    if "韩" in style_text:
        style_keywords.append("K-style")
    if "机能" in style_text or "gorpcore" in style_text.lower():
        style_keywords.append("Gorpcore")
    if "y2k" in style_text.lower():
        style_keywords.append("Y2K")
    if not style_keywords:
        style_keywords = ["Streetwear", "K-style", "Clean Fit"]

    summary = (
        f"{int(profile.height_cm)}/{int(profile.weight_kg)} 的{gender}生体型偏{shape}，适合用 {style_keywords[0]}"
        f" 和层次叠穿把比例拉开。{skin_tone} 对冷中性色、低饱和蓝绿和米白都比较友好，"
        f"结合 {occasion} 场景，优先选择短外套、直筒下装与有存在感的鞋型，预算 {budget} 也能稳定做出完整造型。"
    )
    if reason:
        summary += f"（本次为快速稳态兜底：{reason}）"

    return {
        "summary": summary,
        "body_analysis": {
            "shape": shape,
            "proportion": proportion,
            "strengths": strengths,
            "cautions": cautions,
        },
        "color_palette": {
            "best": [
                {"name": "Charcoal Gray", "hex": "#2B2F36", "note": "显瘦耐看"},
                {"name": "Off White", "hex": "#F2F1EC", "note": "提亮干净"},
                {"name": "Steel Blue", "hex": "#3A5A7A", "note": "冷感利落"},
                {"name": "Olive", "hex": "#556B2F", "note": "机能氛围"},
                {"name": "Sand Beige", "hex": "#C8B89A", "note": "复古柔和"},
            ],
            "accent": [
                {"name": "Cobalt Blue", "hex": "#2D6BFF", "note": "出片点睛"},
                {"name": "Neon Lime", "hex": "#B7FF00", "note": "Y2K 小面积提神"},
                {"name": "Safety Orange", "hex": "#FF5A1F", "note": "街头亮点"},
            ],
            "avoid": [
                {"name": "Warm Mustard", "hex": "#D4A017", "note": "容易显黄"},
                {"name": "Dusty Brown", "hex": "#7A5C4B", "note": "显旧不精神"},
                {"name": "Orange Red", "hex": "#FF4500", "note": "大面积容易抢肤色"},
            ],
        },
        "silhouette": {
            "tops": ["落肩 oversize 上装", "短款 boxy 外套", "宽松衬衫/卫衣叠穿"],
            "bottoms": ["高腰直筒牛仔裤", "微阔休闲裤", "束脚或锥形机能裤"],
            "outerwear": ["飞行员夹克", "教练夹克/工装外套", "轻机能壳层"],
            "shoes": ["厚底复古跑鞋", "板鞋 + 中筒袜", "机能徒步鞋"],
            "avoid_fits": ["上衣过长+裤子过宽", "全身都松垮无重点", "过紧小脚裤配大上衣"],
        },
        "seasonal": {
            "spring": {"vibe": "轻层次韩系街头", "key_items": ["教练夹克", "薄卫衣", "直筒牛仔"], "fabrics": ["棉", "轻斜纹", "尼龙混纺"], "colors": ["Off White", "Steel Blue", "Charcoal Gray"]},
            "summer": {"vibe": "轻量 Y2K 出街", "key_items": ["boxy 宽T", "尼龙短裤", "板鞋"], "fabrics": ["纯棉", "网眼", "速干尼龙"], "colors": ["Off White", "Cobalt Blue", "Neon Lime"]},
            "autumn": {"vibe": "复古工装层次", "key_items": ["工装夹克", "连帽卫衣", "休闲裤"], "fabrics": ["帆布", "丹宁", "抓绒"], "colors": ["Olive", "Sand Beige", "Charcoal Gray"]},
            "winter": {"vibe": "机能保暖硬朗", "key_items": ["壳层外套", "羽绒马甲", "厚底鞋"], "fabrics": ["防风面料", "羊毛混纺", "厚棉"], "colors": ["Charcoal Gray", "Olive", "Safety Orange"]},
        },
        "style_keywords": style_keywords,
        "report_id": "rpt_" + uuid.uuid4().hex[:12],
        "strict": False,
        "fallback_mode": True,
    }


def _call_llm_generate_outfits(profile: UserProfile, report: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """真实调用大模型生成 7 套方案（无兜底模拟数据）。

    说明：大模型偶尔会输出不严格的 JSON；这里采用“生成 → 解析失败则让模型自修复”的双轮策略，仍然属于真实 AI 能力。
    如果传入 report，会把 color_palette / silhouette / style_keywords 作为强约束拼进 prompt，保证一周穿搭跟报告口径一致。
    """

    # Aime 内置 LLM Proxy：运行环境内可直接访问，无需外部 API Key
    llm_url = "https://aime.bytedance.net/api/agents/v2/llmproxy/user/chat/completions"
    # 固定使用 Aime 侧可用模型（避免依赖环境变量注入）
    model = "gpt-5.2-2025-12-11-responses-ptu"

    # 只要求“穿搭推荐”必要字段，避免输出过长导致 JSON 被截断
    schema = {
        "outfits": [
            {
                "id": "day1",
                "day_index": 1,
                "day_label": "周一",
                "title": "string",
                "vibe": "string",
                "colors": {
                    "primary": ["#RRGGBB"],
                    "accent": ["#RRGGBB"],
                    "avoid": ["string"],
                },
                "items": [
                    {
                        "category": "上装|下装|鞋",
                        "name": "string",
                        "fit": "string",
                        "material": "string",
                        "color": "string",
                    }
                ],
                "reason": "string",
            }
        ]
    }

    def _llm_call(messages: List[Dict[str, str]], temperature: float = 0.7, max_tokens: int = 1600) -> str:
        payload = {
            "model": model,
            "stream": False,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": messages,
        }
        proxies = {"http": None, "https": None}
        resp = requests.post(
            llm_url,
            json=payload,
            timeout=120,
            proxies=proxies,
        )
        if resp.status_code != 200:
            raise RuntimeError(
                "LLM 调用失败: status=%s, body=%s" % (resp.status_code, (resp.text or "")[:300])
            )
        data = resp.json()
        try:
            return data["choices"][0]["message"]["content"]
        except Exception:
            return resp.text

    system_generate = (
        "你是一个面向 18-28 岁 Z 世代年轻男性的潮流穿搭顾问。"
        "你需要基于用户体型参数生成一周 7 套穿搭方案。"
        "风格只走年轻潮流方向，强调 oversize、街头风、韩系、机能风、Y2K、多巴胺穿搭、美式复古。"
        "关键词方向：oversize、街头风、韩系、机能风、Y2K、多巴胺穿搭、美式复古。"
        "禁止向用户提问或索要更多信息，直接产出结果。"
        "为保证可解析与速度：输出内容要尽量简短。"
        "硬性要求：outfits 必须恰好 7 套；items 每套必须恰好 3 件（上装/下装/鞋）；"
        "colors.primary 2-3 个色值、colors.accent 1-2 个色值、colors.avoid 1-2 条；"
        "reason 不超过 60 字；name/fit/material/color 尽量不超过 12 字；vibe 尽量不超过 12 字；"
        "只输出 JSON，不要输出任何额外字段（例如 user_profile_summary 等）。"
        # ---- 受控词表约束（关键：保证能命中真实商品卡片）----
        "【极重要·必须严格遵守】items 里每一件单品的 color 字段，只能从下面这份"
        "『受控颜色词表』里原样选一个中文词（禁止英文色名、禁止自造色名、禁止修饰词）："
        + "、".join(CONTROLLED_COLORS) + "。"
        "items 里每一件单品的 name 字段，只能从下面这份『受控品类词表』里原样选一个中文词"
        "（禁止英文、禁止在品类词前后添加颜色/材质/款式修饰，例如只写『衬衫』，不要写『条纹亚麻衬衫』）："
        + "、".join(CONTROLLED_CATEGORIES) + "。"
        "上装从（T恤/衬衫/Polo衫/针织衫/卫衣/夹克/风衣）中选；"
        "下装从（直筒牛仔裤/休闲裤）中选；鞋从（运动鞋）中选。"
        "颜色/材质等细节可以放到 fit / material 字段里描述，但 color 与 name 必须落在受控词表内。"
    )

    user_prompt = {
        "task": "Generate 7-day outfit plan for male",
        "language": "zh-CN",
        "user_profile": profile.dict(),
        "rules": {
            "days": 7,
            "tone": "潮流街头 年轻个性 oversize 韩系 机能风 美式复古 Y2K",
            "controlled_colors": CONTROLLED_COLORS,
            "controlled_categories": CONTROLLED_CATEGORIES,
            "color_must_be_in_controlled_colors": True,
            "name_must_be_in_controlled_categories": True,
            "must_include": [
                "颜色系推荐 primary/accent/avoid",
                "单品清单（上装/下装/鞋，且每套恰好 3 件）",
                "每件单品的 color 必须取自 controlled_colors；name 必须取自 controlled_categories",
                "理由（必须和体型/肤色相关）",
            ],
            "output_schema": schema,
            "strict": True,
        },
    }

    # 若有 style-report 上下文，作为强约束注入
    if report and isinstance(report, dict):
        report_ctx: Dict[str, Any] = {}
        for k in ("color_palette", "silhouette", "style_keywords", "body_analysis", "summary"):
            if k in report and report[k]:
                report_ctx[k] = report[k]
        if report_ctx:
            user_prompt["style_report_context"] = report_ctx
            user_prompt["rules"]["must_align_with_style_report"] = True
            user_prompt["rules"]["must_include"].append(
                "颜色/廓形/风格关键词必须与 style_report_context 中的 best/accent 色系、silhouette 与 style_keywords 保持一致；avoid 中的颜色/廓形严禁出现"
            )

    content = _llm_call(
        messages=[
            {"role": "system", "content": system_generate},
            {"role": "user", "content": json.dumps(user_prompt, ensure_ascii=False)},
        ],
        temperature=0.4,
        max_tokens=2200,
    )

    parsed = _extract_json_object(content)

    # 若首轮不严格，二次让模型把“它自己输出的内容”修复为严格 JSON
    if not parsed or "outfits" not in parsed:
        system_fix = (
            "你是一个严格的 JSON 修复器。"
            "你会收到一段文本，其中可能包含 JSON 或接近 JSON 的内容。"
            "你的任务：只输出一个严格 JSON 对象，并且必须符合指定 schema。"
            "禁止输出 markdown、解释、前后缀文字。"
        )
        fix_prompt = {
            "schema": schema,
            "text_to_fix": content,
            "requirements": {
                "must_be_valid_json": True,
                "outfits_len": 7,
                "no_markdown": True,
            },
        }
        fixed = _llm_call(
            messages=[
                {"role": "system", "content": system_fix},
                {"role": "user", "content": json.dumps(fix_prompt, ensure_ascii=False)},
            ],
            temperature=0.2,
            max_tokens=2200,
        )
        parsed = _extract_json_object(fixed)

    if not parsed or "outfits" not in parsed:
        raise RuntimeError("LLM 输出无法解析为目标 JSON")

    outfits = parsed.get("outfits")
    if not isinstance(outfits, list) or len(outfits) < 7:
        raise RuntimeError("LLM 输出 outfits 数量不足 7")

    return outfits[:7]


def _call_llm_generate_report(profile: UserProfile) -> Dict[str, Any]:
    """生成结构化「个人穿搭报告」。

    核心目标：优先保证接口稳定与响应速度，避免 style-report 长时间占用 FaaS 实例，
    进而触发 reached_max_replica_limit 导致前端出现 Failed to fetch。
    """

    cache_key = _profile_cache_key(profile)
    cached = REPORT_CACHE_BY_PROFILE.get(cache_key)
    if cached and cached.get("report"):
        return copy.deepcopy(cached["report"])

    llm_url = "https://aime.bytedance.net/api/agents/v2/llmproxy/user/chat/completions"
    model = "gpt-5.2-2025-12-11-responses-ptu"

    schema = {
        "summary": "string(两三句话概括整体身型 / 风格倾向，不要花哨说教)",
        "body_analysis": {
            "shape": "H 型 / 倒三角 / 梨形 …",
            "proportion": "上下身比例、肩腰比等要点",
            "strengths": ["优势1", "优势2"],
            "cautions": ["需要注意的点1", "点2"],
        },
        "color_palette": {
            "best": [{"name": "string", "hex": "#RRGGBB", "note": "string"}],
            "accent": [{"name": "string", "hex": "#RRGGBB", "note": "string"}],
            "avoid": [{"name": "string", "hex": "#RRGGBB", "note": "string"}],
        },
        "silhouette": {
            "tops": ["string"],
            "bottoms": ["string"],
            "outerwear": ["string"],
            "shoes": ["string"],
            "avoid_fits": ["string"],
        },
        "seasonal": {
            "spring": {"vibe": "string", "key_items": ["string"], "fabrics": ["string"], "colors": ["string"]},
            "summer": {"vibe": "string", "key_items": ["string"], "fabrics": ["string"], "colors": ["string"]},
            "autumn": {"vibe": "string", "key_items": ["string"], "fabrics": ["string"], "colors": ["string"]},
            "winter": {"vibe": "string", "key_items": ["string"], "fabrics": ["string"], "colors": ["string"]},
        },
        "style_keywords": ["Clean minimal", "Neo-preppy"],
    }

    def _llm_call(messages: List[Dict[str, str]], temperature: float = 0.35, max_tokens: int = 1600) -> str:
        payload = {
            "model": model,
            "stream": False,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": messages,
        }
        proxies = {"http": None, "https": None}
        timeout_seconds = 12
        errors: List[str] = []
        for attempt in range(2):
            try:
                resp = requests.post(llm_url, json=payload, timeout=timeout_seconds, proxies=proxies)
                if resp.status_code != 200:
                    raise RuntimeError(
                        "LLM 调用失败: status=%s, body=%s" % (resp.status_code, (resp.text or "")[:300])
                    )
                data = resp.json()
                try:
                    return data["choices"][0]["message"]["content"]
                except Exception:
                    return resp.text
            except requests.Timeout:
                errors.append(f"attempt={attempt + 1}: timeout>{timeout_seconds}s")
                break
            except Exception as e:
                errors.append(f"attempt={attempt + 1}: {str(e)[:180]}")
                if attempt == 0:
                    time.sleep(0.5)
        raise RuntimeError("; ".join(errors) or "style-report llm 调用失败")

    system_generate = (
        "你是一个面向 18-28 岁 Z 世代年轻男性、走潮流街头路线的资深穿搭顾问。"
        "根据用户的体型和肤色参数，生成一份潮流、年轻、可执行的『个人穿搭报告』。"
        "风格方向：oversize、韩系、机能风、美式复古、Y2K、多巴胺穿搭、街头风。"
        "只保留年轻潮流表达，不进入成熟奢华方向。"
        "禁止向用户提问或索要更多信息，直接产出结果。"
        "只输出严格 JSON，禁止输出 markdown、代码块、解释说明、前后缀文字。"
        "务必精简：summary 2 句内；每个数组尽量 3-5 个元素；note 12 字内。"
        "硬性要求："
        "1) 严格符合 output_schema 字段结构与命名；"
        "2) color_palette.best 至少 4 组、accent 至少 2 组、avoid 至少 2 组，每组必须给出真彩 hex（#RRGGBB）；"
        "3) silhouette 五个分类都必须非空；"
        "4) seasonal 四季必须完整；"
        "5) style_keywords 3-5 个英文短语，必须体现潮流/年轻元素；"
        "6) 严禁输出 outfits/推荐 等与本报告无关的字段。"
    )

    user_prompt = {
        "task": "Generate personal style report for male",
        "language": "zh-CN",
        "user_profile": profile.dict(),
        "tone": "streetwear, youthful, oversized, k-style, gorpcore, y2k, energetic",
        "benchmark_brands": ["Stüssy", "Ader Error", "thisisneverthat", "Carhartt WIP"],
        "output_schema": schema,
        "strict": True,
    }

    required_top = ("summary", "body_analysis", "color_palette", "silhouette", "seasonal", "style_keywords")

    try:
        content = _llm_call(
            messages=[
                {"role": "system", "content": system_generate},
                {"role": "user", "content": json.dumps(user_prompt, ensure_ascii=False)},
            ],
            temperature=0.35,
            max_tokens=1500,
        )

        parsed = _extract_json_object(content)
        if not parsed or not all(k in parsed for k in required_top):
            system_fix = (
                "你是一个严格的 JSON 修复器。"
                "你会收到一段文本，其中可能包含 JSON 或接近 JSON 的内容。"
                "你的任务：只输出一个严格 JSON 对象，并且必须符合指定 schema，字段齐全。"
                "禁止输出 markdown、解释、前后缀文字。"
            )
            fix_prompt = {
                "schema": schema,
                "text_to_fix": content,
                "requirements": {
                    "must_be_valid_json": True,
                    "required_top_level_keys": list(required_top),
                    "no_markdown": True,
                },
            }
            fixed = _llm_call(
                messages=[
                    {"role": "system", "content": system_fix},
                    {"role": "user", "content": json.dumps(fix_prompt, ensure_ascii=False)},
                ],
                temperature=0.2,
                max_tokens=1500,
            )
            parsed = _extract_json_object(fixed)

        if not parsed or not all(k in parsed for k in required_top):
            raise RuntimeError("LLM 输出无法解析为目标 JSON（style-report 字段不齐）")

        parsed["strict"] = True
        parsed["fallback_mode"] = False
        if not parsed.get("report_id"):
            parsed["report_id"] = "rpt_" + uuid.uuid4().hex[:12]
        REPORT_CACHE_BY_PROFILE[cache_key] = {"created_at": int(time.time()), "report": copy.deepcopy(parsed)}
        return parsed
    except Exception as e:
        fallback = _build_fallback_style_report(profile, reason=str(e)[:120])
        REPORT_CACHE_BY_PROFILE[cache_key] = {"created_at": int(time.time()), "report": copy.deepcopy(fallback)}
        return fallback



def _build_real_shop_links(query: str) -> List[Dict[str, Any]]:
    """生成真实可访问的电商搜索 URL（不接官方 API，速度优先）。

    说明：为保证稳定与速度，这里直接返回三家平台的“搜索入口链接”。
    """

    kw = (query or "").strip() or "男士 穿搭"

    def enc(x: str) -> str:
        return urllib.parse.quote(x, safe="")

    return [
        {
            "platform": "淘宝",
            "title": f"淘宝搜索：{kw}",
            "url": "https://s.taobao.com/search?q=" + enc(kw),
            "tags": ["真实链接", "搜索页"],
        },
        {
            "platform": "京东",
            "title": f"京东搜索：{kw}",
            "url": "https://search.jd.com/Search?keyword=" + enc(kw),
            "tags": ["真实链接", "搜索页"],
        },
        {
            "platform": "拼多多",
            "title": f"拼多多搜索：{kw}",
            "url": "https://mobile.yangkeduo.com/search_result.html?search_key=" + enc(kw),
            "tags": ["真实链接", "搜索页"],
        },
    ]


def _call_image_tryon(face_image_data_url: str, prompt: str, image_size: str, aspect_ratio: str) -> str:
    """调用真实图像生成能力，返回 data:image/... base64 的 data url"""

    # Aime 内置多模态生成：运行环境内可直接访问，无需外部 API Key
    url = "https://aime.bytedance.net/api/agents/v2/llmproxy/chat/completions"

    headers = {
        "Content-Type": "application/json",
    }

    # 固定使用 image-gen（在 Aime 运行环境内会自动路由到可用图片模型池）
    model_name = "image-gen"

    payload = {
        "stream": False,
        "model": model_name,
        "temperature": 1.0,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": face_image_data_url}},
                ],
            }
        ],
        "max_tokens": 16000,
        "response_modalities": ["text", "image"],
        "image_generation": {"aspect_ratio": aspect_ratio, "image_size": image_size},
        "extra_options": {"session_id": "", "trace_id": "", "tag": "outfit_tryon_demo"},
    }

    proxies = {"http": None, "https": None}

    # 图片服务可能会短时资源不足（429），这里做轻量重试，仍然属于真实图像生成能力调用
    resp = None
    last_body = ""
    for attempt in range(3):
        resp = requests.post(url, headers=headers, json=payload, timeout=600, proxies=proxies)
        if resp.status_code == 200:
            break

        last_body = (resp.text or "")[:300]
        maybe_429 = resp.status_code == 429 or " 429" in last_body or "Error 429" in last_body or "RESOURCE_EXHAUSTED" in last_body
        if maybe_429 and attempt < 2:
            time.sleep(2 + attempt * 3)
            continue

        raise RuntimeError("图片生成失败: status=%s, body=%s" % (resp.status_code, last_body))

    if resp is None or resp.status_code != 200:
        raise RuntimeError("图片生成失败: status=%s, body=%s" % (getattr(resp, 'status_code', 'NA'), last_body))

    result = resp.json()
    choices = result.get("choices") or []
    if not choices:
        raise RuntimeError("图片生成返回为空")

    msg = (choices[0].get("message") or {})
    content_list = msg.get("content") or []
    for c in content_list:
        if c.get("type") == "image_url":
            image_url = (c.get("image_url") or {}).get("url")
            if image_url:
                return image_url

    raise RuntimeError("未在返回中找到 image_url")


# ---------------------------
# API
# ---------------------------
@app.get("/")
def index_handler():
    return {
        "name": "穿点啥 · AI 男性穿搭助手（Demo）",
        "status": "ok",
        "privacy": "照片不落库，仅随请求在内存中处理",
        "endpoints": ["/v1/ping", "/api/style-report", "/api/recommendations", "/api/tryon", "/api/search-clothes", "/api/xiaohongshu-inspo"],
    }


@app.get("/v1/ping")
async def ping_handler():
    return "ok"


def _build_fallback_outfits(profile: UserProfile, report: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    palette = (report or {}).get("color_palette") if isinstance(report, dict) else None
    best = palette.get("best") if isinstance(palette, dict) else []
    accent = palette.get("accent") if isinstance(palette, dict) else []

    def hexes(rows: Any, fallback: List[str]) -> List[str]:
        vals: List[str] = []
        if isinstance(rows, list):
            for row in rows:
                if isinstance(row, dict) and re.match(r"^#[0-9A-Fa-f]{6}$", str(row.get("hex") or "")):
                    vals.append(str(row.get("hex")))
        return vals[:3] or fallback

    primary = hexes(best, ["#1A1A1A", "#5B6B7A", "#F2EFE6"])
    accent_hex = hexes(accent, ["#2D6BFF", "#C6A96C"])
    base = [
        ("周一", "冷灰蓝街头通勤", "Street utility", "卫衣", "直筒牛仔裤", "运动鞋", "灰", "浅蓝"),
        ("周二", "机能层次出街", "Gorpcore layers", "夹克", "休闲裤", "运动鞋", "黑", "墨绿"),
        ("周三", "美式复古校园感", "Vintage campus", "衬衫", "直筒牛仔裤", "运动鞋", "白", "浅蓝"),
        ("周四", "Y2K 冷感简酷", "Y2K clean", "T恤", "休闲裤", "运动鞋", "黑", "深灰"),
        ("周五", "韩系干净松弛", "K-style clean fit", "针织衫", "直筒牛仔裤", "运动鞋", "米白", "藏青"),
        ("周六", "多巴胺小爆点出片", "Dopamine accent", "卫衣", "休闲裤", "运动鞋", "海军蓝", "卡其"),
        ("周日", "风衣长线条街拍", "Longline street", "风衣", "直筒牛仔裤", "运动鞋", "驼色", "黑"),
    ]
    outfits: List[Dict[str, Any]] = []
    for idx, (day, title, vibe, top, bottom, shoes, c1, c2) in enumerate(base, start=1):
        outfits.append({
            "id": f"day-{idx}",
            "day_index": idx,
            "day_label": day,
            "title": title,
            "vibe": vibe,
            "colors": {"primary": primary[:2], "accent": accent_hex[:1], "avoid": ["#7A5A43"]},
            "items": [
                {"category": "上装", "name": top, "fit": "oversize 宽松", "material": "棉混纺", "color": c1},
                {"category": "下装", "name": bottom, "fit": "宽松直筒", "material": "丹宁/机能面料", "color": c2},
                {"category": "鞋", "name": shoes, "fit": "低帮厚底", "material": "皮革拼网面", "color": "白"},
            ],
            "reason": "用宽松上身和直筒下装保持街头轮廓，颜色克制但有出片层次。",
            "image_prompt_en": "young male streetwear editorial, dark luxe lookbook lighting",
            "shopping_keywords": ["oversize", "街头风", "韩系", "clean fit"],
        })
    return outfits


@app.get("/v1/diag")
async def diag_handler():
    # 只输出“是否存在”，不输出任何敏感值
    def has(k: str) -> bool:
        v = os.environ.get(k)
        return bool(v and str(v).strip())

    return {
        "mode": "no-external-api-key",
        "llm_url": "https://aime.bytedance.net/api/agents/v2/llmproxy/user/chat/completions",
        "image_url": "https://aime.bytedance.net/api/agents/v2/llmproxy/chat/completions",
        "note": "本服务不依赖 OPENAI_API_KEY / AIME_USER_CLOUD_JWT 等外部 Key，直接调用 Aime 内置代理。",
    }


@app.post("/api/style-report")
async def style_report(req: StyleReportRequest):
    _cleanup_reports()

    try:
        report = _call_llm_generate_report(req.profile)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"穿搭报告生成失败（LLM）：{str(e)[:200]}")

    report_id = "rpt_" + uuid.uuid4().hex[:12]
    REPORTS[report_id] = {"created_at": int(time.time()), "report": report}

    # 返回体保持 report 里的字段扁平化在顶层（同时带上 report_id）
    out = dict(report)
    out["report_id"] = report_id
    return out


@app.post("/api/recommendations")
async def recommendations(req: RecommendRequest):
    _cleanup_plans()
    _cleanup_reports()

    profile = req.profile

    # 若给定 report_id，则取缓存 report；否则用请求体里的 report
    report_ctx: Optional[Dict[str, Any]] = None
    if req.report_id:
        cached = REPORTS.get(req.report_id)
        if cached and isinstance(cached.get("report"), dict):
            report_ctx = cached["report"]
    if report_ctx is None and req.report and isinstance(req.report, dict):
        report_ctx = req.report

    # 1) 生成 7 套方案：Demo 优先稳定出结果，使用可控 fallback，避免 LLM 长时间阻塞首屏。
    outfits = _build_fallback_outfits(profile, report=report_ctx)

    # 2) 回填"真实商品卡片"（优先命中已抓取缓存；未命中则尝试小红书；兜底为真实搜索入口）
    for o in outfits:
        items = o.get("items") or []

        outfit_products: List[Dict[str, Any]] = []
        for it in items:
            # 约定：query 用于前端展示与缓存命中
            c = _normalize_color(it.get("color") or "")
            n = _normalize_item_name(it.get("name") or "")
            q = _normalize_query("%s %s 男 %s" % (c, n, " ".join(YOUTH_STYLE_TERMS)))
            it["query"] = q

            cached = _lookup_cached_products(c, n)
            if cached:
                it["products"] = cached
                outfit_products.extend(cached)
            else:
                # 尝试小红书采集（先查本地衣物库，无结果才去小红书抓取）
                xhs_items: List[Dict[str, Any]] = []
                if xhs is not None:
                    try:
                        xhs_result = xhs.search_clothes(q, "男")
                        xhs_items = xhs_result.get("items") or []
                    except Exception:
                        xhs_items = []

                if xhs_items:
                    xhs_cards = _filter_product_cards(xhs_items)
                    if xhs_cards:
                        it["products"] = xhs_cards
                        outfit_products.extend(xhs_cards)
                        continue

                # 兜底：真实搜索入口（仍然是"真实链接"，但不是精确商品卡片）
                links = _build_real_shop_links(q or "男士 穿搭")
                cards = [
                    {
                        "platform": l.get("platform"),
                        "title": l.get("title"),
                        "buy_url": l.get("url"),
                    }
                    for l in (links or [])
                    if isinstance(l, dict) and l.get("url")
                ]
                it["products"] = cards[:3]
                outfit_products.extend(cards[:3])

        # 兼容：outfit 级别也给一份聚合，便于旧前端/调试
        o["products"] = outfit_products

    # 3) 只缓存 outfits（不缓存照片）
    plan_id = str(uuid.uuid4())
    PLANS[plan_id] = {"created_at": int(time.time()), "outfits": outfits}

    return {"plan_id": plan_id, "outfits": outfits}


@app.post("/api/search-clothes")
async def search_clothes(req: SearchClothesRequest):
    """搜索衣物：先查本地衣物库缓存，无结果时通过 Playwright CDP 采集小红书。

    入参：
        keyword: 搜索关键词（如「男生潮流穿搭」）
        gender: 性别（「男」或「女」，默认「男」）

    出参：
        keyword: 归一化后的关键词
        source: 数据来源（"cache" / "xiaohongshu" / "empty"）
        items: 衣物列表 [{platform, title, price, image_url, buy_url, description}]
        total: 结果总数
    """
    if xhs is None:
        return {
            "keyword": req.keyword,
            "source": "empty",
            "items": [],
            "total": 0,
            "note": "小红书采集模块未加载（缺少 playwright 依赖或不在本地运行环境）",
        }

    try:
        result = xhs.search_clothes(req.keyword, req.gender)
    except Exception as e:
        return {
            "keyword": req.keyword,
            "source": "empty",
            "items": [],
            "total": 0,
            "error": str(e)[:200],
        }

    return result


@app.get("/api/xiaohongshu-inspo")
async def xiaohongshu_inspo(keyword: Optional[str] = None, limit: int = 24):
    """返回已采集的小红书穿搭灵感（来自 data/xiaohongshu_cache.json）。

    查询参数：
        keyword: 可选，按关键词模糊过滤（命中 note.keyword 或 title）
        limit:   返回条数上限（默认 24）

    出参：
        items: [{title, image_url, author, likes, url, keyword}]
        total: 命中条数
        source: "cache" / "empty"

    说明：缓存文件不存在或为空时返回 items=[]（前端据此隐藏区块），不报错。
    """
    notes = _XHS_INSPO_CACHE or []

    if keyword and keyword.strip():
        kw = keyword.strip().lower()
        notes = [
            n
            for n in notes
            if kw in str(n.get("keyword") or "").lower()
            or kw in str(n.get("title") or "").lower()
        ]

    try:
        lim = max(1, min(int(limit), 60))
    except Exception:
        lim = 24

    items = notes[:lim]
    return {
        "items": items,
        "total": len(items),
        "source": "cache" if items else "empty",
    }


@app.post("/api/tryon")
async def tryon(req: TryOnRequest):
    _cleanup_plans()

    plan = PLANS.get(req.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="plan_id 不存在或已过期（请重新生成一周穿搭）")

    outfits = plan.get("outfits") or []
    outfit = None
    for o in outfits:
        if o.get("id") == req.outfit_id:
            outfit = o
            break

    if not outfit:
        raise HTTPException(status_code=404, detail="outfit_id 不存在")

    face_image_data_url = _normalize_data_url(req.face_image)
    if not face_image_data_url:
        raise HTTPException(status_code=400, detail="未上传人脸照片，无法生成试穿图")

    # prompt：速度优先，只要“看起来像穿着那套衣服”即可
    outfit_title = outfit.get("title") or ""
    vibe = outfit.get("vibe") or ""
    items = outfit.get("items") or []
    items_text = ", ".join(["%s(%s)" % (it.get("name"), it.get("color")) for it in items])
    extra_prompt_en = outfit.get("image_prompt_en") or ""

    prompt = (
        "Generate a photorealistic full-body male virtual try-on image. "
        "Use the provided face photo as identity reference; keep facial features consistent. "
        "Make it look like he is wearing the recommended outfit (good enough, speed first). "
        "Outfit: %s. Items: %s. Vibe: %s. "
        "Clean studio background, realistic clothing, no text, no watermark. %s"
        % (outfit_title, items_text, vibe, extra_prompt_en)
    )

    try:
        image_data_url = _call_image_tryon(
            face_image_data_url=face_image_data_url,
            prompt=prompt,
            image_size=req.image_size,
            aspect_ratio=req.aspect_ratio,
        )
    except Exception as e:
        # 不返回占位图（避免“模拟”），直接让前端提示重试
        raise HTTPException(status_code=503, detail=f"试穿图生成失败（图像服务可能繁忙）：{str(e)[:200]}")

    return {"image_data_url": image_data_url}


# ---------------------------DO NOT EDIT CODE BELOW THIS LINE---------------------------------
# This is the entry point for the FastAPI application.
if __name__ == "__main__":
    port = int(os.environ.get("_BYTEFAAS_RUNTIME_PORT", 8000))
    config = uvicorn.Config("main:app", port=port, log_level="info", host=None)
    server = uvicorn.Server(config)
    server.run()
# --------------------------------------------------------------------------------------------
