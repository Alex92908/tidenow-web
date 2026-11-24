"""把后端结果渲染成 Markdown 报告。

locale="en" 时所有固定标题/标签出英文（LLM 生成的正文内容由
LLMClient 的英文指令负责）；"zh"（默认）与此前输出完全一致。
"""
from __future__ import annotations

import time
from email.utils import parsedate_to_datetime

from .backends.common import to_prob

# Fixed headings/labels. Values are str.format templates; keep the same
# structure in both languages so only the wording changes.
_STR = {
    "zh": {
        "title": "# ForeSight 预测报告",
        "search_ok": "- 🌐 实时搜索：已联网，注入 {count} 条结果{date_note}",
        "search_ok_date": "，最新 {date}",
        "search_fail": "- 🌐 实时搜索：本次未获取到结果，仅基于模型知识（数据可能滞后）",
        "time": "- 时间：{now}",
        "route": "- 路由：`{domain}`（{reason}）",
        "pid": "- 预测ID：`{pid}`（用 `resolve {pid} 1|0` 事后判定）",
        "seed_h": "## 种子信息",
        "error_h": "## ⚠️ 错误",
        "swarm_h": "## 舆情仿真结果",
        "swarm_subject": "**表态命题：** {subject}",
        "swarm_subject_note": "（下方「支持/反对/观望」均针对此命题，非对相关公司/人物的整体态度）",
        "swarm_crowd_h": "### 模拟人群构成",
        "swarm_persona": "- **{name}**（{age}岁，{bg}{bias_note}）",
        "swarm_bias": "，倾向：{bias}",
        "swarm_evo_h": "### 立场演化",
        "swarm_round": "- 第 {round} 轮：{dist}",
        "swarm_final_dist": "**最终分布：** {split}",
        "swarm_dom": "**最终主导立场：{dom}{dom_note} — {prob}**",
        "swarm_dom_note": "（对「{subject}」）",
        "swarm_sample_h": "### 抽样观点",
        "quant_h": "## 量化信号",
        "quant_source": "数据源：{source}",
        "quant_interp": "**解读：** {interp}",
        "quant_range": "**20日上涨概率区间：{lo} – {hi}**",
        "quant_risk": "**最大失效风险：** {risk}",
        "scenario_h": "## 情景树分析",
        "scenario_base": "**外部视角（基率）：** {note}",
        "scenario_leading": "先行指标：{inds}",
        "key_q": "**核心问题：** {q}",
        "prob": "**概率：{p}**",
        "sports_t_h": "## 🏆 锦标赛预测",
        "sports_t_name": "**赛事：** {v}",
        "sports_t_stage": "**当前阶段：** {v}",
        "sports_base_h": "### 基率因素",
        "sports_title_h": "### 夺冠概率",
        "key_q_prob": "**核心问题：** {q}（{p}）",
        "sports_h": "## 赛事分析",
        "sports_match": "**比赛：** {v}",
        "sports_out_h": "### 结果概率",
        "sports_odds": "\n赔率隐含概率（锚点）：{v}",
        "macro_h": "## 宏观区间预测",
        "macro_ind": "**指标：** {v}",
        "macro_anchor": "**锚点：** {value}（截至 {as_of}；{warn}）",
        "macro_leading": "先行数据：{items}",
        "trend_h": "## 趋势分析",
        "trend_stage": "**S曲线阶段：** {v}",
        "trend_fad": "**持久趋势 or 短期热点：** {verdict} — {reason}",
        "trend_drivers": "驱动力：{items}",
        "trend_blockers": "阻力：{items}",
        "trend_outlook_h": "### 展望",
        "election_h": "## 选举预测",
        "election_race": "**选举：** {v}",
        "election_poll": "**民调锚点：** {value}（截至 {as_of}；{warn}）",
        "election_err": "**历史民调误差：** {v}",
        "election_win_h": "### 获胜概率",
        "box_h": "## 票房预测（对标影片法）",
        "box_film": "**影片：** {title}（{market}）",
        "box_comp_h": "### 对标影片",
        "box_range_h": "### 票房区间",
        "box_leading": "先行指标：{items}",
        "nature_h": "## 自然事件分析",
        "nature_sub": "**子类型：** {v}",
        "nature_boundary": "⚖️ **科学边界：** {v}",
        "nature_base": "**气候学基率：** {v}",
        "nature_mod": "调制因素：{items}",
        "nature_no_pred": "（本次不产生可校准预测）",
        "random_h": "## 🎲 这是纯随机事件，拒绝预测",
        "random_event": "**事件：** {v}",
        "random_why": "**为什么不可预测：** {v}",
        "random_ev": "**期望值数学：** {v}",
        "random_advice": "**理性建议：** {v}",
        "random_part": "💡 你的问题里可预测的部分：{v}",
        "random_lucky_h": "### 🎰 娱乐随机号（图个乐）",
        "random_lucky_note": "*号码由等概率真随机生成，中奖率与任何其他号码完全相同，不改变期望值。*",
        "no_log": "（不写入校准日志）",
        "meta_sysname": {"zodiac": "西方占星", "bazi": "八字命理", "yijing": "周易卦象",
                         "fengshui": "风水堪舆", "ziwei": "紫微斗数", "tarot": "塔罗"},
        "metaphysics_h": "## 🔮 玄学解读（{sys}）",
        "meta_symbols": "**用到的符号：** {items}",
        "meta_tendency": "**倾向：** {v}",
        "meta_advice": "**建议：** {v}",
        "meta_note": "（传统文化娱乐，不写入校准日志）",
        "industry_h": "## 💼 行业前瞻（{industry}）",
        "industry_profile": "**画像假设：** {v}",
        "industry_core_h": "### 核心判断",
        "industry_dir_h": "### 可执行方向",
        "industry_proj": "- **可开工项目**：{items}",
        "industry_tech": "- **技术选型**：{v}",
        "industry_region": "- **地域适配**：{v}",
        "industry_cost": "- **成本**：{v}",
        "industry_horizon": "- **见效周期**：{v}",
        "industry_avoid_h": "### ⛔ 别碰的坑",
        "industry_fail": "⚖️ **判断失效条件：** {v}",
        "industry_note": "（方向建议不写入校准日志）",
        "oracle_h": "## 🔮 元引擎：五路独立推理",
        "oracle_agg": "## 聚合结果：**{p}**",
        "oracle_disp": "方法间分歧度：{disp}（{agree}）",
        "cf_h": "## ⏪ 反事实推演：决策节点复盘",
        "cf_outcome": "**实际结局：** {v}",
        "cf_tl_h": "### 决策节点时间线",
        "cf_node_h": "#### {time}｜{node} — 翻转概率 {p} {tag}",
        "cf_hindsight": "🔸后见之明",
        "cf_actual": "- 实际：{v}",
        "cf_alt": "- 替代：{v}",
        "cf_down": "- 连锁推演：{v}",
        "cf_salvage": "## 🎯 最小挽救点：{node}",
        "cf_deep": "**深层结构原因：** {v}",
        "cf_note": "（反事实推演不写入校准日志）",
        "novel_h": "## 📖 长篇：《{title}》",
        "novel_logline": "**Logline：** {v}",
        "novel_bible_h": "### 故事圣经（全书脊柱）",
        "novel_world": "- **世界观**：{v}",
        "novel_conflict": "- **核心冲突引擎**：{v}",
        "novel_win": "- **胜利条件**：{v}",
        "novel_ceiling": "- **结构性宿命（主题）**：{v}",
        "novel_theme": "- **主题**：{v}",
        "novel_pov_h": "**POV 角色**",
        "novel_pov": "- **{name}**（{role}）：{arc}",
        "novel_outline_h": "### 全书章纲",
        "novel_outline": "- **第 {chapter} 章 {title}**（{pov}）：{beat} —— 转折：{turn}",
        "novel_main_h": "## 正文（本次成稿 {n} 章）",
        "novel_ch_h": "### 第 {chapter} 章　{title}",
        "novel_ch_pov": "*POV：{pov}*",
        "novel_note": "（长篇创作产物，不写入校准日志；状态账本已保存，可续写）",
        "screen_h": "## 🎬 剧本 + 分镜：《{title}》",
        "screen_logline": "**Logline：** {v}",
        "screen_style": "**整体视觉风格：** {v}",
        "screen_chars_h": "### 角色设定（AI 生成形象锚点）",
        "screen_char": "- **{name}**：{look}",
        "screen_scene_h": "### 第 {no} 场　{heading}",
        "screen_shots_h": "**分镜表**",
        "screen_table_h": "| 镜号 | 景别 | 机位 | 运镜 | 时长 | 画面 | 声音 | AI 生成提示词 |",
        "screen_total": "**全片共 {n} 场 / {m} 镜**",
        "screen_note": "（创作产物，不写入校准日志）",
        "strange_fic_h": "## 🎭 创作模式：情节生成器（破局决策树）",
        "strange_fic_win": "**主角的胜利条件：** {v}",
        "strange_fic_cand_h": "### 候选情节线（按戏剧张力排序）",
        "strange_fic_base": "（读者预期主线）",
        "strange_fic_branch": "#### {name}{base} — 戏剧合理度 {p}",
        "strange_fic_counter": "- 反派最强反击/转折：{v}",
        "strange_fic_weak": "- 主角命门（故事钩子）：{v}",
        "strange_fic_hybrid": "（复合结构）",
        "strange_fic_best": "## 🎬 推荐主线：{path}{hy}",
        "strange_fic_tone": "**故事基调：{v}**",
        "strange_fic_ceiling": "**结构性宿命（主题所在）：** {v}",
        "strange_fic_why": "**其他情节线为何逊色：** {v}",
        "strange_fic_core": "**故事内核：** {v}",
        "strange_fic_note": "（创作输出，不写入校准日志）",
        "strange_h": "## 🌀 破局搜索（决策树+对抗推演）",
        "strange_win": "**胜利条件：** {v}",
        "strange_branches_h": "### 各分支推演（按胜率排序）",
        "strange_base": "（基线）",
        "strange_branch": "#### {name}{base} — P(win) {p}",
        "strange_counter": "- 对手最强反制：{v}",
        "strange_weak": "- 致命脆弱点：{v}",
        "strange_hybrid": "（混合路径）",
        "strange_best": "## 🎯 最优破局：{path}{hy}",
        "strange_rate": "**胜率 {p} — 裁决：{v}**",
        "strange_ceiling": "**结构性天花板：** {v}",
        "strange_why": "**其他路径为何失败：** {v}",
        "conf_label": {"low": "低", "medium": "中", "high": "高"},
        "meta_conf": "- **置信度：** {v}",
        "meta_wwcm": "- **什么会改变判断：** {v}",
        "meta_ka": "- **关键假设：**",
        "meta_h": "### 🎯 预测质量",
    },
    "en": {
        "title": "# ForeSight Prediction Report",
        "search_ok": "- 🌐 Live search: connected, injected {count} results{date_note}",
        "search_ok_date": ", newest {date}",
        "search_fail": "- 🌐 Live search: no results this time; model knowledge only (may be stale)",
        "time": "- Time: {now}",
        "route": "- Route: `{domain}` ({reason})",
        "pid": "- Prediction ID: `{pid}` (resolve later with `resolve {pid} 1|0`)",
        "seed_h": "## Seed",
        "error_h": "## ⚠️ Error",
        "swarm_h": "## Opinion Simulation",
        "swarm_subject": "**Proposition:** {subject}",
        "swarm_subject_note": "(Support / Oppose / Wait-and-see below all refer to this proposition, not to any company or person.)",
        "swarm_crowd_h": "### Simulated Crowd",
        "swarm_persona": "- **{name}** ({age}, {bg}{bias_note})",
        "swarm_bias": ", lean: {bias}",
        "swarm_evo_h": "### Stance Evolution",
        "swarm_round": "- Round {round}: {dist}",
        "swarm_final_dist": "**Final distribution:** {split}",
        "swarm_dom": "**Dominant stance: {dom}{dom_note} — {prob}**",
        "swarm_dom_note": ' (on "{subject}")',
        "swarm_sample_h": "### Sampled Opinions",
        "quant_h": "## Quantitative Signals",
        "quant_source": "Data source: {source}",
        "quant_interp": "**Interpretation:** {interp}",
        "quant_range": "**20-day up-probability range: {lo} – {hi}**",
        "quant_risk": "**Key failure risk:** {risk}",
        "scenario_h": "## Scenario Tree",
        "scenario_base": "**Outside view (base rate):** {note}",
        "scenario_leading": "Leading indicators: {inds}",
        "key_q": "**Key question:** {q}",
        "prob": "**Probability: {p}**",
        "sports_t_h": "## 🏆 Tournament Prediction",
        "sports_t_name": "**Tournament:** {v}",
        "sports_t_stage": "**Stage:** {v}",
        "sports_base_h": "### Base-Rate Factors",
        "sports_title_h": "### Title Probabilities",
        "key_q_prob": "**Key question:** {q} ({p})",
        "sports_h": "## Match Analysis",
        "sports_match": "**Match:** {v}",
        "sports_out_h": "### Outcome Probabilities",
        "sports_odds": "\nOdds-implied probability (anchor): {v}",
        "macro_h": "## Macro Range Forecast",
        "macro_ind": "**Indicator:** {v}",
        "macro_anchor": "**Anchor:** {value} (as of {as_of}; {warn})",
        "macro_leading": "Leading data: {items}",
        "trend_h": "## Trend Analysis",
        "trend_stage": "**S-curve stage:** {v}",
        "trend_fad": "**Lasting trend or short-lived fad:** {verdict} — {reason}",
        "trend_drivers": "Drivers: {items}",
        "trend_blockers": "Blockers: {items}",
        "trend_outlook_h": "### Outlook",
        "election_h": "## Election Forecast",
        "election_race": "**Race:** {v}",
        "election_poll": "**Poll anchor:** {value} (as of {as_of}; {warn})",
        "election_err": "**Historical polling error:** {v}",
        "election_win_h": "### Win Probabilities",
        "box_h": "## Box-Office Forecast (comparables method)",
        "box_film": "**Film:** {title} ({market})",
        "box_comp_h": "### Comparable Films",
        "box_range_h": "### Gross Range",
        "box_leading": "Leading indicators: {items}",
        "nature_h": "## Natural-Event Analysis",
        "nature_sub": "**Subtype:** {v}",
        "nature_boundary": "⚖️ **Scientific boundary:** {v}",
        "nature_base": "**Climatological base rate:** {v}",
        "nature_mod": "Modulating factors: {items}",
        "nature_no_pred": "(No calibrated prediction this time)",
        "random_h": "## 🎲 This is a purely random event — no prediction",
        "random_event": "**Event:** {v}",
        "random_why": "**Why it is unpredictable:** {v}",
        "random_ev": "**Expected-value math:** {v}",
        "random_advice": "**Rational advice:** {v}",
        "random_part": "💡 The predictable part of your question: {v}",
        "random_lucky_h": "### 🎰 Fun random numbers (just for fun)",
        "random_lucky_note": "*Numbers are drawn uniformly at random; any other numbers have exactly the same chance, and the expected value is unchanged.*",
        "no_log": "(Not written to the calibration log)",
        "meta_sysname": {"zodiac": "Western astrology", "bazi": "BaZi", "yijing": "I Ching",
                         "fengshui": "Feng shui", "ziwei": "Zi Wei Dou Shu", "tarot": "Tarot"},
        "metaphysics_h": "## 🔮 Metaphysics Reading ({sys})",
        "meta_symbols": "**Symbols used:** {items}",
        "meta_tendency": "**Lean:** {v}",
        "meta_advice": "**Advice:** {v}",
        "meta_note": "(Traditional-culture entertainment; not written to the calibration log)",
        "industry_h": "## 💼 Industry Outlook ({industry})",
        "industry_profile": "**Profile assumptions:** {v}",
        "industry_core_h": "### Core Judgment",
        "industry_dir_h": "### Actionable Directions",
        "industry_proj": "- **Projects to start:** {items}",
        "industry_tech": "- **Tech stack:** {v}",
        "industry_region": "- **Regional fit:** {v}",
        "industry_cost": "- **Cost:** {v}",
        "industry_horizon": "- **Time to payoff:** {v}",
        "industry_avoid_h": "### ⛔ Pitfalls to Avoid",
        "industry_fail": "⚖️ **When this judgment fails:** {v}",
        "industry_note": "(Directional advice; not written to the calibration log)",
        "oracle_h": "## 🔮 Meta-Engine: Five Independent Lines of Reasoning",
        "oracle_agg": "## Aggregated Result: **{p}**",
        "oracle_disp": "Cross-method dispersion: {disp} ({agree})",
        "cf_h": "## ⏪ Counterfactual: Decision-Node Review",
        "cf_outcome": "**Actual outcome:** {v}",
        "cf_tl_h": "### Decision-Node Timeline",
        "cf_node_h": "#### {time} | {node} — flip probability {p} {tag}",
        "cf_hindsight": "🔸 Hindsight",
        "cf_actual": "- Actual: {v}",
        "cf_alt": "- Alternative: {v}",
        "cf_down": "- Downstream: {v}",
        "cf_salvage": "## 🎯 Minimal Salvage Point: {node}",
        "cf_deep": "**Deep structural cause:** {v}",
        "cf_note": "(Counterfactuals are not written to the calibration log)",
        "novel_h": "## 📖 Novel: “{title}”",
        "novel_logline": "**Logline:** {v}",
        "novel_bible_h": "### Story Bible (the book's spine)",
        "novel_world": "- **World:** {v}",
        "novel_conflict": "- **Core conflict engine:** {v}",
        "novel_win": "- **Win condition:** {v}",
        "novel_ceiling": "- **Structural fate (theme):** {v}",
        "novel_theme": "- **Theme:** {v}",
        "novel_pov_h": "**POV Characters**",
        "novel_pov": "- **{name}** ({role}): {arc}",
        "novel_outline_h": "### Full Outline",
        "novel_outline": "- **Chapter {chapter}: {title}** ({pov}): {beat} — Turn: {turn}",
        "novel_main_h": "## Main Text ({n} chapters drafted this time)",
        "novel_ch_h": "### Chapter {chapter}: {title}",
        "novel_ch_pov": "*POV: {pov}*",
        "novel_note": "(Novel output; not written to the calibration log. State ledger saved — can be continued.)",
        "screen_h": "## 🎬 Screenplay + Storyboard: “{title}”",
        "screen_logline": "**Logline:** {v}",
        "screen_style": "**Overall visual style:** {v}",
        "screen_chars_h": "### Characters (AI image anchors)",
        "screen_char": "- **{name}**: {look}",
        "screen_scene_h": "### Scene {no}: {heading}",
        "screen_shots_h": "**Shot List**",
        "screen_table_h": "| Shot | Size | Angle | Movement | Duration | Visual | Audio | AI Image Prompt |",
        "screen_total": "**Total: {n} scenes / {m} shots**",
        "screen_note": "(Creative output; not written to the calibration log)",
        "strange_fic_h": "## 🎭 Fiction Mode: Plot Generator (breakthrough decision tree)",
        "strange_fic_win": "**Protagonist's win condition:** {v}",
        "strange_fic_cand_h": "### Candidate Plot Lines (by dramatic tension)",
        "strange_fic_base": "(reader-expected main line)",
        "strange_fic_branch": "#### {name}{base} — dramatic plausibility {p}",
        "strange_fic_counter": "- Strongest antagonist counter / twist: {v}",
        "strange_fic_weak": "- Protagonist's weak spot (story hook): {v}",
        "strange_fic_hybrid": "(hybrid structure)",
        "strange_fic_best": "## 🎬 Recommended Main Line: {path}{hy}",
        "strange_fic_tone": "**Story tone: {v}**",
        "strange_fic_ceiling": "**Structural fate (where the theme lives):** {v}",
        "strange_fic_why": "**Why the other lines fall short:** {v}",
        "strange_fic_core": "**Story core:** {v}",
        "strange_fic_note": "(Creative output; not written to the calibration log)",
        "strange_h": "## 🌀 Breakthrough Search (decision tree + adversarial simulation)",
        "strange_win": "**Win condition:** {v}",
        "strange_branches_h": "### Branch Simulations (by win rate)",
        "strange_base": "(baseline)",
        "strange_branch": "#### {name}{base} — P(win) {p}",
        "strange_counter": "- Strongest counter-move: {v}",
        "strange_weak": "- Fatal weakness: {v}",
        "strange_hybrid": "(hybrid path)",
        "strange_best": "## 🎯 Best Breakthrough: {path}{hy}",
        "strange_rate": "**Win rate {p} — Verdict: {v}**",
        "strange_ceiling": "**Structural ceiling:** {v}",
        "strange_why": "**Why the other paths fail:** {v}",
        "conf_label": {"low": "Low", "medium": "Medium", "high": "High"},
        "meta_conf": "- **Confidence:** {v}",
        "meta_wwcm": "- **What would change my mind:** {v}",
        "meta_ka": "- **Key assumptions:**",
        "meta_h": "### 🎯 Forecast Quality",
    },
}


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


def render(seed: str, route: dict, result: dict, pid: str | None, locale: str = "zh") -> str:
    # Anything other than "en" is the old default Chinese output.
    S = _STR["en" if locale == "en" else "zh"]
    # Search transparency line: shows whether live web search actually ran
    # and injected fresh context, so a stale-looking answer can be told
    # apart from a silently-failed search.
    ss = result.get("search_status") if isinstance(result, dict) else None
    if ss and ss.get("attempted"):
        if ss.get("ok"):
            newest = _newest_date(ss.get("dates") or [])
            date_note = S["search_ok_date"].format(date=newest) if newest else ""
            search_line = S["search_ok"].format(count=ss.get("count", 0), date_note=date_note)
        else:
            search_line = S["search_fail"]
    else:
        search_line = ""

    lines = [
        S["title"],
        "",
        S["time"].format(now=time.strftime("%Y-%m-%d %H:%M")),
        S["route"].format(domain=route["domain"], reason=route.get("reason", "")),
        search_line,
        S["pid"].format(pid=pid) if pid else "",
        "",
        S["seed_h"],
        f"> {seed[:500]}",
        "",
    ]
    b = result.get("backend")

    if result.get("error"):
        lines += [S["error_h"], result["error"], result.get("hint", "")]

    elif b == "swarm":
        lines += [S["swarm_h"], ""]
        # Anchor what the stances are ABOUT. Without this, "反对 50%" reads
        # as "50% are negative on the company" when it may mean "50%
        # disagree with one specific claim". Show the proposition up front.
        subject = result.get("stance_subject", "")
        if subject:
            lines += [S["swarm_subject"].format(subject=subject), "",
                      S["swarm_subject_note"], ""]
        # Show who the simulated crowd was — the credibility of an
        # opinion simulation rests entirely on persona diversity, so a
        # report that hides the cast asks for blind trust.
        personas = result.get("personas", [])
        if personas:
            lines += [S["swarm_crowd_h"], ""]
            for p in personas[:12]:
                name = p.get("name", "")
                age = p.get("age", "")
                bg = p.get("background", "")
                bias = p.get("stance_bias", "")
                bias_note = S["swarm_bias"].format(bias=bias) if bias else ""
                lines.append(S["swarm_persona"].format(name=name, age=age, bg=bg, bias_note=bias_note))
            lines.append("")
        lines += [S["swarm_evo_h"], ""]
        for h in result["evolution"]:
            dist = "  ".join(f"{k} {v}" for k, v in h["distribution"].items())
            lines.append(S["swarm_round"].format(round=h["round"], dist=dist))
        # Final distribution as a clean split, not just the dominant one.
        fd = result.get("final_distribution", {})
        if fd:
            split = "　".join(f"{k} {to_prob(v):.0%}" for k, v in sorted(fd.items(), key=lambda x: -x[1]))
            lines += ["", S["swarm_final_dist"].format(split=split)]
        dom = result["dominant_stance"]
        dom_note = S["swarm_dom_note"].format(subject=subject) if subject else ""
        lines += ["", S["swarm_dom"].format(dom=dom, dom_note=dom_note, prob=f"{to_prob(result.get('probability')):.0%}"), "",
                  S["swarm_sample_h"]]
        lines += [f"- {c}" for c in result.get("sample_comments", [])]

    elif b == "quant":
        lines += [S["quant_h"], "", S["quant_source"].format(source=result["source"]), ""]
        for k, v in result["signals"].items():
            lines.append(f"- {k}：{v}")
        rng = result.get("probability_range") or [0, 0]
        lines += ["", S["quant_interp"].format(interp=result["interpretation"]), "",
                  S["quant_range"].format(lo=f"{to_prob(rng[0]):.0%}", hi=f"{to_prob(rng[1]):.0%}"), "",
                  S["quant_risk"].format(risk=result["key_risk"])]

    elif b == "scenario":
        lines += [S["scenario_h"], "", S["scenario_base"].format(note=result["base_rate_note"]), ""]
        for s in result["scenarios"]:
            lines.append(f"### {s['name']} — {s['probability']:.0%}")
            lines.append(s.get("description", ""))
            inds = s.get("indicators", [])
            if inds:
                lines.append(S["scenario_leading"].format(inds="；".join(inds)))
            lines.append("")
        lines += [S["key_q"].format(q=result["key_question"]),
                  S["prob"].format(p=f"{to_prob(result.get('probability')):.0%}")]

    elif b == "sports" and result.get("mode") == "tournament":
        lines += [S["sports_t_h"], "",
                  S["sports_t_name"].format(v=result.get("tournament", "")),
                  S["sports_t_stage"].format(v=result.get("stage", "")), "", S["sports_base_h"]]
        for f0 in result.get("base_rate_factors", []):
            lines.append(f"- {f0.get('factor','')}（{f0.get('certainty','')}）")
        lines += ["", S["sports_title_h"]]
        for c in result.get("contenders", []):
            lines.append(f"- **{c.get('name','')}**：{to_prob(c.get('probability')):.0%} — {c.get('rationale','')}")
        lines += ["", S["key_q_prob"].format(q=result.get("key_question", ""), p=f"{to_prob(result.get('probability')):.0%}")]

    elif b == "sports":
        lines += [S["sports_h"], "", S["sports_match"].format(v=result.get("match", "")), "", S["sports_base_h"]]
        for f0 in result.get("base_rate_factors", []):
            lines.append(f"- {f0.get('factor','')}（{f0.get('certainty','')}）")
        lines += ["", S["sports_out_h"]]
        for o in result.get("outcomes", []):
            rat = f" — {o['rationale']}" if o.get("rationale") else ""
            lines.append(f"- {o.get('name','')}：{to_prob(o.get('probability')):.0%}{rat}")
        if result.get("implied_from_odds"):
            lines.append(S["sports_odds"].format(v=result["implied_from_odds"]))
        lines += ["", S["key_q_prob"].format(q=result.get("key_question", ""), p=f"{to_prob(result.get('probability')):.0%}")]

    elif b == "macro":
        a = result.get("anchor", {}) or {}
        lines += [S["macro_h"], "", S["macro_ind"].format(v=result.get("indicator", "")),
                  S["macro_anchor"].format(value=a.get("value", "?"), as_of=a.get("as_of", "?"), warn=a.get("staleness_warning", "")), ""]
        for r in result.get("ranges", []):
            rat = f" — {r['rationale']}" if r.get("rationale") else ""
            lines.append(f"- {r.get('name','')} {r.get('range','')}：{to_prob(r.get('probability')):.0%}{rat}")
        ld = result.get("leading_data", [])
        if ld:
            lines += ["", S["macro_leading"].format(items="；".join(str(x) for x in ld))]
        lines += ["", S["key_q_prob"].format(q=result.get("key_question", ""), p=f"{to_prob(result.get('probability')):.0%}")]

    elif b == "trend":
        ft = result.get("fad_or_trend", {}) or {}
        lines += [S["trend_h"], "", S["trend_stage"].format(v=result.get("stage", "")),
                  S["trend_fad"].format(verdict=ft.get("verdict", ""), reason=ft.get("reason", "")), "",
                  S["trend_drivers"].format(items="；".join(str(x) for x in result.get("drivers", []))),
                  S["trend_blockers"].format(items="；".join(str(x) for x in result.get("blockers", []))), "", S["trend_outlook_h"]]
        for o in result.get("outlook", []):
            lines.append(f"- {o.get('horizon','')}：{o.get('direction','')} — {o.get('note','')}")
        lines += ["", S["key_q_prob"].format(q=result.get("key_question", ""), p=f"{to_prob(result.get('probability')):.0%}")]

    elif b == "election":
        a = result.get("poll_anchor", {}) or {}
        lines += [S["election_h"], "", S["election_race"].format(v=result.get("race", "")),
                  S["election_poll"].format(value=a.get("value", "?"), as_of=a.get("as_of", "?"), warn=a.get("staleness_warning", "")),
                  S["election_err"].format(v=result.get("historical_polling_error", "")), "", S["election_win_h"]]
        for o in result.get("outcomes", []):
            rat = f" — {o['rationale']}" if o.get("rationale") else ""
            lines.append(f"- {o.get('name','')}：{to_prob(o.get('probability')):.0%}{rat}")
        lines += ["", S["key_q_prob"].format(q=result.get("key_question", ""), p=f"{to_prob(result.get('probability')):.0%}")]

    elif b == "boxoffice":
        lines += [S["box_h"], "", S["box_film"].format(title=result.get("title", ""), market=result.get("market", "")),
                  "", S["box_comp_h"]]
        for c in result.get("comparables", []):
            lines.append(f"- {c.get('title','')}：{c.get('gross','')}（{c.get('note','')}）")
        lines += ["", S["box_range_h"]]
        for r in result.get("ranges", []):
            rat = f" — {r['rationale']}" if r.get("rationale") else ""
            lines.append(f"- {r.get('name','')} {r.get('range','')}：{to_prob(r.get('probability')):.0%}{rat}")
        li = result.get("leading_indicators", [])
        if li:
            lines += ["", S["box_leading"].format(items="；".join(str(x) for x in li))]
        lines += ["", S["key_q_prob"].format(q=result.get("key_question", ""), p=f"{to_prob(result.get('probability')):.0%}")]

    elif b == "nature":
        lines += [S["nature_h"], "", S["nature_sub"].format(v=result.get("sub_type", "")),
                  "", S["nature_boundary"].format(v=result.get("honest_note", "")), "",
                  S["nature_base"].format(v=result.get("climatology_base_rate", "")),
                  S["nature_mod"].format(items="；".join(str(x) for x in result.get("modulating_factors", [])))]
        if not result.get("no_prediction"):
            lines += ["", S["key_q_prob"].format(q=result.get("key_question", ""), p=f"{to_prob(result.get('probability')):.0%}")]
        else:
            lines += ["", S["nature_no_pred"]]

    elif b == "randomness":
        lines += [S["random_h"], "",
                  S["random_event"].format(v=result.get("game", "")),
                  S["random_why"].format(v=result.get("why_unpredictable", "")),
                  S["random_ev"].format(v=result.get("ev_math", "")),
                  S["random_advice"].format(v=result.get("rational_advice", ""))]
        if result.get("predictable_part"):
            lines += ["", S["random_part"].format(v=result["predictable_part"])]
        lucky = result.get("lucky_numbers", [])
        if lucky:
            picks = "　".join(
                f"{p.get('name','')} {' '.join(f'{n:02d}' for n in p.get('numbers', []))}"
                for p in lucky
            )
            lines += ["", S["random_lucky_h"],
                      picks,
                      S["random_lucky_note"]]
        lines += ["", S["no_log"]]

    elif b == "metaphysics":
        sysname = S["meta_sysname"].get(
            result.get("sub_system", ""), result.get("sub_system", ""))
        lines += [S["metaphysics_h"].format(sys=sysname), "",
                  result.get("reading", "")]
        syms = result.get("key_symbols", [])
        if syms:
            lines += ["", S["meta_symbols"].format(items="、".join(str(s) for s in syms))]
        lines += ["", S["meta_tendency"].format(v=result.get("tendency", "")),
                  S["meta_advice"].format(v=result.get("advice", "")), "",
                  f"⚖️ {result.get('honest_note','')}",
                  "", S["meta_note"]]

    elif b == "industry":
        lines += [S["industry_h"].format(industry=result.get("industry", "")), ""]
        if result.get("profile_note"):
            lines += [S["industry_profile"].format(v=result["profile_note"]), ""]
        lines += [S["industry_core_h"], result.get("outlook", ""), "",
                  S["industry_dir_h"]]
        for i, dd in enumerate(result.get("directions", []), 1):
            lines.append(f"#### {i}. {dd.get('name','')}")
            lines.append(dd.get("why", ""))
            projs = dd.get("projects", [])
            if projs:
                lines.append(S["industry_proj"].format(items="；".join(str(p) for p in projs)))
            if dd.get("tech"):
                lines.append(S["industry_tech"].format(v=dd["tech"]))
            if dd.get("region"):
                lines.append(S["industry_region"].format(v=dd["region"]))
            if dd.get("cost"):
                lines.append(S["industry_cost"].format(v=dd["cost"]))
            if dd.get("horizon"):
                lines.append(S["industry_horizon"].format(v=dd["horizon"]))
            lines.append("")
        avoid = result.get("avoid", [])
        if avoid:
            lines += [S["industry_avoid_h"]] + [f"- {a}" for a in avoid] + [""]
        lines += [S["industry_fail"].format(v=result.get("honest_note", "")),
                  "", S["industry_note"]]

    elif b == "oracle":
        lines += [S["oracle_h"], "", S["key_q"].format(q=result.get("key_question", "")), ""]
        for e in result.get("estimates", []):
            lines.append(f"### {e.get('method','')} → {to_prob(e.get('probability')):.0%}")
            lines.append(e.get("detail", ""))
            lines.append("")
        lines += [S["oracle_agg"].format(p=f"{to_prob(result.get('probability')):.0%}"),
                  S["oracle_disp"].format(disp=result.get("dispersion", "?"), agree=result.get("agreement", ""))]

    elif b == "counterfactual":
        lines += [S["cf_h"], "",
                  S["cf_outcome"].format(v=result.get("outcome", "")), "", S["cf_tl_h"]]
        for n in result.get("nodes", []):
            # The LLM writes knowability in the report language; accept
            # both ("当时可知" / "Knowable at the time") — but NOT
            # "only knowable in hindsight", which starts with "only".
            _k = str(n.get("knowable", ""))
            _knowable = _k == "当时可知" or _k.strip().lower().startswith("knowable")
            tag = "🟢" if _knowable else S["cf_hindsight"]
            lines.append(S["cf_node_h"].format(time=n.get("time", "?"), node=n.get("node", ""),
                                               p=f"{to_prob(n.get('flip_probability'), 0.3):.0%}", tag=tag))
            lines.append(S["cf_actual"].format(v=n.get("actual", "")))
            lines.append(S["cf_alt"].format(v=n.get("alternative", "")))
            lines.append(S["cf_down"].format(v=n.get("downstream", "")))
            lines.append("")
        sp = result.get("minimal_salvage_point", {}) or {}
        lines += [S["cf_salvage"].format(node=sp.get("node", "—")), sp.get("why", ""), "",
                  S["cf_deep"].format(v=result.get("deep_cause", "")), "", S["cf_note"]]

    elif b == "novelist":
        bible = result.get("bible", {}) or {}
        lines += [S["novel_h"].format(title=result.get("title", "")), "",
                  S["novel_logline"].format(v=result.get("logline", "")), "",
                  S["novel_bible_h"],
                  S["novel_world"].format(v=bible.get("world", "")),
                  S["novel_conflict"].format(v=bible.get("conflict_engine", "")),
                  S["novel_win"].format(v=bible.get("win_condition", "")),
                  S["novel_ceiling"].format(v=bible.get("structural_ceiling", "")),
                  S["novel_theme"].format(v=bible.get("theme", "")), "", S["novel_pov_h"]]
        for c in bible.get("pov_characters", []) or []:
            lines.append(S["novel_pov"].format(name=c.get("name", ""), role=c.get("role", ""), arc=c.get("arc", "")))
        lines += ["", S["novel_outline_h"]]
        for ch in result.get("outline", []) or []:
            lines.append(S["novel_outline"].format(chapter=ch.get("chapter", "?"), title=ch.get("title", ""),
                                                   pov=ch.get("pov", ""), beat=ch.get("beat", ""), turn=ch.get("turn", "")))
        lines += ["", "---", "", S["novel_main_h"].format(n=len(result.get("chapters", [])))]
        for ch in result.get("chapters", []) or []:
            lines += ["", S["novel_ch_h"].format(chapter=ch.get("chapter", "?"), title=ch.get("title", "")),
                      S["novel_ch_pov"].format(pov=ch.get("pov", "")), "", ch.get("prose", "")]
        lines += ["", "---", S["novel_note"]]

    elif b == "screenplay":
        lines += [S["screen_h"].format(title=result.get("title", "")), "",
                  S["screen_logline"].format(v=result.get("logline", "")),
                  S["screen_style"].format(v=result.get("style", "")), ""]
        chars = result.get("characters", [])
        if chars:
            lines.append(S["screen_chars_h"])
            for c in chars:
                lines.append(S["screen_char"].format(name=c.get("name", ""), look=c.get("look", "")))
            lines.append("")
        for sc in result.get("scenes", []):
            lines.append(S["screen_scene_h"].format(no=sc.get("scene_no", "?"), heading=sc.get("heading", "")))
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
                lines += ["", S["screen_shots_h"], "",
                          S["screen_table_h"],
                          "|---|---|---|---|---|---|---|---|"]
                for s in shots:
                    row = [str(s.get("shot_no", "")), s.get("size", ""), s.get("angle", ""),
                           s.get("movement", ""), f"{s.get('duration_sec','')}s",
                           s.get("description", ""), s.get("audio", ""), s.get("image_prompt", "")]
                    row = [str(x).replace("\n", " ").replace("|", "／") for x in row]
                    lines.append("| " + " | ".join(row) + " |")
            lines.append("")
        lines += [S["screen_total"].format(n=len(result.get("scenes", [])), m=result.get("total_shots", 0)),
                  "", S["screen_note"]]

    elif b == "strange" and result.get("fiction"):
        lines += [S["strange_fic_h"], "",
                  S["strange_fic_win"].format(v=result.get("win_condition", "")), "", S["strange_fic_cand_h"]]
        for p in result.get("branches", []):
            base = S["strange_fic_base"] if p.get("is_baseline") else ""
            lines.append(S["strange_fic_branch"].format(name=p.get("name", ""), base=base, p=f"{to_prob(p.get('p_win')):.0%}"))
            lines.append(S["strange_fic_counter"].format(v=p.get("counter_move", "")))
            lines.append(S["strange_fic_weak"].format(v=p.get("fatal_weakness", "")))
            lines.append("")
        hy = S["strange_fic_hybrid"] if result.get("is_hybrid") else ""
        lines += [S["strange_fic_best"].format(path=result.get("best_path", ""), hy=hy),
                  S["strange_fic_tone"].format(v=result.get("verdict", "")), "",
                  S["strange_fic_ceiling"].format(v=result.get("structural_ceiling", "")),
                  S["strange_fic_why"].format(v=result.get("why_others_fail", "")), "",
                  S["strange_fic_core"].format(v=result.get("key_question", "")), "",
                  S["strange_fic_note"]]

    elif b == "strange":
        lines += [S["strange_h"], "",
                  S["strange_win"].format(v=result.get("win_condition", "")), "", S["strange_branches_h"]]
        for p in result.get("branches", []):
            base = S["strange_base"] if p.get("is_baseline") else ""
            lines.append(S["strange_branch"].format(name=p.get("name", ""), base=base, p=f"{to_prob(p.get('p_win')):.0%}"))
            lines.append(S["strange_counter"].format(v=p.get("counter_move", "")))
            lines.append(S["strange_weak"].format(v=p.get("fatal_weakness", "")))
            lines.append("")
        hy = S["strange_hybrid"] if result.get("is_hybrid") else ""
        lines += [S["strange_best"].format(path=result.get("best_path", ""), hy=hy),
                  S["strange_rate"].format(p=f"{to_prob(result.get('probability')):.0%}", v=result.get("verdict", "")), "",
                  S["strange_ceiling"].format(v=result.get("structural_ceiling", "")),
                  S["strange_why"].format(v=result.get("why_others_fail", ""))]

    # Universal forecast-quality footer — rendered for ANY backend that
    # emits these fields, so every report gains a confidence band, a
    # "what would change my mind", and the key assumptions the estimate
    # rests on. Backends fill them via their prompts; absent fields are
    # skipped (graceful for creative / no-prediction modes).
    meta = []
    conf = result.get("confidence")
    if conf:
        label = S["conf_label"].get(str(conf).strip().lower(), str(conf))
        meta.append(S["meta_conf"].format(v=label))
    wwcm = result.get("what_would_change_my_mind")
    if wwcm:
        meta.append(S["meta_wwcm"].format(v=wwcm))
    ka = result.get("key_assumptions")
    if ka:
        if isinstance(ka, list):
            meta.append(S["meta_ka"])
            meta += [f"  - {a}" for a in ka if a]
        else:
            meta.append(f"{S['meta_ka']} {ka}")
    if meta:
        lines += ["", S["meta_h"]] + meta

    if result.get("caveat"):
        lines += ["", "---", f"⚠️ {result['caveat']}"]
    return "\n".join(lines)
