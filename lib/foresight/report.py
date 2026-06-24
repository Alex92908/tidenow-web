"""把后端结果渲染成 Markdown 报告。"""
from __future__ import annotations

import time
from email.utils import parsedate_to_datetime

from .backends.common import to_prob


def _newest_date(dates: list) -> str:
    """Find the chronologically newest among RFC822 date strings (e.g.
    'Thu, 25 Dec 2025 08:00:00 GMT'). Returns a short 'YYYY-MM-DD' string,
    or '' if none parse. String max() would compare alphabetically and
    pick the wrong one, hence real date parsing."""
    best = None
    for d in dates:
        if not d:
            continue
        try:
            dt = parsedate_to_datetime(d)
        except (TypeError, ValueError):
            continue
        if dt and (best is None or dt > best):
            best = dt
    return best.strftime("%Y-%m-%d") if best else ""


def render(seed: str, route: dict, result: dict, pid: str | None) -> str:
    # Search transparency line: shows whether live web search actually ran
    # and injected fresh context, so a stale-looking answer can be told
    # apart from a silently-failed search.
    ss = result.get("search_status") if isinstance(result, dict) else None
    if ss and ss.get("attempted"):
        if ss.get("ok"):
            newest = _newest_date(ss.get("dates") or [])
            date_note = f"，最新 {newest}" if newest else ""
            search_line = f"- 🌐 实时搜索：已联网，注入 {ss.get('count', 0)} 条结果{date_note}"
        else:
            search_line = "- 🌐 实时搜索：本次未获取到结果，仅基于模型知识（数据可能滞后）"
    else:
        search_line = ""

    lines = [
        f"# ForeSight 预测报告",
        f"",
        f"- 时间：{time.strftime('%Y-%m-%d %H:%M')}",
        f"- 路由：`{route['domain']}`（{route.get('reason', '')}）",
        search_line,
        f"- 预测ID：`{pid}`（用 `resolve {pid} 1|0` 事后判定）" if pid else "",
        f"",
        f"## 种子信息",
        f"> {seed[:500]}",
        f"",
    ]
    b = result.get("backend")

    if result.get("error"):
        lines += [f"## ⚠️ 错误", result["error"], result.get("hint", "")]

    elif b == "swarm":
        lines += ["## 舆情仿真结果", ""]
        # Anchor what the stances are ABOUT. Without this, "反对 50%" reads
        # as "50% are negative on the company" when it may mean "50%
        # disagree with one specific claim". Show the proposition up front.
        subject = result.get("stance_subject", "")
        if subject:
            lines += [f"**表态命题：** {subject}", "",
                      "（下方「支持/反对/观望」均针对此命题，非对相关公司/人物的整体态度）", ""]
        # Show who the simulated crowd was — the credibility of an
        # opinion simulation rests entirely on persona diversity, so a
        # report that hides the cast asks for blind trust.
        personas = result.get("personas", [])
        if personas:
            lines += ["### 模拟人群构成", ""]
            for p in personas[:12]:
                name = p.get("name", "")
                age = p.get("age", "")
                bg = p.get("background", "")
                bias = p.get("stance_bias", "")
                bias_note = f"，倾向：{bias}" if bias else ""
                lines.append(f"- **{name}**（{age}岁，{bg}{bias_note}）")
            lines.append("")
        lines += ["### 立场演化", ""]
        for h in result["evolution"]:
            dist = "  ".join(f"{k} {v}" for k, v in h["distribution"].items())
            lines.append(f"- 第 {h['round']} 轮：{dist}")
        # Final distribution as a clean split, not just the dominant one.
        fd = result.get("final_distribution", {})
        if fd:
            split = "　".join(f"{k} {to_prob(v):.0%}" for k, v in sorted(fd.items(), key=lambda x: -x[1]))
            lines += ["", f"**最终分布：** {split}"]
        dom = result["dominant_stance"]
        dom_note = f"（对「{subject}」）" if subject else ""
        lines += ["", f"**最终主导立场：{dom}{dom_note} — {to_prob(result.get('probability')):.0%}**", "",
                  "### 抽样观点"]
        lines += [f"- {c}" for c in result.get("sample_comments", [])]

    elif b == "quant":
        lines += ["## 量化信号", "", f"数据源：{result['source']}", ""]
        for k, v in result["signals"].items():
            lines.append(f"- {k}：{v}")
        rng = result.get("probability_range") or [0, 0]
        lines += ["", f"**解读：** {result['interpretation']}", "",
                  f"**20日上涨概率区间：{to_prob(rng[0]):.0%} – {to_prob(rng[1]):.0%}**", "",
                  f"**最大失效风险：** {result['key_risk']}"]

    elif b == "scenario":
        lines += ["## 情景树分析", "", f"**外部视角（基率）：** {result['base_rate_note']}", ""]
        for s in result["scenarios"]:
            lines.append(f"### {s['name']} — {s['probability']:.0%}")
            lines.append(s.get("description", ""))
            inds = s.get("indicators", [])
            if inds:
                lines.append("先行指标：" + "；".join(inds))
            lines.append("")
        lines += [f"**核心问题：** {result['key_question']}",
                  f"**概率：{to_prob(result.get('probability')):.0%}**"]

    elif b == "sports" and result.get("mode") == "tournament":
        lines += ["## 🏆 锦标赛预测", "",
                  f"**赛事：** {result.get('tournament','')}",
                  f"**当前阶段：** {result.get('stage','')}", "", "### 基率因素"]
        for f0 in result.get("base_rate_factors", []):
            lines.append(f"- {f0.get('factor','')}（{f0.get('certainty','')}）")
        lines += ["", "### 夺冠概率"]
        for c in result.get("contenders", []):
            lines.append(f"- **{c.get('name','')}**：{to_prob(c.get('probability')):.0%} — {c.get('rationale','')}")
        lines += ["", f"**核心问题：** {result.get('key_question','')}（{to_prob(result.get('probability')):.0%}）"]

    elif b == "sports":
        lines += ["## 赛事分析", "", f"**比赛：** {result.get('match','')}", "", "### 基率因素"]
        for f0 in result.get("base_rate_factors", []):
            lines.append(f"- {f0.get('factor','')}（{f0.get('certainty','')}）")
        lines += ["", "### 结果概率"]
        for o in result.get("outcomes", []):
            rat = f" — {o['rationale']}" if o.get("rationale") else ""
            lines.append(f"- {o.get('name','')}：{to_prob(o.get('probability')):.0%}{rat}")
        if result.get("implied_from_odds"):
            lines.append(f"\n赔率隐含概率（锚点）：{result['implied_from_odds']}")
        lines += ["", f"**核心问题：** {result.get('key_question','')}（{to_prob(result.get('probability')):.0%}）"]

    elif b == "macro":
        a = result.get("anchor", {}) or {}
        lines += ["## 宏观区间预测", "", f"**指标：** {result.get('indicator','')}",
                  f"**锚点：** {a.get('value','?')}（截至 {a.get('as_of','?')}；{a.get('staleness_warning','')}）", ""]
        for r in result.get("ranges", []):
            rat = f" — {r['rationale']}" if r.get("rationale") else ""
            lines.append(f"- {r.get('name','')} {r.get('range','')}：{to_prob(r.get('probability')):.0%}{rat}")
        ld = result.get("leading_data", [])
        if ld:
            lines += ["", "先行数据：" + "；".join(str(x) for x in ld)]
        lines += ["", f"**核心问题：** {result.get('key_question','')}（{to_prob(result.get('probability')):.0%}）"]

    elif b == "trend":
        ft = result.get("fad_or_trend", {}) or {}
        lines += ["## 趋势分析", "", f"**S曲线阶段：** {result.get('stage','')}",
                  f"**持久趋势 or 短期热点：** {ft.get('verdict','')} — {ft.get('reason','')}", "",
                  "驱动力：" + "；".join(str(x) for x in result.get("drivers", [])),
                  "阻力：" + "；".join(str(x) for x in result.get("blockers", [])), "", "### 展望"]
        for o in result.get("outlook", []):
            lines.append(f"- {o.get('horizon','')}：{o.get('direction','')} — {o.get('note','')}")
        lines += ["", f"**核心问题：** {result.get('key_question','')}（{to_prob(result.get('probability')):.0%}）"]

    elif b == "election":
        a = result.get("poll_anchor", {}) or {}
        lines += ["## 选举预测", "", f"**选举：** {result.get('race','')}",
                  f"**民调锚点：** {a.get('value','?')}（截至 {a.get('as_of','?')}；{a.get('staleness_warning','')}）",
                  f"**历史民调误差：** {result.get('historical_polling_error','')}", "", "### 获胜概率"]
        for o in result.get("outcomes", []):
            rat = f" — {o['rationale']}" if o.get("rationale") else ""
            lines.append(f"- {o.get('name','')}：{to_prob(o.get('probability')):.0%}{rat}")
        lines += ["", f"**核心问题：** {result.get('key_question','')}（{to_prob(result.get('probability')):.0%}）"]

    elif b == "boxoffice":
        lines += ["## 票房预测（对标影片法）", "", f"**影片：** {result.get('title','')}（{result.get('market','')}）",
                  "", "### 对标影片"]
        for c in result.get("comparables", []):
            lines.append(f"- {c.get('title','')}：{c.get('gross','')}（{c.get('note','')}）")
        lines += ["", "### 票房区间"]
        for r in result.get("ranges", []):
            rat = f" — {r['rationale']}" if r.get("rationale") else ""
            lines.append(f"- {r.get('name','')} {r.get('range','')}：{to_prob(r.get('probability')):.0%}{rat}")
        li = result.get("leading_indicators", [])
        if li:
            lines += ["", "先行指标：" + "；".join(str(x) for x in li)]
        lines += ["", f"**核心问题：** {result.get('key_question','')}（{to_prob(result.get('probability')):.0%}）"]

    elif b == "nature":
        lines += ["## 自然事件分析", "", f"**子类型：** {result.get('sub_type','')}",
                  f"", f"⚖️ **科学边界：** {result.get('honest_note','')}", "",
                  f"**气候学基率：** {result.get('climatology_base_rate','')}",
                  "调制因素：" + "；".join(str(x) for x in result.get("modulating_factors", []))]
        if not result.get("no_prediction"):
            lines += ["", f"**核心问题：** {result.get('key_question','')}（{to_prob(result.get('probability')):.0%}）"]
        else:
            lines += ["", "（本次不产生可校准预测）"]

    elif b == "randomness":
        lines += ["## 🎲 这是纯随机事件，拒绝预测", "",
                  f"**事件：** {result.get('game','')}",
                  f"**为什么不可预测：** {result.get('why_unpredictable','')}",
                  f"**期望值数学：** {result.get('ev_math','')}",
                  f"**理性建议：** {result.get('rational_advice','')}"]
        if result.get("predictable_part"):
            lines += ["", f"💡 你的问题里可预测的部分：{result['predictable_part']}"]
        lines += ["", "（不写入校准日志）"]

    elif b == "oracle":
        lines += ["## 🔮 元引擎：五路独立推理", "", f"**核心问题：** {result.get('key_question','')}", ""]
        for e in result.get("estimates", []):
            lines.append(f"### {e.get('method','')} → {to_prob(e.get('probability')):.0%}")
            lines.append(e.get("detail", ""))
            lines.append("")
        lines += [f"## 聚合结果：**{to_prob(result.get('probability')):.0%}**",
                  f"方法间分歧度：{result.get('dispersion','?')}（{result.get('agreement','')}）"]

    elif b == "counterfactual":
        lines += ["## ⏪ 反事实推演：决策节点复盘", "",
                  f"**实际结局：** {result.get('outcome','')}", "", "### 决策节点时间线"]
        for n in result.get("nodes", []):
            tag = "🟢" if n.get("knowable") == "当时可知" else "🔸后见之明"
            lines.append(f"#### {n.get('time','?')}｜{n.get('node','')} — 翻转概率 {to_prob(n.get('flip_probability'),0.3):.0%} {tag}")
            lines.append(f"- 实际：{n.get('actual','')}")
            lines.append(f"- 替代：{n.get('alternative','')}")
            lines.append(f"- 连锁推演：{n.get('downstream','')}")
            lines.append("")
        sp = result.get("minimal_salvage_point", {}) or {}
        lines += [f"## 🎯 最小挽救点：{sp.get('node','—')}", sp.get("why", ""), "",
                  f"**深层结构原因：** {result.get('deep_cause','')}", "", "（反事实推演不写入校准日志）"]

    elif b == "novelist":
        bible = result.get("bible", {}) or {}
        lines += [f"## 📖 长篇：《{result.get('title','')}》", "",
                  f"**Logline：** {result.get('logline','')}", "",
                  "### 故事圣经（全书脊柱）",
                  f"- **世界观**：{bible.get('world','')}",
                  f"- **核心冲突引擎**：{bible.get('conflict_engine','')}",
                  f"- **胜利条件**：{bible.get('win_condition','')}",
                  f"- **结构性宿命（主题）**：{bible.get('structural_ceiling','')}",
                  f"- **主题**：{bible.get('theme','')}", "", "**POV 角色**"]
        for c in bible.get("pov_characters", []) or []:
            lines.append(f"- **{c.get('name','')}**（{c.get('role','')}）：{c.get('arc','')}")
        lines += ["", "### 全书章纲"]
        for ch in result.get("outline", []) or []:
            lines.append(f"- **第 {ch.get('chapter','?')} 章 {ch.get('title','')}**"
                         f"（{ch.get('pov','')}）：{ch.get('beat','')} —— 转折：{ch.get('turn','')}")
        lines += ["", "---", "", f"## 正文（本次成稿 {len(result.get('chapters', []))} 章）"]
        for ch in result.get("chapters", []) or []:
            lines += ["", f"### 第 {ch.get('chapter','?')} 章　{ch.get('title','')}",
                      f"*POV：{ch.get('pov','')}*", "", ch.get("prose", "")]
        lines += ["", "---", "（长篇创作产物，不写入校准日志；状态账本已保存，可续写）"]

    elif b == "screenplay":
        lines += [f"## 🎬 剧本 + 分镜：《{result.get('title','')}》", "",
                  f"**Logline：** {result.get('logline','')}",
                  f"**整体视觉风格：** {result.get('style','')}", ""]
        chars = result.get("characters", [])
        if chars:
            lines.append("### 角色设定（AI 生成形象锚点）")
            for c in chars:
                lines.append(f"- **{c.get('name','')}**：{c.get('look','')}")
            lines.append("")
        for sc in result.get("scenes", []):
            lines.append(f"### 第 {sc.get('scene_no','?')} 场　{sc.get('heading','')}")
            if sc.get("synopsis"):
                lines.append(f"> {sc['synopsis']}")
            lines.append("")
            if sc.get("action"):
                lines.append(sc["action"])
            for d in sc.get("dialogue", []) or []:
                par = f"（{d['parenthetical'].strip('（）()')}）" if d.get("parenthetical") else ""
                lines.append(f"- **{d.get('character','')}**{par}：{d.get('line','')}")
            shots = sc.get("shots", [])
            if shots:
                lines += ["", "**分镜表**", "",
                          "| 镜号 | 景别 | 机位 | 运镜 | 时长 | 画面 | 声音 | AI 生成提示词 |",
                          "|---|---|---|---|---|---|---|---|"]
                for s in shots:
                    row = [str(s.get("shot_no", "")), s.get("size", ""), s.get("angle", ""),
                           s.get("movement", ""), f"{s.get('duration_sec','')}s",
                           s.get("description", ""), s.get("audio", ""), s.get("image_prompt", "")]
                    row = [str(x).replace("\n", " ").replace("|", "／") for x in row]
                    lines.append("| " + " | ".join(row) + " |")
            lines.append("")
        lines += [f"**全片共 {len(result.get('scenes', []))} 场 / {result.get('total_shots', 0)} 镜**",
                  "", "（创作产物，不写入校准日志）"]

    elif b == "strange" and result.get("fiction"):
        lines += ["## 🎭 创作模式：情节生成器（破局决策树）", "",
                  f"**主角的胜利条件：** {result.get('win_condition','')}", "", "### 候选情节线（按戏剧张力排序）"]
        for p in result.get("branches", []):
            base = "（读者预期主线）" if p.get("is_baseline") else ""
            lines.append(f"#### {p.get('name','')}{base} — 戏剧合理度 {to_prob(p.get('p_win')):.0%}")
            lines.append(f"- 反派最强反击/转折：{p.get('counter_move','')}")
            lines.append(f"- 主角命门（故事钩子）：{p.get('fatal_weakness','')}")
            lines.append("")
        hy = "（复合结构）" if result.get("is_hybrid") else ""
        lines += [f"## 🎬 推荐主线：{result.get('best_path','')}{hy}",
                  f"**故事基调：{result.get('verdict','')}**", "",
                  f"**结构性宿命（主题所在）：** {result.get('structural_ceiling','')}",
                  f"**其他情节线为何逊色：** {result.get('why_others_fail','')}", "",
                  f"**故事内核：** {result.get('key_question','')}", "",
                  "（创作输出，不写入校准日志）"]

    elif b == "strange":
        lines += ["## 🌀 破局搜索（决策树+对抗推演）", "",
                  f"**胜利条件：** {result.get('win_condition','')}", "", "### 各分支推演（按胜率排序）"]
        for p in result.get("branches", []):
            base = "（基线）" if p.get("is_baseline") else ""
            lines.append(f"#### {p.get('name','')}{base} — P(win) {to_prob(p.get('p_win')):.0%}")
            lines.append(f"- 对手最强反制：{p.get('counter_move','')}")
            lines.append(f"- 致命脆弱点：{p.get('fatal_weakness','')}")
            lines.append("")
        hy = "（混合路径）" if result.get("is_hybrid") else ""
        lines += [f"## 🎯 最优破局：{result.get('best_path','')}{hy}",
                  f"**胜率 {to_prob(result.get('probability')):.0%} — 裁决：{result.get('verdict','')}**", "",
                  f"**结构性天花板：** {result.get('structural_ceiling','')}",
                  f"**其他路径为何失败：** {result.get('why_others_fail','')}"]

    # Universal forecast-quality footer — rendered for ANY backend that
    # emits these fields, so every report gains a confidence band, a
    # "what would change my mind", and the key assumptions the estimate
    # rests on. Backends fill them via their prompts; absent fields are
    # skipped (graceful for creative / no-prediction modes).
    meta = []
    conf = result.get("confidence")
    if conf:
        label = {"low": "低", "medium": "中", "high": "高"}.get(str(conf).strip().lower(), str(conf))
        meta.append(f"- **置信度：** {label}")
    wwcm = result.get("what_would_change_my_mind")
    if wwcm:
        meta.append(f"- **什么会改变判断：** {wwcm}")
    ka = result.get("key_assumptions")
    if ka:
        if isinstance(ka, list):
            meta.append("- **关键假设：**")
            meta += [f"  - {a}" for a in ka if a]
        else:
            meta.append(f"- **关键假设：** {ka}")
    if meta:
        lines += ["", "### 🎯 预测质量"] + meta

    if result.get("caveat"):
        lines += ["", "---", f"⚠️ {result['caveat']}"]
    return "\n".join(lines)
