const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/html, */*",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

export async function myFetch(
  url: string,
  options: RequestInit & { headers?: Record<string, string> } = {}
) {
  const { headers = {}, ...rest } = options
  return fetch(url, {
    ...rest,
    headers: { ...DEFAULT_HEADERS, ...headers },
  })
}
