"""lottery：中国彩票历史数据 + 可证伪的统计回测（多游戏）。

**立场先说清楚**（与 backends/randomness.py 同一条纪律）：
这些游戏都是均匀随机抽样。本模块**不是**用来提高中奖率的，
它是一台证伪机器：把流行选号法放进严格的 walk-forward 回测 + 排列检验，
用 p 值回答"它们到底有没有超出随机的表现"。预注册假设：没有。

两类游戏，结构本质不同，必须分开处理——套同一套引擎会得出错的结论：

  ● 选号型（set）：从 K 个号里选 n 个，不重复、不看顺序。
    双色球(33选6+16选1)、大乐透(35选5+12选2)、七乐彩(30选7)。
    分析：号码频率/遗漏/马尔可夫…，命中数服从超几何分布。

  ● 数字型（digit）：每位独立 0-9，可重复、看顺序。
    福彩3D(3位)、排列3(3位)、排列5(5位)、七星彩(7位)。
    "选9码"在这里毫无意义——正确的检验是每位数字是否均匀(df=9)，
    以及和值/跨度/组三组六这些形态是否偏离理论分布。

数据源：500.com 历史开奖表（gb2312）。注意它只提供号码本身，
选号型不含出球顺序（对集合统计无影响，中奖只看集合）。

台账隔离：本模块不写 predictions.jsonl。
"""
from __future__ import annotations

import csv
import os
import re
import time

import requests

# 本仓库里数据落在 src/data/lottery/（Next.js 侧 /api/lottery 直接读它，
# 且随部署一起走）。独立 foresight 仓库用的是 data/lottery/——
# 同一份模块靠这个路径差异适配两边。
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.environ.get("FORESIGHT_LOTTERY_DIR",
                          os.path.join(ROOT, "src", "data", "lottery"))
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

# path      : 500.com 路径段
# variant   : newinc（有 tbody#tdata）/ inc（整页 tr）/ tablelist（老表）
# kind      : set 选号型 / digit 数字型
# zones     : 选号型 —— [(名称, 号码上限, 选几个), ...]
# digits    : 数字型 —— 位数
# num_col   : 号码所在列（tablelist/inc 版是一个空格分隔的串）
GAMES = {
    "dlt": {"name": "超级大乐透", "path": "dlt", "variant": "newinc", "kind": "set",
            "zones": [("前区", 35, 5), ("后区", 12, 2)], "picks": [9, 3]},
    "ssq": {"name": "双色球", "path": "ssq", "variant": "newinc", "kind": "set",
            "zones": [("红球", 33, 6), ("蓝球", 16, 1)], "picks": [10, 4]},
    "qlc": {"name": "七乐彩", "path": "qlc", "variant": "tablelist", "kind": "set",
            "zones": [("基本号", 30, 7)], "picks": [12]},
    "fc3d": {"name": "福彩3D", "path": "sd", "variant": "inc", "kind": "digit", "digits": 3},
    "pl3": {"name": "排列3", "path": "pls", "variant": "inc", "kind": "digit", "digits": 3},
    "pl5": {"name": "排列5", "path": "plw", "variant": "inc", "kind": "digit", "digits": 5},
    "qxc": {"name": "七星彩", "path": "qxc", "variant": "inc", "kind": "digit", "digits": 7},
}


def csv_path(game: str) -> str:
    return os.path.join(DATA_DIR, f"{game}_history.csv")


def _url(g: dict) -> str:
    if g["variant"] == "newinc":
        return f"https://datachart.500.com/{g['path']}/history/newinc/history.php?start=00001&end=99999"
    if g["variant"] == "inc":
        return f"https://datachart.500.com/{g['path']}/history/inc/history.php?limit=100000"
    return f"https://datachart.500.com/{g['path']}/history/newinc/history.php?start=00001&end=99999"


def _cells(tr: str) -> list:
    return [re.sub(r"<[^>]+>|&nbsp;?", "", t).strip()
            for t in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]


def _rows_html(html: str, variant: str) -> list:
    if variant == "newinc":
        m = re.search(r'<tbody id="tdata">(.*?)</tbody>', html, re.S)
        if not m:
            raise ValueError("未找到 tbody#tdata（页面结构可能已变）")
        return re.findall(r"<tr[^>]*>(.*?)</tr>", m.group(1), re.S)
    if variant == "tablelist":
        m = re.search(r'id="tablelist".*?</table>', html, re.S)
        if not m:
            raise ValueError("未找到 #tablelist（页面结构可能已变）")
        return re.findall(r"<tr[^>]*>(.*?)</tr>", m.group(0), re.S)
    return re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S)


_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")


def fetch_history(game: str, fetcher=None, timeout: int = 45) -> list:
    """抓某个游戏的全量历史。返回按期号升序的 list[dict]。

    脏数据一律丢弃不猜：号码个数不对、越界、重复（选号型）、日期缺失的行直接跳过。
    """
    g = GAMES[game]
    if fetcher is not None:
        html = fetcher()
    else:
        resp = requests.get(_url(g), headers={"User-Agent": UA,
                                              "Referer": f"https://datachart.500.com/{g['path']}/"},
                            timeout=timeout)
        resp.raise_for_status()
        html = resp.content.decode("gb2312", errors="ignore")

    out = []
    for tr in _rows_html(html, g["variant"]):
        c = _cells(tr)
        if len(c) < 4 or not c[1][:2].isdigit():
            continue
        issue = c[1].strip()
        date = next((x for x in c if _DATE.fullmatch(x)), "")
        if not date:
            continue
        rec = {"期号": issue, "日期": date}

        if g["kind"] == "set":
            if g["variant"] == "newinc":
                total = sum(z[2] for z in g["zones"])
                nums = []
                for x in c[2:2 + total]:
                    if not x.isdigit():
                        break
                    nums.append(int(x))
            else:
                nums = [int(x) for x in c[2].split() if x.isdigit()]
            need = sum(z[2] for z in g["zones"])
            # 七乐彩表里号码串含 1 个特别号，取前 need 个基本号
            if len(nums) < need:
                continue
            nums = nums[:need]
            ok, i = True, 0
            for zname, zmax, zn in g["zones"]:
                part = sorted(nums[i:i + zn])
                if len(set(part)) != zn or not all(1 <= v <= zmax for v in part):
                    ok = False
                    break
                for j, v in enumerate(part):
                    rec[f"{zname}{j+1}"] = v
                i += zn
            if not ok:
                continue
        else:
            digs = [int(x) for x in c[2].split() if x.isdigit() and len(x) == 1]
            if len(digs) != g["digits"]:
                continue
            for j, v in enumerate(digs):
                rec[f"位{j+1}"] = v
            rec["和值"] = sum(digs)
            rec["跨度"] = max(digs) - min(digs)
        out.append(rec)

    out.sort(key=lambda r: r["期号"])
    return out


def fields(game: str) -> list:
    g = GAMES[game]
    f = ["期号", "日期"]
    if g["kind"] == "set":
        for zname, _, zn in g["zones"]:
            f += [f"{zname}{j+1}" for j in range(zn)]
    else:
        f += [f"位{j+1}" for j in range(g["digits"])] + ["和值", "跨度"]
    return f


def save_csv(game: str, rows: list, path: str | None = None) -> str:
    path = path or csv_path(game)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8-sig", newline="") as fp:
        w = csv.DictWriter(fp, fieldnames=fields(game))
        w.writeheader()
        w.writerows(rows)
    return path


def load_csv(game: str, path: str | None = None) -> list:
    path = path or csv_path(game)
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8-sig", newline="") as fp:
        rows = list(csv.DictReader(fp))
    for r in rows:
        for k, v in list(r.items()):
            if k not in ("期号", "日期") and v not in ("", None):
                r[k] = int(v)
    return rows


def update(game: str, fetcher=None, verbose: bool = True) -> dict:
    old = load_csv(game)
    seen = {r["期号"] for r in old}
    rows = fetch_history(game, fetcher=fetcher)
    if not rows:
        raise ValueError(f"{game}: 未解析到任何有效开奖记录")
    added = [r for r in rows if r["期号"] not in seen]
    path = save_csv(game, rows)
    info = {"game": game, "name": GAMES[game]["name"], "total": len(rows),
            "added": len(added), "path": path,
            "first": rows[0]["期号"], "last": rows[-1]["期号"],
            "first_date": rows[0]["日期"], "last_date": rows[-1]["日期"],
            "fetched_at": time.strftime("%Y-%m-%d %H:%M")}
    if verbose:
        print(f"{GAMES[game]['name']:8s} {info['total']:5d} 期"
              f"（{info['first']} {info['first_date']} → {info['last']} {info['last_date']}）"
              f" 新增 {info['added']}")
    return info


def update_all(games=None, verbose: bool = True) -> dict:
    out = {}
    for gid in (games or list(GAMES)):
        try:
            out[gid] = update(gid, verbose=verbose)
        except Exception as e:
            out[gid] = {"game": gid, "error": f"{type(e).__name__}: {e}"}
            if verbose:
                print(f"{GAMES[gid]['name']:8s} 失败：{type(e).__name__}: {e}")
    return out
