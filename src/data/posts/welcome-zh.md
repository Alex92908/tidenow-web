---
slug: hello-tidenow-zh
title: 我为什么做 TideNow
description: 两个月跟着 60+ 个热榜源跑下来，我对算法、对聚合站、对所谓"热点"有了一些新的判断。这是 TideNow 的初衷。
date: 2026-05-31
author: Alex
locale: zh
tags: [杂谈, 独立开发]
---

# 我为什么做 TideNow

我之前每天早上要开 8 个左右的标签页:Hacker News、Reddit、BBC、路透、微博、知乎、GitHub Trending、Product Hunt。同一条新闻经常在两个源里同时上榜,但角度完全不一样——HN 说是"内部文件泄露",微博说是"战略性官宣"。半杯咖啡的时间都耗在交叉验证哪个版本更接近真相。

TideNow 就是为了不再做这件事。

## 它实际上在做什么

60+ 个公开热榜源,并排展示,顶部一个"跨源热点"面板做并查集聚类。同一条新闻 5 分钟内在路透和微博都飙起来,会被合并成一个 cluster,带上两个源的徽章。**你能一眼看出哪条热搜是真正跨文化的现象(很少),哪条只是某个地区编辑的选择**。

整站 local-first:拖拽排序、置顶、隐藏、屏蔽关键词,全在浏览器本地存。无登录、无追踪(除了 Vercel Analytics),没有所谓"算法学习你的偏好然后反过来收割你"。

## 8 周得到的硬教训

聚合站被所有重要的分发渠道惩罚。搜索引擎把它当成 duplicate content。AdSense 第一次申请被直接拒,原因是精准但残酷的「low value content」。LLM 引用时永远去引上游,不引索引。所以**聚合站想在编辑层面有意义,只能在数据上做出观点**,光列出来不够。

这些 posts 就是干这个的。少说"TideNow 新闻",多写"60 个 feed 跑了一周到底看出什么"。

## 接下来

- 每周一篇跨源热点的地区差异比较
- 给每个源写一段编辑说明,讲它的立场和定位
- 大概会有一篇专门讲 TikTok TLS 指纹的坑——一下午调研得出的结论("Vercel 跑的 Node 拿不到 TikTok")值得记下来

想继续跟进:[/changelog](/changelog) 有每次更新的记录。[公开 JSON API](https://github.com/Alex92908/tidenow-web#public-json-api) 任何人都可以接。意见反馈 alex.chu0206@gmail.com,**反馈是我持续做这站的唯一理由**。
