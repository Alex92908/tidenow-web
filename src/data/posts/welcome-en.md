---
slug: hello-tidenow
title: Why I built TideNow
description: A few weeks tracking 60+ trending feeds taught me the algorithm I was building against. This is what I learned, and what TideNow is for.
date: 2026-05-31
author: Alex
locale: en
tags: [meta, indie-hacking]
---

# Why I built TideNow

I used to keep ~8 tabs open every morning: Hacker News, Reddit r/technology, BBC, Reuters, Weibo, Zhihu, GitHub Trending, Product Hunt. The same story would show up in two of them within an hour, but the framing was always different — what HN called a "leaked memo" Weibo treated as a strategic announcement. Half my coffee disappeared into manually triangulating which one was right.

TideNow exists because I got tired of that ritual.

## What it actually does

60+ public trending feeds, side by side, with a "trending across sources" panel at the top that does union-find clustering over titles. When the same story spikes on Reuters and Weibo within the same 5-minute window, it surfaces as one cluster with both source badges attached. You can tell at a glance whether a story is genuinely cross-cultural (rare) or just one regional outlet's editorial pick.

The site is local-first by design — drag-to-reorder, pin, hide, mute keywords, all stored in your browser. No login, no tracking beyond Vercel Analytics, no algorithm trying to learn your preferences and then weaponize them.

## The hard lesson from 8 weeks

Aggregators are punished by everything that matters for distribution. Search engines treat them as duplicate-content sites. AdSense bounced TideNow's first application with the brutally accurate "low value content." LLMs default to citing the upstream source, not the index. So the only way to make an aggregator matter editorially is to make a *take* on the data, not just relist it.

That's what these posts are. Less "TideNow news" and more "what 60 feeds running in parallel actually look like, this week."

## What's next

Weekly recaps comparing how cross-source stories diverge by region. A piece on every source explaining the editorial slant. Probably one post about the TikTok TLS-fingerprint rabbit hole, because I spent a full afternoon in it and the answer (you can't fetch TikTok from Node.js on Vercel) felt important to document.

If you want to follow along: the [/changelog](/changelog) page tracks every release. The [public JSON API](https://github.com/Alex92908/tidenow-web#public-json-api) is open for anyone building their own reader. Drop me a line at alex.chu0206@gmail.com — feedback is the only reason I keep shipping.
