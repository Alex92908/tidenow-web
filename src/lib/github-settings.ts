// GitHub Personal Access Token for one-click publish from /compose.
// Same BYO pattern as src/lib/ai-settings.ts: the token lives ONLY in
// this browser's localStorage — it is never sent to our server (the
// publish call goes straight from the browser to api.github.com).
// The token only needs Contents: read + write on Alex92908/tidenow-web
// (fine-grained) or `repo` scope (classic). Without it, Publish falls
// back to the download-the-.md flow.

const STORAGE_KEY = "tidenow-github-token"

export function getGitHubToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function saveGitHubToken(token: string) {
  localStorage.setItem(STORAGE_KEY, token)
}

export function clearGitHubToken() {
  localStorage.removeItem(STORAGE_KEY)
}
