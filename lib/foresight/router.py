"""领域路由器：判断种子信息属于哪个领域，路由到对应预测后端。

- opinion  : 舆情 / 娱乐 / 社会事件 / 传播 / 口碑     → 多智能体仿真 (swarm)
- market   : 股票 / 期货 / 加密 / 商品价格            → 量化信号 (quant)
- scenario : 军事 / 外交 / 地缘 / 政策 / 科技突破     → 情景树分析 (scenario)
- sports   : 体育赛事胜负                              → 基率+赔率锚点 (sports)
- macro    : CPI / 利率 / 汇率 / GDP / 就业            → 区间预测 (macro)
- trend    : 消费趋势 / 衣食住行 / 产品采用 / 生活方式 → S曲线分析 (trend)
"""
from __future__ import annotations


DOMAINS = ("opinion", "market", "scenario", "sports", "macro", "trend",
           "election", "boxoffice", "nature", "randomness", "counterfactual",
           "metaphysics", "industry")

ROUTER_PROMPT = """你是一个预测任务分类器。根据种子信息，判断它属于哪类预测任务：

- "opinion"  ：舆论走向、娱乐事件、影视口碑、社会热点传播、品牌公关——本质是"人群如何反应"
- "market"   ：具体股票、期货、加密货币、商品的价格走势——本质是"某个标的价格如何变化"
- "scenario" ：军事冲突、外交博弈、地缘政治、科技突破、政策走向——本质是"宏观事件如何演化"
- "sports"   ：体育比赛胜负、赛季排名、球员表现
- "macro"    ：宏观经济指标——CPI、利率、汇率、GDP、失业率、房价指数等
- "trend"    ：消费趋势、生活方式、产品/品类的流行度走向（衣食住行、新产品采用）
- "election" ：选举、公投、党内投票等有民调锚点的政治投票事件
- "boxoffice"：电影/剧集的票房或播放量表现
- "nature"   ：天气、气候、台风、地震等自然事件
- "randomness"：彩票号码、轮盘、骰子等数学上纯随机的事件
- "counterfactual"：已发生事件的复盘推演——"如果当初""哪一步走错了""在哪个环节还能挽救"（历史事件、投资复盘、项目失败分析）
- "metaphysics"：星座运势、八字命理、周易卦象、风水、紫微斗数、塔罗——传统玄学/命理解读（娱乐性质）
- "industry"  ：行业前景、职业/转型选择、"该做什么项目/产品"、技术选型（如"前端还有前途吗""做什么游戏好""用Unity还是UE"）

注意区分：问"茅台股价" → market；问"白酒消费是否复苏" → trend 或 macro；
问"央行是否降息" → macro；问"降息对市场的连锁影响" → scenario；
问"某电影好不好看/口碑" → opinion，问"某电影票房多少" → boxoffice；
问"大选谁赢" → election，问"选举结果对外交的影响" → scenario；
电竞比赛胜负 → sports。

只返回 JSON：{"domain": "opinion|market|scenario|sports|macro|trend|election|boxoffice|nature|randomness|counterfactual|metaphysics|industry", "reason": "一句话理由"}

种子信息：
"""


def classify(llm, seed: str, forced: str | None = None) -> dict:
    if forced and forced != "auto":
        if forced not in DOMAINS:
            return {"domain": "scenario", "reason": f"未知领域 {forced}，回退到 scenario"}
        return {"domain": forced, "reason": "用户指定"}
    try:
        result = llm.chat_json(
            [{"role": "user", "content": ROUTER_PROMPT + seed[:2000]}],
            temperature=0.0,
        )
    except Exception as e:
        return {"domain": "scenario", "reason": f"路由失败（{type(e).__name__}），回退到 scenario"}
    if not isinstance(result, dict):
        return {"domain": "scenario", "reason": "路由返回格式异常，回退到 scenario"}
    domain = result.get("domain", "scenario")
    if domain not in DOMAINS:
        domain = "scenario"
    return {"domain": domain, "reason": result.get("reason", "")}
