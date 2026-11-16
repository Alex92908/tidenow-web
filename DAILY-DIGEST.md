# Daily digest — automatic daily hot-topics roundup

Every day at **00:00 UTC (08:00 Beijing)**, Vercel Cron calls
`GET /api/cron/daily-digest`. The route:

1. Takes the day's trending topics from the site's own sources (the same
   cross-source clustering the Trending panel uses — `src/lib/aggregate.ts`).
2. Has AI write a roundup in **EN + ZH** (intro, one section per top story
   with the outlets that covered it, a closing "why it matters" take).
3. Commits both `.md` files to `src/data/posts/` via the GitHub Contents
   API. Vercel auto-deploys on push, so the posts go live within minutes.
4. Past roundups stay browsable at **/posts/daily** ("📅 往期日报").

No human clicks anything. If a day has too few topics (< 3 per locale),
or today's digest already exists, the route publishes **nothing**.

## Env vars — add these in the Vercel dashboard

Project → Settings → Environment Variables (Production). Redeploy once
after adding them (or wait for the next push).

| Variable | Value | Notes |
|---|---|---|
| `CRON_SECRET` | any random string, e.g. `openssl rand -hex 16` | **Required.** Vercel Cron automatically sends it as `Authorization: Bearer <secret>`. The route refuses to run without it. |
| `DIGEST_AI_PROVIDER` | `deepseek` (default) | `deepseek` \| `openai` \| `anthropic` \| `zhipu` \| `gemini` |
| `DIGEST_AI_KEY` | the provider API key | DeepSeek (cheapest): https://platform.deepseek.com/api_keys — `deepseek-chat`, ~$0.14 / 1M input tokens; one digest ≈ a few cents a month. OpenAI: https://platform.openai.com/api-keys (`gpt-4o-mini`). Anthropic: https://console.anthropic.com/settings/keys. 智谱： https://open.bigmodel.cn/usercenter/apikeys. Gemini: https://aistudio.google.com/app/apikey. |
| `DIGEST_GITHUB_TOKEN` | fine-grained token | https://github.com/settings/tokens?type=beta — only `Alex92908/tidenow-web`, **Contents: Read and write**. The same kind of token the /compose one-click publish uses; you can reuse that token. |

## How to test before the first auto-post

```bash
# Dry run — generates both posts, publishes NOTHING:
curl "https://www.tide-now.com/api/cron/daily-digest?dry=1&secret=YOUR_CRON_SECRET"
# Same, but with a canned test body instead of calling the AI:
curl "https://www.tide-now.com/api/cron/daily-digest?dry=1&stub=1&secret=YOUR_CRON_SECRET"
```

The response contains both generated `.md` files — read them before
letting the cron run live. Vercel → Logs shows each run's outcome
(`[daily-digest] ...` lines).

## Behaviour notes

- **Slugs**: `daily-YYYY-MM-DD` (EN) and `daily-YYYY-MM-DD-zh` (ZH).
  The two locales need distinct slugs because post lookup is by slug.
- **Idempotent**: if either of today's files already exists in the repo,
  the run returns `{skipped: "already-published"}` and changes nothing.
- **Archive**: `/posts/daily` lists only posts tagged `daily-digest`,
  grouped by month, newest first. Digests are regular posts, so they also
  appear in the normal /posts index.
- **First run**: the next 00:00 UTC after the env vars are set. The first
  digest appears on the site a few minutes after that (Vercel rebuild).
- **Cost**: one DeepSeek `deepseek-chat` call per locale per day — a few
  cents a month at most. No other cost.
- **Never logged**: `CRON_SECRET`, `DIGEST_AI_KEY`,
  `DIGEST_GITHUB_TOKEN` are never written to logs or responses.
