"""backends 公共工具。"""
from __future__ import annotations



def safe_chat_json(llm, prompt: str, temperature: float = 0.3, retries: int = 2):
    """调用 LLM 并解析 JSON，失败自动重试。返回 (dict, None) 或 (None, 错误信息)。"""
    last = None
    for attempt in range(retries + 1):
        try:
            data = llm.chat_json([{"role": "user", "content": prompt}], temperature=temperature)
            if isinstance(data, dict):
                return data, None
            last = f"LLM 返回了非对象 JSON：{type(data).__name__}"
        except Exception as e:
            last = f"{type(e).__name__}: {e}"
    return None, f"LLM 调用失败（重试 {retries} 次后）：{last}"


def to_prob(value, default: float = 0.5) -> float:
    """把 LLM 可能返回的各种概率写法强转为 [0,1] 浮点。
    支持：0.6 / "0.6" / "60%" / 60 / None / 垃圾值。"""
    if value is None:
        return default
    try:
        if isinstance(value, str):
            value = value.strip().rstrip("%％")
            value = float(value)
            if value > 1:
                value /= 100
        else:
            value = float(value)
            if value > 1:
                value /= 100
        return min(max(value, 0.0), 1.0)
    except (ValueError, TypeError):
        return default
