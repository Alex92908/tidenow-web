"""联网搜索模块：为预测注入实时上下文。

引擎优先级：Google News RSS → Bing RSS → DuckDuckGo HTML（依次降级）。
前两者是稳定的免 key XML 接口，不依赖 JS 渲染，不易被反爬拦截。
搜索结果被压缩成简洁片段拼入后端 prompt，不改变后端逻辑。
"""
from __future__ import annotations

import html as html_mod
import re
import xml.etree.ElementTree as ET

import requests

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")


def _strip_tags(s: str) -> str:
    text = html_mod.unescape(re.sub(r"<[^>]+>", "", s or ""))
    return re.sub(r"\s+", " ", text).strip()


def _parse_rss(xml_text: str, max_results: int) -> list:
    """通用 RSS 解析：返回 [{title, snippet, url, date}]。"""
    results = []
    root = ET.fromstring(xml_text)
    for item in root.iter("item"):
        title = _strip_tags(item.findtext("title"))
        snippet = _strip_tags(item.findtext("description"))
        url = (item.findtext("link") or "").strip()
        date = (item.findtext("pubDate") or "").strip()
        if title:
            # Google News 的 description 常与标题重复，重复时丢弃
            core = title.split(" - ")[0][:30]
            if core and core in snippet:
                snippet = ""
            results.append({"title": title, "snippet": snippet[:200],
                            "url": url, "date": date})
        if len(results) >= max_results:
            break
    return results


def _search_google_news(query: str, max_results: int, timeout: int) -> list:
    resp = requests.get(
        "https://news.google.com/rss/search",
        params={"q": query, "hl": "zh-CN", "gl": "CN", "ceid": "CN:zh-Hans"},
        headers={"User-Agent": UA}, timeout=timeout,
    )
    resp.raise_for_status()
    return _parse_rss(resp.text, max_results)


def _search_bing_rss(query: str, max_results: int, timeout: int) -> list:
    resp = requests.get(
        "https://www.bing.com/search",
        params={"q": query, "format": "rss", "count": max_results + 4},
        headers={"User-Agent": UA}, timeout=timeout,
    )
    resp.raise_for_status()
    return _parse_rss(resp.text, max_results)


def _search_ddg(query: str, max_results: int, timeout: int) -> list:
    resp = requests.get(
        "https://html.duckduckgo.com/html/",
        params={"q": query},
        headers={"User-Agent": UA}, timeout=timeout,
    )
    resp.raise_for_status()
    results = []
    blocks = re.findall(
        r'class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)</a>.*?'
        r'class="result__snippet"[^>]*>(.*?)</(?:a|td|div)',
        resp.text, re.S,
    )
    for url, title, snippet in blocks[:max_results]:
        title, snippet = _strip_tags(title), _strip_tags(snippet)
        if title and snippet:
            results.append({"title": title, "snippet": snippet[:200],
                            "url": url, "date": ""})
    return results


ENGINES = [("google", _search_google_news), ("bing", _search_bing_rss), ("ddg", _search_ddg)]


def web_search(query: str, max_results: int = 6, timeout: int = 10) -> list:
    """依次尝试各引擎，返回 [{title, snippet, url, date}]；全部失败返回 []。"""
    for _name, fn in ENGINES:
        try:
            results = fn(query, max_results, timeout)
            if results:
                return results
        except Exception:
            continue
    return []


def format_context(results: list, max_chars: int = 1500) -> str:
    """把搜索结果格式化为可拼入 prompt 的上下文块。"""
    if not results:
        return ""
    lines = ["【实时搜索结果（供参考，请批判性使用；注意发布日期）】"]
    total = 0
    for r in results:
        date = f"（{r['date'][:16]}）" if r.get("date") else ""
        body = r["snippet"] or ""
        line = f"- {r['title']}{date}" + (f"：{body}" if body else "")
        if total + len(line) > max_chars:
            break
        lines.append(line)
        total += len(line)
    return "\n".join(lines)


def search_for_seed(seed: str, max_results: int = 6) -> str:
    """根据种子信息搜索，返回格式化的上下文字符串。"""
    query = seed[:120].replace("\n", " ")
    results = web_search(query, max_results=max_results)
    return format_context(results)
