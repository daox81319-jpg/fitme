"""
小红书采集模块 — 本地衣物库

功能：
- 通过 Playwright 连接本地 Chrome CDP（ws://localhost:9222）采集小红书搜索结果
- 支持本地衣物库缓存，搜索前先查本地库，无结果才去小红书采集
- 缓存文件：data/clothes_library.json

注意：
- 不启动新 Chrome，只连接已在运行的 CDP
- CDP 不可用时返回空结果（不报错）
- 小红书可能有登录态要求，遇登录墙时返回空结果
"""

import json
import os
import re
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

# --- 常量 ---
CDP_URL = "http://localhost:9222"
CLOTHES_LIBRARY_PATH = os.path.join(os.path.dirname(__file__), "data", "clothes_library.json")
CST = timezone(timedelta(hours=8))

# 每个关键词最多缓存的结果数
MAX_RESULTS_PER_QUERY = 20

# 缓存有效期（秒）：24 小时
CACHE_TTL_SECONDS = 24 * 60 * 60


# --- 本地衣物库读写 ---
def _load_library() -> Dict[str, Any]:
    """加载本地衣物库"""
    try:
        if os.path.exists(CLOTHES_LIBRARY_PATH):
            with open(CLOTHES_LIBRARY_PATH, "r", encoding="utf-8") as f:
                return json.load(f) or {}
    except Exception:
        pass
    return {"version": 1, "updated_at": "", "queries": {}}


def _save_library(lib: Dict[str, Any]) -> None:
    """保存本地衣物库"""
    os.makedirs(os.path.dirname(CLOTHES_LIBRARY_PATH), exist_ok=True)
    with open(CLOTHES_LIBRARY_PATH, "w", encoding="utf-8") as f:
        json.dump(lib, f, ensure_ascii=False, indent=2)


def _normalize_keyword(kw: str) -> str:
    """归一化关键词"""
    return re.sub(r"\s+", " ", (kw or "").strip())


def _is_cache_fresh(updated_at: str) -> bool:
    """判断缓存是否在有效期内"""
    if not updated_at:
        return False
    try:
        dt = datetime.fromisoformat(updated_at)
        now = datetime.now(CST)
        return (now - dt).total_seconds() < CACHE_TTL_SECONDS
    except Exception:
        return False


def _search_local_library(keyword: str) -> Optional[List[Dict[str, Any]]]:
    """在本地衣物库中搜索，命中则返回缓存结果，否则返回 None"""
    lib = _load_library()
    queries = lib.get("queries") or {}
    kw = _normalize_keyword(keyword)

    if not queries:
        return None

    # 精确匹配
    if kw in queries:
        return queries[kw]

    # 模糊匹配：去空格后关键词包含关系
    kw_compact = kw.replace(" ", "")
    for k, v in queries.items():
        k_compact = k.replace(" ", "")
        if kw_compact in k_compact or k_compact in kw_compact:
            return v

    return None


def _save_to_local_library(keyword: str, results: List[Dict[str, Any]]) -> None:
    """保存采集结果到本地衣物库"""
    lib = _load_library()
    if "queries" not in lib:
        lib["queries"] = {}
    kw = _normalize_keyword(keyword)
    lib["queries"][kw] = results[:MAX_RESULTS_PER_QUERY]
    lib["updated_at"] = datetime.now(CST).isoformat()
    _save_library(lib)


# --- 小红书采集（通过 Playwright CDP） ---
def _check_cdp_available() -> bool:
    """检查 Chrome CDP 是否可用"""
    try:
        import urllib.request
        req = urllib.request.Request(CDP_URL + "/json/version")
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return "Browser" in (data or {})
    except Exception:
        return False


def _scrape_xiaohongshu(keyword: str, gender: str) -> List[Dict[str, Any]]:
    """通过 Playwright 连接本地 Chrome CDP 采集小红书搜索结果

    Args:
        keyword: 搜索关键词（如「男生潮流穿搭」）
        gender: 性别（「男」或「女」）

    Returns:
        采集到的衣物列表，每项包含：
        - platform: "小红书"
        - title: 笔记标题
        - price: 价格（如有）
        - image_url: 图片 URL
        - buy_url: 笔记链接
        - description: 博主穿搭内容描述
    """
    if not _check_cdp_available():
        return []

    try:
        from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
    except ImportError:
        return []

    results: List[Dict[str, Any]] = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.connect_over_cdp(CDP_URL)

            # 使用已有的 context 或创建新页面
            contexts = browser.contexts
            if not contexts:
                return []
            context = contexts[0]

            page = context.new_page()
            try:
                # 构建搜索 URL
                encoded_kw = __import__("urllib.parse").quote(keyword)
                search_url = f"https://www.xiaohongshu.com/search_result?keyword={encoded_kw}&type=51"
                # type=51 是「商品」tab，更可能包含穿搭/购买相关笔记

                page.goto(search_url, wait_until="domcontentloaded", timeout=15000)

                # 等待页面加载，检测登录墙
                time.sleep(2)

                page_content = page.content()

                # 检测登录墙
                if "login" in page.url.lower() or "请登录" in page_content or "手机号登录" in page_content:
                    page.close()
                    return []

                # 等待搜索结果出现
                try:
                    # 小红书笔记卡片的常见选择器
                    page.wait_for_selector(
                        ".note-item, .feeds-page .note-item, section.note-item, "
                        "a[href*='/explore/'], a[href*='/discovery/item/'], "
                        "div[class*='note'], div[class*='card']",
                        timeout=8000,
                    )
                except PlaywrightTimeout:
                    pass

                # 额外等待渲染
                time.sleep(2)

                # 提取笔记卡片数据
                # 小红书的 DOM 结构可能变化，这里采用多策略提取
                note_cards = page.query_selector_all(
                    ".note-item, section.note-item, a[href*='/explore/'], "
                    "a[href*='/discovery/item/'], div[class*='note-item']"
                )

                for card in note_cards[:MAX_RESULTS_PER_QUERY]:
                    try:
                        title_el = card.query_selector(
                            ".title, .note-title, span[class*='title'], "
                            "a[class*='title'], div[class*='title']"
                        )
                        title = (title_el.inner_text() or "").strip() if title_el else ""

                        img_el = card.query_selector("img")
                        image_url = ""
                        if img_el:
                            image_url = (
                                img_el.get_attribute("src")
                                or img_el.get_attribute("data-src")
                                or ""
                            )

                        link_el = card.query_selector("a")
                        buy_url = ""
                        if link_el:
                            href = link_el.get_attribute("href") or ""
                            if href:
                                buy_url = (
                                    "https://www.xiaohongshu.com" + href
                                    if href.startswith("/")
                                    else href
                                )

                        price_el = card.query_selector(
                            ".price, span[class*='price'], "
                            "div[class*='price'], .discount-price"
                        )
                        price = (price_el.inner_text() or "").strip() if price_el else ""

                        desc_el = card.query_selector(
                            ".desc, .note-desc, span[class*='desc'], "
                            "div[class*='desc'], p"
                        )
                        description = (desc_el.inner_text() or "").strip() if desc_el else ""

                        # 至少要有标题或链接才保留
                        if not title and not buy_url:
                            continue

                        results.append({
                            "platform": "小红书",
                            "title": title or "小红书笔记",
                            "price": price or "",
                            "image_url": image_url,
                            "buy_url": buy_url,
                            "description": description,
                        })
                    except Exception:
                        continue

                page.close()

            except Exception:
                try:
                    page.close()
                except Exception:
                    pass
                return []

    except Exception:
        return []

    return results


# --- 公开接口 ---
def search_clothes(keyword: str, gender: str = "男") -> Dict[str, Any]:
    """搜索衣物：先查本地库，无结果才去小红书采集

    Args:
        keyword: 搜索关键词
        gender: 性别（「男」或「女」）

    Returns:
        {
            "keyword": str,
            "source": "cache" | "xiaohongshu" | "empty",
            "items": [...],
            "total": int,
        }
    """
    kw = _normalize_keyword(keyword)
    if not kw:
        return {"keyword": keyword, "source": "empty", "items": [], "total": 0}

    # 1) 先查本地库
    cached = _search_local_library(kw)
    if cached:
        return {
            "keyword": kw,
            "source": "cache",
            "items": cached,
            "total": len(cached),
        }

    # 2) 本地库无结果，尝试小红书采集
    scraped = _scrape_xiaohongshu(kw, gender)

    if scraped:
        # 存入本地库
        _save_to_local_library(kw, scraped)
        return {
            "keyword": kw,
            "source": "xiaohongshu",
            "items": scraped,
            "total": len(scraped),
        }

    # 3) 无结果
    return {
        "keyword": kw,
        "source": "empty",
        "items": [],
        "total": 0,
    }


def get_library_stats() -> Dict[str, Any]:
    """获取本地衣物库统计信息"""
    lib = _load_library()
    queries = lib.get("queries") or {}
    total_items = sum(len(v) for v in queries.values() if isinstance(v, list))
    return {
        "version": lib.get("version", 1),
        "updated_at": lib.get("updated_at", ""),
        "total_queries": len(queries),
        "total_items": total_items,
        "cdp_available": _check_cdp_available(),
    }
