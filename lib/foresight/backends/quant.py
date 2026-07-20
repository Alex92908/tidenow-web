"""quant：股票/期货量化信号后端。

设计原则：不用 LLM 预测价格（那是玄学），而是：
1. 拉取真实行情（akshare，多源；未安装则接受手动 CSV）
2. 计算 RSI / MACD / 布林带 / 动量
3. 输出"信号组合 + 历史基率"式的概率判断，而非点预测
4. LLM 只负责把信号翻译成人话 + 提示风险

数据源优先级：akshare 自动拉取 → 手动 CSV 兜底（akshare 网络不稳时）。
"""
from __future__ import annotations

import json
import statistics

import requests


def _try_fetch_sina(symbol: str, verbose=True):
    """轻量行情抓取：直接打新浪财经日线接口，纯 requests，无需 akshare。
    akshare 底层也是调这类接口，这里省掉那一大坨 pandas 依赖。

    symbol 归一化：6位数字→ A股（6开头=sh，其余=sz）；sh/sz 前缀→原样；
    5位数字（港股）新浪这个接口不支持，返回 None 让上层降级到 akshare。
    """
    s = symbol.lower().strip()
    if s.isdigit() and len(s) == 6:
        sina_sym = ("sh" if s[0] == "6" else "sz") + s
    elif s[:2] in ("sh", "sz") and s[2:].isdigit():
        sina_sym = s
    else:
        return None  # 港股/指数等交给 akshare 分支

    try:
        r = requests.get(
            "https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData",
            params={"symbol": sina_sym, "scale": 240, "ma": "no", "datalen": 120},
            headers={"User-Agent": "Mozilla/5.0", "Referer": "https://finance.sina.com.cn"},
            timeout=10,
        )
        r.raise_for_status()
        data = json.loads(r.text)
        closes = [float(d["close"]) for d in data if d.get("close")]
        return closes[-120:] if closes else None
    except Exception as e:
        if verbose:
            print(f"    ! 新浪接口失败（{type(e).__name__}），尝试 akshare…")
        return None


def _try_fetch_akshare(symbol: str, verbose=True):
    """尝试用 akshare 拉 A 股/港股/指数日线，多源降级（东财→新浪），失败返回 None。

    symbol 形态：6位数字=A股个股；5位数字=港股；sh/sz/csi 前缀=指数（如 sh000001 上证）。
    国内源在开代理的机器上易被截断（ProxyError/RemoteDisconnected），故按源逐个降级。
    """
    try:
        import akshare as ak
    except ImportError:
        if verbose:
            print("    ! 未安装 akshare（pip install akshare），无法自动拉取行情")
        return None

    def _hk():
        return ak.stock_hk_daily(symbol=symbol)["close"].tolist()

    def _a_east():
        return ak.stock_zh_a_hist(symbol=symbol, period="daily", adjust="qfq")["收盘"].tolist()

    def _a_sina():
        return ak.stock_zh_a_daily(symbol=("sh" if symbol.startswith("6") else "sz") + symbol,
                                   adjust="qfq")["close"].tolist()

    def _index_sina():
        return ak.stock_zh_index_daily(symbol=symbol)["close"].tolist()

    def _index_east():
        return ak.index_zh_a_hist(symbol=symbol[2:] if symbol[:2] in ("sh", "sz") else symbol,
                                  period="daily")["收盘"].tolist()

    if symbol.isdigit() and len(symbol) == 5:
        fetchers = [("hk", _hk)]
    elif symbol[:2].lower() in ("sh", "sz", "cs") and not symbol.isdigit():
        fetchers = [("index_sina", _index_sina), ("index_east", _index_east)]
    else:
        fetchers = [("a_east", _a_east), ("a_sina", _a_sina)]

    for name, fn in fetchers:
        try:
            closes = fn()[-120:]
            if closes:
                return [float(c) for c in closes]
        except Exception as e:
            if verbose:
                print(f"    ! 源 {name} 失败（{type(e).__name__}），尝试下一个…")
    return None


def _load_csv(path: str):
    closes = []
    with open(path) as f:
        for line in f:
            line = line.strip().split(",")[-1]
            try:
                closes.append(float(line))
            except ValueError:
                continue
    return closes[-120:]


# ---------- 指标 ----------
def rsi(closes, period=14):
    if len(closes) < period + 1:
        return None
    gains, losses = [], []
    for i in range(-period, 0):
        d = closes[i] - closes[i - 1]
        gains.append(max(d, 0))
        losses.append(max(-d, 0))
    avg_g, avg_l = sum(gains) / period, sum(losses) / period
    if avg_l == 0:
        return 100.0
    return round(100 - 100 / (1 + avg_g / avg_l), 1)


def _ema(values, period):
    k = 2 / (period + 1)
    e = values[0]
    out = [e]
    for v in values[1:]:
        e = v * k + e * (1 - k)
        out.append(e)
    return out


def macd(closes):
    if len(closes) < 35:
        return None
    e12, e26 = _ema(closes, 12), _ema(closes, 26)
    dif = [a - b for a, b in zip(e12, e26)]
    dea = _ema(dif[-60:], 9)
    hist = dif[-1] - dea[-1]
    prev = dif[-2] - dea[-2]
    return {"dif": round(dif[-1], 3), "dea": round(dea[-1], 3),
            "hist": round(hist, 3), "cross": "金叉" if prev < 0 <= hist else ("死叉" if prev > 0 >= hist else "无")}


def bollinger(closes, period=20):
    if len(closes) < period:
        return None
    window = closes[-period:]
    mid = sum(window) / period
    sd = statistics.pstdev(window)
    price = closes[-1]
    pos = (price - (mid - 2 * sd)) / (4 * sd) if sd else 0.5
    return {"position": round(pos, 2), "mid": round(mid, 2)}


def momentum(closes, period=20):
    if len(closes) < period + 1:
        return None
    return round((closes[-1] / closes[-period - 1] - 1) * 100, 2)


SIGNAL_PROMPT = """你是一个克制的量化分析助手。以下是某标的的技术信号，请：
1. 用 2-3 句话解读信号组合
2. 给出未来 20 个交易日"上涨概率"的区间估计（如 45%-55%），不允许给点预测
3. 明确指出当前信号组合最大的失效风险（例如：牛市中超买信号会持续钝化）

标的：{symbol}
信号：{signals}

只返回 JSON：{{"interpretation": "...", "up_probability_range": [0.45, 0.55], "key_risk": "..."}}
"""


def run(llm, seed: str, symbol: str | None = None, csv: str | None = None, verbose: bool = True) -> dict:
    closes = None
    src = None
    if csv:
        closes = _load_csv(csv)
        src = f"CSV: {csv}"
    elif symbol:
        # 优先轻量新浪接口（A股，无需 akshare），失败再降级 akshare（港股/指数）
        closes = _try_fetch_sina(symbol, verbose)
        if closes:
            src = f"sina: {symbol}"
        else:
            closes = _try_fetch_akshare(symbol, verbose)
            src = f"akshare: {symbol}"
    if not closes:
        try:
            import akshare  # noqa: F401
            reason = "拉取失败（网络问题或代码不存在）。A股用6位代码（如600519），港股/指数需装 akshare，或用 --csv 提供收盘价。"
        except ImportError:
            reason = "A股用6位代码（如600519）走轻量新浪接口即可；港股/指数需 pip install akshare，或用 --csv 提供收盘价。"
        if not symbol and not csv:
            reason = "market 域需要数据源：--symbol 股票代码 或 --csv 收盘价文件。"
        return {"backend": "quant", "error": reason}

    signals = {
        "price": closes[-1],
        "RSI14": rsi(closes),
        "MACD": macd(closes),
        "布林带位置(0下轨-1上轨)": bollinger(closes),
        "20日动量%": momentum(closes),
    }
    if verbose:
        print(f"  ✓ 数据源 {src}，{len(closes)} 根K线")
        print(f"  ✓ 信号：{signals}")

    try:
        analysis = llm.chat_json([{"role": "user", "content": SIGNAL_PROMPT.format(
            symbol=symbol or "（CSV数据）", signals=signals)}], temperature=0.2)
    except Exception as e:
        analysis = {"interpretation": f"LLM 解读失败：{e}", "up_probability_range": None, "key_risk": "未知"}

    from .common import to_prob
    rng = analysis.get("up_probability_range") or [0.5, 0.5]
    rng = [to_prob(rng[0]), to_prob(rng[-1])]
    return {
        "backend": "quant",
        "source": src,
        "signals": signals,
        "interpretation": analysis.get("interpretation", ""),
        "probability": round(sum(rng) / 2, 3),
        "probability_range": rng,
        "key_risk": analysis.get("key_risk", ""),
        "caveat": "技术信号不构成投资建议；牛熊市同一信号含义不同（参考此前 A 股复盘中'恐高早卖'的系统性偏差）。",
    }
