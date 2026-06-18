"""LLM 客户端：兼容任意 OpenAI 格式 API（DeepSeek / Qwen / GLM / OpenAI / Claude 网关均可），
以及 Anthropic 原生 API（provider: anthropic，走官方 SDK，自适应思考 + effort）。

支持 mock 模式（不消耗 token，用于跑通流程测试）。
"""
from __future__ import annotations

import json
import os
import random
import re

import requests


class LLM:
    def __init__(self, cfg: dict, mock: bool = False):
        self.base_url = cfg.get("base_url", "https://api.deepseek.com/v1").rstrip("/")
        # Caller-supplied key (TideNow BYOK request body) wins;
        # FORESIGHT_API_KEY env is only a fallback for standalone CLI use.
        self.api_key = cfg.get("api_key") or os.environ.get("FORESIGHT_API_KEY", "")
        self.model = cfg.get("model", "deepseek-chat")
        self.mock = mock or cfg.get("mock", False)
        self.temperature = cfg.get("temperature", 0.7)
        # provider: 显式指定，或从 base_url 推断（含 anthropic 即走原生）
        self.provider = cfg.get("provider") or ("anthropic" if "anthropic" in self.base_url else "openai")
        self.effort = cfg.get("effort", "high")  # Anthropic effort：low|medium|high|xhigh|max
        self.max_tokens = cfg.get("max_tokens", 8000)
        self._anthropic_client = None
        self._backoff = 1

    def chat(self, messages: list, temperature: float | None = None, json_mode: bool = False) -> str:
        if self.mock:
            return self._mock_response(messages, json_mode)
        if self.provider == "anthropic":
            return self._post_anthropic(messages, temperature, json_mode)
        last_err = None
        for attempt in range(4):  # 1 次原始 + 3 次退避重试
            if attempt:
                import time
                time.sleep(self._backoff)
                self._backoff = min(self._backoff * 2, 16)
            try:
                return self._post(messages, temperature, json_mode)
            except requests.HTTPError as e:
                code = e.response.status_code if e.response is not None else 0
                if code == 429 or 500 <= code < 600:  # 限流/服务端错误才重试
                    ra = e.response.headers.get("Retry-After") if e.response is not None else None
                    if ra and ra.isdigit():
                        self._backoff = max(self._backoff, int(ra))
                    last_err = e
                    continue
                raise  # 4xx（鉴权/参数错误）重试无意义，直接抛
            except (requests.ConnectionError, requests.Timeout) as e:
                last_err = e
                continue
        raise last_err

    def _get_anthropic_client(self):
        """惰性构建 Anthropic SDK 客户端（仅 provider=anthropic 时才需要装 anthropic 包）。"""
        if self._anthropic_client is None:
            try:
                import anthropic
            except ImportError as e:
                raise RuntimeError(
                    "provider=anthropic 需要安装官方 SDK：pip install anthropic") from e
            kwargs = {"api_key": self.api_key} if self.api_key else {}
            # 自定义网关：base_url 非官方域名时透传（官方域名留空让 SDK 用默认）
            if self.base_url and "api.anthropic.com" not in self.base_url:
                kwargs["base_url"] = self.base_url
            self._anthropic_client = anthropic.Anthropic(**kwargs)
        return self._anthropic_client

    def _post_anthropic(self, messages: list, temperature: float | None, json_mode: bool) -> str:
        """调用 Anthropic 原生 /v1/messages。SDK 自带 429/5xx 指数退避重试。

        - OpenAI 风格 messages（含 system role）→ Anthropic 的 system 参数 + messages
        - json_mode → 在末尾追加"只返回 JSON"硬约束（后端 prompt 已含此要求，双保险）
        - 自适应思考 + effort：质量优先；不传 temperature（Opus 4.7+ 已移除采样参数）
        """
        client = self._get_anthropic_client()
        system_parts, conv = [], []
        for m in messages:
            if m["role"] == "system":
                system_parts.append(m["content"])
            else:
                conv.append({"role": m["role"], "content": m["content"]})
        if not conv:  # 全是 system 时兜底，保证至少一条 user
            conv = [{"role": "user", "content": "\n".join(system_parts)}]
            system_parts = []
        if json_mode and conv[-1]["role"] == "user":
            conv[-1]["content"] += "\n\n（重要：只返回 JSON 对象本身，不要任何解释或代码块包裹。）"

        kwargs = dict(
            model=self.model,
            max_tokens=self.max_tokens,
            messages=conv,
            thinking={"type": "adaptive"},
            output_config={"effort": self.effort},
        )
        if system_parts:
            kwargs["system"] = "\n\n".join(system_parts)
        resp = client.messages.create(**kwargs)
        # 取首个 text block（思考块的 text 默认为空，跳过）
        for block in resp.content:
            if getattr(block, "type", None) == "text":
                return block.text
        return ""

    def _post(self, messages: list, temperature: float | None, json_mode: bool) -> str:
        resp = requests.post(
            f"{self.base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.model,
                "messages": messages,
                "temperature": temperature if temperature is not None else self.temperature,
                **({"response_format": {"type": "json_object"}} if json_mode else {}),
            },
            timeout=120,
        )
        if not resp.ok:
            # 带上服务端返回的错误信息（如"模型名不存在"），否则 400 只剩状态码没法排查
            raise requests.HTTPError(
                f"{resp.status_code} {resp.reason}: {resp.text[:300]}", response=resp)
        return resp.json()["choices"][0]["message"]["content"]

    def chat_json(self, messages: list, temperature: float | None = None) -> dict:
        """请求并解析 JSON，自动剥离 markdown 代码块。"""
        text = self.chat(messages, temperature=temperature, json_mode=True)
        text = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.M).strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # 尝试截取第一个 { 到最后一个 }
            m = re.search(r"\{.*\}", text, re.S)
            if m:
                return json.loads(m.group(0))
            raise

    # ---------- mock ----------
    def _mock_response(self, messages: list, json_mode: bool) -> str:
        import json as _j, random as _r
        prompt = messages[-1]["content"]

        if "预测任务分类器" in prompt:
            seed = prompt.split("种子信息：")[-1]
            rules = [("股", "market"), ("期货", "market"), ("币", "market"),
                     ("比赛", "sports"), ("赛", "sports"), ("队", "sports"),
                     ("CPI", "macro"), ("利率", "macro"), ("汇率", "macro"), ("GDP", "macro"),
                     ("趋势", "trend"), ("流行", "trend"), ("消费", "trend"),
                     ("军", "scenario"), ("外交", "scenario"), ("政策", "scenario")]
            domain = next((d for k, d in rules if k in seed), "opinion")
            return _j.dumps({"domain": domain, "reason": "mock 关键词路由"}, ensure_ascii=False)

        if "人物画像" in prompt:
            personas = [{"name": f"Agent-{i}", "age": _r.randint(18, 65),
                         "background": _r.choice(["上班族", "学生", "投资者", "媒体人", "退休人员"]),
                         "stance_bias": _r.choice(["乐观", "悲观", "中立", "怀疑"])} for i in range(8)]
            return _j.dumps({"personas": personas}, ensure_ascii=False)

        if "给出你的立场" in prompt:
            return _j.dumps({"stance": _r.choice(["支持", "反对", "观望"]),
                             "confidence": round(_r.uniform(0.3, 0.9), 2),
                             "comment": "mock 观点：基于我的背景，我倾向于这个判断。"}, ensure_ascii=False)

        if "超级预测方法论" in prompt:
            return _j.dumps({"base_rate_note": "历史同类事件升级概率约 20-30%",
                "scenarios": [
                    {"name": "基准情景", "probability": 0.55, "description": "按当前趋势发展", "indicators": ["官方表态", "相关方动作"]},
                    {"name": "升级情景", "probability": 0.25, "description": "意外事件触发升级", "indicators": ["突发新闻"]},
                    {"name": "缓和情景", "probability": 0.20, "description": "阶段性妥协", "indicators": ["谈判信号"]}],
                "key_question": "未来30天内是否出现实质性升级？", "key_question_probability": 0.35,
                "what_would_change_my_mind": "出现直接对抗信号"}, ensure_ascii=False)

        if "锦标赛" in prompt and "夺冠概率" in prompt:
            return _j.dumps({"error": None, "tournament": "mock锦标赛",
                "stage": "未开赛",
                "base_rate_factors": [{"factor": "历史夺冠分布集中于前8强", "certainty": "确定"},
                                       {"factor": "东道主优势约+5%", "certainty": "确定"}],
                "contenders": [
                    {"name": "A队", "probability": 0.20, "rationale": "世界排名第1"},
                    {"name": "B队", "probability": 0.15, "rationale": "卫冕冠军"},
                    {"name": "C队", "probability": 0.12, "rationale": "近期状态最佳"},
                    {"name": "D队", "probability": 0.10, "rationale": "东道主加成"},
                    {"name": "其他", "probability": 0.43, "rationale": "历史黑马概率"}],
                "key_question": "A队是否夺冠？", "key_question_probability": 0.20,
                "what_would_change_my_mind": "关键球员伤病或签表大变"}, ensure_ascii=False)

        if "体育赛事分析师" in prompt:
            return _j.dumps({"error": None, "match": "A队 vs B队（mock联赛）",
                "base_rate_factors": [{"factor": "主场优势约+8%", "certainty": "确定"},
                                       {"factor": "近期状态", "certainty": "猜测"}],
                "outcomes": [{"name": "主胜", "probability": 0.46}, {"name": "平局", "probability": 0.27},
                             {"name": "客胜", "probability": 0.27}],
                "key_question": "A队是否获胜？", "key_question_probability": 0.46}, ensure_ascii=False)

        if "宏观经济分析师" in prompt:
            return _j.dumps({"error": None, "indicator": "mock-CPI同比",
                "anchor": {"value": "0.5%", "as_of": "训练数据截止时", "staleness_warning": "可能已过期"},
                "ranges": [{"name": "悲观", "range": "<0.3%", "probability": 0.2},
                           {"name": "基准", "range": "0.3-0.8%", "probability": 0.6},
                           {"name": "乐观", "range": ">0.8%", "probability": 0.2}],
                "leading_data": ["下月PMI", "央行会议"],
                "key_question": "下月CPI是否高于0.5%？", "key_question_probability": 0.55}, ensure_ascii=False)

        if "趋势分析师" in prompt:
            return _j.dumps({"stage": "早期采用",
                "drivers": ["社交媒体扩散", "成本下降"], "blockers": ["供给不足", "审美疲劳风险"],
                "outlook": [{"horizon": "3个月", "direction": "升温", "note": "mock"},
                            {"horizon": "6个月", "direction": "持平", "note": "mock"},
                            {"horizon": "12个月", "direction": "降温", "note": "mock"}],
                "fad_or_trend": {"verdict": "待观察", "reason": "mock 判定"},
                "key_question": "未来6个月该趋势热度是否上升？", "key_question_probability": 0.5}, ensure_ascii=False)

        if "选举预测分析师" in prompt:
            return _j.dumps({"error": None, "race": "mock市长选举",
                "poll_anchor": {"value": "A 48% vs B 45%", "as_of": "训练数据截止", "staleness_warning": "可能过期"},
                "historical_polling_error": "该类选举民调误差约±3个百分点",
                "outcomes": [{"name": "A", "probability": 0.58}, {"name": "B", "probability": 0.42}],
                "key_question": "A是否赢得选举？", "key_question_probability": 0.58,
                "what_would_change_my_mind": "新民调反转"}, ensure_ascii=False)
        if "票房分析师" in prompt:
            return _j.dumps({"error": None, "title": "mock电影", "market": "中国内地",
                "comparables": [{"title": "对标A", "gross": "10亿", "note": "同档期"},
                                 {"title": "对标B", "gross": "6亿", "note": "同类型"},
                                 {"title": "对标C", "gross": "15亿", "note": "同主创"}],
                "ranges": [{"name": "低", "range": "<6亿", "probability": 0.25},
                           {"name": "中", "range": "6-12亿", "probability": 0.5},
                           {"name": "高", "range": ">12亿", "probability": 0.25}],
                "leading_indicators": ["想看数", "预售"],
                "key_question": "最终票房是否超过8亿？", "key_question_probability": 0.5}, ensure_ascii=False)
        if "自然事件分析师" in prompt:
            return _j.dumps({"sub_type": "seasonal", "honest_note": "季节尺度可给气候学基率",
                "climatology_base_rate": "该地区年均台风登陆约7个",
                "modulating_factors": ["拉尼娜状态"],
                "key_question": "今年登陆台风是否超过8个？", "key_question_probability": 0.4}, ensure_ascii=False)
        if "概率数学讲解者" in prompt:
            return _j.dumps({"game": "mock彩票", "why_unpredictable": "每期独立同分布，历史号码无信息量",
                "ev_math": "返奖率约50%，单注期望亏损一半",
                "rational_advice": "当娱乐预算，别当投资", "predictable_part": None}, ensure_ascii=False)
        if "可明确判定真假" in prompt:
            return _j.dumps({"question": "在2026年12月31日前，该事件是否发生？"}, ensure_ascii=False)
        if "Fermi 分解专家" in prompt:
            return _j.dumps({"conditions": [{"name": "条件A", "probability": 0.8},
                {"name": "条件B", "probability": 0.7}, {"name": "条件C", "probability": 0.75}],
                "correlation": "中", "note": "mock"}, ensure_ascii=False)
        if "正方律师" in prompt:
            return _j.dumps({"pro_case": ["论据1"], "con_case": ["论据2"],
                "judge_probability": 0.45, "decisive_argument": "mock决定性论据"}, ensure_ascii=False)
        if "参照类分析师" in prompt:
            return _j.dumps({"classes": [{"name": "参照1", "base_rate": 0.4, "weight": 0.5, "why": "m"},
                {"name": "参照2", "base_rate": 0.3, "weight": 0.3, "why": "m"},
                {"name": "参照3", "base_rate": 0.5, "weight": 0.2, "why": "m"}]}, ensure_ascii=False)
        if "事前验尸法" in prompt:
            return _j.dumps({"path_to_yes": ["a"], "surprise_if_yes": 0.5,
                "path_to_no": ["b"], "surprise_if_no": 0.45}, ensure_ascii=False)
        if "反事实推演分析师" in prompt:
            return _j.dumps({"outcome": "mock结局",
                "nodes": [{"time": "T1", "node": "节点A", "actual": "实际a", "alternative": "替代a",
                           "knowable": "当时可知", "flip_probability": 0.6, "downstream": "链条a"},
                          {"time": "T2", "node": "节点B", "actual": "实际b", "alternative": "替代b",
                           "knowable": "仅后见之明", "flip_probability": 0.3, "downstream": "链条b"}],
                "minimal_salvage_point": {"node": "节点A", "why": "mock原因"},
                "deep_cause": "mock结构性原因"}, ensure_ascii=False)
        if "破局架构师" in prompt:
            return _j.dumps({"win_condition": "mock胜利条件",
                "branches": [{"name": "基线路径", "description": "维持现状", "p_initial": 0.2, "is_baseline": True},
                             {"name": "激进路径", "description": "豪赌", "p_initial": 0.25, "is_baseline": False},
                             {"name": "稳健路径", "description": "积蓄待机", "p_initial": 0.3, "is_baseline": False}]}, ensure_ascii=False)
        if "对抗推演员" in prompt:
            return _j.dumps({"counter_move": "mock反制", "p_win": round(_r.uniform(0.1, 0.4), 2),
                "fatal_weakness": "mock脆弱点"}, ensure_ascii=False)
        if "最终评估官" in prompt:
            return _j.dumps({"best_path": "稳健路径", "p_win": 0.3, "is_hybrid": False,
                "verdict": "低概率破局", "structural_ceiling": "mock天花板",
                "why_others_fail": "mock原因", "key_question": "X期限内是否达成？"}, ensure_ascii=False)
        if "故事圣经" in prompt and "长篇小说总策划" in prompt:
            return _j.dumps({"title": "mock长篇", "logline": "一句话梗概",
                "world": "近未来", "conflict_engine": "核心矛盾", "win_condition": "主角要达成的",
                "structural_ceiling": "最高只能到的一步", "theme": "主题句",
                "pov_characters": [{"name": "主角", "role": "身份", "arc": "弧光"}]}, ensure_ascii=False)
        if "长篇小说结构师" in prompt:
            return _j.dumps({"acts": [{"act": 1, "title": "第一幕"}],
                "chapters": [{"chapter": 1, "act": 1, "title": "开篇", "pov": "主角",
                              "beat": "建置", "turn": "异象出现", "threads": ["主线"]},
                             {"chapter": 2, "act": 1, "title": "纠葛", "pov": "主角",
                              "beat": "冲突", "turn": "第一道裂痕", "threads": ["主线"]}]}, ensure_ascii=False)
        if "推演师" in prompt and "因果推演" in prompt:
            return _j.dumps({"character_moves": [{"who": "主角", "does": "行动", "why": "动机"}],
                "key_turn": "本章转折", "foreshadow": {"pay_off": "收", "plant": "埋"},
                "tone": "冷峻", "ending_beat": "悬而未决"}, ensure_ascii=False)
        if "连贯性管理员" in prompt:
            return _j.dumps({"timeline": "第1天", "locations": {"主角": "现场"},
                "knows": {"主角": "异象发生"}, "relationships": "尚未展开",
                "open_threads": ["主线"], "closed_threads": [], "emotional_state": {"主角": "震惊"}}, ensure_ascii=False)

        if "资深编剧" in prompt:
            return _j.dumps({"title": "mock片名", "logline": "一句话故事梗概",
                "style": "冷调写实，蓝灰主色，电影感颗粒",
                "characters": [{"name": "主角", "look": "中年，疲惫但坚定"}],
                "scenes": [
                    {"scene_no": 1, "heading": "内 - 控制室 - 深夜", "synopsis": "建置：异象出现",
                     "action": "屏幕同时切换成同一画面。", "dialogue": [{"character": "主角", "parenthetical": "(低声)", "line": "这是什么。"}]},
                    {"scene_no": 2, "heading": "外 - 街道 - 黄昏", "synopsis": "转折：共识浮现",
                     "action": "人们走出门，抬手。", "dialogue": []}]}, ensure_ascii=False)
        if "分镜师" in prompt:
            return _j.dumps({"shots": [
                {"shot_no": "1A", "size": "大全景", "angle": "俯拍", "movement": "缓推", "duration_sec": 4,
                 "description": "控制室全景，一墙屏幕同时变白", "audio": "环境嗡鸣，无对白",
                 "image_prompt": "wide overhead shot, dim control room, wall of monitors turning white in unison, cold blue-grey, cinematic grain"},
                {"shot_no": "1B", "size": "特写", "angle": "平视", "movement": "固定", "duration_sec": 3,
                 "description": "主角的脸被屏幕白光照亮", "audio": "对白：这是什么。",
                 "image_prompt": "close-up, tired face lit by white screen glow, reflection in eyes, film still"}]}, ensure_ascii=False)

        if "量化分析助手" in prompt:
            return _j.dumps({"interpretation": "mock：短期超买但趋势向上，信号偏多。",
                             "up_probability_range": [0.5, 0.62],
                             "key_risk": "牛市中超买信号会持续钝化"}, ensure_ascii=False)

        if json_mode:
            return _j.dumps({"summary": "mock 报告摘要", "probability": 0.5}, ensure_ascii=False)
        return "（mock 模式输出）这是一段模拟的分析文本，用于测试流程。"
