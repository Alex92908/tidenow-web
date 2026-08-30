"""大乐透回测引擎——纯计算，不做解释（解释归 AI / 报告层）。

核心设计（决定了整套系统的可信度）：
每个方法实现为 `f(M) -> S`，M 是 (N,K) 的 0/1 开奖矩阵，S 是 (N,K) 评分矩阵，
**硬约束：S[t] 只能由 M[:t] 决定**。这样一次向量化就算完整条 walk-forward，
既快（cumsum 级复杂度），又让"未来数据污染"变成可以自动检验的性质——
tests 里有一条：把 M[t:] 全部改掉，S[:t+1] 必须逐位不变。
凭"我很小心"保证无泄漏是不够的，得能被测出来。

预注册假设：所有方法 OOS 命中率与随机对照无显著差异，ROI 全负。
"""
from __future__ import annotations

import numpy as np

FRONT_MAX, FRONT_N, FRONT_PICK = 35, 5, 9
BACK_MAX, BACK_N, BACK_PICK = 12, 2, 3
TRAIN = 705          # 前 705 期训练，之后全部 OOS


# ---------- 数据 ----------

def to_matrix(rows: list, cols: list, K: int) -> np.ndarray:
    """开奖记录 → (N,K) uint8 矩阵。cols 是该区号码的字段名列表。

    泛化到任意选号型游戏：双色球红球(33选6)、七乐彩(30选7)、大乐透前区(35选5)
    走同一条路径，参数由调用方给出，方法内部再从矩阵自身推断——
    见 _drawn()：每行的 1 的个数就是该区每期开出几个号，不必层层传参。"""
    M = np.zeros((len(rows), K), dtype=np.uint8)
    for t, r in enumerate(rows):
        for c in cols:
            M[t, int(r[c]) - 1] = 1
    return M


def _drawn(M: np.ndarray) -> int:
    """每期开出几个号——直接从矩阵读，避免把游戏参数一路透传进每个方法。"""
    return int(M[0].sum())


def _shift(S: np.ndarray) -> np.ndarray:
    """把"含第 t 期"的统计量右移一行 → S[t] 只含 M[:t]。防未来泄漏的唯一出口，
    所有方法都必须经过它，别在别处自己造轮子。"""
    out = np.zeros_like(S, dtype=np.float64)
    out[1:] = S[:-1]
    return out


# ---------- 选号方法（每个都是 M -> S 的纯函数） ----------

def m_freq_hot(M):
    """历史累计频率，高者优先（"热号"派）。"""
    return _shift(np.cumsum(M, axis=0, dtype=np.float64))


def m_freq_cold(M):
    """历史累计频率，低者优先（"冷号补omission"派）。"""
    return -m_freq_hot(M)


def _last_seen(M):
    """每期每号的"当前遗漏"（进入第 t 期前距上次开出多少期），只用历史。

    向量化：last[t] = 截至 t 的最后一次出现下标（未出现为 -1），
    则进入 t 期时的遗漏 = (t-1) - last[t-1]，正好是 _shift(idx - last)。
    比逐期循环快一个量级——排列检验要跑 5000 次，这点差距是分钟级的。"""
    N, K = M.shape
    idx = np.arange(N, dtype=np.int64)[:, None]
    last = np.maximum.accumulate(np.where(M == 1, idx, -1), axis=0)
    return _shift((idx - last).astype(np.float64))


def m_omit_max(M):
    """当前遗漏最大者优先（"该补了"派）。"""
    return _last_seen(M)


def m_omit_min(M):
    """当前遗漏最小者优先（"追热"派）。"""
    return -_last_seen(M)


def _window_freq(M, w):
    C = np.cumsum(M, axis=0, dtype=np.float64)
    out = C.copy()
    out[w:] = C[w:] - C[:-w]
    return _shift(out)


def m_recent30(M):
    """近 30 期频率。"""
    return _window_freq(M, 30)


def m_recent100(M):
    """近 100 期频率。"""
    return _window_freq(M, 100)


def m_ewma(M, alpha=0.05):
    """指数加权频率：近期权重高，但不像窗口那样一刀切。

    s[t] = α·Σ_{u<t} (1-α)^(t-1-u)·M[u]。直接按定义做前缀和会溢出
    （(1-α)^-t 在 t 上千时爆掉），改用 scipy 的一阶 IIR 滤波；
    没有 scipy 时退回逐期递推（结果完全一致，只是慢）。"""
    F = M.astype(np.float64)
    try:
        from scipy.signal import lfilter
        s_full = lfilter([alpha], [1.0, -(1 - alpha)], F, axis=0)
        return _shift(s_full)
    except ImportError:
        N, K = M.shape
        out = np.zeros((N, K), dtype=np.float64)
        acc = np.zeros(K, dtype=np.float64)
        for t in range(N):
            out[t] = acc
            acc = (1 - alpha) * acc + alpha * F[t]
        return out


def m_bayes(M):
    """Dirichlet-Multinomial 后验均值（对称先验 α=1）。

    注意：这在数学上就是加了平滑的频率法，排名与 freq_hot 几乎同序——
    保留它是为了让"贝叶斯"这个名号在报告里被如实祛魅，而不是显得高级。"""
    C = _shift(np.cumsum(M, axis=0, dtype=np.float64))
    n = np.arange(M.shape[0], dtype=np.float64)[:, None]
    return (C + 1.0) / (n * _drawn(M) + M.shape[1])


def m_markov(M):
    """一阶马尔可夫：以"上期开出的号码"为条件，统计各号的历史共现频率。

    out[t] = M[t-1] @ C_t，其中 C_t = Σ_{s<t} outer(M[s-1], M[s])。

    这里**故意保留 Python 循环**。试过用 (N,K,K) 的累积外积做全向量化，
    结果既算错（多移了一位）又更慢——中间数组 2916×35×35×8B ≈ 285MB，
    分配开销远超省下的循环。每期只有 drawn 个非零元，逐期更新共现矩阵
    本来就是稀疏友好的写法，20ms 已经是合理量级。
    留着这段注释，免得下次又有人（包括我）想当然地去"优化"它。
    """
    N, K = M.shape
    out = np.zeros((N, K), dtype=np.float64)
    co = np.zeros((K, K), dtype=np.float64)
    for t in range(1, N):
        prev = np.flatnonzero(M[t - 1])
        if prev.size:
            out[t] = co[prev].sum(axis=0)
            co[np.ix_(prev, np.flatnonzero(M[t]))] += 1.0
    return out


def m_gap_ratio(M):
    """遗漏比：当前遗漏 / 该号历史平均间隔。>1 表示"欠账"，博补出。"""
    C = _shift(np.cumsum(M, axis=0, dtype=np.float64))
    n = np.arange(M.shape[0], dtype=np.float64)[:, None]
    mean_gap = np.where(C > 0, n / np.maximum(C, 1e-9), n + 1.0)
    return _last_seen(M) / np.maximum(mean_gap, 1e-9)


def m_chi_dev(M):
    """与均匀分布的偏离（观测 - 期望），正偏离优先。"""
    C = _shift(np.cumsum(M, axis=0, dtype=np.float64))
    n = np.arange(M.shape[0], dtype=np.float64)[:, None]
    return C - n * (_drawn(M) / M.shape[1])


def m_random(M, seed=0):
    """随机对照组——**整套系统的基准线**。任何方法跑不赢它就是没有信号。"""
    rng = np.random.default_rng(seed)
    return rng.random(M.shape)


# ---------- 融合 ----------

def _rank_norm(S):
    """按行转成 [0,1] 的秩分，消除各方法量纲差异。

    原来是 argsort(argsort(·))——两次全排序。第二次其实只是在求逆置换，
    用 put_along_axis 写回下标即可，省掉一次 O(K log K)。
    三个融合方法每次置换都要调它十几遍，这一下是数量级的差别。"""
    order = np.argsort(S, axis=1)
    ranks = np.empty(S.shape, dtype=np.float64)
    idx = np.broadcast_to(np.arange(S.shape[1], dtype=np.float64), S.shape)
    np.put_along_axis(ranks, order, idx, axis=1)
    return ranks / max(S.shape[1] - 1, 1)


def fuse_equal(mats, ranks=None):
    """等权投票：各方法秩分求和。"""
    R = ranks if ranks is not None else [_rank_norm(S) for S in mats]
    return sum(R) / len(R)


def fuse_topk(mats, k):
    """TopK 投票：每个方法只对自己的前 k 名投一票。"""
    total = np.zeros_like(mats[0], dtype=np.float64)
    for S in mats:
        thr = np.partition(S, -k, axis=1)[:, -k][:, None]
        total += (S >= thr).astype(np.float64)
    return total


def fuse_signal(mats, ranks=None):
    """信号强度加权：把秩分中心化后按|偏离|加权——观点越极端权重越大。"""
    R = ranks if ranks is not None else [_rank_norm(S) for S in mats]
    total = np.zeros_like(mats[0], dtype=np.float64)
    for Ri in R:
        c = Ri - 0.5
        total += c * np.abs(c)
    return total


def fuse_perf(mats, M, pick_k, train, warm=200, ranks=None, hits=None):
    """性能加权：用**截至上一期**的滚动命中率给各方法加权。

    权重也必须无未来信息——用 _shift 保证第 t 期的权重只由 <t 的表现决定。

    ranks/hits 可由调用方传入复用：置换循环里三个融合方法都要算秩分、
    而 hit_series 又要为每个基础方法各跑一遍 top_mask，重复算是最大单项开销。
    调用方一次算好传进来，比每个融合各算一遍省一半时间。
    """
    H = hits if hits is not None else np.stack([hit_series(S, M, pick_k) for S in mats])
    cum = np.cumsum(H, axis=1, dtype=np.float64)
    cnt = np.arange(1, H.shape[1] + 1, dtype=np.float64)[None, :]
    perf = _shift((cum / cnt).T).T
    perf = np.maximum(perf, 1e-9)
    perf[:, :warm] = 1.0
    w = perf / perf.sum(axis=0, keepdims=True)
    R = ranks if ranks is not None else [_rank_norm(S) for S in mats]
    return sum(w[i][:, None] * R[i] for i in range(len(R)))


def build_all_fusions(mats: dict, M, pick_k, train, exclude=("random",)) -> dict:
    """一次算好秩分与命中序列，四个融合共用——置换循环的主要提速点。"""
    names = [n for n in mats if n not in exclude]
    base = [mats[n] for n in names]
    ranks = [_rank_norm(S) for S in base]
    hits = np.stack([hit_series(S, M, pick_k) for S in base])
    return {"fuse_equal": fuse_equal(base, ranks=ranks),
            "fuse_topk": fuse_topk(base, pick_k),
            "fuse_signal": fuse_signal(base, ranks=ranks),
            "fuse_perf": fuse_perf(base, M, pick_k, train, ranks=ranks, hits=hits)}


# ---------- 评分 ----------

def top_mask(S, k):
    """每行取分数最高的 k 个 → (N,K) bool 选号掩码。"""
    idx = np.argpartition(-S, k - 1, axis=1)[:, :k]
    out = np.zeros(S.shape, dtype=bool)
    np.put_along_axis(out, idx, True, axis=1)
    return out


def hit_series(S, M, k):
    """每期命中个数（选出的 k 码里中了几个）。"""
    return (top_mask(S, k) & M.astype(bool)).sum(axis=1)


def evaluate(S, M, k, train=TRAIN):
    """OOS 命中统计。"""
    h = hit_series(S, M, k)[train:]
    return {"n": int(h.size), "mean_hits": float(h.mean()),
            "hit2": float((h >= 2).mean()), "hit3": float((h >= 3).mean()),
            "hit4": float((h >= 4).mean()), "hit5": float((h >= 5).mean()),
            "last30_mean": float(h[-30:].mean()) if h.size >= 30 else float("nan"),
            "series": h}


def expected_random_hits(K, drawn, pick):
    """随机选 pick 码的期望命中数（超几何分布均值）——解析基准线。"""
    return drawn * pick / K


# ---------- 排列检验 ----------
# 方法论要点（比"跑5000次"本身重要得多）：
# 行置换**不能**检验频率类方法——打乱期次顺序不改变各号码的总频次，
# freq_hot 在置换样本上会得到几乎相同的排名，p 值必然趋近 0.5 而显得"无信号"，
# 但那只是因为这个零假设根本没触及它所依赖的东西。所以要两套零假设：
#   null="rows"    ：打乱期次顺序 → 检验方法是否利用了**时序结构**
#                    （马尔可夫、遗漏、近期窗口靠这个吃饭）
#   null="uniform" ：按均匀分布重新生成开奖 → 检验是否利用了**号码级偏差**
#                    （频率、贝叶斯、卡方偏离靠这个吃饭）
# 一个方法只有在**它自己依赖的那套零假设**下显著，才算真有信号。

def make_uniform(N, K, drawn, rng):
    """按均匀分布生成 N 期开奖（每期 drawn 个互异号码）。"""
    R = rng.random((N, K))
    idx = np.argpartition(R, drawn - 1, axis=1)[:, :drawn]
    M = np.zeros((N, K), dtype=np.uint8)
    np.put_along_axis(M, idx, 1, axis=1)
    return M


def perm_test(method, M, k, train=TRAIN, n_perm=5000, seed=0,
              null="rows", drawn=None, lo=None, hi=None):
    """返回 {observed, null_mean, null_sd, p, n_perm, null}。

    统计量 = 指定区间内的平均命中数。p = 零分布中 ≥ 观测值的比例（单尾，
    加 1 平滑避免报出 p=0——5000 次置换的分辨率下限是 1/5001）。"""
    rng = np.random.default_rng(seed)
    N, K = M.shape
    drawn = drawn or _drawn(M)
    lo = train if lo is None else lo
    hi = N if hi is None else hi

    obs = float(hit_series(method(M), M, k)[lo:hi].mean())
    null_stats = np.empty(n_perm, dtype=np.float64)
    for i in range(n_perm):
        if null == "rows":
            Mp = M[rng.permutation(N)]
        else:
            Mp = make_uniform(N, K, drawn, rng)
        null_stats[i] = hit_series(method(Mp), Mp, k)[lo:hi].mean()
    p = float((np.sum(null_stats >= obs) + 1) / (n_perm + 1))
    return {"observed": obs, "null_mean": float(null_stats.mean()),
            "null_sd": float(null_stats.std()), "p": p,
            "n_perm": n_perm, "null": null, "seed": seed}


# ---------- 形态分析 ----------

def forms(rows: list) -> dict:
    """和值 / 跨度 / 奇偶比 / 大小比 / 三区比 / 012路 / AC值 的历史分布。"""
    F = np.array([[r[f"前{i}"] for i in range(1, 6)] for r in rows])
    out = {}
    out["和值"] = F.sum(axis=1)
    out["跨度"] = F.max(axis=1) - F.min(axis=1)
    out["奇数个数"] = (F % 2 == 1).sum(axis=1)
    out["大数个数"] = (F > 17).sum(axis=1)
    zone = np.digitize(F, [13, 25])                 # 1-12 / 13-24 / 25-35
    out["三区比"] = np.stack([(zone == z).sum(axis=1) for z in range(3)], axis=1)
    out["012路"] = np.stack([((F % 3) == r).sum(axis=1) for r in range(3)], axis=1)
    # AC值：两两差的相异个数 - (n-1)，衡量号码离散度
    n = F.shape[1]
    diffs = np.abs(F[:, :, None] - F[:, None, :])
    ac = np.array([len(np.unique(d[np.triu_indices(n, 1)])) - (n - 1) for d in diffs])
    out["AC值"] = ac
    return out


def form_summary(rows: list) -> dict:
    f = forms(rows)
    def stat(a):
        return {"mean": float(np.mean(a)), "std": float(np.std(a)),
                "min": int(np.min(a)), "max": int(np.max(a)),
                "p10": float(np.percentile(a, 10)), "p90": float(np.percentile(a, 90))}
    return {"和值": stat(f["和值"]), "跨度": stat(f["跨度"]),
            "奇数个数": stat(f["奇数个数"]), "大数个数": stat(f["大数个数"]),
            "AC值": stat(f["AC值"]),
            "三区比均值": f["三区比"].mean(axis=0).round(3).tolist(),
            "012路均值": f["012路"].mean(axis=0).round(3).tolist()}


# ---------- 组合枚举（向量化） ----------

def enumerate_combos(K=FRONT_MAX, n=FRONT_N) -> np.ndarray:
    """C(K,n) 全组合，(C,n) int8。C(35,5)=324632。用 numpy 递归构造，无 Python 循环嵌套。"""
    from itertools import combinations
    return np.fromiter((x for c in combinations(range(K), n) for x in c),
                       dtype=np.int8).reshape(-1, n)


def combo_hit_distribution(picks: np.ndarray, drawn_mask: np.ndarray) -> np.ndarray:
    """给定选号掩码下所有组合的命中数分布（向量化，无循环）。"""
    return drawn_mask[picks].sum(axis=1)


METHODS = {
    "freq_hot": m_freq_hot, "freq_cold": m_freq_cold,
    "omit_max": m_omit_max, "omit_min": m_omit_min,
    "recent30": m_recent30, "recent100": m_recent100,
    "ewma": m_ewma, "bayes": m_bayes, "markov": m_markov,
    "gap_ratio": m_gap_ratio, "chi_dev": m_chi_dev, "random": m_random,
}


# ---------- 数字型游戏（福彩3D / 排列3 / 排列5 / 七星彩） ----------
# 结构与选号型本质不同：每位独立 0-9、可重复、看顺序。
# "选9码"在这里没有意义，正确的问题是：
#   1) 每一位的数字分布是否均匀（df=9）；
#   2) 位与位之间是否独立（列联表检验）；
#   3) 和值/跨度/组三组六等"形态"是否偏离理论分布——
#      彩民常据此选号，但理论分布本身就不均匀（和值13-14最常见是组合数决定的，
#      不是"规律"），所以必须跟**理论值**比，而不是跟均匀分布比。

def digit_matrix(rows: list, n_digits: int) -> np.ndarray:
    """(N, n_digits) int8，每个元素 0-9。"""
    return np.array([[r[f"位{i+1}"] for i in range(n_digits)] for r in rows], dtype=np.int8)


def digit_uniformity(D: np.ndarray) -> dict:
    """每位的卡方均匀性检验（df=9）。"""
    N, nd = D.shape
    exp = N / 10.0
    out = []
    for i in range(nd):
        cnt = np.bincount(D[:, i], minlength=10).astype(float)
        chi2 = float(((cnt - exp) ** 2 / exp).sum())
        out.append({"pos": i + 1, "chi2": round(chi2, 2), "df": 9,
                    "counts": cnt.astype(int).tolist(),
                    "max_digit": int(cnt.argmax()), "min_digit": int(cnt.argmin())})
    return {"n": N, "per_position": out,
            "total_chi2": round(sum(o["chi2"] for o in out), 2),
            "total_df": 9 * nd}


def digit_independence(D: np.ndarray) -> dict:
    """相邻位之间的独立性（10×10 列联表，df=81）。

    "上期出过X，下期容易出Y"这类说法，检验的就是这个。"""
    N, nd = D.shape
    out = []
    for i in range(nd - 1):
        tab = np.zeros((10, 10), dtype=float)
        np.add.at(tab, (D[:, i], D[:, i + 1]), 1)
        row, col = tab.sum(1, keepdims=True), tab.sum(0, keepdims=True)
        exp = row @ col / N
        chi2 = float(((tab - exp) ** 2 / np.maximum(exp, 1e-9)).sum())
        out.append({"pair": f"位{i+1}-位{i+2}", "chi2": round(chi2, 2), "df": 81})
    return {"pairs": out}


def digit_serial(D: np.ndarray) -> dict:
    """期间序列相关：本期某位与上期同位的转移是否偏离独立（df=81）。

    这是数字型游戏版本的"马尔可夫"——检验有没有期与期之间的记忆。"""
    N, nd = D.shape
    out = []
    for i in range(nd):
        tab = np.zeros((10, 10), dtype=float)
        np.add.at(tab, (D[:-1, i], D[1:, i]), 1)
        n = tab.sum()
        row, col = tab.sum(1, keepdims=True), tab.sum(0, keepdims=True)
        exp = row @ col / n
        chi2 = float(((tab - exp) ** 2 / np.maximum(exp, 1e-9)).sum())
        out.append({"pos": i + 1, "chi2": round(chi2, 2), "df": 81})
    return {"per_position": out}


def digit_sum_theory(nd: int) -> np.ndarray:
    """和值的理论分布（nd 位各自 0-9 独立均匀的卷积）——纯组合数学，非经验。"""
    p = np.ones(1)
    unit = np.ones(10) / 10.0
    for _ in range(nd):
        p = np.convolve(p, unit)
    return p


def digit_forms(D: np.ndarray) -> dict:
    """和值/跨度与理论分布的比较，以及 3 位游戏的组三/组六比例。"""
    N, nd = D.shape
    s = D.sum(axis=1)
    theo = digit_sum_theory(nd)
    obs = np.bincount(s, minlength=len(theo)).astype(float)
    exp = theo * N
    keep = exp >= 5                     # 卡方要求期望频数≥5，尾部合并前先剔除
    chi2 = float(((obs[keep] - exp[keep]) ** 2 / exp[keep]).sum())
    out = {"sum_mean": float(s.mean()), "sum_theory_mean": float(4.5 * nd),
           "sum_chi2": round(chi2, 2), "sum_df": int(keep.sum() - 1),
           "span_mean": float((D.max(axis=1) - D.min(axis=1)).mean())}
    if nd == 3:
        # 组三=恰有两位相同，组六=三位互异，豹子=三位相同
        uniq = np.array([len(set(r.tolist())) for r in D])
        n3, n6, nb = int((uniq == 2).sum()), int((uniq == 3).sum()), int((uniq == 1).sum())
        out["组选"] = {"组三": n3, "组六": n6, "豹子": nb,
                       "组三理论": round(N * 0.27, 1), "组六理论": round(N * 0.72, 1),
                       "豹子理论": round(N * 0.01, 1)}
    return out


def chi2_sf(chi2: float, df: int) -> float:
    """卡方分布上尾概率。优先用 scipy；没有则用 Wilson-Hilferty 正态近似
    （df≥10 时误差可忽略，本模块的 df 都在 9 以上）。"""
    try:
        from scipy.stats import chi2 as _c
        return float(_c.sf(chi2, df))
    except ImportError:
        from statistics import NormalDist
        z = ((chi2 / df) ** (1 / 3) - (1 - 2 / (9 * df))) / np.sqrt(2 / (9 * df))
        return float(1 - NormalDist().cdf(z))


# 方法中文名。英文是代码标识符（跨端对照用），中文才是给人看的。
# 命名原则：说清楚"它凭什么选号"，而不是音译术语——
# "马尔可夫"四个字对多数人等于没说，"看上期关联"才是它实际在做的事。
METHOD_LABELS = {
    "freq_hot":    "热号（历史出得多）",
    "freq_cold":   "冷号（历史出得少）",
    "omit_max":    "遗漏最久（最久没出）",
    "omit_min":    "最近刚出",
    "recent30":    "近30期热号",
    "recent100":   "近100期热号",
    "ewma":        "近期加权（越近权重越高）",
    "bayes":       "贝叶斯平滑（本质仍是频率）",
    "markov":      "看上期关联",
    "gap_ratio":   "欠账程度（遗漏÷平均间隔）",
    "chi_dev":     "偏离均匀程度",
    "random":      "随机对照组 ← 基准线",
    "fuse_equal":  "融合·等权投票",
    "fuse_topk":   "融合·TopK投票",
    "fuse_signal": "融合·信号强度加权",
    "fuse_perf":   "融合·按历史表现加权",
}
